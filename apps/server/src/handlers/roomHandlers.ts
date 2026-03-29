import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents } from "@fuzhou-mahjong/shared";
import {
  createRoom,
  findRoom,
  findRoomBySocket,
  deleteRoomIfEmpty,
} from "../room.js";

type GameSocket = Socket<ClientEvents, ServerEvents>;
type GameServer = Server<ClientEvents, ServerEvents>;

export function registerRoomHandlers(io: GameServer, socket: GameSocket): void {
  socket.on("createRoom", (playerName: string) => {
    // Leave any existing room first
    leaveCurrentRoom(io, socket);

    const room = createRoom();
    room.addPlayer(socket.id, playerName);
    socket.join(room.id);

    socket.emit("roomCreated", room.id);
    socket.emit("roomJoined", room.getState());
    console.log(`Room ${room.id} created by ${playerName} (${socket.id})`);
  });

  socket.on("joinRoom", (roomId: string, playerName: string) => {
    const room = findRoom(roomId);
    if (!room) {
      socket.emit("error", `Room ${roomId} not found`);
      return;
    }
    if (room.isFull()) {
      socket.emit("error", `Room ${roomId} is full`);
      return;
    }
    if (room.gameStarted) {
      socket.emit("error", `Game already in progress in room ${roomId}`);
      return;
    }

    // Leave any existing room first
    leaveCurrentRoom(io, socket);

    room.addPlayer(socket.id, playerName);
    socket.join(room.id);

    socket.emit("roomJoined", room.getState());
    io.to(room.id).emit("roomUpdated", room.getState());
    console.log(`${playerName} (${socket.id}) joined room ${room.id}`);
  });

  socket.on("leaveRoom", () => {
    leaveCurrentRoom(io, socket);
  });

  socket.on("startGame", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) {
      socket.emit("error", "Not in a room");
      return;
    }
    if (!room.isFull()) {
      socket.emit("error", `Need ${room.maxPlayers} players to start (have ${room.players.length})`);
      return;
    }
    if (room.gameStarted) {
      socket.emit("error", "Game already started");
      return;
    }

    room.gameStarted = true;
    console.log(`Game starting in room ${room.id}`);
    // Actual game initialization will be implemented in the next ticket
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(io, socket);
  });
}

function leaveCurrentRoom(io: GameServer, socket: GameSocket): void {
  const room = findRoomBySocket(socket.id);
  if (!room) return;

  room.removePlayer(socket.id);
  socket.leave(room.id);

  if (room.isEmpty()) {
    deleteRoomIfEmpty(room.id);
    console.log(`Room ${room.id} deleted (empty)`);
  } else {
    io.to(room.id).emit("roomUpdated", room.getState());
    console.log(`Player ${socket.id} left room ${room.id}`);
  }
}
