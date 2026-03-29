import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents, GameAction } from "@fuzhou-mahjong/shared";
import { handlePlayerAction } from "../gameEngine.js";

type GameSocket = Socket<ClientEvents, ServerEvents>;
type GameServer = Server<ClientEvents, ServerEvents>;

export function registerGameHandlers(io: GameServer, socket: GameSocket): void {
  socket.on("playerAction", (action: GameAction) => {
    handlePlayerAction(io, socket.id, action);
  });
}
