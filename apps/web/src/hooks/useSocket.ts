import { useEffect, useState } from "react";
import { socket } from "../socket";

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return { socket, connected };
}
