const AVATARS = ["🦊", "🐼", "🐸", "🦄", "🐯", "🦁", "🐻", "🐨", "🐶", "🐱", "🦉", "🐧", "🐢", "🦖", "🐙", "🦋"];
const STORAGE_KEY = "tokenArena.player";
const TRANSFER_AMOUNT = 5;
const el = (id) => document.getElementById(id);

let myPlayer = null;
let players = [];
let netPairs = {};
let roster = {};
let pollHandle = null;
let selectedAvatar = null;
let pendingGainerId = null;
let pendingLoserId = null;

function genId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  el(`screen-${name}`).classList.add("active");
}

async function api(payload) {
  await fetch(CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

async function fetchState() {
  const res = await fetch(CONFIG.API_URL, { cache: "no-store" });
  return res.json();
}

/* ---------------- login ---------------- */

function renderAvatarGrid() {
  const grid = el("avatar-grid");
  grid.innerHTML = "";
  AVATARS.forEach((av) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-btn";
    btn.textContent = av;
    btn.addEventListener("click", () => {
      selectedAvatar = av;
      grid.querySelectorAll(".avatar-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      updateJoinEnabled();
    });
    grid.appendChild(btn);
  });
}

function updateJoinEnabled() {
  el("btn-join").disabled = !(el("f-name").value.trim() && selectedAvatar);
}

async function joinGame(name, avatar) {
  myPlayer = { id: genId(), name, avatar };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(myPlayer));
  await api({ action: "join", id: myPlayer.id, name: myPlayer.name, avatar: myPlayer.avatar });
  enterBoard();
}

/* ---------------- board ---------------- */

async function enterBoard() {
  showScreen("board");
  await refresh();
  clearInterval(pollHandle);
  pollHandle = setInterval(refresh, CONFIG.POLL_MS || 2000);
}

async function refresh() {
  try {
    const data = await fetchState();
    players = data.players || [];
    netPairs = data.netPairs || {};
    roster = data.roster || {};
    renderBoard();
    renderSelectionBar();
    el("last-updated").textContent = "อัปเดตล่าสุด " + new Date().toLocaleTimeString("th-TH");
  } catch (e) {
    el("last-updated").textContent = "โหลดข้อมูลไม่สำเร็จ: " + e.message;
  }
}

function playerName(id) {
  const p = players.find((x) => x.id === id);
  if (p) return p.name;
  if (roster[id]) return roster[id].name + " (ออกจากเกมแล้ว)";
  return "ไม่ทราบชื่อ";
}

function playerAvatar(id) {
  const p = players.find((x) => x.id === id);
  if (p) return p.avatar;
  if (roster[id]) return roster[id].avatar;
  return "❓";
}

function renderBoard() {
  const sorted = [...players].sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
  const grid = el("player-grid");
  grid.innerHTML = "";
  sorted.forEach((p) => {
    const isMe = myPlayer && p.id === myPlayer.id;
    const tokens = p.tokens || 0;
    const card = document.createElement("div");
    card.className =
      "player-card" +
      (isMe ? " me" : "") +
      (tokens > 0 ? " pos" : tokens < 0 ? " neg" : "") +
      (pendingGainerId === p.id ? " picked-gain" : "") +
      (pendingLoserId === p.id ? " picked-lose" : "");
    card.innerHTML = `
      <div class="avatar-big">${p.avatar}</div>
      <div class="p-name">${escapeHtml(p.name)}${isMe ? ' <span class="you-tag">(คุณ)</span>' : ""}</div>
      <div class="p-tokens">${tokens}</div>
      <div class="controls">
        <button type="button" class="fx-btn fire-btn" data-id="${p.id}" data-role="gain" aria-label="ให้ ${TRANSFER_AMOUNT}">🔥<span class="fx-label">+${TRANSFER_AMOUNT}</span></button>
        <button type="button" class="fx-btn ice-btn" data-id="${p.id}" data-role="lose" aria-label="ริบ ${TRANSFER_AMOUNT}">❄️<span class="fx-label">-${TRANSFER_AMOUNT}</span></button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".fx-btn").forEach((btn) => {
    btn.addEventListener("click", () => onPick(btn.dataset.role, btn.dataset.id, btn));
  });
}

function renderSelectionBar() {
  const bar = el("selection-bar");
  if (!pendingGainerId && !pendingLoserId) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  el("pick-gain-label").textContent = pendingGainerId ? playerName(pendingGainerId) : "ยังไม่เลือก";
  el("pick-lose-label").textContent = pendingLoserId ? playerName(pendingLoserId) : "ยังไม่เลือก";
}

function onPick(role, id, btnEl) {
  if (role === "gain") {
    pendingGainerId = pendingGainerId === id ? null : id;
  } else {
    pendingLoserId = pendingLoserId === id ? null : id;
  }

  if (pendingGainerId && pendingLoserId) {
    if (pendingGainerId === pendingLoserId) {
      // same player picked for both — invalid, reset and let them retry
      pendingGainerId = null;
      pendingLoserId = null;
      renderBoard();
      renderSelectionBar();
      return;
    }
    executeTransfer(pendingGainerId, pendingLoserId, btnEl);
    return;
  }

  renderBoard();
  renderSelectionBar();
}

function executeTransfer(gainerId, loserId, btnEl) {
  const gainer = players.find((p) => p.id === gainerId);
  const loser = players.find((p) => p.id === loserId);
  if (gainer) gainer.tokens = (gainer.tokens || 0) + TRANSFER_AMOUNT;
  if (loser) loser.tokens = (loser.tokens || 0) - TRANSFER_AMOUNT;

  const key = gainerId < loserId ? `${gainerId}|${loserId}` : `${loserId}|${gainerId}`;
  const sign = gainerId < loserId ? 1 : -1;
  netPairs[key] = (netPairs[key] || 0) + sign * TRANSFER_AMOUNT;

  pendingGainerId = null;
  pendingLoserId = null;
  renderBoard();
  renderSelectionBar();

  if (btnEl) {
    btnEl.classList.add("burst");
    setTimeout(() => btnEl.classList.remove("burst"), 400);
  }

  api({ action: "transfer", gainerId, loserId, amount: TRANSFER_AMOUNT });
}

function cancelSelection() {
  pendingGainerId = null;
  pendingLoserId = null;
  renderBoard();
  renderSelectionBar();
}

/* ---------------- summary ---------------- */

function openSummary() {
  const rows = Object.keys(netPairs)
    .map((key) => {
      const [idA, idB] = key.split("|");
      const net = netPairs[key];
      const gainerId = net > 0 ? idA : idB;
      const loserId = net > 0 ? idB : idA;
      return { gainerId, loserId, amount: Math.abs(net) };
    })
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const list = el("summary-list");
  if (!rows.length) {
    list.innerHTML = `<p class="muted center">ยังไม่มีการให้/ริบ Token ระหว่างผู้เล่นเลยครับ</p>`;
  } else {
    list.innerHTML = rows
      .map(
        (r) => `
        <div class="summary-row">
          <span class="summary-side loser">${playerAvatar(r.loserId)} ${escapeHtml(playerName(r.loserId))}</span>
          <span class="summary-arrow">เสีย ${r.amount} ให้</span>
          <span class="summary-side gainer">${playerAvatar(r.gainerId)} ${escapeHtml(playerName(r.gainerId))}</span>
        </div>`
      )
      .join("");
  }
  showScreen("summary");
}

/* ---------------- leave / reset ---------------- */

async function leaveGame() {
  if (myPlayer) await api({ action: "remove", id: myPlayer.id });
  localStorage.removeItem(STORAGE_KEY);
  myPlayer = null;
  pendingGainerId = null;
  pendingLoserId = null;
  clearInterval(pollHandle);
  el("f-name").value = "";
  selectedAvatar = null;
  document.querySelectorAll(".avatar-btn").forEach((b) => b.classList.remove("selected"));
  updateJoinEnabled();
  showScreen("login");
}

async function resetGame() {
  if (!confirm("ล้างผู้เล่นทั้งหมดและเริ่มเกมใหม่หรือไม่?")) return;
  await api({ action: "reset" });
  localStorage.removeItem(STORAGE_KEY);
  myPlayer = null;
  pendingGainerId = null;
  pendingLoserId = null;
  clearInterval(pollHandle);
  showScreen("login");
}

/* ---------------- init ---------------- */

function init() {
  if (!CONFIG.API_URL || !CONFIG.API_URL.trim()) {
    showScreen("notconfigured");
    return;
  }

  renderAvatarGrid();
  el("f-name").addEventListener("input", updateJoinEnabled);
  el("btn-join").addEventListener("click", () => joinGame(el("f-name").value.trim(), selectedAvatar));
  el("btn-refresh").addEventListener("click", refresh);
  el("btn-leave").addEventListener("click", leaveGame);
  el("btn-reset").addEventListener("click", resetGame);
  el("btn-summary").addEventListener("click", openSummary);
  el("btn-back-board").addEventListener("click", () => showScreen("board"));
  el("btn-cancel-pick").addEventListener("click", cancelSelection);

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    myPlayer = JSON.parse(saved);
    api({ action: "join", id: myPlayer.id, name: myPlayer.name, avatar: myPlayer.avatar });
    enterBoard();
  } else {
    showScreen("login");
  }
}

init();
