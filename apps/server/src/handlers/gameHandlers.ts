import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents, GameAction } from "@fuzhou-mahjong/shared";
import { handlePlayerAction } from "../gameEngine.js";
import { findRoomBySocket } from "../room.js";
import { getGame } from "../gameState.js";

type GameSocket = Socket<ClientEvents, ServerEvents>;
type GameServer = Server<ClientEvents, ServerEvents>;

export function registerGameHandlers(io: GameServer, socket: GameSocket): void {
  socket.on("playerAction", (action: GameAction) => {
    handlePlayerAction(io, socket.id, action);
  });

  socket.on("resyncState", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const game = getGame(room.id);
    if (!game) return;
    const idx = game.getPlayerIndex(socket.id);
    if (idx === -1) return;
    socket.emit("gameStateUpdate", game.getClientGameState(idx));
  });
}
