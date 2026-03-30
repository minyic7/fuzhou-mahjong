import { useState, useEffect, useRef } from "react";
import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { PlayerArea } from "./PlayerArea";
import { GameInfo } from "./GameInfo";
import { TileWall } from "./TileWall";
import { TILE_BACK_URL } from "../tileSvg";
import { TileView } from "./Tile";
import { useIsCompactLandscape, useIsFirstPersonMobile } from "../hooks/useIsMobile";

export type DrawAnimationSeat = "bottom" | "top" | "left" | "right";

export interface DrawAnimationState {
  seat: DrawAnimationSeat;
  isSupplement: boolean;
  key: number; // unique key to re-trigger animation
}

interface GameTableProps {
  state: ClientGameState;
  onTileSelect: (tile: TileInstance | null) => void;
  onTileDoubleClick?: (tile: TileInstance) => void;
  selectedTileId: number | null;
  claimableTileIds?: Set<number>;
  canDiscard?: boolean;
  onDiscard?: (tileInstanceId: number) => void;
  canHu?: boolean;
  onHu?: () => void;
  canDraw?: boolean;
  onDraw?: () => void;
  kongTileIds?: Set<number>;
  onAnGang?: (tileInstanceId: number) => void;
  onBuGang?: (tileInstanceId: number) => void;
  onBackgroundClick?: () => void;
  disconnectedPlayers?: Set<number>;
  drawAnimation?: DrawAnimationState | null;
  claimAnimation?: { seat: DrawAnimationSeat; key: number } | null;
  departingTile?: TileInstance | null;
  revealedHands?: { hand: TileInstance[]; melds: import("@fuzhou-mahjong/shared").Meld[]; flowers: TileInstance[] }[] | null;
  claimActive?: boolean;
}

