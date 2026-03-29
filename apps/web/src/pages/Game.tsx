import { useEffect, useState } from "react";
import { socket } from "../socket";
import { GameTable } from "../components/GameTable";
import { ActionBar } from "../components/ActionBar";
import type { ClientGameState, GameOverResult, AvailableActions, GameAction } from "@fuzhou-mahjong/shared";

interface GameProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function Game({ initialGameState, onLeave }: GameProps) {
  const [gameState, setGameState] = useState<ClientGameState | null>(initialGameState ?? null);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<GameOverResult | null>(null);
  const [actions, setActions] = useState<AvailableActions | null>(null);

  useEffect(() => {
    // gameStarted is handled by App.tsx (passed as initialGameState prop)
    // Only listen for subsequent updates here
    socket.on("gameStateUpdate", (state) => {
      setGameState((prev) => {
        // Clear actions if turn changed
        if (prev && prev.currentTurn !== state.currentTurn) {
          setActions(null);
        }
        return state;
      });
    });
    socket.on("actionRequired", (availableActions) => {
      setActions(availableActions);
    });
    socket.on("gameOver", (result) => setGameOver(result));

    return () => {
      socket.off("gameStateUpdate");
      socket.off("actionRequired");
      socket.off("gameOver");
    };
  }, []);

  const handleAction = (action: GameAction) => {
    socket.emit("playerAction", action);
    setSelectedTileId(null);
    setActions(null);
  };

  if (gameOver) {
    const handleNextRound = () => {
      socket.emit("nextRound");
      setGameOver(null);
      setActions(null);
      setSelectedTileId(null);
    };

    const winTypeNames: Record<string, string> = {
      normal: "普通胡", tianHu: "天胡 30x", grabGold: "抢金 30x",
      pingHu0: "平胡(无花) 30x", pingHu1: "平胡(一花) 15x",
      threeGoldDown: "三金倒 40x", goldSparrow: "金雀 60x", goldDragon: "金龙 120x",
      duiDuiHu: "对对胡", qingYiSe: "清一色", draw: "流局",
    };

    const getPlayerName = (idx: number) => {
      if (!gameState) return `玩家${idx}`;
      if (idx === gameState.myIndex) return gameState.myName || "我";
      const other = gameState.otherPlayers.find((_, i) => (gameState.myIndex + i + 1) % 4 === idx);
      return other?.name || `玩家${idx}`;
    };

    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>
          {gameOver.winnerId !== null ? `🎉 ${getPlayerName(gameOver.winnerId)} 胡了!` : "流局 / Draw"}
        </h2>
        <p style={{ fontSize: 18, color: "#ffd700", marginBottom: 12 }}>
          {winTypeNames[gameOver.winType] || gameOver.winType}
        </p>
        <div style={{ marginBottom: 20 }}>
          {gameOver.scores.map((score, i) => (
            <p key={i} style={{ color: score > 0 ? "#4caf50" : score < 0 ? "#f44336" : "#aaa" }}>
              {getPlayerName(i)}: {score > 0 ? "+" : ""}{score}
            </p>
          ))}
        </div>
        <button
          onClick={handleNextRound}
          style={{ padding: "12px 32px", fontSize: 18, background: "#0f3460", color: "#eee", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          下一局 / Next Round
        </button>
        {onLeave && (
          <button
            onClick={() => { socket.emit("leaveRoom"); onLeave(); }}
            style={{ marginLeft: 10, padding: "12px 32px", fontSize: 18, background: "#444", color: "#eee", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            离开 / Leave
          </button>
        )}
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p>等待游戏数据... / Loading game...</p>
      </div>
    );
  }

  return (
    <div>
      <GameTable
        state={gameState}
        onTileSelect={(tile) => setSelectedTileId(tile?.id ?? null)}
        selectedTileId={selectedTileId}
      />
      <ActionBar
        actions={actions}
        selectedTileId={selectedTileId}
        gameState={gameState}
        onAction={handleAction}
      />
    </div>
  );
}
