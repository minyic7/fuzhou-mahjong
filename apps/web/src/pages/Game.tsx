import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { GameTable, type DrawAnimationState, type DrawAnimationSeat } from "../components/GameTable";
import { ClaimOverlay } from "../components/ClaimOverlay";
import { CenterAction, useCenterAction } from "../components/CenterAction";
import { sounds, setMuted, isMuted } from "../sounds";
import { TileCounter } from "../components/TileCounter";
import { TutorialModal } from "../components/TutorialModal";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { TileView } from "../components/Tile";
import { SessionSummary, type SessionData } from "../components/SessionSummary";
import { Button } from "../components/Button";
import { ActionType, MeldType } from "@fuzhou-mahjong/shared";
import type { ClientGameState, GameOverResult, AvailableActions, GameAction, PlayerDisconnectedEvent, PlayerReconnectedEvent, TileInstance } from "@fuzhou-mahjong/shared";

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
  const gameStartedRef = useRef(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };
  const [roundHistory, setRoundHistory] = useState<{ scores: number[]; winnerId: number | null; winType: string }[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionData | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCondensed, setTutorialCondensed] = useState(false);
  const [drawAnimation, setDrawAnimation] = useState<DrawAnimationState | null>(null);
  const drawAnimKeyRef = useRef(0);
  const [claimAnimation, setClaimAnimation] = useState<{ seat: DrawAnimationSeat; key: number } | null>(null);
  const claimAnimKeyRef = useRef(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [departingTile, setDepartingTile] = useState<TileInstance | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const [isPortrait, setIsPortrait] = useState(() => window.matchMedia("(orientation: portrait)").matches && window.innerWidth <= 768);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait) and (max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings dropdown on click outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  // First-game auto-show tutorial
  useEffect(() => {
    const seen = localStorage.getItem('tutorial-seen');
    if (!seen) {
      setTutorialCondensed(true);
      setShowTutorial(true);
      localStorage.setItem('tutorial-seen', '1');
    }
  }, []);

  // Warn before browser close/back during active game
  useEffect(() => {
    if (gameOver) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [gameOver]);

  // Intercept browser back button / swipe-back during active game
  useEffect(() => {
    if (gameOver) return;
    // Push a dummy state so back button triggers popstate instead of leaving
    history.pushState({ game: true }, "");

    const handler = () => {
      // Back was pressed — push state again and show confirm
      history.pushState({ game: true }, "");
      setShowLeaveConfirm(true);
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [gameOver]);

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
        const isSuppDraw = state.wallSupplementCount > prev.wallSupplementCount;
        if (isSuppDraw) sounds.supplementDraw(); else sounds.draw();
      }

      // Detect gold tile flip
      if (prev && state.gold && (!prev.gold || prev.gold.indicatorTile.id !== state.gold.indicatorTile.id)) {
        sounds.goldFlip();
      }

      // Detect low wall count warning (≤16 tiles remaining)
      if (prev && state.wallRemaining <= 16 && prev.wallRemaining > 16) {
        sounds.warning();
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
          const seatMap: DrawAnimationSeat[] = ["bottom", "right", "top", "left"];
          if (state.myMelds.length > prev.myMelds.length) {
            const meld = state.myMelds[state.myMelds.length - 1];
            showClaim(meld.tiles, meld.type, state.myName || "我");
            if (meld.type === "chi") sounds.chi();
            else if (meld.type === "peng") sounds.peng();
            else sounds.gang();
            // Claim fly toward bottom (self)
            const ck = ++claimAnimKeyRef.current;
            setClaimAnimation({ seat: "bottom", key: ck });
            setTimeout(() => setClaimAnimation((cur) => cur?.key === ck ? null : cur), 300);
          } else {
            for (let i = 0; i < state.otherPlayers.length; i++) {
              if (state.otherPlayers[i].melds.length > (prev.otherPlayers[i]?.melds.length || 0)) {
                const meld = state.otherPlayers[i].melds[state.otherPlayers[i].melds.length - 1];
                showClaim(meld.tiles, meld.type, state.otherPlayers[i].name || "");
                if (meld.type === "chi") sounds.chi();
                else if (meld.type === "peng") sounds.peng();
                else sounds.gang();
                // Claim fly toward the claiming player's seat
                const seat = seatMap[i + 1]; // otherPlayers[0]=right, [1]=top, [2]=left
                const ck = ++claimAnimKeyRef.current;
                setClaimAnimation({ seat, key: ck });
                setTimeout(() => setClaimAnimation((cur) => cur?.key === ck ? null : cur), 300);
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
        // Only clear actions if it's NOT my turn now.
        // If it IS my turn, actionRequired will set the correct actions.
        // Clearing unconditionally caused a race: gameStateUpdate would wipe
        // the actions set by a near-simultaneous actionRequired event.
        if (state.currentTurn !== state.myIndex) {
          setActions(null);
        }
      }

      setDepartingTile(null);
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
      // Show hu announcement in center before transitioning to game-over screen
      if (result.winnerId !== null) {
        const winnerName = (result.playerNames ?? [])[result.winnerId] || `玩家${result.winnerId}`;
        showClaim([], "hu", winnerName);
        sounds.hu();
      } else {
        sounds.gameDraw();
      }
      setGameOver(result);
      setRoundHistory((prev) => [...prev, {
        scores: result.scores,
        winnerId: result.winnerId,
        winType: result.winType,
      }]);
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
    socket.on("actionError", (error: { message: string; code: string }) => {
      sounds.error();
      addToast(`操作失败: ${error.message}`);
      socket.emit("resyncState");
    });

    return () => {
      socket.off("gameStateUpdate");
      socket.off("actionRequired");
      socket.off("gameOver");
      socket.off("playerDisconnected");
      socket.off("playerReconnected");
      socket.off("actionError");
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

  // Client-side safeguard: if actions were cleared by a race but it's our turn
  // and no claim is pending, allow discard so the bubble still appears.
  const effectiveCanDiscard = actions?.canDiscard
    ?? (gameState !== null && gameState.currentTurn === gameState.myIndex && !pendingClaim);

  const isClaimWindow = actions
    ? (actions.canHu || actions.canPeng || actions.canMingGang || actions.chiOptions.length > 0) && !actions.canDiscard
    : false;

  const isCompactMain = window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT;

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

    const [showAllHands, setShowAllHands] = useState(false);
    const isCompact = window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT;

    const isWin = gameOver.winnerId !== null;
    const confettiColors = ["#ff6b6b", "#ffd700", "#4caf50", "#2196f3", "#ff9800", "#e91e63"];

    return (
      <div>
        {isPortrait && (
          <div className="portrait-rotate-overlay">
            <div style={{ fontSize: 48, animation: 'rotatePhone 2s ease-in-out infinite' }}>📱</div>
            <div style={{ fontSize: 18, color: '#eee' }}>请旋转手机</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Please rotate your phone</div>
          </div>
        )}
        {isWin && (
          <div className="confetti-container">
            {Array.from({ length: isCompact ? 10 : 30 }).map((_, i) => (
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
      <div className={isWin ? "hu-celebration" : ""} style={{ textAlign: "center", padding: "clamp(12px, 3vh, 40px)", maxHeight: "100dvh", overflowY: "auto" }}>
        <div style={{ display: isCompact ? "grid" : "block", gridTemplateColumns: isCompact ? "1fr 1fr" : undefined, gap: 12 }}>
          <div>
        <h2 style={{ fontSize: isCompact ? 20 : 28, marginBottom: isCompact ? 8 : 16 }}>
          {isWin ? `🎉 ${getPlayerName(gameOver.winnerId!)} 胡了!` : "流局 / Draw"}
        </h2>
        <p style={{ fontSize: isCompact ? 14 : 18, color: "var(--color-text-gold)", marginBottom: 12 }}>
          {winTypeNames[gameOver.winType] || gameOver.winType}
        </p>

        {/* Score breakdown */}
        {gameOver.breakdown && isWin && (
          <div style={{ marginBottom: 12, padding: 10, background: "rgba(255,255,255,0.05)", borderRadius: 6, display: "inline-block" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>得分明细</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "center", fontSize: 13, color: "var(--color-text-primary)" }}>
              <span>花分: {gameOver.breakdown.flowerScore}</span>
              <span>金: {gameOver.breakdown.goldScore}</span>
              <span>连庄: {gameOver.breakdown.lianZhuangCount}</span>
              <span>特殊: {gameOver.breakdown.specialMultiplier}x</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-gold)", marginTop: 4 }}>
              总分: {gameOver.breakdown.totalScore}
            </div>
          </div>
        )}
          </div>
          <div>
        {/* Round scores */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: isCompact ? 12 : 14, color: "var(--color-text-secondary)", marginBottom: 6 }}>本局得分</div>
          {gameOver.scores
            .map((score, i) => ({ name: (gameOver.playerNames ?? [])[i] || getPlayerName(i), score, i }))
            .sort((a, b) => b.score - a.score)
            .map((p, rank) => (
              <div key={p.i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 16px", marginBottom: 4, borderRadius: 4, fontSize: isCompact ? 12 : 14,
                background: p.score > 0 ? "rgba(76,175,80,0.15)" : p.score < 0 ? "rgba(244,67,54,0.1)" : "transparent",
                border: rank === 0 && p.score > 0 ? "1px solid var(--color-success)" : "1px solid transparent",
                animation: `scoreReveal 0.3s ease-out ${rank * 0.1}s both`,
              }}>
                <span>
                  {rank === 0 && p.score > 0 ? "🏆 " : `${rank + 1}. `}
                  {p.name}
                </span>
                <span style={{ fontWeight: "bold", color: p.score > 0 ? "var(--color-success)" : p.score < 0 ? "var(--color-error)" : "var(--color-text-secondary)" }}>
                  {p.score > 0 ? "+" : ""}{p.score}
                </span>
              </div>
            ))}
        </div>

        {/* Cumulative standings */}
        {gameOver.cumulative && gameOver.cumulative.roundsPlayed > 0 && (
          <div style={{ marginBottom: isCompact ? 12 : 20 }}>
            <div style={{ fontSize: isCompact ? 12 : 14, color: "var(--color-text-secondary)", marginBottom: 6 }}>
              累计排名 ({gameOver.cumulative.roundsPlayed} 局)
            </div>
            {gameOver.cumulative.scores
              .map((score, i) => ({ name: (gameOver.playerNames ?? [])[i] || getPlayerName(i), score, i }))
              .sort((a, b) => b.score - a.score)
              .map((p, rank) => (
                <div key={p.i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 16px", marginBottom: 4, borderRadius: 4, fontSize: isCompact ? 12 : 14,
                  background: rank === 0 ? "rgba(255,215,0,0.12)" : "transparent",
                  border: rank === 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent",
                  animation: `scoreReveal 0.3s ease-out ${rank * 0.1}s both`,
                }}>
                  <span>
                    {rank === 0 ? "👑 " : `${rank + 1}. `}
                    {p.name}
                  </span>
                  <span style={{ fontWeight: "bold", color: p.score > 0 ? "var(--color-text-gold)" : p.score < 0 ? "var(--color-error)" : "var(--color-text-secondary)" }}>
                    {p.score > 0 ? "+" : ""}{p.score}
                  </span>
                </div>
              ))}
          </div>
        )}
          </div>
        </div>
        {/* All player hands */}
        {gameOver.allHands && gameOver.allHands.length > 0 && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <button
              onClick={() => setShowAllHands(!showAllHands)}
              style={{
                display: "block", width: "100%", padding: "8px 0", marginBottom: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6, color: "var(--color-text-secondary)", fontSize: 13,
                cursor: "pointer", textAlign: "center",
              }}
            >
              {showAllHands ? "收起手牌 ▲" : "查看所有手牌 ▼"}
            </button>
            {(showAllHands || !isCompact) && gameOver.allHands.map((playerHand, idx) => {
              const isWinner = idx === gameOver.winnerId;
              const name = (gameOver.playerNames ?? [])[idx] || getPlayerName(idx);
              return (
                <div key={idx} style={{
                  marginBottom: 8, padding: "8px 12px", borderRadius: 6,
                  background: isWinner ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.03)",
                  border: isWinner ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: isWinner ? "bold" : "normal", color: isWinner ? "var(--color-text-gold)" : "var(--color-text-primary)", marginBottom: 4 }}>
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

        <Button variant="gold" size="lg" onClick={handleNextRound} style={{ minHeight: 48 }}>
          下一局 / Next Round
        </Button>
        {onLeave && (
          <Button variant="secondary" onClick={() => {
              const cum = gameOver.cumulative;
              if (cum && cum.roundsPlayed > 0) {
                setSessionSummary({
                  playerNames: gameOver.playerNames ?? [],
                  cumulativeScores: cum.scores,
                  roundsPlayed: cum.roundsPlayed,
                  roundHistory,
                });
              } else {
                socket.emit("leaveRoom");
                onLeave();
              }
            }} style={{ marginLeft: 10, minHeight: 48 }}>
            离开 / Leave
          </Button>
        )}
      </div>
      {sessionSummary && (
        <SessionSummary
          data={sessionSummary}
          onClose={() => {
            setSessionSummary(null);
            socket.emit("leaveRoom");
            onLeave?.();
          }}
        />
      )}
      </div>
    );
  }

  if (!gameState) {
    return <div className="loading-state" style={{ minHeight: "80vh" }}><div className="spinner" />等待游戏数据...</div>;
  }

  return (
    <div className="game-wrapper">
      {isPortrait && (
        <div className="portrait-rotate-overlay">
          <div style={{ fontSize: 48, animation: 'rotatePhone 2s ease-in-out infinite' }}>📱</div>
          <div style={{ fontSize: 18, color: '#eee' }}>请旋转手机</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Please rotate your phone</div>
        </div>
      )}
      {showFlash && (
        <>
          <div className="screen-flash" />
          <div className="border-flash" />
        </>
      )}
      {/* Toast notifications */}
      <div className={`game-toast-container${isCompactMain ? ' compact' : ''}`}>
        {toasts.map((t) => (
          <div key={t.id} className="game-toast">
            {t.message}
          </div>
        ))}
      </div>
      <CenterAction display={centerAction} gold={gameState.gold} />
      <GameTable
        state={gameState}
        onTileSelect={(tile) => setSelectedTileId(tile?.id ?? null)}
        onTileDoubleClick={(tile) => {
          if (effectiveCanDiscard) {
            setDepartingTile(tile);
            handleAction({ type: ActionType.Discard, playerIndex: gameState.myIndex, tile });
          }
        }}
        selectedTileId={selectedTileId}
        claimableTileIds={getClaimableTileIds(actions)}
        canDiscard={effectiveCanDiscard}
        onDiscard={(tileInstanceId) => {
          const tile = gameState.myHand.find(t => t.id === tileInstanceId);
          if (tile) {
            setDepartingTile(tile);
            handleAction({ type: ActionType.Discard, playerIndex: gameState.myIndex, tile });
          }
        }}
        canHu={!!(actions?.canHu && effectiveCanDiscard)}
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
        claimAnimation={claimAnimation}
        departingTile={departingTile}
      />
      {isClaimWindow && actions && (
        <ClaimOverlay actions={actions} gameState={gameState} onAction={handleAction} />
      )}
      {/* Floating tile counter overlay */}
      <div style={{ position: "fixed", bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", left: 12, zIndex: 15 }}>
        <TileCounter gameState={gameState} />
      </div>
      {/* Settings gear button + dropdown */}
      <div ref={settingsRef} style={{
        position: 'fixed',
        top: 'calc(8px + env(safe-area-inset-top, 0px))',
        right: 'calc(8px + env(safe-area-inset-right, 0px))',
        zIndex: 20,
      }}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Settings"
          style={{
            width: 44, height: 44, minHeight: 44, borderRadius: "50%",
            background: "var(--overlay-bg)", border: "1px solid var(--color-gold-border-hover)",
            color: "var(--color-text-secondary)", fontSize: 20, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >⚙</button>
        {settingsOpen && (
          <div style={{
            position: 'absolute', top: 48, right: 0,
            background: 'var(--overlay-bg)', border: '1px solid var(--color-gold-border-hover)',
            borderRadius: 'var(--radius-md)', padding: 4, minWidth: 160,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <Button
              variant="secondary"
              size="sm"
              style={{ justifyContent: 'flex-start', width: '100%', border: 'none' }}
              onClick={() => { setTutorialCondensed(false); setShowTutorial(true); setSettingsOpen(false); }}
            >📖 规则说明</Button>
            <Button
              variant="secondary"
              size="sm"
              style={{ justifyContent: 'flex-start', width: '100%', border: 'none' }}
              onClick={() => { sounds.toggle(); const next = !muted; setMuted(next); setMutedState(next); }}
            >{muted ? '🔇' : '🔊'} 音效{muted ? '开启' : '关闭'}</Button>
            {onLeave && (
              <Button
                variant="danger"
                size="sm"
                style={{ justifyContent: 'flex-start', width: '100%', border: 'none' }}
                onClick={() => { setShowLeaveConfirm(true); setSettingsOpen(false); }}
              >🚪 退出游戏</Button>
            )}
          </div>
        )}
      </div>
      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="confirm-modal-backdrop">
          <div className="confirm-modal">
            <p className="confirm-modal-title">确定要退出吗？</p>
            <p className="confirm-modal-subtitle">退出后本局将由机器人代打</p>
            <div className="confirm-modal-actions">
              <Button variant='secondary' onClick={() => setShowLeaveConfirm(false)}>取消</Button>
              <Button variant='danger' onClick={() => { sounds.confirm(); socket.emit('leaveRoom'); onLeave!(); }}>退出游戏</Button>
            </div>
          </div>
        </div>
      )}
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        condensed={tutorialCondensed}
      />
    </div>
  );
}
