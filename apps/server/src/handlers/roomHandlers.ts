import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents } from "@fuzhou-mahjong/shared";
import { ActionType } from "@fuzhou-mahjong/shared";
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
import { createGame, getGame, deleteGame } from "../gameState.js";
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
      io.to(room.id).emit("playerReconnected", { playerIndex, playerName: player.name });
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

  socket.on("quickStart", (playerName: string) => {
    try {
      // Force leave even during active game (unlike leaveCurrentRoom which skips if gameStarted)
      const oldRoom = findRoomBySocket(socket.id);
      if (oldRoom) {
        const oldPlayer = oldRoom.players.find((p) => p.socketId === socket.id);
        if (oldPlayer) unregisterPlayerRoom(oldPlayer.playerId);
        oldRoom.removePlayer(socket.id);
        socket.leave(oldRoom.id);
        const hasHumans = oldRoom.players.some((p) => !p.isBot && p.socketId);
        if (!hasHumans) {
          oldRoom.players = [];
          deleteRoomIfEmpty(oldRoom.id);
        }
      }

      const room = createRoom();
      const player = room.addPlayer(socket.id, playerName);
      registerPlayerRoom(player.playerId, room.id);
      socket.join(room.id);

      socket.emit("playerIdAssigned", player.playerId);

      // Add 3 bots
      for (let i = 0; i < 3; i++) {
        room.addBot();
      }

      // Start game
      room.gameStarted = true;
      broadcastRoomList(io);
      console.log(`Quick start: room ${room.id} created by ${playerName} with 3 bots`);

      const socketIds = room.players.map((p) => p.socketId ?? `bot-${p.playerId}`);
      const playerNames = room.players.map((p) => p.name);
      const botIndices = room.players.map((p, i) => p.isBot ? i : -1).filter((i) => i >= 0);
      const game = createGame(room.id, socketIds, playerNames, botIndices);

      for (let i = 0; i < 4; i++) {
        if (!game.isBot(i) && room.players[i].socketId) {
          io.to(room.players[i].socketId!).emit("gameStarted", game.getClientGameState(i));
        }
      }

      triggerDealerAction(io, game, room);
    } catch (err) {
      console.error("quickStart error:", err);
      socket.emit("error", "Failed to quick start game");
    }
  });

  socket.on("leaveRoom", () => {
    leaveCurrentRoom(io, socket);
    broadcastRoomList(io);
  });

  socket.on("startGame", () => {
    try {
      const room = findRoomBySocket(socket.id);
      if (!room) { socket.emit("error", "Not in a room"); return; }
      if (!room.isFull()) { socket.emit("error", `Need ${room.maxPlayers} players to start (have ${room.players.length})`); return; }
      if (room.gameStarted) { socket.emit("error", "Game already started"); return; }

      room.gameStarted = true;
      broadcastRoomList(io);
      console.log(`Game starting in room ${room.id}`);

      const socketIds = room.players.map((p) => p.socketId ?? `bot-${p.playerId}`);
      const playerNames = room.players.map((p) => p.name);
      const botIndices = room.players.map((p, i) => p.isBot ? i : -1).filter((i) => i >= 0);
      const game = createGame(room.id, socketIds, playerNames, botIndices);

      for (let i = 0; i < 4; i++) {
        if (!game.isBot(i) && room.players[i].socketId) {
          io.to(room.players[i].socketId!).emit("gameStarted", game.getClientGameState(i));
        }
      }

      triggerDealerAction(io, game, room);
    } catch (err) {
      console.error("startGame error:", err);
      socket.emit("error", "Failed to start game");
    }
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

    // Check tianhu: dealer wins immediately if hand is complete after gold reveal
    const nextDealer = game.state.players[game.state.dealerIndex];
    const nextDealerLastTile = nextDealer.hand[nextDealer.hand.length - 1];
    if (nextDealerLastTile) {
      const tianhuResult = checkWin(nextDealer, nextDealerLastTile, game.state.gold, {
        isSelfDraw: true,
        isFirstAction: true,
        isDealer: true,
        isRobbingKong: false,
        totalFlowers: nextDealer.flowers.length,
        totalGangs: 0,
      });
      if (tianhuResult.isWin) {
        game.state.phase = GamePhase.Finished;
        for (let i = 0; i < 4; i++) {
          if (!game.isBot(i) && room.players[i].socketId) {
            io.to(room.players[i].socketId!).emit("gameStateUpdate", game.getClientGameState(i));
          }
        }
        const tianhuScores = [0, 0, 0, 0];
        room.addRoundScores(tianhuScores);
        io.to(room.id).emit("gameOver", {
          winnerId: game.state.dealerIndex,
          winType: tianhuResult.winType,
          scores: tianhuScores,
          cumulative: room.getCumulativeData(),
        });
        return;
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
      io.to(room.id).emit("playerDisconnected", { playerIndex, playerName: player.name, timeoutMs: RECONNECT_TIMEOUT_MS });
      io.to(room.id).emit("roomUpdated", room.getState());
      console.log(`Player ${player.name} disconnected from game in room ${room.id}`);

      const timer = setTimeout(() => {
        room.disconnectTimers.delete(player.playerId);
        console.log(`Reconnect timeout for ${player.name} in room ${room.id}`);

        // If no humans left connected, clean up room and game
        if (!room.hasConnectedPlayers()) {
          deleteGame(room.id);
          room.players = [];
          deleteRoomIfEmpty(room.id);
          console.log(`Room ${room.id} cleaned up (all humans disconnected)`);
        }
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
      try {
        const actions = game.getInitialDealerActions();
        const player = game.state.players[dealerIdx];
        const botAction = decideBotAction(player.hand, player.melds, actions, dealerIdx, game.state.gold);
        handlePlayerAction(io, game.roomId, botAction, dealerIdx);
      } catch (err) {
        console.error(`Dealer bot ${dealerIdx} action error:`, err);
        try {
          handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex: dealerIdx }, dealerIdx);
        } catch (e) {
          console.error(`Dealer bot ${dealerIdx} fallback also failed:`, e);
        }
      }
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

  // Remove bots if no humans left (prevent zombie rooms)
  const hasHumans = room.players.some((p) => !p.isBot && p.socketId);
  if (!hasHumans) {
    room.players = [];
    deleteRoomIfEmpty(room.id);
    console.log(`Room ${room.id} deleted (no humans left)`);
  } else if (room.isEmpty()) {
    deleteRoomIfEmpty(room.id);
    console.log(`Room ${room.id} deleted (empty)`);
  } else {
    io.to(room.id).emit("roomUpdated", room.getState());
    console.log(`Player ${socket.id} left room ${room.id}`);
  }
}