export function GameTable({ state, onTileSelect, onTileDoubleClick, selectedTileId, claimableTileIds, canDiscard, onDiscard, canHu, onHu, canDraw, onDraw, kongTileIds, onAnGang, onBuGang, onBackgroundClick, disconnectedPlayers, drawAnimation, claimAnimation, departingTile, revealedHands, claimActive }: GameTableProps) {
  const isCompact = useIsCompactLandscape();
  const isFirstPersonMobile = useIsFirstPersonMobile();

  // Discard fly overlay — triggered when a tile departs the hand
  const [discardFlyKey, setDiscardFlyKey] = useState<number | null>(null);
  const discardFlyKeyRef = useRef(0);
  useEffect(() => {
    if (departingTile != null) {
      const key = ++discardFlyKeyRef.current;
      setDiscardFlyKey(key);
      setTimeout(() => setDiscardFlyKey((cur) => (cur === key ? null : cur)), 500);
    }
  }, [departingTile]);
  const { myHand, myFlowers, myMelds, myDiscards, myName, otherPlayers, currentTurn, myIndex, gold, dealerIndex, lianZhuangCount, wallRemaining, myHasDiscardedGold, cumulativeScores, roundsPlayed } = state;
  const lastDiscardTileId = state.lastDiscard?.tile.id ?? null;
  const lastDiscardPlayerIndex = state.lastDiscard?.playerIndex ?? -1;
  const botLabel = (name: string, isBot?: boolean) => isBot ? `${name} 🤖` : name;
  const labels = [
    myName || "我",
    botLabel(otherPlayers[0]?.name || "右", otherPlayers[0]?.isBot),
    botLabel(otherPlayers[1]?.name || "上", otherPlayers[1]?.isBot),
    botLabel(otherPlayers[2]?.name || "左", otherPlayers[2]?.isBot),
  ];

  return (
    <div className="game-table" onClick={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }} style={{
      display: "grid",
      gridTemplateAreas: isFirstPersonMobile
        ? `"left top right" "left center right" "bottom bottom bottom"`
        : isCompact
        ? `". top ." "left center right" ". bottom ."`
        : `". top ." "left center right" "bottom bottom bottom"`,
      gridTemplateColumns: isFirstPersonMobile ? "var(--fp-side-col) 1fr var(--fp-side-col)" : isCompact ? "var(--grid-side-col) 1fr var(--grid-side-col)" : "1fr 2fr 1fr",
      gridTemplateRows: isFirstPersonMobile ? "var(--fp-top-row) 1fr minmax(min(55%, 45dvh), 65%)" : isCompact ? "var(--grid-top-row) var(--grid-center-row) 1fr" : "auto 1fr auto",
      flex: 1,
      minHeight: 0,
      gap: "var(--game-gap)",
      padding: "var(--game-padding)",
      perspective: "var(--game-perspective)",
      perspectiveOrigin: "50% 60%",
    }}>
      {/* Top player (index 2 in otherPlayers = across from me) */}
      <div style={{ gridArea: "top", position: "relative", zIndex: 1 }}>
        <PlayerArea
          isMe={false}
          hand={revealedHands?.[(myIndex + 2) % 4]?.hand}
          handCount={otherPlayers[1]?.handCount ?? 0}
          melds={revealedHands?.[(myIndex + 2) % 4]?.melds ?? otherPlayers[1]?.melds ?? []}
          flowers={revealedHands?.[(myIndex + 2) % 4]?.flowers ?? otherPlayers[1]?.flowers ?? []}
          discards={otherPlayers[1]?.discards ?? []}
          isCurrentTurn={currentTurn === (myIndex + 2) % 4}
          isDealer={dealerIndex === (myIndex + 2) % 4}
          gold={gold}
          label={labels[2]}
          lastDiscardedTileId={lastDiscardPlayerIndex === (myIndex + 2) % 4 ? lastDiscardTileId : null}
          hasDiscardedGold={otherPlayers[1]?.hasDiscardedGold}
          isDisconnected={disconnectedPlayers?.has((myIndex + 2) % 4)}
          compact={isCompact}
          ultraCompact={isFirstPersonMobile}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[(myIndex + 2) % 4] : undefined}
        />
      </div>

      {/* Left player — rotated 90° clockwise to face left */}
      <div style={{ gridArea: "left", position: "relative", zIndex: 1, transform: "rotate(90deg)", transformOrigin: "center center", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PlayerArea
          isMe={false}
          hand={revealedHands?.[(myIndex + 3) % 4]?.hand}
          handCount={otherPlayers[2]?.handCount ?? 0}
          melds={revealedHands?.[(myIndex + 3) % 4]?.melds ?? otherPlayers[2]?.melds ?? []}
          flowers={revealedHands?.[(myIndex + 3) % 4]?.flowers ?? otherPlayers[2]?.flowers ?? []}
          discards={otherPlayers[2]?.discards ?? []}
          isCurrentTurn={currentTurn === (myIndex + 3) % 4}
          isDealer={dealerIndex === (myIndex + 3) % 4}
          gold={gold}
          label={labels[3]}
          lastDiscardedTileId={lastDiscardPlayerIndex === (myIndex + 3) % 4 ? lastDiscardTileId : null}
          hasDiscardedGold={otherPlayers[2]?.hasDiscardedGold}
          isDisconnected={disconnectedPlayers?.has((myIndex + 3) % 4)}
          compact={isCompact}
          ultraCompact={isFirstPersonMobile}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[(myIndex + 3) % 4] : undefined}
        />
      </div>

      {/* Center - game info */}
      <div className="table-center-area" style={{ gridArea: "center", display: "flex", flexDirection: isCompact ? "column" : "row", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, overflow: "hidden", padding: isCompact ? 0 : "12px" }}>
        {isCompact && (
          <TileWall wallRemaining={wallRemaining} wallDrawCount={state.wallDrawCount} wallSupplementCount={state.wallSupplementCount} gold={gold} canDraw={canDraw} onDraw={onDraw} compact />
        )}
        <GameInfo
          gold={gold}
          wallRemaining={wallRemaining}
          dealerIndex={dealerIndex}
          lianZhuangCount={lianZhuangCount}
          myIndex={myIndex}
          lastDiscard={state.lastDiscard}
          playerNames={[myName || "我", ...otherPlayers.map(p => p.name || "")]}
          compact={isCompact}
        />
      </div>

      {/* Wall segments along table edges (non-compact only) */}
      {!isCompact && (
        <>
          <div style={{ gridArea: "center", alignSelf: "start", justifySelf: "center", zIndex: 2, marginTop: "clamp(8%, 10dvh, 18%)" }}>
            <TileWall segment="top" wallRemaining={wallRemaining} wallDrawCount={state.wallDrawCount} wallSupplementCount={state.wallSupplementCount} gold={gold} canDraw={canDraw} onDraw={onDraw} />
          </div>
          <div style={{ gridArea: "center", alignSelf: "center", justifySelf: "start", zIndex: 2, marginLeft: "clamp(8%, 10vw, 18%)" }}>
            <TileWall segment="left" wallRemaining={wallRemaining} wallDrawCount={state.wallDrawCount} wallSupplementCount={state.wallSupplementCount} gold={gold} canDraw={canDraw} onDraw={onDraw} />
          </div>
          <div style={{ gridArea: "center", alignSelf: "center", justifySelf: "end", zIndex: 2, marginRight: "clamp(8%, 10vw, 18%)" }}>
            <TileWall segment="right" wallRemaining={wallRemaining} wallDrawCount={state.wallDrawCount} wallSupplementCount={state.wallSupplementCount} gold={gold} canDraw={canDraw} onDraw={onDraw} />
          </div>
          {!isFirstPersonMobile && (
            <div style={{ gridArea: "center", alignSelf: "end", justifySelf: "center", zIndex: 2, marginBottom: "clamp(8%, 10dvh, 18%)" }}>
              <TileWall segment="bottom" wallRemaining={wallRemaining} wallDrawCount={state.wallDrawCount} wallSupplementCount={state.wallSupplementCount} gold={gold} canDraw={canDraw} onDraw={onDraw} />
            </div>
          )}
        </>
      )}

      {/* Right player — rotated 90° counter-clockwise to face right */}
      <div style={{ gridArea: "right", position: "relative", zIndex: 1, transform: "rotate(-90deg)", transformOrigin: "center center", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PlayerArea
          isMe={false}
          hand={revealedHands?.[(myIndex + 1) % 4]?.hand}
          handCount={otherPlayers[0]?.handCount ?? 0}
          melds={revealedHands?.[(myIndex + 1) % 4]?.melds ?? otherPlayers[0]?.melds ?? []}
          flowers={revealedHands?.[(myIndex + 1) % 4]?.flowers ?? otherPlayers[0]?.flowers ?? []}
          discards={otherPlayers[0]?.discards ?? []}
          isCurrentTurn={currentTurn === (myIndex + 1) % 4}
          isDealer={dealerIndex === (myIndex + 1) % 4}
          gold={gold}
          label={labels[1]}
          lastDiscardedTileId={lastDiscardPlayerIndex === (myIndex + 1) % 4 ? lastDiscardTileId : null}
          hasDiscardedGold={otherPlayers[0]?.hasDiscardedGold}
          isDisconnected={disconnectedPlayers?.has((myIndex + 1) % 4)}
          compact={isCompact}
          ultraCompact={isFirstPersonMobile}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[(myIndex + 1) % 4] : undefined}
        />
      </div>

      {/* Bottom - my area */}
      <div style={{ gridArea: "bottom", position: "relative", zIndex: 1 }}>
        <PlayerArea
          isMe
          hand={myHand}
          melds={myMelds}
          flowers={myFlowers}
          discards={myDiscards}
          isCurrentTurn={currentTurn === myIndex}
          isDealer={dealerIndex === myIndex}
          gold={gold}
          selectedTileId={selectedTileId}
          onTileClick={(t) => onTileSelect(selectedTileId === t.id ? null : t)}
          onTileDoubleClick={onTileDoubleClick}
          label={labels[0]}
          claimableTileIds={claimableTileIds}
          canDiscard={canDiscard}
          onDiscard={onDiscard}
          canHu={canHu}
          onHu={onHu}
          kongTileIds={kongTileIds}
          onAnGang={onAnGang}
          onBuGang={onBuGang}
          hasDiscardedGold={myHasDiscardedGold}
          lastDrawnTileId={state.lastDrawnTileId}
          lastDiscardedTileId={lastDiscardPlayerIndex === myIndex ? lastDiscardTileId : null}
          departingTileId={departingTile?.id ?? null}
          tenpaiTiles={state.tenpaiTiles}
          firstPerson={isFirstPersonMobile}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[myIndex] : undefined}
          claimActive={claimActive}
        />
      </div>

      {/* Discard fly overlay — tile travels from hand toward discard pool */}
      {discardFlyKey != null && departingTile && (
        <div
          key={discardFlyKey}
          style={{
            position: "absolute",
            bottom: "clamp(8%, 10dvh, 18%)",
            left: "50%",
            marginLeft: "calc(var(--wall-tw) / -2)",
            pointerEvents: "none",
            zIndex: "var(--z-tile-anim)" as any,
            animation: "discardFlyToPool 0.3s ease-in forwards",
          }}
        >
          <TileView tile={departingTile} faceUp gold={gold} small />
        </div>
      )}

      {/* Draw fly animation overlay */}
      {drawAnimation && (
        <div
          key={drawAnimation.key}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: "calc(var(--wall-th) / -2)",
            marginLeft: "calc(var(--wall-tw) / -2)",
            pointerEvents: "none",
            zIndex: "var(--z-tile-anim)" as any,
            animation: `${drawAnimation.isSupplement ? "supplementFly" : "drawFly"}${drawAnimation.seat.charAt(0).toUpperCase() + drawAnimation.seat.slice(1)} ${drawAnimation.seat === "bottom" ? "0.3s" : "0.2s"} ease-out forwards`,
          }}
        >
          <img
            src={TILE_BACK_URL}
            alt=""
            style={{
              width: "var(--wall-tw)",
              height: "var(--wall-th)",
              display: "block",
              borderRadius: 2,
              boxShadow: drawAnimation.isSupplement
                ? "0 0 8px rgba(255,215,0,0.6)"
                : "0 1px 4px rgba(0,0,0,0.4)",
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Claim fly animation overlay — tile travels from pool toward claiming player */}
      {claimAnimation && (
        <div
          key={claimAnimation.key}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: "calc(var(--wall-th) / -2)",
            marginLeft: "calc(var(--wall-tw) / -2)",
            pointerEvents: "none",
            zIndex: "var(--z-tile-anim)" as any,
            animation: `claimFly${claimAnimation.seat.charAt(0).toUpperCase() + claimAnimation.seat.slice(1)} 0.3s ease-out forwards`,
          }}
        >
          <img
            src={TILE_BACK_URL}
            alt=""
            style={{
              width: "var(--wall-tw)",
              height: "var(--wall-th)",
              display: "block",
              borderRadius: 2,
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
