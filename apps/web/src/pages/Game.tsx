import { useEffect, useState } from "react";
import { socket } from "../socket";
import { GameTable } from "../components/GameTable";
import { ActionBar } from "../components/ActionBar";
import type { ClientGameState, GameOverResult, AvailableActions, GameAction } from "@fuzhou-mahjong/shared";

export function Game() {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<GameOverResult | null>(null);
  const [actions, setActions] = useState<AvailableActions | null>(null);

  useEffect(() => {
    socket.on("gameStarted", (state) => {
      setGameState(state);
      setActions(null);
    });
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
      socket.off("gameStarted");
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

    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>{gameOver.winnerId !== null ? `玩家 ${gameOver.winnerId} 胡了!` : "流局 / Draw"}</h2>
        <p>胡法: {gameOver.winType}</p>
        <p>分数: {gameOver.scores.join(", ")}</p>
        <button
          onClick={handleNextRound}
          style={{ marginTop: 20, padding: "12px 32px", fontSize: 18, background: "#0f3460", color: "#eee", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          下一局 / Next Round
        </button>
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
