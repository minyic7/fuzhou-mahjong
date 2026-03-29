import { useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";
import { Game } from "./pages/Game";

type View = "lobby" | "room" | "game";

export function App() {
  const { connected } = useSocket();
  const [view, setView] = useState<View>("lobby");

  if (!connected) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p>连接服务器中... / Connecting...</p>
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
