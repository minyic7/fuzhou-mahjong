import { useEffect, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { socket } from "./socket";
import type { RoomState, ClientGameState, CumulativeData } from "@fuzhou-mahjong/shared";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";
import { Game } from "./pages/Game";
import { MobileGame } from "./pages/MobileGame";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { useIsMobileDevice } from "./hooks/useIsMobileDevice";

type View = "lobby" | "room" | "game";

const PLAYER_ID_KEY = "fuzhou-mahjong-playerId";

export function App() {
  const { connected, connectionState, reconnectAttempt } = useSocket();
  const isMobile = useIsMobileDevice();
  const [view, setView] = useState<View>("lobby");
  const [reconnecting, setReconnecting] = useState(false);
  const [disconnectedAt, setDisconnectedAt] = useState<number | null>(null);
  const [initialRoomState, setInitialRoomState] = useState<RoomState | null>(null);
  const [initialGameState, setInitialGameState] = useState<ClientGameState | null>(null);
  const [sessionScores, setSessionScores] = useState<CumulativeData | null>(null);

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
      if (view === "game") {
        setReconnecting(true);
        setDisconnectedAt(Date.now());
      }
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

  // Capture gameStarted at App level — prevents race condition
  // where Room.tsx consumes event before Game.tsx mounts
  useEffect(() => {
    const handler = (state: ClientGameState) => {
      setInitialGameState(state);
      if (state.roundsPlayed > 0) {
        setSessionScores({ scores: state.cumulativeScores, roundsPlayed: state.roundsPlayed });
      }
      setReconnecting(false);
      setDisconnectedAt(null);
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

  if (!connected && !reconnecting) {
    return (
      <div className="loading-state" style={{ minHeight: "80dvh" }}>
        <div className="spinner" />
        连接服务器中... / Connecting...
      </div>
    );
  }

  const content = (() => {
    switch (view) {
      case "lobby":
        return <Lobby onJoined={(roomState) => { setInitialRoomState(roomState); setView("room"); }} />;
      case "room":
        return <Room initialRoomState={initialRoomState} sessionScores={sessionScores} />;
      case "game": {
        const handleLeave = () => { localStorage.removeItem(PLAYER_ID_KEY); setInitialGameState(null); setSessionScores(null); setView("lobby"); };
        return isMobile
          ? <MobileGame initialGameState={initialGameState} onLeave={handleLeave} />
          : <Game initialGameState={initialGameState} onLeave={handleLeave} />;
      }
    }
  })();

  return (
    <div key={view} className="page-transition" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {content}
      {reconnecting && (
        <ConnectionStatus
          connectionState={connectionState}
          reconnectAttempt={reconnectAttempt}
          timeoutMs={60000}
          disconnectedAt={disconnectedAt}
        />
      )}
    </div>
  );
}
