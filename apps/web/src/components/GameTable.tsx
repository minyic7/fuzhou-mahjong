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
}

export function GameTable({ state, onTileSelect, onTileDoubleClick, selectedTileId, claimableTileIds }: GameTableProps) {
  const { myHand, myFlowers, myMelds, myDiscards, myName, otherPlayers, currentTurn, myIndex, gold, dealerIndex, lianZhuangCount, wallRemaining } = state;
  const botLabel = (name: string, isBot?: boolean) => isBot ? `${name} 🤖` : name;
  const labels = [
    myName || "我",
    botLabel(otherPlayers[0]?.name || "右", otherPlayers[0]?.isBot),
    botLabel(otherPlayers[1]?.name || "上", otherPlayers[1]?.isBot),
    botLabel(otherPlayers[2]?.name || "左", otherPlayers[2]?.isBot),
  ];

  return (
    <div className="game-table" style={{
      display: "grid",
      gridTemplateAreas: `
        ". top ."
        "left center right"
        ". bottom ."
      `,
      gridTemplateColumns: "1fr 2fr 1fr",
      gridTemplateRows: "auto 1fr auto",
      minHeight: "min(80vh, 600px)",
      gap: 8,
      padding: 8,
    }}>
      {/* Top player (index 2 in otherPlayers = across from me) */}
      <div style={{ gridArea: "top" }}>
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
        />
      </div>

      {/* Left player */}
      <div style={{ gridArea: "left" }}>
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
        />
      </div>

      {/* Center - game info */}
      <div style={{ gridArea: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <TileWall wallRemaining={wallRemaining} gold={gold} />
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
      <div style={{ gridArea: "right" }}>
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
        />
      </div>

      {/* Bottom - my area */}
      <div style={{ gridArea: "bottom" }}>
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
          lastDrawnTileId={(state as any).lastDrawnTileId}
          tenpaiTiles={(state as any).tenpaiTiles}
        />
      </div>
    </div>
  );
}
