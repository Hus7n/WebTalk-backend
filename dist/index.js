import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { createServer } from "http";
const app = express();
app.get("/", (_req, res) => {
    res.status(200).send("WebTalk WebSocket server is running (chat + audio)");
});
const server = createServer(app);
const wss = new WebSocketServer({ server });
let allSockets = [];
/** Broadcast current user count to all users in a room */
function broadcastUserCount(roomId) {
    const count = allSockets.filter((u) => u.room === roomId).length;
    allSockets
        .filter((u) => u.room === roomId)
        .forEach((u) => {
        u.socket.send(JSON.stringify({
            type: "userCount",
            payload: { count },
        }));
    });
}
/** Heartbeat for keeping connections alive */
function heartbeat() {
    // @ts-ignore
    this.isAlive = true;
}
wss.on("connection", (socket) => {
    // @ts-ignore
    socket.isAlive = true;
    socket.on("pong", heartbeat);
    socket.on("message", (message) => {
        const parsedMessage = JSON.parse(message.toString());
        // User joins a room
        if (parsedMessage.type === "join") {
            const userId = Math.random().toString(36).substring(2, 10);
            allSockets.push({
                socket,
                room: parsedMessage.payload.roomId,
                id: userId,
            });
            socket.send(JSON.stringify({
                type: "id",
                payload: { senderId: userId },
            }));
            broadcastUserCount(parsedMessage.payload.roomId);
            return;
        }
        // Chat messaging inside a room
        if (parsedMessage.type === "chat") {
            const sender = allSockets.find((u) => u.socket === socket);
            if (!sender)
                return;
            allSockets
                .filter((u) => u.room === sender.room)
                .forEach((u) => {
                u.socket.send(JSON.stringify({
                    type: "chat",
                    payload: {
                        senderId: sender.id,
                        message: parsedMessage.payload.message,
                    },
                }));
            });
            return;
        }
        // Audio messaging inside a room
        if (parsedMessage.type === "audio") {
            const sender = allSockets.find((u) => u.socket === socket);
            if (!sender)
                return;
            allSockets
                .filter((u) => u.room === sender.room)
                .forEach((u) => {
                u.socket.send(JSON.stringify({
                    type: "audio",
                    payload: {
                        senderId: sender.id,
                        audio: parsedMessage.payload.audio, // base64 string or blob
                    },
                }));
            });
            return;
        }
    });
    socket.on("close", () => {
        const user = allSockets.find((u) => u.socket === socket);
        if (user) {
            const roomId = user.room;
            allSockets = allSockets.filter((u) => u.socket !== socket);
            broadcastUserCount(roomId);
        }
    });
});
/** Ping/pong for dead connections */
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false)
            return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);
wss.on("close", () => clearInterval(interval));
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Chat + Audio WS server running on ${PORT}`);
});
//# sourceMappingURL=index.js.map