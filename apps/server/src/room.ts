import type { RoomState } from "@fuzhou-mahjong/shared";

export interface Player {
  socketId: string;
  name: string;
}

export class Room {
  readonly id: string;
  players: Player[] = [];
  readonly maxPlayers = 4 as const;
  gameStarted = false;

  constructor(id: string) {
    this.id = id;
  }

  addPlayer(socketId: string, name: string): boolean {
    if (this.isFull()) return false;
    if (this.players.some((p) => p.socketId === socketId)) return false;
    this.players.push({ socketId, name });
    return true;
  }

  removePlayer(socketId: string): void {
    this.players = this.players.filter((p) => p.socketId !== socketId);
  }

  isFull(): boolean {
    return this.players.length >= this.maxPlayers;
  }

  isEmpty(): boolean {
    return this.players.length === 0;
  }

  getPlayerIndex(socketId: string): number {
    return this.players.findIndex((p) => p.socketId === socketId);
  }

  getState(): RoomState {
    return {
      roomId: this.id,
      players: this.players.map((p) => ({ name: p.name, ready: true })),
      maxPlayers: this.maxPlayers,
    };
  }
}

// ─── Room Store ──────────────────────────────────────────────────

const rooms = new Map<string, Room>();

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

export function deleteRoomIfEmpty(roomId: string): void {
  const room = rooms.get(roomId);
  if (room && room.isEmpty()) {
    rooms.delete(roomId);
  }
}
