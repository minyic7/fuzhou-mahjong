import { useRef, useEffect } from "react";
import type { TileInstance, Meld, GoldState, SuitedTile } from "@fuzhou-mahjong/shared";
import { MeldType, isSuitedTile } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { useLongPress } from "./TileTooltip";

interface MobilePlayerAreaProps {
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
  onTileSelect?: (tile: TileInstance) => void;
  label: string;
  claimableTileIds?: Set<number>;
  lastDrawnTileId?: number | null;
  lastDiscardedTileId?: number | null;
  tenpaiTiles?: SuitedTile[];
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

const BUBBLE_BTN: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: "var(--label-font)",
  fontWeight: "bold",
  border: "none",
  borderRadius: 6,
  whiteSpace: "nowrap",
  minHeight: "var(--btn-min-size, 44px)",
  minWidth: "var(--btn-min-size, 44px)",
  cursor: "pointer",
};

const FLOWER_CHARS: Record<string, Record<string, string>> = {
  wind: { east: "東", south: "南", west: "西", north: "北" },
  dragon: { red: "中", green: "發", white: "白" },
  season: { spring: "春", summer: "夏", autumn: "秋", winter: "冬" },
  plant: { plum: "梅", orchid: "蘭", bamboo: "竹", chrysanthemum: "菊" },
};

const FLOWER_COLORS: Record<string, string> = {
  wind: "var(--suit-color-wind, #e8d44d)",
  dragon: "var(--suit-color-wan, #c41e3a)",
  season: "var(--suit-color-season, #4fc3f7)",
  plant: "var(--suit-color-plant, #81c784)",
};

function getFlowerChar(tile: TileInstance): string {
  const t = tile.tile;
  if (t.kind === "wind") return FLOWER_CHARS.wind[t.windType] ?? "";
  if (t.kind === "dragon") return FLOWER_CHARS.dragon[t.dragonType] ?? "";
  if (t.kind === "season") return FLOWER_CHARS.season[t.seasonType] ?? "";
  if (t.kind === "plant") return FLOWER_CHARS.plant[t.plantType] ?? "";
  return "";
}

function getFlowerColor(tile: TileInstance): string {
  return FLOWER_COLORS[tile.tile.kind] ?? "#aaa";
}

