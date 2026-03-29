import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@fuzhou-mahjong/shared";

const URL = import.meta.env.PROD
  ? window.location.origin
  : "http://localhost:7701";

const SOCKET_PATH = import.meta.env.PROD
  ? "/fuzhou-mahjong/api/socket.io"
  : "/api/socket.io";

export const socket: Socket<ServerEvents, ClientEvents> = io(URL, {
  path: SOCKET_PATH,
  autoConnect: false,
});
