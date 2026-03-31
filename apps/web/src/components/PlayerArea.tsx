import { useRef, useState, useEffect } from "react";
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
  departingTileId?: number | null;
  hasDiscardedGold?: boolean;
  isDisconnected?: boolean;
  cumulativeScore?: number;
  claimActive?: boolean;
}

const BUBBLE_BTN = {
  padding: "6px 12px", fontSize: "var(--label-font)", fontWeight: "bold" as const,
  border: "none", borderRadius: 6,
  whiteSpace: "nowrap" as const, minHeight: "var(--btn-min-size, 44px)", minWidth: "var(--btn-min-size, 44px)",
  cursor: "pointer",
};

export function PlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileClick, label,
  claimableTileIds, onTileDoubleClick, lastDrawnTileId, lastDiscardedTileId, tenpaiTiles,
  canDiscard, onDiscard, canHu, onHu, kongTileIds, onAnGang, onBuGang, departingTileId, hasDiscardedGold,
  isDisconnected, cumulativeScore, claimActive,
}: PlayerAreaProps) {
  const { onTouchStart: lpTouchStart, onTouchEnd: lpTouchEnd, onTouchCancel: lpTouchCancel, onMouseEnter, onMouseLeave, Tooltip, dismiss } = useLongPress(gold);

  // Auto-dismiss tooltip when claim overlay appears
  useEffect(() => {
    if (claimActive) dismiss();
  }, [claimActive, dismiss]);

  // Auto-scroll discards to the end when new tiles are added
  const discardScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = discardScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [discards.length]);

  // Track newest meld index for entrance animation
  const [newestMeldIdx, setNewestMeldIdx] = useState<number | null>(null);
  const prevMeldCountRef = useRef(melds.length);
  useEffect(() => {
    if (melds.length > prevMeldCountRef.current) {
      const idx = melds.length - 1;
      setNewestMeldIdx(idx);
      const timer = setTimeout(() => setNewestMeldIdx(null), 400);
      return () => clearTimeout(timer);
    }
    prevMeldCountRef.current = melds.length;
  }, [melds.length]);

  return (
    <>
    <Tooltip />
    <div
      className={`player-area-card${isCurrentTurn ? " current-turn" : ""}`}
      style={{
        background: isCurrentTurn ? "rgba(255,255,255,0.08)" : undefined,
        border: isCurrentTurn ? "2px solid var(--color-gold-bright)" : undefined,
        overflow: "hidden",
        opacity: isDisconnected ? 0.5 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Player info panel */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
        padding: "4px 10px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 4,
        borderLeft: isCurrentTurn ? "3px solid var(--color-gold-bright)" : "3px solid transparent",
      }}>
        <span style={{ fontSize: "var(--label-font)", fontWeight: "bold", color: "var(--color-text-warm)" }}>
          {label}
        </span>
        {isDealer && <span style={{ fontSize: "var(--font-xs)", background: "var(--color-dealer-bg)", color: "var(--color-gold-bright)", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>庄</span>}
        {isDisconnected && <span style={{ fontSize: "var(--font-xs)", background: "var(--color-disconnect)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: "bold", animation: "disconnectPulse 2s ease-in-out infinite" }}>断线</span>}
        {hasDiscardedGold && <span style={{ fontSize: "var(--font-xs)", background: "var(--color-action-hu)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>弃金</span>}
        {isCurrentTurn && <span className="your-turn-prompt" style={{ fontSize: "var(--font-xs)", background: "rgba(255,215,0,0.2)", color: "var(--color-gold-bright)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--color-gold-bright)" }}>出牌</span>}
        <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)", marginLeft: "auto" }}>
          🌸{flowers.length}
        </span>
        {cumulativeScore != null && (
          <span className="cumulative-score-badge" style={{
            fontSize: "var(--font-sm)", fontWeight: "bold",
            color: cumulativeScore > 0 ? "var(--color-gold-bright)" : cumulativeScore < 0 ? "var(--color-error)" : "var(--color-text-secondary)",
            padding: "1px 6px", borderRadius: 3, background: "rgba(0,0,0,0.3)",
          }}>
            {cumulativeScore > 0 ? "+" : ""}{cumulativeScore}
          </span>
        )}
      </div>

      {/* Hand */}
      <div style={{
        display: "flex", flexWrap: "nowrap", gap: 1, marginBottom: 4, alignItems: "flex-end",
        justifyContent: isMe ? "center" : undefined,
        paddingTop: isMe ? "var(--hand-padding-top)" : 0, overflow: "visible", clipPath: "inset(-9999px 0px -9999px 0px)", position: "relative",
      }}>
        {isMe && hand ? (
          hand.map((t) => {
            const isSelected = selectedTileId === t.id;
            const isKong = kongTileIds?.has(t.id);
            const showBubble = isSelected && (canDiscard || canHu || isKong);
            const isGoldTile = !!(gold && t.tile.kind === "suited" && t.tile.suit === gold.wildTile.suit && t.tile.value === gold.wildTile.value);
            const isAnGang = !!(isKong && onAnGang);
            const isBuGang = !!(isKong && onBuGang);
            return (
            <div
              key={t.id}
              style={{
                display: "inline-flex",
                marginLeft: lastDrawnTileId === t.id ? "var(--hand-new-tile-margin)" : 0,
                position: "relative",
                transition: "transform 0.2s ease, opacity 0.2s ease, margin 0.15s ease",
              }}
            >
              {lastDrawnTileId === t.id && (
                <div style={{
                  position: "absolute", top: "clamp(-8px, -3.5dvh, -14px)", left: "50%", transform: "translateX(-50%)",
                  fontSize: "var(--font-xs)", color: "#4fc3f7", whiteSpace: "nowrap",
                }}>新牌</div>
              )}
              {/* Discard / Kong bubble */}
              {showBubble && (
                <div className="discard-bubble" style={{
                  position: "absolute",
                  bottom: "100%", marginBottom: "clamp(2px, 1dvh, 4px)",
                  left: "max(8px, 50%)",
                  transform: "translateX(max(-50%, calc(-100% + 8px)))",
                  display: "flex",
                  flexDirection: "column",
                  flexWrap: "nowrap",
                  gap: 8,
                  zIndex: "var(--z-tile-anim)" as any,
                  maxHeight: "40dvh",
                  overflowY: "auto",
                  animation: "bubbleFadeIn 0.15s ease-out",
                }}>
                  {canHu && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "var(--color-action-hu)", color: "#fff", boxShadow: "0 2px 8px rgba(196,30,58,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onHu?.(); }}
                    >
                      胡!
                    </button>
                  )}
                  {canDiscard && (
                    <button
                      className={isGoldTile ? "gold-warning-pulse" : undefined}
                      style={{
                        ...BUBBLE_BTN,
                        background: isGoldTile ? "var(--color-action-hu)" : "var(--color-action-discard)",
                        color: "#fff",
                        boxShadow: isGoldTile ? "0 2px 8px rgba(196,30,58,0.5)" : "0 2px 8px rgba(0,184,148,0.5)",
                      }}
                      onClick={(e) => { e.stopPropagation(); onDiscard?.(t.id); }}
                    >
                      {isGoldTile ? "弃金!" : "出牌"}
                    </button>
                  )}
                  {isAnGang && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "var(--color-action-gang)", color: "#fff", boxShadow: "0 2px 8px rgba(212,118,10,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onAnGang?.(t.id); }}
                    >
                      暗杠
                    </button>
                  )}
                  {isBuGang && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "var(--color-action-gang)", color: "#fff", boxShadow: "0 2px 8px rgba(212,118,10,0.5)" }}
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
                className={departingTileId === t.id ? "tile-departing" : lastDrawnTileId === t.id ? "tile-new" : undefined}
                onTouchStart={(e) => lpTouchStart(t, e)}
                onTouchEnd={lpTouchEnd}
                onTouchCancel={lpTouchCancel}
                onMouseEnter={(e) => onMouseEnter(t, e)}
                onMouseLeave={onMouseLeave}
                onClick={() => onTileClick?.(t)}
              />
            </div>
            );
          })
        ) : hand ? (
          hand.map((t) => (
            <TileView key={t.id} tile={t} faceUp gold={gold} small />
          ))
        ) : (
          Array.from({ length: handCount ?? 0 }).map((_, i) => (
            <TileView key={i} tile={{ id: -1, tile: { kind: "suited", suit: "wan" as any, value: 1 as any } }} faceUp={false} />
          ))
        )}
      </div>

      {/* Tenpai indicator */}
      {isMe && tenpaiTiles && tenpaiTiles.length > 0 && (
        <div style={{ fontSize: "var(--font-sm)", color: "var(--color-success)", marginBottom: 4 }}>
          🀄 听牌！等: {tenpaiTiles.map(t => `${t.value}${{wan:"万",bing:"饼",tiao:"条"}[t.suit]}`).join(" ")}
        </div>
      )}

      {/* Melds */}
      {melds.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          {melds.map((m, mi) => (
            <div key={mi} className={newestMeldIdx === mi ? "meld-new" : undefined} style={{ display: "flex", gap: 0 }}>
              {m.tiles.map((t, ti) => (
                <TileView
                  key={ti}
                  tile={t}
                  faceUp={m.type !== MeldType.AnGang}
                  gold={gold}
                  small
                  className={newestMeldIdx === mi && m.type === MeldType.AnGang ? "angang-flip-reveal" : undefined}
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
        <div ref={discardScrollRef} className="compact-discards" style={{
          display: "flex",
          gap: 1,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "var(--game-padding)",
          background: isMe ? "rgba(0,100,200,0.08)" : "rgba(255,255,255,0.03)",
          borderRadius: 4,
        }}>
          {discards.map((d) => (
            <TileView key={d.id} tile={d} faceUp gold={gold} small
              className={lastDiscardedTileId === d.id ? "discard-arrive last-discard" : undefined}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}
