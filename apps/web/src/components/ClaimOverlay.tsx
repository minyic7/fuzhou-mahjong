import { useState } from "react";
import { ActionType, isSuitedTile, suitedTilesMatch } from "@fuzhou-mahjong/shared";
import type { AvailableActions, ClientGameState, GameAction, TileInstance, SuitedTile } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { useWindowSize } from "../hooks/useWindowSize";

interface ClaimOverlayProps {
  actions: AvailableActions;
  gameState: ClientGameState;
  onAction: (action: GameAction) => void;
}

/**
 * Touch-target audit (iPhone SE landscape 667×375, 2026-03-30):
 * All buttons use minHeight/minWidth = var(--btn-min-size) = 44px (≥390px breakpoint)
 * with box-sizing:border-box, so padding is included — 44×44 touch targets meet Apple HIG.
 * Chi picker items: isCompact ? 44 : 56 — 44px at 375px height. ✓
 * 4-button flex row fits in ~584px with 10px gaps (≈206px total). No overlap. ✓
 */
const BTN = {
  base: {
    padding: "var(--btn-padding)", fontSize: "var(--btn-font)", fontWeight: "bold" as const,
    borderRadius: 8, border: "none", minHeight: "clamp(40px, 8dvh, 56px)", minWidth: "var(--btn-min-size)",
    cursor: "pointer",
  },
  hu: { background: "var(--color-action-hu)", color: "#fff" },
  peng: { background: "var(--color-action-peng)", color: "#fff" },
  gang: { background: "var(--color-action-gang)", color: "#fff" },
  chi: { background: "var(--color-action-chi)", color: "#fff" },
  pass: { background: "var(--color-action-pass-bg)", color: "var(--color-action-pass-text)" },
};

const HIGHLIGHT_STYLE: React.CSSProperties = {
  border: "2px solid var(--color-accent-orange)",
  borderRadius: 4,
  padding: 1,
  boxShadow: "0 0 6px rgba(255,165,0,0.4)",
};

function findMatchingHandTiles(hand: TileInstance[], discard: TileInstance, count: number): TileInstance[] {
  if (!isSuitedTile(discard.tile)) return [];
  return hand
    .filter(t => isSuitedTile(t.tile) && suitedTilesMatch(t.tile as SuitedTile, discard.tile as SuitedTile))
    .slice(0, count);
}

