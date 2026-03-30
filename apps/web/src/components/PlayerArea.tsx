import type { TileInstance, Meld, GoldState } from "@fuzhou-mahjong/shared";
import { MeldType } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { useLongPress } from "./TileTooltip";

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
  lastDiscardedTileId?: number | null;
  tenpaiTiles?: import("@fuzhou-mahjong/shared").SuitedTile[];
  canDiscard?: boolean;
  onDiscard?: (tileInstanceId: number) => void;
  canHu?: boolean;
  onHu?: () => void;
  kongTileIds?: Set<number>;
  onAnGang?: (tileInstanceId: number) => void;
  onBuGang?: (tileInstanceId: number) => void;
}

const BUBBLE_BTN = {
  padding: "6px 12px", fontSize: 14, fontWeight: "bold" as const,
  border: "none", borderRadius: 6,
  whiteSpace: "nowrap" as const, minHeight: 44, minWidth: 44,
  cursor: "pointer",
};

export function PlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileClick, label,
  claimableTileIds, onTileDoubleClick, lastDrawnTileId, lastDiscardedTileId, tenpaiTiles,
  canDiscard, onDiscard, canHu, onHu, kongTileIds, onAnGang, onBuGang,
}: PlayerAreaProps) {
  const { onTouchStart, onTouchEnd, onMouseEnter, onMouseLeave, Tooltip } = useLongPress(gold);

  return (
    <>
    <Tooltip />
    <div
      className={isCurrentTurn ? "current-turn" : ""}
      style={{
        padding: 8,
        background: isCurrentTurn ? "rgba(255,255,255,0.08)" : "transparent",
        borderRadius: 8,
        border: isCurrentTurn ? "2px solid #ffd700" : "1px solid transparent",
        overflow: "visible",
      }}
    >
      {/* Player info panel */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
        padding: "4px 10px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 4,
        borderLeft: isCurrentTurn ? "3px solid #ffd700" : "3px solid transparent",
      }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#e8d5a3" }}>
          {label}
        </span>
        {isDealer && <span style={{ fontSize: 10, background: "#b71c1c", color: "#ffd700", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>庄</span>}
        {isCurrentTurn && <span style={{ fontSize: 10, background: "rgba(255,215,0,0.2)", color: "#ffd700", padding: "1px 5px", borderRadius: 3, border: "1px solid #ffd700" }}>出牌</span>}
        <span style={{ fontSize: 11, color: "#8fbc8f", marginLeft: "auto" }}>
          🌸{flowers.length}
        </span>
      </div>

      {/* Hand */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, marginBottom: 4, alignItems: "flex-end", paddingTop: isMe ? 18 : 0, overflow: "visible", position: "relative" }}>
        {isMe && hand ? (
          hand.map((t, idx) => {
            const isSelected = selectedTileId === t.id;
            const isKong = kongTileIds?.has(t.id);
            const showBubble = isSelected && (canDiscard || canHu || isKong);
            const isAnGang = !!(isKong && onAnGang);
            const isBuGang = !!(isKong && onBuGang);
            return (
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
              {/* Discard / Kong bubble */}
              {showBubble && (
                <div className="discard-bubble" style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginBottom: 4,
                  zIndex: 20,
                  animation: "bubbleFadeIn 0.15s ease-out",
                }}>
                  {canHu && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#c41e3a", color: "#fff", boxShadow: "0 2px 8px rgba(196,30,58,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onHu?.(); }}
                    >
                      胡!
                    </button>
                  )}
                  {canDiscard && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#00b894", color: "#fff", boxShadow: "0 2px 8px rgba(0,184,148,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onDiscard?.(t.id); }}
                    >
                      出牌
                    </button>
                  )}
                  {isAnGang && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#d4760a", color: "#fff", boxShadow: "0 2px 8px rgba(212,118,10,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onAnGang?.(t.id); }}
                    >
                      暗杠
                    </button>
                  )}
                  {isBuGang && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#d4760a", color: "#fff", boxShadow: "0 2px 8px rgba(212,118,10,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onBuGang?.(t.id); }}
                    >
                      补杠
                    </button>
                  )}
                </div>
              )}
              <TileView
                tile={t}
                faceUp
                gold={gold}
                selected={selectedTileId === t.id}
                claimable={claimableTileIds?.has(t.id) || !!isKong}
                className={lastDrawnTileId === t.id ? "tile-new" : undefined}
                onTouchStart={(e) => onTouchStart(t, e)}
                onTouchEnd={onTouchEnd}
                onMouseEnter={(e) => onMouseEnter(t, e)}
                onMouseLeave={onMouseLeave}
                onClick={() => onTileClick?.(t)}
                onDoubleClick={() => onTileDoubleClick?.(t)}
              />
            </div>
            );
          })
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
            <TileView key={d.id} tile={d} faceUp gold={gold} small
              className={lastDiscardedTileId === d.id ? "discard-arrive" : undefined}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}
