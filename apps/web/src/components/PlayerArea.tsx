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
  onTileDoubleClick?: (tile: TileInstance) => void;
  label: string;
  claimableTileIds?: Set<number>;
  lastDrawnTileId?: number | null;
  tenpaiTiles?: import("@fuzhou-mahjong/shared").SuitedTile[];
}

export function PlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileClick, label,
  claimableTileIds, onTileDoubleClick, lastDrawnTileId, tenpaiTiles,
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
      {/* Player info panel */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
        padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: 4,
      }}>
        <span style={{ fontSize: 14, fontWeight: "bold" }}>
          {label}
        </span>
        {isDealer && <span style={{ fontSize: 11, background: "#c41e3a", color: "#fff", padding: "1px 4px", borderRadius: 3 }}>庄</span>}
        {isCurrentTurn && <span style={{ fontSize: 11, background: "#ffd700", color: "#000", padding: "1px 4px", borderRadius: 3 }}>出牌中</span>}
        <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
          🌸{flowers.length}
        </span>
      </div>

      {/* Hand */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, marginBottom: 4, alignItems: "flex-end" }}>
        {isMe && hand ? (
          hand.map((t, idx) => (
            <div key={t.id} style={{
              display: "inline-flex",
              marginLeft: lastDrawnTileId === t.id ? 16 : 0,
              position: "relative",
            }}>
              {lastDrawnTileId === t.id && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, color: "#4fc3f7", whiteSpace: "nowrap",
                }}>新牌</div>
              )}
              <TileView
                tile={t}
                faceUp
                gold={gold}
                selected={selectedTileId === t.id}
                claimable={claimableTileIds?.has(t.id)}
                className={lastDrawnTileId === t.id ? "tile-new" : undefined}
                onClick={() => onTileClick?.(t)}
                onDoubleClick={() => onTileDoubleClick?.(t)}
              />
            </div>
          ))
        ) : (
          Array.from({ length: handCount ?? 0 }).map((_, i) => (
            <TileView key={i} tile={{ id: -1, tile: { kind: "suited", suit: "wan" as any, value: 1 as any } }} faceUp={false} />
          ))
        )}
      </div>

      {/* Tenpai indicator */}
      {isMe && tenpaiTiles && tenpaiTiles.length > 0 && (
        <div style={{ fontSize: 12, color: "#4caf50", marginBottom: 4 }}>
          🀄 听牌！等: {tenpaiTiles.map(t => `${t.value}${{wan:"万",bing:"饼",tiao:"条"}[t.suit]}`).join(" ")}
        </div>
      )}

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

      {/* Discards - grid layout */}
      {discards.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, auto)",
          gap: 1,
          padding: 4,
          background: isMe ? "rgba(0,100,200,0.08)" : "rgba(255,255,255,0.03)",
          borderRadius: 4,
          maxWidth: "min(300px, 90vw)",
        }}>
          {discards.map((d) => (
            <TileView key={d.id} tile={d} faceUp gold={gold} small />
          ))}
        </div>
      )}
    </div>
  );
}
