import { useEffect, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { socket } from "./socket";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";
import { Game } from "./pages/Game";

type View = "lobby" | "room" | "game";

const PLAYER_ID_KEY = "fuzhou-mahjong-playerId";

export function App() {
  const { connected } = useSocket();
  const [view, setView] = useState<View>("lobby");
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    // Store playerId when assigned
    socket.on("playerIdAssigned", (playerId) => {
      localStorage.setItem(PLAYER_ID_KEY, playerId);
    });

    // On reconnect to server, try to rejoin game
    socket.on("connect", () => {
      const savedPlayerId = localStorage.getItem(PLAYER_ID_KEY);
      if (savedPlayerId && reconnecting) {
        socket.emit("rejoinGame", savedPlayerId);
      }
    });

    // If we get gameStarted during reconnect, switch to game
    socket.on("gameStarted", () => {
      setReconnecting(false);
      setView("game");
    });

    return () => {
      socket.off("playerIdAssigned");
      socket.off("gameStarted");
    };
  }, [reconnecting]);

  // Detect disconnect during game
  useEffect(() => {
    socket.on("disconnect", () => {
      if (view === "game") {
        setReconnecting(true);
      }
    });

    return () => {
      socket.off("disconnect");
    };
  }, [view]);

  // Try reconnect on first load if we have a saved playerId
  useEffect(() => {
    if (connected) {
      const savedPlayerId = localStorage.getItem(PLAYER_ID_KEY);
      if (savedPlayerId) {
        socket.emit("rejoinGame", savedPlayerId);
      }
    }
  }, [connected]);

  if (!connected) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p>{reconnecting ? "重新连接中... / Reconnecting..." : "连接服务器中... / Connecting..."}</p>
      </div>
    );
  }

  switch (view) {
    case "lobby":
      return <Lobby onJoined={() => setView("room")} />;
    case "room":
      return <Room onGameStarted={() => setView("game")} />;
    case "game":
      return <Game />;
  }
}
