import { useEffect, useState } from "react";
import { socket } from "../socket";
import { GameTable } from "../components/GameTable";
import type { ClientGameState, GameOverResult } from "@fuzhou-mahjong/shared";

export function Game() {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<GameOverResult | null>(null);

  useEffect(() => {
    socket.on("gameStarted", (state) => setGameState(state));
    socket.on("gameStateUpdate", (state) => setGameState(state));
    socket.on("gameOver", (result) => setGameOver(result));

    return () => {
      socket.off("gameStarted");
      socket.off("gameStateUpdate");
      socket.off("gameOver");
    };
  }, []);

  if (gameOver) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>{gameOver.winnerId !== null ? `玩家 ${gameOver.winnerId} 胡了!` : "流局 / Draw"}</h2>
        <p>胡法: {gameOver.winType}</p>
        <p>分数: {gameOver.scores.join(", ")}</p>
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
    <GameTable
      state={gameState}
      onTileSelect={(tile) => setSelectedTileId(tile?.id ?? null)}
      selectedTileId={selectedTileId}
    />
  );
}
