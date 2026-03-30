import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { PlayerArea } from "./PlayerArea";
import { GameInfo } from "./GameInfo";
import { TileWall } from "./TileWall";
import { TILE_BACK_URL } from "../tileSvg";
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
  departingTileId?: number | null;
}

export function GameTable({ state, onTileSelect, onTileDoubleClick, selectedTileId, claimableTileIds, canDiscard, onDiscard, canHu, onHu, canDraw, onDraw, kongTileIds, onAnGang, onBuGang, onBackgroundClick, disconnectedPlayers, drawAnimation, departingTileId }: GameTableProps) {
  const isCompact = useIsCompactLandscape();
  const isFirstPersonMobile = useIsFirstPersonMobile();
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
        : `". top ." "left center right" ". bottom ."`,
      gridTemplateColumns: isFirstPersonMobile ? "44px 1fr 44px" : isCompact ? "60px 1fr 60px" : "1fr 2fr 1fr",
      gridTemplateRows: isFirstPersonMobile ? "24px 1fr minmax(55%, 65%)" : isCompact ? "28px 40px 1fr" : "auto 1fr auto",
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
          handCount={otherPlayers[1]?.handCount ?? 0}
          melds={otherPlayers[1]?.melds ?? []}
          flowers={otherPlayers[1]?.flowers ?? []}
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

      {/* Left player */}
      <div style={{ gridArea: "left", position: "relative", zIndex: 1 }}>
        <PlayerArea
          isMe={false}
          handCount={otherPlayers[2]?.handCount ?? 0}
          melds={otherPlayers[2]?.melds ?? []}
          flowers={otherPlayers[2]?.flowers ?? []}
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
      <div className="table-center-area" style={{ gridArea: "center", display: "flex", flexDirection: isCompact ? "column" : "row", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, overflow: "hidden" }}>
        <TileWall wallRemaining={wallRemaining} wallDrawCount={state.wallDrawCount} wallSupplementCount={state.wallSupplementCount} gold={gold} canDraw={canDraw} onDraw={onDraw} compact={isCompact} />
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

      {/* Right player */}
      <div style={{ gridArea: "right", position: "relative", zIndex: 1 }}>
        <PlayerArea
          isMe={false}
          handCount={otherPlayers[0]?.handCount ?? 0}
          melds={otherPlayers[0]?.melds ?? []}
          flowers={otherPlayers[0]?.flowers ?? []}
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
          departingTileId={departingTileId}
          tenpaiTiles={state.tenpaiTiles}
          firstPerson={isFirstPersonMobile}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[myIndex] : undefined}
        />
      </div>

      {/* Draw fly animation overlay */}
      {drawAnimation && (
        <div
          key={drawAnimation.key}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginTop: -8,
            marginLeft: -6,
            pointerEvents: "none",
            zIndex: 20,
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
    </div>
  );
}
