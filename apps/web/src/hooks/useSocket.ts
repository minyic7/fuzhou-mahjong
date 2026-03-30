import { useEffect, useState } from "react";
import { socket } from "../socket";

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

export function useSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    socket.connected ? "connected" : "disconnected"
  );
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      setConnectionState("connected");
      setReconnectAttempt(0);
    };

    const onDisconnect = () => {
      setConnectionState("disconnected");
    };

    const onReconnectAttempt = (attempt: number) => {
      setConnectionState("reconnecting");
      setReconnectAttempt(attempt);
    };

    const onReconnectError = () => {
      setConnectionState("reconnecting");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_error", onReconnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_error", onReconnectError);
    };
  }, []);

  return { socket, connected: connectionState === "connected", connectionState, reconnectAttempt };
}
