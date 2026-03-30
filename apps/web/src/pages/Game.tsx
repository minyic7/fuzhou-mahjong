import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { GameTable, type DrawAnimationState, type DrawAnimationSeat } from "../components/GameTable";
import { ClaimOverlay } from "../components/ClaimOverlay";
import { CenterAction, useCenterAction } from "../components/CenterAction";
import { sounds, setMuted, isMuted } from "../sounds";
import { TileCounter } from "../components/TileCounter";
import { TutorialModal } from "../components/TutorialModal";
import { TileView } from "../components/Tile";
import { ActionType, MeldType } from "@fuzhou-mahjong/shared";
import type { ClientGameState, GameOverResult, AvailableActions, GameAction, PlayerDisconnectedEvent, PlayerReconnectedEvent } from "@fuzhou-mahjong/shared";

const MUTE_KEY = "fuzhou-mahjong-muted";

interface GameProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function Game({ initialGameState, onLeave }: GameProps) {
  // Lock orientation to landscape on mount; release on unmount
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // screen.orientation.lock() is not in all TS DOM libs yet
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (type: string) => Promise<void>;
          unlock?: () => void;
        };
        await orientation.lock?.('landscape');
      } catch {
        // Not supported or not allowed — CSS fallback handles it
      }
    };
    lockOrientation();

    return () => {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          unlock?: () => void;
        };
        orientation.unlock?.();
      } catch {
        // ignore
      }
    };
  }, []);

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
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCondensed, setTutorialCondensed] = useState(false);
  const [drawAnimation, setDrawAnimation] = useState<DrawAnimationState | null>(null);
  const drawAnimKeyRef = useRef(0);

  // First-game auto-show tutorial
  useEffect(() => {
    const seen = localStorage.getItem('tutorial-seen');
    if (!seen) {
      setTutorialCondensed(true);
      setShowTutorial(true);
      localStorage.setItem('tutorial-seen', '1');
    }
  }, []);

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

      // Detect wall draw/supplement for fly animation
      if (prev) {
        const drawDelta = state.wallDrawCount - prev.wallDrawCount;
        const suppDelta = state.wallSupplementCount - prev.wallSupplementCount;
        if (drawDelta > 0 || suppDelta > 0) {
          const isSupplement = suppDelta > 0;
          // Determine which seat drew: currentTurn is the player who just drew
          const relIdx = (state.currentTurn - state.myIndex + 4) % 4;
          const seatMap: DrawAnimationSeat[] = ["bottom", "right", "top", "left"];
          const seat = seatMap[relIdx];
          const key = ++drawAnimKeyRef.current;
          setDrawAnimation({ seat, isSupplement, key });
          const duration = seat === "bottom" ? 300 : 200;
          setTimeout(() => setDrawAnimation((cur) => cur?.key === key ? null : cur), duration);
        }
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
    socket.on("playerDisconnected", (event: PlayerDisconnectedEvent) => {
      setDisconnectedPlayers((prev) => new Set(prev).add(event.playerIndex));
      addToast(`${event.playerName} 断线了 / disconnected`);
    });
    socket.on("playerReconnected", (event: PlayerReconnectedEvent) => {
      setDisconnectedPlayers((prev) => {
        const next = new Set(prev);
        next.delete(event.playerIndex);
        return next;
      });
      addToast(`${event.playerName} 已重连 / reconnected`);
    });

    return () => {
      socket.off("gameStateUpdate");
      socket.off("actionRequired");
      socket.off("gameOver");
      socket.off("playerDisconnected");
      socket.off("playerReconnected");
    };
  }, []);

  // Escape key dismisses tile selection (and thus the discard bubble)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTileId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const getKongTileIds = (a: AvailableActions | null): Set<number> => {
    const ids = new Set<number>();
    if (!a) return ids;
    for (const combo of a.anGangOptions ?? []) {
      for (const t of combo) ids.add(t.id);
    }
    for (const opt of a.buGangOptions ?? []) {
      ids.add(opt.tile.id);
    }
    return ids;
  };

  const isClaimWindow = actions
    ? (actions.canHu || actions.canPeng || actions.canMingGang || actions.chiOptions.length > 0) && !actions.canDiscard
    : false;

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

        {/* Round scores */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>本局得分</div>
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

        {/* Cumulative standings */}
        {gameOver.cumulative && gameOver.cumulative.roundsPlayed > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>
              累计排名 ({gameOver.cumulative.roundsPlayed} 局)
            </div>
            {gameOver.cumulative.scores
              .map((score, i) => ({ name: (gameOver.playerNames ?? [])[i] || getPlayerName(i), score, i }))
              .sort((a, b) => b.score - a.score)
              .map((p, rank) => (
                <div key={p.i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 16px", marginBottom: 4, borderRadius: 4,
                  background: rank === 0 ? "rgba(255,215,0,0.12)" : "transparent",
                  border: rank === 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent",
                }}>
                  <span>
                    {rank === 0 ? "👑 " : `${rank + 1}. `}
                    {p.name}
                  </span>
                  <span style={{ fontWeight: "bold", color: p.score > 0 ? "#ffd700" : p.score < 0 ? "#f44336" : "#aaa" }}>
                    {p.score > 0 ? "+" : ""}{p.score}
                  </span>
                </div>
              ))}
          </div>
        )}
        {/* All player hands */}
        {gameOver.allHands && gameOver.allHands.length > 0 && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, textAlign: "center" }}>
              所有玩家手牌 / All Hands
            </div>
            {gameOver.allHands.map((playerHand, idx) => {
              const isWinner = idx === gameOver.winnerId;
              const name = (gameOver.playerNames ?? [])[idx] || getPlayerName(idx);
              return (
                <div key={idx} style={{
                  marginBottom: 8, padding: "8px 12px", borderRadius: 6,
                  background: isWinner ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.03)",
                  border: isWinner ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: isWinner ? "bold" : "normal", color: isWinner ? "#ffd700" : "#ccc", marginBottom: 4 }}>
                    {isWinner ? "🏆 " : ""}{name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "flex-end" }}>
                    {/* Hand tiles */}
                    {playerHand.hand.map((t) => (
                      <TileView key={t.id} tile={t} faceUp gold={gameState?.gold} small />
                    ))}
                    {/* Melds */}
                    {playerHand.melds.length > 0 && (
                      <>
                        <div style={{ width: 4 }} />
                        {playerHand.melds.map((m, mi) => (
                          <div key={`meld-${mi}`} style={{ display: "flex", gap: 0 }}>
                            {m.tiles.map((t, ti) => (
                              <TileView key={ti} tile={t} faceUp={m.type !== MeldType.AnGang} gold={gameState?.gold} small />
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                    {/* Flowers */}
                    {playerHand.flowers.length > 0 && (
                      <>
                        <div style={{ width: 4 }} />
                        {playerHand.flowers.map((t) => (
                          <TileView key={t.id} tile={t} faceUp gold={gameState?.gold} small />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
    <div className="game-wrapper">
      <div className="portrait-rotate-overlay">
        <div style={{ fontSize: 48, animation: 'rotatePhone 2s ease-in-out infinite' }}>📱</div>
        <div style={{ fontSize: 18, color: '#eee' }}>请旋转手机</div>
        <div style={{ fontSize: 14, color: '#8fbc8f' }}>Please rotate your phone</div>
      </div>
      {showFlash && (
        <>
          <div className="screen-flash" />
          <div className="border-flash" />
        </>
      )}
      {/* Toast notifications */}
      <div style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 9000, display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
        pointerEvents: "none",
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: "rgba(0,0,0,0.85)", color: "#e8d5a3", padding: "8px 20px",
            borderRadius: 8, fontSize: 14, fontWeight: "bold",
            border: "1px solid rgba(232,213,163,0.3)",
            animation: "pageFadeIn 0.3s ease-out",
            whiteSpace: "nowrap",
          }}>
            {t.message}
          </div>
        ))}
      </div>
      <CenterAction display={centerAction} gold={gameState.gold} />
      <GameTable
        state={gameState}
        onTileSelect={(tile) => setSelectedTileId(tile?.id ?? null)}
        onTileDoubleClick={(tile) => {
          if (actions?.canDiscard) {
            handleAction({ type: ActionType.Discard, playerIndex: gameState.myIndex, tile });
          }
        }}
        selectedTileId={selectedTileId}
        claimableTileIds={getClaimableTileIds(actions)}
        canDiscard={actions?.canDiscard ?? false}
        onDiscard={(tileInstanceId) => {
          const tile = gameState.myHand.find(t => t.id === tileInstanceId);
          if (tile) handleAction({ type: ActionType.Discard, playerIndex: gameState.myIndex, tile });
        }}
        canHu={!!(actions?.canHu && actions?.canDiscard)}
        onHu={() => handleAction({ type: ActionType.Hu, playerIndex: gameState.myIndex })}
        canDraw={actions?.canDraw ?? false}
        onDraw={() => handleAction({ type: ActionType.Draw, playerIndex: gameState.myIndex })}
        kongTileIds={getKongTileIds(actions)}
        onAnGang={(tileInstanceId) => {
          const tile = gameState.myHand.find(t => t.id === tileInstanceId);
          if (tile) handleAction({ type: ActionType.AnGang, playerIndex: gameState.myIndex, tile });
        }}
        onBuGang={(tileInstanceId) => {
          const tile = gameState.myHand.find(t => t.id === tileInstanceId);
          if (tile) handleAction({ type: ActionType.BuGang, playerIndex: gameState.myIndex, tile });
        }}
        onBackgroundClick={() => setSelectedTileId(null)}
        disconnectedPlayers={disconnectedPlayers}
        drawAnimation={drawAnimation}
      />
      {isClaimWindow && actions && (
        <ClaimOverlay actions={actions} gameState={gameState} onAction={handleAction} />
      )}
      <TileCounter gameState={gameState} />
      {/* Help button */}
      <button
        onClick={() => { setTutorialCondensed(false); setShowTutorial(true); }}
        aria-label="How to play"
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          width: 36,
          height: 36,
          minHeight: 36,
          borderRadius: "50%",
          background: "rgba(15,30,25,0.85)",
          border: "1px solid rgba(184,134,11,0.4)",
          color: "#8fbc8f",
          fontSize: 18,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 20,
          padding: 0,
        }}
      >
        ?
      </button>
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        condensed={tutorialCondensed}
      />
    </div>
  );
}