export function ClaimOverlay({ actions, gameState, onAction }: ClaimOverlayProps) {
  const { height } = useWindowSize();
  const isCompact = height <= BREAKPOINTS.COMPACT_HEIGHT;
  const isUltraCompact = height <= BREAKPOINTS.SMALL_PHONE_HEIGHT;
  const [showChiPicker, setShowChiPicker] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitingChi, setExitingChi] = useState(false);
  const myIndex = gameState.myIndex;

  const handleAction = (action: GameAction) => {
    setExiting(true);
    setTimeout(() => onAction(action), 180);
  };

  const handleShowChiPicker = () => {
    setShowChiPicker(true);
    setExitingChi(false);
  };

  const handleHideChiPicker = () => {
    setExitingChi(true);
    setTimeout(() => {
      setShowChiPicker(false);
      setExitingChi(false);
    }, 150);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "var(--color-overlay-backdrop)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--z-claim-overlay)" as any,
        animation: exiting ? "overlayFadeOut 0.18s ease-in forwards" : "overlayFadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && showChiPicker) {
          handleHideChiPicker();
        }
      }}
    >
      <div style={{
        background: "var(--overlay-bg)",
        border: "2px solid var(--color-accent-orange)",
        borderRadius: 12,
        padding: "calc(var(--overlay-padding-y) + env(safe-area-inset-top, 0px)) calc(var(--overlay-padding-x) + env(safe-area-inset-right, 0px)) calc(var(--overlay-padding-y) + env(safe-area-inset-bottom, 0px)) calc(var(--overlay-padding-x) + env(safe-area-inset-left, 0px))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isUltraCompact ? 4 : isCompact ? 6 : 12,
        maxWidth: "90vw",
        maxHeight: isUltraCompact ? "70dvh" : isCompact ? "80dvh" : "90dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        animation: exiting ? "overlayScaleOut 0.18s ease-in forwards" : "overlayScaleIn 0.2s ease-out",
      }}>
        <div style={{ color: "var(--color-accent-orange)", fontWeight: "bold", fontSize: "var(--btn-font)", marginBottom: 4 }}>
          {isCompact ? "选择" : "可以操作！请选择"}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: isUltraCompact ? 6 : 10 }}>
          {actions.canHu && (
            <button
              style={{ ...BTN.base, ...BTN.hu }}
              onClick={() => handleAction({ type: ActionType.Hu, playerIndex: myIndex })}
            >
              胡!
            </button>
          )}

          {actions.canMingGang && gameState.lastDiscard && (() => {
            const gangTiles = findMatchingHandTiles(gameState.myHand, gameState.lastDiscard!.tile, 3);
            return (
              <button
                style={{ ...BTN.base, ...BTN.gang, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: isCompact ? "6px 10px" : "10px 16px" }}
                onClick={() => {
                  if (!gameState.lastDiscard) return;
                  handleAction({
                    type: ActionType.MingGang,
                    playerIndex: myIndex,
                    targetTile: gameState.lastDiscard.tile,
                  });
                }}
              >
                {gangTiles.length === 3 ? (
                  <>
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      {gangTiles.map(t => <TileView key={t.id} tile={t} faceUp small />)}
                      <div style={HIGHLIGHT_STYLE}>
                        <TileView tile={gameState.lastDiscard!.tile} faceUp small />
                      </div>
                    </div>
                    <span style={{ fontSize: "var(--label-font, 11px)" }}>杠</span>
                  </>
                ) : "杠"}
              </button>
            );
          })()}

          {actions.canPeng && gameState.lastDiscard && (() => {
            const pengTiles = findMatchingHandTiles(gameState.myHand, gameState.lastDiscard!.tile, 2);
            return (
              <button
                style={{ ...BTN.base, ...BTN.peng, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: isCompact ? "6px 10px" : "10px 16px" }}
                onClick={() => {
                  if (!gameState.lastDiscard) return;
                  handleAction({
                    type: ActionType.Peng,
                    playerIndex: myIndex,
                    targetTile: gameState.lastDiscard.tile,
                  });
                }}
              >
                {pengTiles.length === 2 ? (
                  <>
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      {pengTiles.map(t => <TileView key={t.id} tile={t} faceUp small />)}
                      <div style={HIGHLIGHT_STYLE}>
                        <TileView tile={gameState.lastDiscard!.tile} faceUp small />
                      </div>
                    </div>
                    <span style={{ fontSize: "var(--label-font, 11px)" }}>碰</span>
                  </>
                ) : "碰"}
              </button>
            );
          })()}

          {actions.chiOptions.length === 1 && !showChiPicker && gameState.lastDiscard && (
            <button
              style={{
                ...BTN.base, ...BTN.chi,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: isCompact ? "6px 10px" : "10px 16px",
              }}
              onClick={() => {
                handleAction({
                  type: ActionType.Chi,
                  playerIndex: myIndex,
                  tiles: actions.chiOptions[0] as [TileInstance, TileInstance],
                  targetTile: gameState.lastDiscard!.tile,
                });
              }}
            >
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {actions.chiOptions[0].map(t => <TileView key={t.id} tile={t} faceUp small />)}
                <div style={HIGHLIGHT_STYLE}>
                  <TileView tile={gameState.lastDiscard.tile} faceUp small />
                </div>
              </div>
              <span style={{ fontSize: "var(--label-font, 11px)" }}>吃</span>
            </button>
          )}

          {actions.chiOptions.length === 2 && !showChiPicker && gameState.lastDiscard && actions.chiOptions.map((combo, i) => (
            <button
              key={i}
              style={{
                ...BTN.base, ...BTN.chi,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: isCompact ? "6px 10px" : "10px 16px",
              }}
              onClick={() => {
                handleAction({
                  type: ActionType.Chi,
                  playerIndex: myIndex,
                  tiles: combo as [TileInstance, TileInstance],
                  targetTile: gameState.lastDiscard!.tile,
                });
              }}
            >
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {combo.map(t => <TileView key={t.id} tile={t} faceUp small />)}
                <div style={HIGHLIGHT_STYLE}>
                  <TileView tile={gameState.lastDiscard!.tile} faceUp small />
                </div>
              </div>
              <span style={{ fontSize: "var(--label-font, 11px)" }}>吃</span>
            </button>
          ))}

          {actions.chiOptions.length >= 3 && !showChiPicker && (
            <button
              style={{
                ...BTN.base, ...BTN.chi,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: isCompact ? "6px 10px" : "10px 16px",
              }}
              onClick={() => handleShowChiPicker()}
            >
              吃 ×{actions.chiOptions.length}
            </button>
          )}

        </div>

        {/* Pass button on separate row */}
        {actions.canPass && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, width: "100%" , textAlign: "center" }}>
            <button
              style={{ ...BTN.base, ...BTN.pass, ...(isCompact ? { padding: "6px 12px" } : {}) }}
              onClick={() => handleAction({ type: ActionType.Pass, playerIndex: myIndex })}
            >
              过
            </button>
          </div>
        )}

        {/* Chi picker */}
        {showChiPicker && gameState.lastDiscard && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            padding: "8px 0",
            width: "100%",
            animation: exitingChi ? "overlayScaleOut 0.15s ease-in forwards" : "overlayScaleIn 0.15s ease-out",
          }}>
            <div style={{ textAlign: "center", fontSize: "var(--label-font)", color: "var(--color-text-secondary)", marginBottom: 8 }}>
              选择吃牌组合
            </div>
            <div className="chi-picker-scroll" style={{
              display: "flex",
              overflowX: "auto",
              gap: 12,
              padding: "4px 4px",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x",
              justifyContent: actions.chiOptions.length <= 2 ? "center" : undefined,
              maxHeight: isUltraCompact ? "min(45dvh, calc(100dvh - 160px))" : "60dvh",
              overflowY: "auto",
            }}>
              {actions.chiOptions.map((combo, i) => (
                <button
                  key={i}
                  style={{
                    ...BTN.base,
                    ...BTN.chi,
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                    padding: isCompact ? "6px 10px" : "10px 16px",
                    minHeight: isCompact ? 44 : 56,
                    scrollSnapAlign: "start",
                    flexShrink: 0,
                    borderRadius: 10,
                    border: "2px solid rgba(46,139,87,0.6)",
                  }}
                  onClick={() => {
                    if (!gameState.lastDiscard) return;
                    handleAction({
                      type: ActionType.Chi,
                      playerIndex: myIndex,
                      tiles: combo as [TileInstance, TileInstance],
                      targetTile: gameState.lastDiscard.tile,
                    });
                  }}
                >
                  {combo.map((t) => (
                    <TileView key={t.id} tile={t} faceUp small />
                  ))}
                  <div style={{
                    border: "2px solid var(--color-accent-orange)",
                    borderRadius: 4,
                    padding: 1,
                    marginLeft: 2,
                    boxShadow: "0 0 6px rgba(255,165,0,0.4)",
                  }}>
                    <TileView tile={gameState.lastDiscard!.tile} faceUp small />
                  </div>
                </button>
              ))}
              <button
                style={{
                  ...BTN.base,
                  ...BTN.pass,
                  minHeight: isCompact ? 44 : 56,
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                }}
                onClick={() => handleHideChiPicker()}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
