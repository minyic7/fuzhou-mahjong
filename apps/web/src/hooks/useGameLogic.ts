import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { useCenterAction, type ActionDisplay } from "../components/CenterAction";
import { sounds, setMuted, isMuted } from "../sounds";
import { BREAKPOINTS } from "./useIsMobile";
import { useWindowSize } from "./useWindowSize";
import { ActionType } from "@fuzhou-mahjong/shared";
import type {
  ClientGameState,
  GameOverResult,
  AvailableActions,
  GameAction,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  TileInstance,
} from "@fuzhou-mahjong/shared";
import type { DrawAnimationState, DrawAnimationSeat } from "../components/GameTable";
import type { SessionData } from "../components/SessionSummary";

interface GameLogicProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function useGameLogic({ initialGameState, onLeave }: GameLogicProps) {
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
  const [isPortrait, setIsPortrait] = useState(() => window.matchMedia("(orientation: portrait)").matches && window.innerWidth <= BREAKPOINTS.TABLET_WIDTH);

  useEffect(() => {
    const mq = window.matchMedia(`(orientation: portrait) and (max-width: ${BREAKPOINTS.TABLET_WIDTH}px)`);
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

  // Game-over helper functions
  const handleNextRound = () => {
    socket.emit("nextRound");
    setGameOver(null);
    setActions(null);
    setSelectedTileId(null);
  };

  // GameTable handlers
  const handleTileSelect = (tile: TileInstance | null) => setSelectedTileId(tile?.id ?? null);

  const handleTileDoubleClick = (tile: TileInstance) => {
    if (effectiveCanDiscard && gameState) {
      setDepartingTile(tile);
      handleAction({ type: ActionType.Discard, playerIndex: gameState.myIndex, tile });
    }
  };

  const handleDiscardById = (tileInstanceId: number) => {
    if (!gameState) return;
    const tile = gameState.myHand.find(t => t.id === tileInstanceId);
    if (tile) {
      setDepartingTile(tile);
      handleAction({ type: ActionType.Discard, playerIndex: gameState.myIndex, tile });
    }
  };

  const handleHu = () => {
    if (gameState) handleAction({ type: ActionType.Hu, playerIndex: gameState.myIndex });
  };

  const handleDraw = () => {
    if (gameState) handleAction({ type: ActionType.Draw, playerIndex: gameState.myIndex });
  };

  const handleAnGang = (tileInstanceId: number) => {
    if (!gameState) return;
    const tile = gameState.myHand.find(t => t.id === tileInstanceId);
    if (tile) handleAction({ type: ActionType.AnGang, playerIndex: gameState.myIndex, tile });
  };

  const handleBuGang = (tileInstanceId: number) => {
    if (!gameState) return;
    const tile = gameState.myHand.find(t => t.id === tileInstanceId);
    if (tile) handleAction({ type: ActionType.BuGang, playerIndex: gameState.myIndex, tile });
  };

  const handleBackgroundClick = () => setSelectedTileId(null);

  // Settings/UI handlers
  const handleToggleMute = () => {
    sounds.toggle();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const handleOpenFullTutorial = () => {
    setTutorialCondensed(false);
    setShowTutorial(true);
    setSettingsOpen(false);
  };

  const handleRequestLeave = () => {
    setShowLeaveConfirm(true);
    setSettingsOpen(false);
  };

  const handleConfirmLeave = () => {
    sounds.confirm();
    socket.emit('leaveRoom');
    onLeave!();
  };

  const handleLeaveOrShowSummary = () => {
    const cum = gameOver?.cumulative;
    if (cum && cum.roundsPlayed > 0) {
      setSessionSummary({
        playerNames: gameOver!.playerNames ?? [],
        cumulativeScores: cum.scores,
        roundsPlayed: cum.roundsPlayed,
        roundHistory,
      });
    } else {
      socket.emit("leaveRoom");
      onLeave?.();
    }
  };

  const handleSessionSummaryClose = () => {
    setSessionSummary(null);
    socket.emit("leaveRoom");
    onLeave?.();
  };

  const winTypeNames: Record<string, string> = {
    normal: "普通胡", tianHu: "天胡 30x", grabGold: "抢金 30x",
    pingHu0: "平胡(无花) 30x", pingHu1: "平胡(一花) 15x",
    threeGoldDown: "三金倒 40x", goldSparrow: "金雀 60x", goldDragon: "金龙 120x",
    duiDuiHu: "对对胡", qingYiSe: "清一色", draw: "流局",
  };

  return {
    // State
    gameState,
    selectedTileId,
    gameOver,
    actions,
    showFlash,
    disconnectedPlayers,
    toasts,
    roundHistory,
    sessionSummary,
    showTutorial,
    tutorialCondensed,
    drawAnimation,
    claimAnimation,
    showLeaveConfirm,
    departingTile,
    settingsOpen,
    muted,
    isPortrait,

    // Computed
    centerAction,
    effectiveCanDiscard,
    isClaimWindow,
    isCompactMain,
    claimableTileIds: getClaimableTileIds(actions),
    kongTileIds: getKongTileIds(actions),
    canHuSelf: !!(actions?.canHu && effectiveCanDiscard),
    canDraw: actions?.canDraw ?? false,
    winTypeNames,

    // Refs
    settingsRef,

    // Setters
    setSettingsOpen,
    setShowLeaveConfirm,
    setShowTutorial,

    // Handlers
    handleAction,
    handleNextRound,
    handleTileSelect,
    handleTileDoubleClick,
    handleDiscardById,
    handleHu,
    handleDraw,
    handleAnGang,
    handleBuGang,
    handleBackgroundClick,
    handleToggleMute,
    handleOpenFullTutorial,
    handleRequestLeave,
    handleConfirmLeave,
    handleLeaveOrShowSummary,
    handleSessionSummaryClose,

    // Props passthrough
    onLeave,
  };
}

export type GameLogicState = ReturnType<typeof useGameLogic>;
