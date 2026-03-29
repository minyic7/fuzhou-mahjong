import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@fuzhou-mahjong/shared";

const URL = import.meta.env.PROD
  ? window.location.origin
  : "http://localhost:7701";

export const socket: Socket<ServerEvents, ClientEvents> = io(URL, {
  path: "/socket.io",
  autoConnect: false,
});
