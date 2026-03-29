import { useEffect, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { socket } from "./socket";
import type { RoomState } from "@fuzhou-mahjong/shared";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";
import { Game } from "./pages/Game";

type View = "lobby" | "room" | "game";

const PLAYER_ID_KEY = "fuzhou-mahjong-playerId";

export function App() {
  const { connected } = useSocket();
  const [view, setView] = useState<View>("lobby");
  const [reconnecting, setReconnecting] = useState(false);
  const [initialRoomState, setInitialRoomState] = useState<RoomState | null>(null);

  // Store playerId when assigned
  useEffect(() => {
    const handler = (playerId: string) => {
      localStorage.setItem(PLAYER_ID_KEY, playerId);
    };
    socket.on("playerIdAssigned", handler);
    return () => { socket.off("playerIdAssigned", handler); };
  }, []);

  // Detect disconnect during game
  useEffect(() => {
    const handler = () => {
      if (view === "game") setReconnecting(true);
    };
    socket.on("disconnect", handler);
    return () => { socket.off("disconnect", handler); };
  }, [view]);

  // On reconnect to server, try to rejoin game
  useEffect(() => {
    const handler = () => {
      if (reconnecting) {
        const id = localStorage.getItem(PLAYER_ID_KEY);
        if (id) socket.emit("rejoinGame", id);
      }
    };
    socket.on("connect", handler);
    return () => { socket.off("connect", handler); };
  }, [reconnecting]);

  // On successful rejoin, resume game view
  useEffect(() => {
    const handler = () => {
      setReconnecting(false);
      setView("game");
    };
    socket.on("gameStarted", handler);
    return () => { socket.off("gameStarted", handler); };
  }, []);

  // Try reconnect on first page load if we have a saved playerId
  useEffect(() => {
    if (connected) {
      const id = localStorage.getItem(PLAYER_ID_KEY);
      if (id) socket.emit("rejoinGame", id);
    }
  }, [connected]);

  // If rejoin fails, clear stored playerId
  useEffect(() => {
    const handler = (msg: string) => {
      if (msg === "No active game found" || msg === "Player not found in room") {
        localStorage.removeItem(PLAYER_ID_KEY);
        setReconnecting(false);
      }
    };
    socket.on("error", handler);
    return () => { socket.off("error", handler); };
  }, []);

  if (!connected) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p>{reconnecting ? "重新连接中... / Reconnecting..." : "连接服务器中... / Connecting..."}</p>
      </div>
    );
  }

  switch (view) {
    case "lobby":
      return <Lobby onJoined={(roomState) => { setInitialRoomState(roomState); setView("room"); }} />;
    case "room":
      return <Room initialRoomState={initialRoomState} onGameStarted={() => setView("game")} />;
    case "game":
      return <Game />;
  }
}
