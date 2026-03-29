import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { HealthResponse, ClientEvents, ServerEvents } from "@fuzhou-mahjong/shared";
import { registerRoomHandlers } from "./handlers/roomHandlers.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 7701;

const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: "*" },
  path: "/socket.io",
});

app.get("/api/health", (_req, res) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  registerRoomHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };
