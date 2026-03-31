import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { MobilePlayerArea } from "./MobilePlayerArea";
import { MobileOpponentArea } from "./MobileOpponentArea";

interface MobileGameTableProps {
  gameState: ClientGameState;
  selectedTileId: number | null;
  onTileSelect: (tile: TileInstance) => void;
  claimableTileIds: Set<number>;
  canDiscard: boolean;
  onDiscard: (tileInstanceId: number) => void;
  canHu: boolean;
  onHu: () => void;
  kongTileIds: Set<number>;
  onAnGang: (tileInstanceId: number) => void;
  onBuGang: (tileInstanceId: number) => void;
  disconnectedPlayers: Set<number>;
  lastDiscardTileId: number | null;
  lastDiscardPlayerIndex: number;
  claimActive: boolean;
}

export function MobileGameTable({
  gameState: gs,
  selectedTileId,
  onTileSelect,
  claimableTileIds,
  canDiscard,
  onDiscard,
  canHu,
  onHu,
  kongTileIds,
  onAnGang,
  onBuGang,
  disconnectedPlayers,
  lastDiscardTileId,
  lastDiscardPlayerIndex,
  claimActive,
}: MobileGameTableProps) {
  const { myIndex, otherPlayers, currentTurn, dealerIndex, gold, roundsPlayed, wallRemaining, cumulativeScores } = gs;

  // Absolute indices for other players
  const rightIdx = (myIndex + 1) % 4;
  const topIdx = (myIndex + 2) % 4;
  const leftIdx = (myIndex + 3) % 4;

  const botLabel = (name: string, isBot?: boolean) => isBot ? `${name} 🤖` : name;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        gridTemplateRows: "1fr 2fr 1fr",
        gridTemplateAreas: `". top ." "left center right" ". bottom ."`,
        width: "100%",
        height: "100dvh",
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        boxSizing: "border-box",
        background: "var(--color-table-felt, #1a472a)",
        color: "var(--color-text-primary, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Top Opponent — otherPlayers[1] */}
      <div style={{ gridArea: "top", minHeight: 0, overflow: "hidden" }}>
        <MobileOpponentArea
          position="top"
          name={botLabel(otherPlayers[1]?.name || "上", otherPlayers[1]?.isBot)}
          handCount={otherPlayers[1]?.handCount ?? 0}
          melds={otherPlayers[1]?.melds ?? []}
          flowers={otherPlayers[1]?.flowers ?? []}
          discards={otherPlayers[1]?.discards ?? []}
          isCurrentTurn={currentTurn === topIdx}
          isDealer={dealerIndex === topIdx}
          gold={gold}
          isDisconnected={disconnectedPlayers.has(topIdx)}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[topIdx] : undefined}
          lastDiscardedTileId={lastDiscardPlayerIndex === topIdx ? lastDiscardTileId : null}
        />
      </div>

      {/* Left Opponent — otherPlayers[2] */}
      <div style={{ gridArea: "left", minHeight: 0, overflow: "hidden" }}>
        <MobileOpponentArea
          position="left"
          name={botLabel(otherPlayers[2]?.name || "左", otherPlayers[2]?.isBot)}
          handCount={otherPlayers[2]?.handCount ?? 0}
          melds={otherPlayers[2]?.melds ?? []}
          flowers={otherPlayers[2]?.flowers ?? []}
          discards={otherPlayers[2]?.discards ?? []}
          isCurrentTurn={currentTurn === leftIdx}
          isDealer={dealerIndex === leftIdx}
          gold={gold}
          isDisconnected={disconnectedPlayers.has(leftIdx)}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[leftIdx] : undefined}
          lastDiscardedTileId={lastDiscardPlayerIndex === leftIdx ? lastDiscardTileId : null}
        />
      </div>

      {/* Center — Game Info */}
      <div
        style={{
          gridArea: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
          fontSize: "0.75rem",
          opacity: 0.8,
        }}
      >
        <span>第 {roundsPlayed + 1} 局 · 牌墙: {wallRemaining}</span>
        {gold && <span style={{ color: "var(--color-text-gold)" }}>金: {gold.wildTile.value}{gold.wildTile.suit === "wan" ? "万" : gold.wildTile.suit === "bing" ? "饼" : "条"}</span>}
      </div>

      {/* Right Opponent — otherPlayers[0] */}
      <div style={{ gridArea: "right", minHeight: 0, overflow: "hidden" }}>
        <MobileOpponentArea
          position="right"
          name={botLabel(otherPlayers[0]?.name || "右", otherPlayers[0]?.isBot)}
          handCount={otherPlayers[0]?.handCount ?? 0}
          melds={otherPlayers[0]?.melds ?? []}
          flowers={otherPlayers[0]?.flowers ?? []}
          discards={otherPlayers[0]?.discards ?? []}
          isCurrentTurn={currentTurn === rightIdx}
          isDealer={dealerIndex === rightIdx}
          gold={gold}
          isDisconnected={disconnectedPlayers.has(rightIdx)}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[rightIdx] : undefined}
          lastDiscardedTileId={lastDiscardPlayerIndex === rightIdx ? lastDiscardTileId : null}
        />
      </div>

      {/* Bottom — My Hand */}
      <div style={{ gridArea: "bottom", minHeight: 0, overflow: "hidden" }}>
        <MobilePlayerArea
          isMe={true}
          hand={gs.myHand}
          melds={gs.myMelds}
          flowers={gs.myFlowers}
          discards={gs.myDiscards}
          isCurrentTurn={currentTurn === myIndex}
          isDealer={dealerIndex === myIndex}
          gold={gold}
          selectedTileId={selectedTileId}
          onTileSelect={onTileSelect}
          label={gs.myName || "我"}
          claimableTileIds={claimableTileIds}
          lastDrawnTileId={gs.lastDrawnTileId}
          lastDiscardedTileId={lastDiscardPlayerIndex === myIndex ? lastDiscardTileId : null}
          tenpaiTiles={gs.tenpaiTiles}
          canDiscard={canDiscard}
          onDiscard={onDiscard}
          canHu={canHu}
          onHu={onHu}
          kongTileIds={kongTileIds}
          onAnGang={onAnGang}
          onBuGang={onBuGang}
          hasDiscardedGold={gs.myHasDiscardedGold}
          cumulativeScore={roundsPlayed > 0 ? cumulativeScores[myIndex] : undefined}
          claimActive={claimActive}
        />
      </div>
    </div>
  );
}
