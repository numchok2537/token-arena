var PLAYERS_KEY = "players";
var NET_PAIRS_KEY = "netPairs";
var ROSTER_KEY = "roster"; // { id: {name, avatar} } — never pruned on "remove", so end-game summaries can still show a departed player's name

function loadPlayers_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PLAYERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function savePlayers_(players) {
  PropertiesService.getScriptProperties().setProperty(PLAYERS_KEY, JSON.stringify(players));
}

function loadRoster_() {
  var raw = PropertiesService.getScriptProperties().getProperty(ROSTER_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveRoster_(roster) {
  PropertiesService.getScriptProperties().setProperty(ROSTER_KEY, JSON.stringify(roster));
}

// netPairs: { "idA|idB": net } where idA < idB alphabetically, and a positive net
// means idA has net-gained `net` tokens from idB across the whole game (negative = reverse).
function loadNetPairs_() {
  var raw = PropertiesService.getScriptProperties().getProperty(NET_PAIRS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveNetPairs_(pairs) {
  PropertiesService.getScriptProperties().setProperty(NET_PAIRS_KEY, JSON.stringify(pairs));
}

function pairKey_(idA, idB) {
  return idA < idB ? idA + "|" + idB : idB + "|" + idA;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonOut_({ players: loadPlayers_(), netPairs: loadNetPairs_(), roster: loadRoster_() });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var result = withLock_(function () {
    var players = loadPlayers_();
    var netPairs = loadNetPairs_();
    var roster = loadRoster_();

    if (data.action === "join") {
      var existing = players.filter(function (p) {
        return p.id === data.id;
      })[0];
      if (existing) {
        existing.name = data.name;
        existing.avatar = data.avatar;
      } else {
        players.push({ id: data.id, name: data.name, avatar: data.avatar, tokens: 0 });
      }
      roster[data.id] = { name: data.name, avatar: data.avatar };
    } else if (data.action === "transfer") {
      // gainerId receives +amount, loserId loses -amount
      players.forEach(function (p) {
        if (p.id === data.gainerId) p.tokens = (p.tokens || 0) + data.amount;
        if (p.id === data.loserId) p.tokens = (p.tokens || 0) - data.amount;
      });
      var key = pairKey_(data.gainerId, data.loserId);
      var sign = data.gainerId < data.loserId ? 1 : -1;
      netPairs[key] = (netPairs[key] || 0) + sign * data.amount;
      if (netPairs[key] === 0) delete netPairs[key];
    } else if (data.action === "remove") {
      players = players.filter(function (p) {
        return p.id !== data.id;
      });
    } else if (data.action === "reset") {
      players = [];
      netPairs = {};
      roster = {};
    }

    savePlayers_(players);
    saveNetPairs_(netPairs);
    saveRoster_(roster);
    return { players: players, netPairs: netPairs, roster: roster };
  });

  return jsonOut_(result);
}
