import { useState } from "react";
import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { PlayerArea } from "./PlayerArea";
import { GameInfo } from "./GameInfo";

interface GameTableProps {
  state: ClientGameState;
  onTileSelect: (tile: TileInstance | null) => void;
  selectedTileId: number | null;
}

const POSITION_LABELS = ["我 / Me", "右 / Right", "上 / Top", "左 / Left"];

export function GameTable({ state, onTileSelect, selectedTileId }: GameTableProps) {
  const { myHand, myFlowers, myMelds, myDiscards, otherPlayers, currentTurn, myIndex, gold, dealerIndex, lianZhuangCount, wallRemaining } = state;

  return (
    <div style={{
      display: "grid",
      gridTemplateAreas: `
        ". top ."
        "left center right"
        ". bottom ."
      `,
      gridTemplateColumns: "1fr 2fr 1fr",
      gridTemplateRows: "auto 1fr auto",
      minHeight: "80vh",
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
          label={POSITION_LABELS[2]}
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
          label={POSITION_LABELS[3]}
        />
      </div>

      {/* Center - game info */}
      <div style={{ gridArea: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GameInfo
          gold={gold}
          wallRemaining={wallRemaining}
          dealerIndex={dealerIndex}
          lianZhuangCount={lianZhuangCount}
          myIndex={myIndex}
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
          label={POSITION_LABELS[1]}
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
          label={POSITION_LABELS[0]}
        />
      </div>
    </div>
  );
}