export function MobilePlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileSelect, label,
  claimableTileIds, lastDrawnTileId, lastDiscardedTileId, tenpaiTiles,
  canDiscard, onDiscard, canHu, onHu, kongTileIds, onAnGang, onBuGang,
  departingTileId, hasDiscardedGold, isDisconnected, cumulativeScore, claimActive,
}: MobilePlayerAreaProps) {
  const {
    onTouchStart: lpTouchStart, onTouchEnd: lpTouchEnd, onTouchCancel: lpTouchCancel,
    onMouseEnter, onMouseLeave, Tooltip, dismiss,
  } = useLongPress(gold);

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

  const tenpaiSet = new Set(
    tenpaiTiles?.map(t => `${t.suit}-${t.value}`) ?? []
  );

  const handleTileTap = (tile: TileInstance) => {
    if (selectedTileId === tile.id) {
      // Already selected — discard if allowed
      if (canDiscard) onDiscard?.(tile.id);
    } else {
      onTileSelect?.(tile);
    }
  };

  return (
    <>
      <Tooltip />
      <div
        style={{
          "--tile-width": "36px",
          "--tile-height": "48px",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          opacity: isDisconnected ? 0.5 : 1,
          transition: "opacity 0.3s ease",
        } as React.CSSProperties}
      >
        {/* 1. Info bar (~24px) */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 24,
          minHeight: 24,
          padding: "0 8px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 4,
          borderLeft: isCurrentTurn ? "3px solid var(--color-gold-bright)" : "3px solid transparent",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--color-text-warm)" }}>
            {label}
          </span>
          {isDealer && (
            <span style={{ fontSize: 10, background: "var(--color-dealer-bg)", color: "var(--color-gold-bright)", padding: "0 4px", borderRadius: 3, fontWeight: "bold" }}>庄</span>
          )}
          {isDisconnected && (
            <span style={{ fontSize: 10, background: "var(--color-disconnect)", color: "#fff", padding: "0 4px", borderRadius: 3, fontWeight: "bold" }}>断线</span>
          )}
          {hasDiscardedGold && (
            <span style={{ fontSize: 10, background: "var(--color-action-hu)", color: "#fff", padding: "0 4px", borderRadius: 3, fontWeight: "bold" }}>弃金</span>
          )}
          {isCurrentTurn && (
            <span style={{ fontSize: 10, background: "rgba(255,215,0,0.2)", color: "var(--color-gold-bright)", padding: "0 4px", borderRadius: 3, border: "1px solid var(--color-gold-bright)" }}>出牌</span>
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: "auto" }}>
            {flowers.length > 0 && `花${flowers.length}`}
          </span>
          {cumulativeScore != null && (
            <span style={{
              fontSize: 11, fontWeight: "bold",
              color: cumulativeScore > 0 ? "var(--color-gold-bright)" : cumulativeScore < 0 ? "var(--color-error)" : "var(--color-text-secondary)",
              padding: "0 4px", borderRadius: 3, background: "rgba(0,0,0,0.3)",
            }}>
              {cumulativeScore > 0 ? "+" : ""}{cumulativeScore}
            </span>
          )}
        </div>

        {/* 2. Melds + Flowers row (~40px) */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 40,
          minHeight: 40,
          padding: "0 4px",
          overflowX: "auto",
          overflowY: "hidden",
          flexShrink: 0,
        }}>
          {melds.map((m, mi) => (
            <div key={mi} style={{ display: "flex", gap: 0, flexShrink: 0 }}>
              {m.tiles.map((t, ti) => (
                <TileView
                  key={ti}
                  tile={t}
                  faceUp={m.type !== MeldType.AnGang}
                  gold={gold}
                  small
                  style={{ width: "28px", height: "38px", fontSize: "12px" }}
                />
              ))}
            </div>
          ))}
          {flowers.map((f) => (
            <span
              key={f.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 4,
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${getFlowerColor(f)}`,
                color: getFlowerColor(f),
                fontSize: 13,
                fontWeight: "bold",
                flexShrink: 0,
              }}
            >
              {getFlowerChar(f)}
            </span>
          ))}
        </div>

        {/* 3. Discards area (~60px) */}
        <div
          ref={discardScrollRef}
          style={{
            display: "flex",
            gap: 1,
            height: 60,
            minHeight: 60,
            overflowX: "auto",
            overflowY: "hidden",
            alignItems: "center",
            padding: "0 4px",
            background: isMe ? "rgba(0,100,200,0.08)" : "rgba(255,255,255,0.03)",
            borderRadius: 4,
            flexShrink: 0,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {discards.map((d) => (
            <div key={d.id} style={{ flexShrink: 0 }}>
              <TileView
                tile={d}
                faceUp
                gold={gold}
                small
                style={{ width: "28px", height: "38px", fontSize: "12px" }}
                className={lastDiscardedTileId === d.id ? "discard-arrive last-discard" : undefined}
                onTouchStart={(e) => lpTouchStart(d, e)}
                onTouchEnd={lpTouchEnd}
                onTouchCancel={lpTouchCancel}
                onMouseEnter={(e) => onMouseEnter(d, e)}
                onMouseLeave={onMouseLeave}
              />
            </div>
          ))}
        </div>

        {/* Tenpai indicator */}
        {isMe && tenpaiTiles && tenpaiTiles.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--color-success)", padding: "2px 4px", flexShrink: 0 }}>
            听牌: {tenpaiTiles.map(t => `${t.value}${{ wan: "万", bing: "饼", tiao: "条" }[t.suit]}`).join(" ")}
          </div>
        )}

        {/* 4. Hand tiles (remaining space) */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          overflowX: "auto",
          overflowY: "hidden",
          padding: "0 4px",
          gap: 2,
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x proximity",
        }}>
          {isMe && hand ? (
            hand.map((t) => {
              const isSelected = selectedTileId === t.id;
              const isKong = kongTileIds?.has(t.id);
              const showBubble = isSelected && (canDiscard || canHu || isKong);
              const isGoldTile = !!(gold && isSuitedTile(t.tile) && t.tile.suit === gold.wildTile.suit && t.tile.value === gold.wildTile.value);
              const isAnGang = !!(isKong && onAnGang);
              const isBuGang = !!(isKong && onBuGang);
              const isClaimable = claimableTileIds?.has(t.id);
              const isTenpai = isSuitedTile(t.tile) && tenpaiSet.has(`${t.tile.suit}-${t.tile.value}`);

              return (
                <div
                  key={t.id}
                  style={{
                    flexShrink: 0,
                    position: "relative",
                    marginLeft: lastDrawnTileId === t.id ? 8 : 0,
                    transform: isSelected ? "translateY(-8px)" : "none",
                    transition: "transform 0.15s ease, margin 0.15s ease",
                    scrollSnapAlign: "start",
                  }}
                >
                  {/* Bubble buttons (discard / kong / hu) */}
                  {showBubble && (
                    <div style={{
                      position: "absolute",
                      bottom: "100%",
                      marginBottom: 4,
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      zIndex: 10,
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
                    selected={isSelected}
                    claimable={isClaimable || !!isKong}
                    className={[
                      departingTileId === t.id ? "tile-departing" : lastDrawnTileId === t.id ? "tile-new" : "",
                      isTenpai ? "tile-tenpai" : "",
                    ].filter(Boolean).join(" ") || undefined}
                    style={{ width: "var(--tile-width)", height: "var(--tile-height)" }}
                    onTouchStart={(e) => lpTouchStart(t, e)}
                    onTouchEnd={lpTouchEnd}
                    onTouchCancel={lpTouchCancel}
                    onMouseEnter={(e) => onMouseEnter(t, e)}
                    onMouseLeave={onMouseLeave}
                    onClick={() => handleTileTap(t)}
                  />
                </div>
              );
            })
          ) : hand ? (
            hand.map((t) => (
              <TileView key={t.id} tile={t} faceUp gold={gold} small
                style={{ width: "28px", height: "38px", fontSize: "12px" }}
              />
            ))
          ) : (
            Array.from({ length: handCount ?? 0 }).map((_, i) => (
              <TileView key={i} tile={{ id: -1, tile: { kind: "suited", suit: "wan" as any, value: 1 as any } }} faceUp={false}
                style={{ width: "var(--tile-width)", height: "var(--tile-height)" }}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
