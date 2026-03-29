import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { GameTable } from "../components/GameTable";
import { ActionBar } from "../components/ActionBar";
import { CenterAction, useCenterAction } from "../components/CenterAction";
import { sounds, setMuted, isMuted } from "../sounds";
import type { ClientGameState, GameOverResult, AvailableActions, GameAction } from "@fuzhou-mahjong/shared";

const MUTE_KEY = "fuzhou-mahjong-muted";

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
  const { display: centerAction, showDiscard, showClaim } = useCenterAction();
  const prevStateRef = useRef<ClientGameState | null>(null);
  const [soundMuted, setSoundMuted] = useState(() => {
    const stored = localStorage.getItem(MUTE_KEY);
    if (stored === "true") { setMuted(true); return true; }
    return false;
  });
  const gameStartedRef = useRef(false);

  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setMuted(next);
    localStorage.setItem(MUTE_KEY, String(next));
  };

  useEffect(() => {
    socket.on("gameStateUpdate", (state) => {
      // Play game start sound on first state update
      if (!gameStartedRef.current) {
        gameStartedRef.current = true;
        sounds.gameStart();
      }

      // Detect discard: lastDiscard changed
      const prev = prevStateRef.current;
      if (state.lastDiscard && (!prev?.lastDiscard || prev.lastDiscard.tile.id !== state.lastDiscard.tile.id)) {
        const names = [state.myName || "我", ...(state.otherPlayers?.map(p => p.name) || [])];
        const relIdx = (state.lastDiscard.playerIndex - state.myIndex + 4) % 4;
        showDiscard(state.lastDiscard.tile, names[relIdx] || "");
        sounds.discard();
      }

      // Detect draw: my hand grew without a new meld
      if (prev && state.myHand.length > prev.myHand.length && state.myMelds.length === prev.myMelds.length) {
        sounds.draw();
      }

      // Detect new meld: total melds increased
      if (prev) {
        const prevMelds = prev.myMelds.length + prev.otherPlayers.reduce((s, p) => s + p.melds.length, 0);
        const newMelds = state.myMelds.length + state.otherPlayers.reduce((s, p) => s + p.melds.length, 0);
        if (newMelds > prevMelds) {
          // Find which player got a new meld
          if (state.myMelds.length > prev.myMelds.length) {
            const meld = state.myMelds[state.myMelds.length - 1];
            showClaim(meld.tiles, meld.type, state.myName || "我");
            if (meld.type === "chi") sounds.chi();
            else if (meld.type === "peng") sounds.peng();
            else sounds.gang();
          } else {
            for (let i = 0; i < state.otherPlayers.length; i++) {
              if (state.otherPlayers[i].melds.length > (prev.otherPlayers[i]?.melds.length || 0)) {
                const meld = state.otherPlayers[i].melds[state.otherPlayers[i].melds.length - 1];
                showClaim(meld.tiles, meld.type, state.otherPlayers[i].name || "");
                if (meld.type === "chi") sounds.chi();
                else if (meld.type === "peng") sounds.peng();
                else sounds.gang();
                break;
              }
            }
          }
        }
      }

      // Clear pendingClaim when the game state moves on (turn changed or lastDiscard cleared)
      // so stale claim actions don't block future actionRequired events
      if (prev && (state.currentTurn !== prev.currentTurn || (!state.lastDiscard && prev.lastDiscard))) {
        setPendingClaim(false);
        setActions(null);
      }

      prevStateRef.current = state;
      setGameState(state);
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
          sounds.claim();
          return true; // mark as pending claim
        }
        if (availableActions.canDiscard) sounds.yourTurn();
        return false;
      });
    });
    socket.on("gameOver", (result) => {
      setGameOver(result);
      if (result.winnerId !== null) sounds.hu();
    });

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
    return <div className="loading-state" style={{ minHeight: "80vh" }}><div className="spinner" />等待游戏数据...</div>;
  }

  return (
    <div>
      {showFlash && (
        <>
          <div className="screen-flash" />
          <div className="border-flash" />
        </>
      )}
      <CenterAction display={centerAction} gold={gameState.gold} />
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
