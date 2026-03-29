import type { TileInstance, Meld, GoldState } from "@fuzhou-mahjong/shared";
import { MeldType } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface PlayerAreaProps {
  isMe: boolean;
  hand?: TileInstance[];
  handCount?: number;
  melds: Meld[];
  flowers: TileInstance[];
  discards: TileInstance[];
  isCurrentTurn: boolean;
  isDealer: boolean;
  gold: GoldState | null;
  selectedTileId?: number | null;
  onTileClick?: (tile: TileInstance) => void;
  label: string;
  claimableTileIds?: Set<number>;
}

export function PlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileClick, label,
  claimableTileIds,
}: PlayerAreaProps) {
  return (
    <div
      className={isCurrentTurn ? "current-turn" : ""}
      style={{
        padding: 8,
        background: isCurrentTurn ? "rgba(255,255,255,0.08)" : "transparent",
        borderRadius: 8,
        border: isCurrentTurn ? "2px solid #ffd700" : "1px solid transparent",
      }}
    >
      <div style={{ fontSize: 12, marginBottom: 4, color: "#aaa" }}>
        {label} {isDealer && "🀄"} {isCurrentTurn && "◀"}
      </div>

      {/* Hand */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, marginBottom: 4 }}>
        {isMe && hand ? (
          hand.map((t) => (
            <TileView
              key={t.id}
              tile={t}
              faceUp
              gold={gold}
              selected={selectedTileId === t.id}
              claimable={claimableTileIds?.has(t.id)}
              onClick={() => onTileClick?.(t)}
            />
          ))
        ) : (
          Array.from({ length: handCount ?? 0 }).map((_, i) => (
            <TileView key={i} tile={{ id: -1, tile: { kind: "suited", suit: "wan" as any, value: 1 as any } }} faceUp={false} />
          ))
        )}
      </div>

      {/* Melds */}
      {melds.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          {melds.map((m, mi) => (
            <div key={mi} style={{ display: "flex", gap: 0 }}>
              {m.tiles.map((t, ti) => (
                <TileView
                  key={ti}
                  tile={t}
                  faceUp={m.type !== MeldType.AnGang}
                  gold={gold}
                  small
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Flowers */}
      {flowers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginBottom: 4 }}>
          {flowers.map((f) => (
            <TileView key={f.id} tile={f} faceUp gold={gold} small />
          ))}
        </div>
      )}

      {/* Discards */}
      {discards.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, maxWidth: "min(300px, 90vw)" }}>
          {discards.map((d) => (
            <TileView key={d.id} tile={d} faceUp gold={gold} small />
          ))}
        </div>
      )}
    </div>
  );
}
