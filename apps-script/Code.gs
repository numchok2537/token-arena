var PROP_KEY = "players";

function loadPlayers_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  return raw ? JSON.parse(raw) : [];
}

function savePlayers_(players) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, JSON.stringify(players));
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
  return jsonOut_({ players: loadPlayers_() });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var result = withLock_(function () {
    var players = loadPlayers_();

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
    } else if (data.action === "adjust") {
      players.forEach(function (p) {
        if (p.id === data.id) p.tokens = (p.tokens || 0) + data.delta;
      });
    } else if (data.action === "remove") {
      players = players.filter(function (p) {
        return p.id !== data.id;
      });
    } else if (data.action === "reset") {
      players = [];
    }

    savePlayers_(players);
    return players;
  });

  return jsonOut_({ players: result });
}
