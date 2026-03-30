import { useRef, useState, useEffect } from "react";
import type { TileInstance, Meld, GoldState } from "@fuzhou-mahjong/shared";
import { MeldType } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { useLongPress } from "./TileTooltip";
import { useSwipeGesture } from "../hooks/useSwipeGesture";
import { useIsCompactLandscape } from "../hooks/useIsMobile";

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
  compact?: boolean;
  ultraCompact?: boolean;
  firstPerson?: boolean;
  cumulativeScore?: number;
}

const BUBBLE_BTN = {
  padding: "6px 12px", fontSize: "var(--label-font)", fontWeight: "bold" as const,
  border: "none", borderRadius: 6,
  whiteSpace: "nowrap" as const, minHeight: 44, minWidth: 44,
  cursor: "pointer",
};

export function PlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileClick, label,
  claimableTileIds, onTileDoubleClick, lastDrawnTileId, lastDiscardedTileId, tenpaiTiles,
  canDiscard, onDiscard, canHu, onHu, kongTileIds, onAnGang, onBuGang, departingTileId, hasDiscardedGold,
  isDisconnected, compact, ultraCompact, firstPerson, cumulativeScore,
}: PlayerAreaProps) {
  const { onTouchStart: lpTouchStart, onTouchEnd: lpTouchEnd, onMouseEnter, onMouseLeave, Tooltip } = useLongPress(gold);
  const isCompactLandscape = useIsCompactLandscape();

  // Double-tap detection for reliable mobile double-tap
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);
  const handleTap = (t: TileInstance) => {
    const now = Date.now();
    if (lastTapRef.current?.id === t.id && now - lastTapRef.current.time < 300) {
      // Double-tap detected
      lastTapRef.current = null;
      onTileDoubleClick?.(t);
    } else {
      lastTapRef.current = { id: t.id, time: now };
      onTileClick?.(t);
    }
  };

  // Swipe-to-discard gesture
  const swipe = useSwipeGesture({
    onSwipeUp: (tileId: number) => {
      const tile = hand?.find((t) => t.id === tileId);
      if (!tile) return;
      const tileIsGold = !!(gold && tile.tile.kind === "suited" && tile.tile.suit === gold.wildTile.suit && tile.tile.value === gold.wildTile.value);
      if (tileIsGold) {
        // Gold tile safety: select tile to show warning bubble instead of auto-discarding
        onTileClick?.(tile);
      } else {
        onDiscard?.(tileId);
      }
    },
    enabled: !!canDiscard,
    threshold: 40,
  });

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

  // Ultra-compact layout for opponents in first-person mobile mode
  if (ultraCompact) {
    return (
      <div
        className={`player-area-card${isCurrentTurn ? " current-turn" : ""} compact-opponent ultra-compact-opponent`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          padding: "2px",
          background: isCurrentTurn ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.3)",
          border: isCurrentTurn ? "1px solid var(--color-gold-bright)" : undefined,
          borderRadius: 3,
          opacity: isDisconnected ? 0.5 : 1,
          overflow: "hidden",
          minHeight: 0,
          fontSize: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: "bold", color: "var(--color-text-warm)", whiteSpace: "nowrap" }}>{label}</span>
          {isDealer && <span style={{ fontSize: 7, background: "var(--color-dealer-bg)", color: "var(--color-gold-bright)", padding: "0 2px", borderRadius: 2, fontWeight: "bold" }}>庄</span>}
          {isCurrentTurn && <span style={{ fontSize: 7, background: "rgba(255,215,0,0.2)", color: "var(--color-gold-bright)", padding: "0 2px", borderRadius: 2 }}>出牌</span>}
          <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: "auto" }}>{handCount ?? 0}张 🌸{flowers.length}</span>
        </div>
        {melds.length > 0 && (
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {melds.map((m, mi) => (
              <div key={mi} className={newestMeldIdx === mi ? "meld-new" : undefined} style={{ display: "flex", gap: 0 }}>
                {m.tiles.map((t, ti) => (
                  <TileView key={ti} tile={t} faceUp={m.type !== MeldType.AnGang} gold={gold} small
                    className={newestMeldIdx === mi && m.type === MeldType.AnGang ? "angang-flip-reveal" : undefined}
                    style={{ width: "var(--fp-opponent-tile-w)", height: "var(--fp-opponent-tile-h)", fontSize: 6 }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {discards.length > 0 && (
          <div className="compact-discards" style={{ display: "flex", gap: 0, overflowX: "auto", overflowY: "hidden", minWidth: 0, alignItems: "center" }}>
            {discards.slice(-6).map((d) => (
              <TileView key={d.id} tile={d} faceUp gold={gold} small
                style={{ width: "var(--fp-opponent-tile-w)", height: "var(--fp-opponent-tile-h)", fontSize: 6 }}
                className={lastDiscardedTileId === d.id ? "discard-arrive last-discard" : undefined}
              />
            ))}
            {discards.length > 6 && <span style={{ fontSize: 8, color: "var(--color-text-muted)" }}>+{discards.length - 6}</span>}
          </div>
        )}
      </div>
    );
  }

  // Compact single-row layout for opponents on mobile landscape
  if (compact) {
    return (
      <div
        className={`player-area-card${isCurrentTurn ? " current-turn" : ""} compact-opponent`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--compact-gap, 6px)",
          padding: "var(--compact-padding, 2px 8px)",
          background: isCurrentTurn ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.3)",
          border: isCurrentTurn ? "2px solid var(--color-gold-bright)" : undefined,
          borderRadius: 4,
          borderLeft: isCurrentTurn ? "3px solid var(--color-gold-bright)" : "3px solid transparent",
          opacity: isDisconnected ? 0.5 : 1,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Name + badges */}
        <span style={{ fontSize: "var(--compact-label-font, 12px)", fontWeight: "bold", color: "var(--color-text-warm)", whiteSpace: "nowrap", flexShrink: 0 }}>
          {label}
        </span>
        {isDealer && <span style={{ fontSize: 9, background: "var(--color-dealer-bg)", color: "var(--color-gold-bright)", padding: "0 4px", borderRadius: 3, fontWeight: "bold", flexShrink: 0 }}>庄</span>}
        {isDisconnected && <span style={{ fontSize: 9, background: "var(--color-disconnect)", color: "#fff", padding: "0 4px", borderRadius: 3, fontWeight: "bold", flexShrink: 0 }}>断线</span>}
        {hasDiscardedGold && <span style={{ fontSize: 9, background: "var(--color-action-hu)", color: "#fff", padding: "0 4px", borderRadius: 3, fontWeight: "bold", flexShrink: 0 }}>弃金</span>}
        {isCurrentTurn && <span className="your-turn-prompt" style={{ fontSize: 9, background: "rgba(255,215,0,0.2)", color: "var(--color-gold-bright)", padding: "0 4px", borderRadius: 3, border: "1px solid var(--color-gold-bright)", flexShrink: 0 }}>出牌</span>}

        {/* Hand count */}
        <span style={{ fontSize: "var(--compact-info-font, 11px)", color: "var(--color-text-secondary)", flexShrink: 0 }}>{handCount ?? 0}张</span>

        {/* Melds (small tiles inline) */}
        {melds.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {melds.map((m, mi) => (
              <div key={mi} className={newestMeldIdx === mi ? "meld-new" : undefined} style={{ display: "flex", gap: 0 }}>
                {m.tiles.map((t, ti) => (
                  <TileView key={ti} tile={t} faceUp={m.type !== MeldType.AnGang} gold={gold} small
                    className={newestMeldIdx === mi && m.type === MeldType.AnGang ? "angang-flip-reveal" : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Discards (tiny, single row, scrollable) */}
        {discards.length > 0 && (
          <div className="compact-discards" style={{
            display: "flex",
            gap: 1,
            overflowX: "auto",
            overflowY: "hidden",
            flex: 1,
            minWidth: 0,
          }}>
            {discards.map((d) => (
              <TileView key={d.id} tile={d} faceUp gold={gold} small
                className={lastDiscardedTileId === d.id ? "discard-arrive last-discard" : undefined}
              />
            ))}
          </div>
        )}

        {/* Flower count */}
        <span style={{ fontSize: "var(--compact-info-font, 11px)", color: "var(--color-text-secondary)", flexShrink: 0, marginLeft: "auto" }}>🌸{flowers.length}</span>
        {cumulativeScore != null && (
          <span className="cumulative-score-badge" style={{
            fontSize: "var(--compact-info-font, 11px)", fontWeight: "bold",
            color: cumulativeScore > 0 ? "var(--color-gold-bright)" : cumulativeScore < 0 ? "var(--color-error)" : "var(--color-text-secondary)",
            padding: "1px 6px", borderRadius: 3, background: "rgba(0,0,0,0.3)",
          }}>
            {cumulativeScore > 0 ? "+" : ""}{cumulativeScore}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
    <Tooltip />
    <div
      className={`player-area-card${isCurrentTurn ? " current-turn" : ""}`}
      style={{
        background: isCurrentTurn ? "rgba(255,255,255,0.08)" : undefined,
        border: isCurrentTurn ? "2px solid var(--color-gold-bright)" : undefined,
        overflow: "visible",
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
        {isDealer && <span style={{ fontSize: 10, background: "var(--color-dealer-bg)", color: "var(--color-gold-bright)", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>庄</span>}
        {isDisconnected && <span style={{ fontSize: 10, background: "var(--color-disconnect)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: "bold", animation: "disconnectPulse 2s ease-in-out infinite" }}>断线</span>}
        {hasDiscardedGold && <span style={{ fontSize: 10, background: "var(--color-action-hu)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>弃金</span>}
        {isCurrentTurn && <span className="your-turn-prompt" style={{ fontSize: 10, background: "rgba(255,215,0,0.2)", color: "var(--color-gold-bright)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--color-gold-bright)" }}>出牌</span>}
        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: "auto" }}>
          🌸{flowers.length}
        </span>
        {cumulativeScore != null && (
          <span className="cumulative-score-badge" style={{
            fontSize: 11, fontWeight: "bold",
            color: cumulativeScore > 0 ? "var(--color-gold-bright)" : cumulativeScore < 0 ? "var(--color-error)" : "var(--color-text-secondary)",
            padding: "1px 6px", borderRadius: 3, background: "rgba(0,0,0,0.3)",
          }}>
            {cumulativeScore > 0 ? "+" : ""}{cumulativeScore}
          </span>
        )}
      </div>

      {/* Hand */}
      <div style={{
        display: "flex", flexWrap: "nowrap", gap: firstPerson ? "var(--fp-hand-gap)" : 1, marginBottom: 4, alignItems: "flex-end",
        justifyContent: isMe ? "center" : undefined,
        paddingTop: isMe ? "var(--hand-padding-top)" : 0, overflow: "visible", position: "relative",
        ...(firstPerson ? { "--tile-w": "var(--fp-tile-w)", "--tile-h": "var(--fp-tile-h)" } as React.CSSProperties : {}),
      }}>
        {isMe && hand ? (
          hand.map((t, idx) => {
            const isSelected = selectedTileId === t.id;
            const isKong = kongTileIds?.has(t.id);
            const showBubble = isSelected && (canDiscard || canHu || isKong);
            const isGoldTile = !!(gold && t.tile.kind === "suited" && t.tile.suit === gold.wildTile.suit && t.tile.value === gold.wildTile.value);
            const isAnGang = !!(isKong && onAnGang);
            const isBuGang = !!(isKong && onBuGang);
            const isSwiping = swipe.swipingTileId === t.id;
            const tileSwipeOffset = isSwiping ? swipe.swipeOffset : 0;
            const swipeReady = isSwiping && swipe.swipeOffset < -40;
            return (
            <div
              key={t.id}
              onTouchStart={(e) => swipe.onTouchStart(t.id, e)}
              onTouchMove={swipe.onTouchMove}
              onTouchEnd={(e) => { swipe.onTouchEnd(); }}
              style={{
                display: "inline-flex",
                marginLeft: lastDrawnTileId === t.id ? "var(--hand-new-tile-margin)" : 0,
                position: "relative",
                transform: tileSwipeOffset < 0 ? `translateY(${tileSwipeOffset}px)` : undefined,
                opacity: isSwiping ? 1 - Math.min(0.5, Math.abs(tileSwipeOffset) / 100) : 1,
                transition: isSwiping ? "none" : "transform 0.2s ease, opacity 0.2s ease, margin 0.15s ease",
                boxShadow: swipeReady ? "0 0 12px rgba(0,184,148,0.6)" : undefined,
              }}
            >
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
                  ...(isCompactLandscape
                    ? { top: "100%", marginTop: 4 }
                    : { bottom: "100%", marginBottom: 4 }),
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  zIndex: 20,
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
                onMouseEnter={(e) => onMouseEnter(t, e)}
                onMouseLeave={onMouseLeave}
                onClick={() => handleTap(t)}
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
        <div style={{ fontSize: 12, color: "var(--color-success)", marginBottom: 4 }}>
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

      {/* Discards - always single row */}
      {discards.length > 0 && (
        <div className="compact-discards" style={{
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
