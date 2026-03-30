import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { PlayerArea } from "./PlayerArea";
import { GameInfo } from "./GameInfo";
import { TileWall } from "./TileWall";

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
}

export function GameTable({ state, onTileSelect, onTileDoubleClick, selectedTileId, claimableTileIds, canDiscard, onDiscard, canHu, onHu, canDraw, onDraw, kongTileIds, onAnGang, onBuGang, onBackgroundClick }: GameTableProps) {
  const { myHand, myFlowers, myMelds, myDiscards, myName, otherPlayers, currentTurn, myIndex, gold, dealerIndex, lianZhuangCount, wallRemaining, myHasDiscardedGold } = state;
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
      gridTemplateAreas: `
        ". top ."
        "left center right"
        ". bottom ."
      `,
      gridTemplateColumns: "1fr 2fr 1fr",
      gridTemplateRows: "auto 1fr auto",
      flex: 1,
      minHeight: 0,
      gap: 8,
      padding: 8,
      perspective: "1200px",
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
        />
      </div>

      {/* Center - game info */}
      <div style={{ gridArea: "center", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <TileWall wallRemaining={wallRemaining} gold={gold} canDraw={canDraw} onDraw={onDraw} />
        <GameInfo
          gold={null}
          wallRemaining={wallRemaining}
          dealerIndex={dealerIndex}
          lianZhuangCount={lianZhuangCount}
          myIndex={myIndex}
          lastDiscard={state.lastDiscard}
          playerNames={[myName || "我", ...otherPlayers.map(p => p.name || "")]}
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
          lastDrawnTileId={(state as any).lastDrawnTileId}
          lastDiscardedTileId={lastDiscardPlayerIndex === myIndex ? lastDiscardTileId : null}
          tenpaiTiles={(state as any).tenpaiTiles}
        />
      </div>
    </div>
  );
}
