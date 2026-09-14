const AVATARS = ["🦊", "🐼", "🐸", "🦄", "🐯", "🦁", "🐻", "🐨", "🐶", "🐱", "🦉", "🐧", "🐢", "🦖", "🐙", "🦋"];
const STORAGE_KEY = "tokenArena.player";
const el = (id) => document.getElementById(id);

let myPlayer = null;
let players = [];
let pollHandle = null;
let selectedAvatar = null;

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

async function fetchPlayers() {
  const res = await fetch(CONFIG.API_URL, { cache: "no-store" });
  const data = await res.json();
  return data.players || [];
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
    players = await fetchPlayers();
    renderBoard();
    el("last-updated").textContent = "อัปเดตล่าสุด " + new Date().toLocaleTimeString("th-TH");
  } catch (e) {
    el("last-updated").textContent = "โหลดข้อมูลไม่สำเร็จ: " + e.message;
  }
}

function renderBoard() {
  const sorted = [...players].sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
  const grid = el("player-grid");
  grid.innerHTML = "";
  sorted.forEach((p) => {
    const isMe = myPlayer && p.id === myPlayer.id;
    const tokens = p.tokens || 0;
    const card = document.createElement("div");
    card.className = "player-card" + (isMe ? " me" : "") + (tokens > 0 ? " pos" : tokens < 0 ? " neg" : "");
    card.innerHTML = `
      <div class="avatar-big">${p.avatar}</div>
      <div class="p-name">${escapeHtml(p.name)}${isMe ? ' <span class="you-tag">(คุณ)</span>' : ""}</div>
      <div class="p-tokens">${tokens}</div>
      ${
        isMe
          ? `<div class="controls">
              <button type="button" class="fx-btn fire-btn" data-delta="5" aria-label="บวก 5">🔥<span class="fx-label">+5</span></button>
              <button type="button" class="fx-btn ice-btn" data-delta="-5" aria-label="ลบ 5">❄️<span class="fx-label">-5</span></button>
            </div>`
          : ""
      }
    `;
    if (isMe) {
      card.querySelectorAll(".fx-btn").forEach((btn) => {
        btn.addEventListener("click", () => onAdjust(Number(btn.dataset.delta), btn));
      });
    }
    grid.appendChild(card);
  });
}

function onAdjust(delta, btnEl) {
  const p = players.find((x) => x.id === myPlayer.id);
  if (p) p.tokens = (p.tokens || 0) + delta;
  renderBoard();
  btnEl.classList.add("burst");
  setTimeout(() => btnEl.classList.remove("burst"), 400);
  api({ action: "adjust", id: myPlayer.id, delta });
}

async function leaveGame() {
  if (myPlayer) await api({ action: "remove", id: myPlayer.id });
  localStorage.removeItem(STORAGE_KEY);
  myPlayer = null;
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
