import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents } from "@fuzhou-mahjong/shared";
import {
  createRoom,
  findRoom,
  findRoomBySocket,
  findRoomByPlayerId,
  deleteRoomIfEmpty,
  getAvailableRooms,
  registerPlayerRoom,
  unregisterPlayerRoom,
} from "../room.js";
import { createGame, getGame } from "../gameState.js";
import { checkWin, MeldType, isGoldTile, GamePhase, decideBotAction } from "@fuzhou-mahjong/shared";
import { handlePlayerAction } from "../gameEngine.js";

type GameSocket = Socket<ClientEvents, ServerEvents>;
type GameServer = Server<ClientEvents, ServerEvents>;

const RECONNECT_TIMEOUT_MS = 60_000;

function broadcastRoomList(io: GameServer): void {
  io.emit("roomList", getAvailableRooms());
}

export function registerRoomHandlers(io: GameServer, socket: GameSocket): void {
  socket.on("listRooms", () => {
    socket.emit("roomList", getAvailableRooms());
  });

  socket.on("createRoom", (playerName: string) => {
    leaveCurrentRoom(io, socket);

    const room = createRoom();
    const player = room.addPlayer(socket.id, playerName);
    registerPlayerRoom(player.playerId, room.id);
    socket.join(room.id);

    socket.emit("playerIdAssigned", player.playerId);
    socket.emit("roomCreated", room.id);
    socket.emit("roomJoined", room.getState());
    broadcastRoomList(io);
    console.log(`Room ${room.id} created by ${playerName} (${socket.id})`);
  });

  socket.on("joinRoom", (roomId: string, playerName: string) => {
    const room = findRoom(roomId);
    if (!room) { socket.emit("error", `Room ${roomId} not found`); return; }
    if (room.isFull()) { socket.emit("error", `Room ${roomId} is full`); return; }
    if (room.gameStarted) { socket.emit("error", `Game already in progress in room ${roomId}`); return; }

    leaveCurrentRoom(io, socket);

    const player = room.addPlayer(socket.id, playerName);
    registerPlayerRoom(player.playerId, room.id);
    socket.join(room.id);

    socket.emit("playerIdAssigned", player.playerId);
    socket.emit("roomJoined", room.getState());
    io.to(room.id).emit("roomUpdated", room.getState());
    broadcastRoomList(io);
    console.log(`${playerName} (${socket.id}) joined room ${room.id}`);
  });

  socket.on("rejoinGame", (playerId: string) => {
    const room = findRoomByPlayerId(playerId);
    if (!room) { socket.emit("error", "No active game found"); return; }

    const player = room.reconnectPlayer(playerId, socket.id);
    if (!player) { socket.emit("error", "Player not found in room"); return; }

    socket.join(room.id);

    const game = getGame(room.id);
    if (game) {
      const playerIndex = room.getPlayerIndexByPlayerId(playerId);
      game.updateSocketId(playerIndex, socket.id);
      socket.emit("playerIdAssigned", playerId);
      socket.emit("gameStarted", game.getClientGameState(playerIndex));
      io.to(room.id).emit("playerReconnected", playerIndex);
      console.log(`Player ${player.name} reconnected to room ${room.id}`);
    } else {
      socket.emit("roomJoined", room.getState());
    }
  });

  socket.on("addBot", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) { socket.emit("error", "Not in a room"); return; }
    if (room.isFull()) { socket.emit("error", "Room is full"); return; }
    if (room.gameStarted) { socket.emit("error", "Game already started"); return; }

    const bot = room.addBot();
    if (!bot) { socket.emit("error", "Failed to add bot"); return; }

    io.to(room.id).emit("roomUpdated", room.getState());
    broadcastRoomList(io);
    console.log(`Bot ${bot.name} added to room ${room.id}`);
  });

  socket.on("removeBot", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) { socket.emit("error", "Not in a room"); return; }
    if (room.gameStarted) { socket.emit("error", "Game already started"); return; }

    if (room.removeLastBot()) {
      io.to(room.id).emit("roomUpdated", room.getState());
      broadcastRoomList(io);
      console.log(`Bot removed from room ${room.id}`);
    }
  });

  socket.on("leaveRoom", () => {
    leaveCurrentRoom(io, socket);
    broadcastRoomList(io);
  });

  socket.on("startGame", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) { socket.emit("error", "Not in a room"); return; }
    if (!room.isFull()) { socket.emit("error", `Need ${room.maxPlayers} players to start (have ${room.players.length})`); return; }
    if (room.gameStarted) { socket.emit("error", "Game already started"); return; }

    room.gameStarted = true;
    broadcastRoomList(io);
    console.log(`Game starting in room ${room.id}`);

    const socketIds = room.players.map((p) => p.socketId ?? `bot-${p.playerId}`);
    const botIndices = room.players.map((p, i) => p.isBot ? i : -1).filter((i) => i >= 0);
    const game = createGame(room.id, socketIds, botIndices);

    for (let i = 0; i < 4; i++) {
      if (!game.isBot(i) && room.players[i].socketId) {
        io.to(room.players[i].socketId!).emit("gameStarted", game.getClientGameState(i));
      }
    }

    // Check tianhu: dealer wins immediately if hand is complete after gold reveal
    const dealer = game.state.players[game.state.dealerIndex];
    const dealerLastTile = dealer.hand[dealer.hand.length - 1];
    if (dealerLastTile) {
      const tianhuResult = checkWin(dealer, dealerLastTile, game.state.gold, {
        isSelfDraw: true,
        isFirstAction: true,
        isDealer: true,
        isRobbingKong: false,
        totalFlowers: dealer.flowers.length,
        totalGangs: 0,
      });
      if (tianhuResult.isWin) {
        game.state.phase = GamePhase.Finished;
        for (let i = 0; i < 4; i++) {
          if (!game.isBot(i) && room.players[i].socketId) {
            io.to(room.players[i].socketId!).emit("gameStateUpdate", game.getClientGameState(i));
          }
        }
        io.to(room.id).emit("gameOver", {
          winnerId: game.state.dealerIndex,
          winType: tianhuResult.winType,
          scores: [0, 0, 0, 0],
        });
        return;
      }
    }

    triggerDealerAction(io, game, room);
  });

  socket.on("nextRound", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) { socket.emit("error", "Not in a room"); return; }

    const game = getGame(room.id);
    if (!game) { socket.emit("error", "No active game"); return; }
    if (game.state.phase !== GamePhase.Finished && game.state.phase !== GamePhase.Draw) {
      socket.emit("error", "Game is still in progress");
      return;
    }

    game.startNextRound();
    console.log(`Next round in room ${room.id}, dealer: ${game.state.dealerIndex}`);

    for (let i = 0; i < 4; i++) {
      if (!game.isBot(i) && room.players[i].socketId) {
        io.to(room.players[i].socketId!).emit("gameStarted", game.getClientGameState(i));
      }
    }

    triggerDealerAction(io, game, room);
  });

  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.gameStarted) {
      // During game: keep slot, start reconnect timer
      const player = room.disconnectPlayer(socket.id);
      if (!player) return;

      const playerIndex = room.getPlayerIndexByPlayerId(player.playerId);
      io.to(room.id).emit("playerDisconnected", playerIndex);
      io.to(room.id).emit("roomUpdated", room.getState());
      console.log(`Player ${player.name} disconnected from game in room ${room.id}`);

      const timer = setTimeout(() => {
        room.disconnectTimers.delete(player.playerId);
        console.log(`Reconnect timeout for ${player.name} in room ${room.id}`);
        // Player stays in game but auto-passes all actions (handled by action timeout in gameEngine)
      }, RECONNECT_TIMEOUT_MS);
      room.disconnectTimers.set(player.playerId, timer);
    } else {
      // Not in game: remove normally
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) unregisterPlayerRoom(player.playerId);
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
    broadcastRoomList(io);
  });
}

function triggerDealerAction(io: GameServer, game: import("../gameState.js").ServerGameState, room: import("../room.js").Room): void {
  const dealerIdx = game.state.dealerIndex;
  if (game.isBot(dealerIdx)) {
    setTimeout(() => {
      const actions = game.getInitialDealerActions();
      const player = game.state.players[dealerIdx];
      const botAction = decideBotAction(player.hand, player.melds, actions, dealerIdx, game.state.gold);
      handlePlayerAction(io, game.roomId, botAction, dealerIdx);
    }, 500);
  } else if (room.players[dealerIdx].socketId) {
    io.to(room.players[dealerIdx].socketId!).emit("actionRequired", game.getInitialDealerActions());
  }
}

function leaveCurrentRoom(io: GameServer, socket: GameSocket): void {
  const room = findRoomBySocket(socket.id);
  if (!room) return;
  if (room.gameStarted) return; // Can't leave during game

  const player = room.players.find((p) => p.socketId === socket.id);
  if (player) unregisterPlayerRoom(player.playerId);
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
