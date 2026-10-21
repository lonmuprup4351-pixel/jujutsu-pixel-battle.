const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
res.end("Jujutsu Pixel Battle server is running!");
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

function send(ws, data) {
if (ws.readyState === WebSocket.OPEN) {
ws.send(JSON.stringify(data));
}
}

function broadcast(room, data, except = null) {
for (const client of room.players) {
if (client !== except) send(client, data);
}
}

wss.on("connection", (ws) => {
ws.roomCode = null;
send(ws, { type: "connected" });

ws.on("message", (raw) => {
let msg;
try {
msg = JSON.parse(raw.toString());
} catch {
return send(ws, { type: "error", message: "Invalid JSON" });
}

if (msg.type === "create_room") {
  if (ws.roomCode) return;

  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));

  rooms.set(code, { players: [ws] });
  ws.roomCode = code;
  return send(ws, { type: "room_created", code });
}

if (msg.type === "join_room") {
  const code = String(msg.code || "").trim();
  const room = rooms.get(code);

  if (!room) {
    return send(ws, { type: "error", message: "Không tìm thấy phòng" });
  }

  if (room.players.length >= 2) {
    return send(ws, { type: "error", message: "Phòng đã đủ người" });
  }

  if (ws.roomCode) return;

  room.players.push(ws);
  ws.roomCode = code;
  broadcast(room, { type: "player_joined", count: 2 });
  return;
}

if (msg.type === "game_state" && ws.roomCode) {
  const room = rooms.get(ws.roomCode);
  if (room) {
    broadcast(room, {
      type: "game_state",
      playerId: room.players.indexOf(ws),
      state: msg.state
    }, ws);
  }
}

});

ws.on("close", () => {
const code = ws.roomCode;
if (!code) return;

const room = rooms.get(code);
if (!room) return;

room.players = room.players.filter((p) => p !== ws);
broadcast(room, { type: "player_left" });

if (room.players.length === 0) rooms.delete(code);

});
});

server.listen(PORT, "0.0.0.0", () => {
console.log("Server listening on port ${PORT}");
});
