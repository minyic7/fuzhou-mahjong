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
  const [showFlash, setShowFlash] = useState(false);
  const [pendingClaim, setPendingClaim] = useState(false);

  useEffect(() => {
    // gameStarted is handled by App.tsx (passed as initialGameState prop)
    // Only listen for subsequent updates here
    socket.on("gameStateUpdate", (state) => {
      setGameState(state);
      // Don't clear actions here — actionRequired is the authoritative source.
      // Clearing on turn change races with actionRequired and causes buttons to vanish.
    });
    socket.on("actionRequired", (availableActions) => {
      // Don't overwrite claim actions while user is actively choosing (chi picker open)
      setPendingClaim((isPending) => {
        if (isPending) return isPending; // keep current actions, ignore new ones
        setActions(availableActions);
        // Flash screen when claim actions available (chi/peng/gang/hu)
        const hasClaim = availableActions.canHu || availableActions.canPeng || availableActions.canMingGang || (availableActions.chiOptions?.length > 0);
        if (hasClaim && !availableActions.canDiscard) {
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 1500);
          return true; // mark as pending claim
        }
        return false;
      });
    });
    socket.on("gameOver", (result) => setGameOver(result));

    return () => {
      socket.off("gameStateUpdate");
      socket.off("actionRequired");
      socket.off("gameOver");
    };
  }, []);

  const getClaimableTileIds = (a: AvailableActions | null): Set<number> => {
    const ids = new Set<number>();
    if (!a) return ids;
    // Chi tiles
    for (const combo of a.chiOptions ?? []) {
      for (const t of combo) ids.add(t.id);
    }
    // Peng: tiles matching lastDiscard
    if (a.canPeng && gameState?.lastDiscard && gameState.myHand) {
      const d = gameState.lastDiscard.tile.tile;
      if (d.kind === "suited") {
        for (const t of gameState.myHand) {
          if (t.tile.kind === "suited" && t.tile.suit === d.suit && t.tile.value === d.value) ids.add(t.id);
        }
      }
    }
    return ids;
  };

  const handleAction = (action: GameAction) => {
    socket.emit("playerAction", action);
    setSelectedTileId(null);
    setActions(null);
    setPendingClaim(false);
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

    const isWin = gameOver.winnerId !== null;
    const confettiColors = ["#ff6b6b", "#ffd700", "#4caf50", "#2196f3", "#ff9800", "#e91e63"];

    return (
      <div>
        {isWin && (
          <div className="confetti-container">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  background: confettiColors[i % confettiColors.length],
                  borderRadius: Math.random() > 0.5 ? "50%" : "0",
                  width: 8 + Math.random() * 8,
                  height: 8 + Math.random() * 8,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        )}
      <div className={isWin ? "hu-celebration" : ""} style={{ textAlign: "center", padding: 40 }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>
          {isWin ? `🎉 ${getPlayerName(gameOver.winnerId!)} 胡了!` : "流局 / Draw"}
        </h2>
        <p style={{ fontSize: 18, color: "#ffd700", marginBottom: 12 }}>
          {winTypeNames[gameOver.winType] || gameOver.winType}
        </p>

        {/* Score breakdown */}
        {gameOver.breakdown && isWin && (
          <div style={{ marginBottom: 12, padding: 10, background: "rgba(255,255,255,0.05)", borderRadius: 6, display: "inline-block" }}>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>得分明细</div>
            <div style={{ fontSize: 13, color: "#ccc" }}>
              花分: {gameOver.breakdown.flowerScore} | 金: {gameOver.breakdown.goldScore} | 连庄: {gameOver.breakdown.lianZhuangCount} | 特殊: {gameOver.breakdown.specialMultiplier}x
            </div>
            <div style={{ fontSize: 14, color: "#ffd700", marginTop: 4 }}>
              总分: {gameOver.breakdown.totalScore}
            </div>
          </div>
        )}

        {/* Player ranking */}
        <div style={{ marginBottom: 20 }}>
          {gameOver.scores
            .map((score, i) => ({ name: (gameOver.playerNames ?? [])[i] || getPlayerName(i), score, i }))
            .sort((a, b) => b.score - a.score)
            .map((p, rank) => (
              <div key={p.i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 16px", marginBottom: 4, borderRadius: 4,
                background: p.score > 0 ? "rgba(76,175,80,0.15)" : p.score < 0 ? "rgba(244,67,54,0.1)" : "transparent",
                border: rank === 0 && p.score > 0 ? "1px solid #4caf50" : "1px solid transparent",
              }}>
                <span>
                  {rank === 0 && p.score > 0 ? "🏆 " : `${rank + 1}. `}
                  {p.name}
                </span>
                <span style={{ fontWeight: "bold", color: p.score > 0 ? "#4caf50" : p.score < 0 ? "#f44336" : "#aaa" }}>
                  {p.score > 0 ? "+" : ""}{p.score}
                </span>
              </div>
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
      {showFlash && (
        <>
          <div className="screen-flash" />
          <div className="border-flash" />
        </>
      )}
      <GameTable
        state={gameState}
        onTileSelect={(tile) => setSelectedTileId(tile?.id ?? null)}
        onTileDoubleClick={(tile) => {
          if (actions?.canDiscard) {
            handleAction({ type: "discard" as any, playerIndex: gameState.myIndex, tile });
          }
        }}
        selectedTileId={selectedTileId}
        claimableTileIds={getClaimableTileIds(actions)}
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
