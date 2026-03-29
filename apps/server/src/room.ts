import crypto from "node:crypto";
import type { RoomState, RoomListItem } from "@fuzhou-mahjong/shared";

export interface Player {
  socketId: string | null;
  playerId: string;
  name: string;
  isBot?: boolean;
  disconnectedAt?: number;
}

const BOT_NAMES = ["Bot 东", "Bot 南", "Bot 西", "Bot 北"];

export class Room {
  readonly id: string;
  players: Player[] = [];
  readonly maxPlayers = 4 as const;
  gameStarted = false;
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(id: string) {
    this.id = id;
  }

  addPlayer(socketId: string, name: string): Player {
    const playerId = crypto.randomUUID();
    const player: Player = { socketId, playerId, name };
    this.players.push(player);
    return player;
  }

  addBot(): Player | null {
    if (this.isFull()) return null;
    const botIndex = this.players.filter((p) => p.isBot).length;
    const name = BOT_NAMES[botIndex] ?? `Bot ${botIndex + 1}`;
    const player: Player = {
      socketId: null,
      playerId: crypto.randomUUID(),
      name,
      isBot: true,
    };
    this.players.push(player);
    return player;
  }

  removePlayer(socketId: string): void {
    this.players = this.players.filter((p) => p.socketId !== socketId);
  }

  disconnectPlayer(socketId: string): Player | undefined {
    const player = this.players.find((p) => p.socketId === socketId);
    if (player) {
      player.socketId = null;
      player.disconnectedAt = Date.now();
    }
    return player;
  }

  reconnectPlayer(playerId: string, newSocketId: string): Player | undefined {
    const player = this.players.find((p) => p.playerId === playerId);
    if (player) {
      player.socketId = newSocketId;
      player.disconnectedAt = undefined;
      const timer = this.disconnectTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectTimers.delete(playerId);
      }
    }
    return player;
  }

  findByPlayerId(playerId: string): Player | undefined {
    return this.players.find((p) => p.playerId === playerId);
  }

  isFull(): boolean {
    return this.players.length >= this.maxPlayers;
  }

  isEmpty(): boolean {
    return this.players.length === 0;
  }

  hasConnectedPlayers(): boolean {
    return this.players.some((p) => p.socketId !== null);
  }

  getPlayerIndex(socketId: string): number {
    return this.players.findIndex((p) => p.socketId === socketId);
  }

  getPlayerIndexByPlayerId(playerId: string): number {
    return this.players.findIndex((p) => p.playerId === playerId);
  }

  getState(): RoomState {
    return {
      roomId: this.id,
      players: this.players.map((p) => ({ name: p.name, ready: p.isBot || p.socketId !== null, isBot: p.isBot })),
      maxPlayers: this.maxPlayers,
    };
  }
}

// ─── Room Store ──────────────────────────────────────────────────

const rooms = new Map<string, Room>();
const playerRoomMap = new Map<string, string>(); // playerId → roomId

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomId(): string {
  let id: string;
  do {
    id = Array.from({ length: 4 }, () =>
      CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join("");
  } while (rooms.has(id));
  return id;
}

export function createRoom(): Room {
  const room = new Room(generateRoomId());
  rooms.set(room.id, room);
  return room;
}

export function findRoom(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase());
}

export function findRoomBySocket(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) {
      return room;
    }
  }
  return undefined;
}

export function findRoomByPlayerId(playerId: string): Room | undefined {
  const roomId = playerRoomMap.get(playerId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function registerPlayerRoom(playerId: string, roomId: string): void {
  playerRoomMap.set(playerId, roomId);
}

export function unregisterPlayerRoom(playerId: string): void {
  playerRoomMap.delete(playerId);
}

export function deleteRoomIfEmpty(roomId: string): void {
  const room = rooms.get(roomId);
  if (room && room.isEmpty()) {
    for (const p of room.players) {
      playerRoomMap.delete(p.playerId);
    }
    rooms.delete(roomId);
  }
}

export function getAvailableRooms(): RoomListItem[] {
  const result: RoomListItem[] = [];
  for (const room of rooms.values()) {
    if (!room.isFull() && !room.gameStarted) {
      result.push({
        roomId: room.id,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        players: room.players.map((p) => p.name),
      });
    }
  }
  return result;
}
