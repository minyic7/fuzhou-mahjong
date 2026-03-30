import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { GameTable, type DrawAnimationState, type DrawAnimationSeat } from "../components/GameTable";
import { ClaimOverlay } from "../components/ClaimOverlay";
import { CenterAction, useCenterAction } from "../components/CenterAction";
import { sounds, setMuted, isMuted } from "../sounds";
import { TileCounter } from "../components/TileCounter";
import { TutorialModal } from "../components/TutorialModal";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { useWindowSize } from "../hooks/useWindowSize";
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

  // Close settings dropdown on click/touch outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
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

  // Auto-close settings dropdown when claim overlay appears
  useEffect(() => {
    if (isClaimWindow) setSettingsOpen(false);
  }, [isClaimWindow]);

  const { height: windowHeight } = useWindowSize();
  const isCompactMain = windowHeight <= BREAKPOINTS.COMPACT_HEIGHT;

  const handleAction = (action: GameAction) => {
    socket.emit("playerAction", action);
    setSelectedTileId(null);
    setActions(null);
    setPendingClaim(false);
  };

  // Game-over helper functions (used in modal overlay below)
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


  if (!gameState) {
    return <div className="loading-state" style={{ minHeight: "80dvh" }}><div className="spinner" />等待游戏数据...</div>;
  }

  return (
    <div className="game-wrapper">
      {isPortrait && (
        <div className="portrait-rotate-overlay">
          <div className="portrait-title">福州麻将</div>
          <div className="portrait-phone-icon phone-rotate-icon">📱</div>
          <div className="portrait-msg">
            请将手机横屏以获得最佳体验
          </div>
          <div className="portrait-hint">
            Please rotate your device to landscape mode.
            The game table requires a wider screen to display properly.
          </div>
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
        revealedHands={gameOver?.allHands ?? null}
        claimActive={isClaimWindow}
      />
      {isClaimWindow && actions && (
        <ClaimOverlay actions={actions} gameState={gameState} onAction={handleAction} />
      )}
      {/* Floating tile counter overlay */}
      <div style={{ position: "fixed", bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", left: "calc(12px + env(safe-area-inset-left, 0px))", zIndex: 15 }}>
        <TileCounter gameState={gameState} />
      </div>
      {/* Settings gear button + dropdown */}
      <div ref={settingsRef} style={{
        position: 'fixed',
        top: 'calc(8px + env(safe-area-inset-top, 0px))',
        right: 'calc(8px + env(safe-area-inset-right, 0px))',
        zIndex: "var(--z-settings-btn)" as any,
      }}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Settings"
          style={{
            width: "var(--btn-min-size)", height: "var(--btn-min-size)", minHeight: "var(--btn-min-size)", borderRadius: "50%",
            background: "var(--overlay-bg)", border: "1px solid var(--color-gold-border-hover)",
            color: "var(--color-text-secondary)", fontSize: 20, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >⚙</button>
        {settingsOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: "var(--z-settings-dropdown)" as any,
            background: 'var(--overlay-bg)', border: '1px solid var(--color-gold-border-hover)',
            borderRadius: 'var(--radius-md)', padding: 4, minWidth: "clamp(120px, 35vw, 160px)",
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
      {/* Game-over modal overlay — shows on top of the game table */}
      {gameOver && (() => {
        const go = gameOver!;
        return (
        <div style={{
          position: "fixed", inset: 0, zIndex: "var(--z-game-over)" as any,
          background: "rgba(0,0,0,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "overlayFadeIn 0.3s ease-out",
        }}>
          <div style={{
            background: "var(--overlay-bg)",
            border: "2px solid var(--color-gold-border-hover)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(8px, 2.5dvh, 16px) clamp(12px, 3dvh, 20px)",
            maxWidth: "min(360px, 90vw)", width: "90vw",
            maxHeight: "clamp(200px, 80dvh, 90dvh)", overflowY: "auto",
            textAlign: "center",
            animation: "overlayScaleIn 0.3s ease-out",
          }}>
            <h2 style={{ fontSize: "clamp(16px, 5dvh, 24px)", marginBottom: "clamp(4px, 1.2dvh, 8px)" }}>
              {go.winnerId !== null
                ? `🎉 ${(go.playerNames ?? [])[go.winnerId] || "玩家"} 胡了!`
                : "流局 / Draw"}
            </h2>
            <p style={{ fontSize: "clamp(12px, 3.5dvh, 16px)", color: "var(--color-text-gold)", marginBottom: "clamp(6px, 2dvh, 12px)" }}>
              {winTypeNames[go.winType] || go.winType}
            </p>

            {/* Winning hand tiles */}
            {go.winnerId !== null && go.allHands?.[go.winnerId] && (() => {
              const winnerHand = go.allHands[go.winnerId!];
              const tileStyle = { width: "var(--fp-opponent-tile-w)", height: "var(--fp-opponent-tile-h)" };
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", marginBottom: "clamp(6px, 2dvh, 12px)" }}>
                  {winnerHand.melds.map((m, mi) => (
                    <div key={`m${mi}`} style={{ display: "flex", gap: 1 }}>
                      {m.tiles.map((t, ti) => (
                        <TileView key={t.id} tile={t} faceUp={m.type !== MeldType.AnGang} small gold={gameState?.gold} style={tileStyle} />
                      ))}
                    </div>
                  ))}
                  {winnerHand.hand.map(t => (
                    <TileView key={t.id} tile={t} faceUp small gold={gameState?.gold} style={tileStyle} />
                  ))}
                  {winnerHand.flowers.length > 0 && (
                    <div style={{ display: "flex", gap: 1, marginLeft: 4 }}>
                      {winnerHand.flowers.map(t => (
                        <TileView key={t.id} tile={t} faceUp small style={tileStyle} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Score breakdown */}
            {go.breakdown && go.winnerId !== null && (
              <div className="score-breakdown">
                <div style={{ fontSize: "clamp(10px, 2.8dvh, 12px)", color: "var(--color-text-secondary)", marginBottom: "clamp(2px, 0.8dvh, 4px)" }}>得分明细</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(2px, 0.8dvh, 4px) clamp(6px, 2dvh, 12px)", justifyContent: "center", fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-primary)" }}>
                  <span>花分: {go.breakdown.flowerScore}</span>
                  <span>金: {go.breakdown.goldScore}</span>
                  <span>连庄: {go.breakdown.lianZhuangCount}</span>
                  <span>特殊: {go.breakdown.specialMultiplier}x</span>
                </div>
                <div style={{ fontSize: "clamp(12px, 3.2dvh, 14px)", color: "var(--color-text-gold)", marginTop: "clamp(2px, 0.8dvh, 4px)" }}>
                  总分: {go.breakdown.totalScore}
                </div>
              </div>
            )}

            {/* Round scores */}
            <div style={{ marginBottom: "clamp(6px, 2dvh, 12px)" }}>
              {go.scores
                .map((score, i) => ({ name: (go.playerNames ?? [])[i] || `玩家${i}`, score, i }))
                .sort((a, b) => b.score - a.score)
                .map((p, rank) => (
                  <div key={p.i} className={`score-row${p.score > 0 ? " positive" : p.score < 0 ? " negative" : ""}${rank === 0 && p.score > 0 ? " top-positive" : ""}`}
                    style={{ animation: `scoreReveal 0.3s ease-out ${rank * 0.1}s both` }}>
                    <span>{rank === 0 && p.score > 0 ? "🏆 " : `${rank + 1}. `}{p.name}</span>
                    <span style={{ fontWeight: "bold", color: p.score > 0 ? "var(--color-success)" : p.score < 0 ? "var(--color-error)" : "var(--color-text-secondary)" }}>
                      {p.score > 0 ? "+" : ""}{p.score}
                    </span>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "clamp(6px, 2dvh, 12px)", justifyContent: "center", flexWrap: "wrap" }}>
              <Button variant="gold" size="lg" onClick={handleNextRound} style={{ minHeight: "clamp(var(--btn-min-size), 10dvh, 48px)" }}>
                下一局 / Next Round
              </Button>
              {onLeave && (
                <Button variant="secondary" onClick={() => {
                  const cum = go.cumulative;
                  if (cum && cum.roundsPlayed > 0) {
                    setSessionSummary({
                      playerNames: go.playerNames ?? [],
                      cumulativeScores: cum.scores,
                      roundsPlayed: cum.roundsPlayed,
                      roundHistory,
                    });
                  } else {
                    socket.emit("leaveRoom");
                    onLeave();
                  }
                }} style={{ minHeight: "clamp(var(--btn-min-size), 10dvh, 48px)" }}>
                  离开 / Leave
                </Button>
              )}
            </div>
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
      })()}
    </div>
  );
}
