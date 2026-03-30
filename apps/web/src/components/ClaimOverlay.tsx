import { useState } from "react";
import { ActionType } from "@fuzhou-mahjong/shared";
import type { AvailableActions, ClientGameState, GameAction, TileInstance } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { BREAKPOINTS } from "../hooks/useIsMobile";

interface ClaimOverlayProps {
  actions: AvailableActions;
  gameState: ClientGameState;
  onAction: (action: GameAction) => void;
}

const BTN = {
  base: {
    padding: "var(--btn-padding)", fontSize: "var(--btn-font)", fontWeight: "bold" as const,
    borderRadius: 8, border: "none", minHeight: "var(--btn-min-size)", minWidth: "var(--btn-min-size)",
    cursor: "pointer",
  },
  hu: { background: "var(--color-action-hu)", color: "#fff" },
  peng: { background: "var(--color-action-peng)", color: "#fff" },
  gang: { background: "var(--color-action-gang)", color: "#fff" },
  chi: { background: "var(--color-action-chi)", color: "#fff" },
  pass: { background: "var(--color-action-pass-bg)", color: "var(--color-action-pass-text)" },
};

export function ClaimOverlay({ actions, gameState, onAction }: ClaimOverlayProps) {
  const isCompact = window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT;
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
        zIndex: 40,
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
        padding: "var(--overlay-padding-y) var(--overlay-padding-x)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isCompact ? 6 : 12,
        maxWidth: "90vw",
        maxHeight: isCompact ? "80dvh" : "90dvh",
        overflowY: "auto",
        animation: exiting ? "overlayScaleOut 0.18s ease-in forwards" : "overlayScaleIn 0.2s ease-out",
      }}>
        <div style={{ color: "var(--color-accent-orange)", fontWeight: "bold", fontSize: "var(--btn-font)", marginBottom: 4 }}>
          {isCompact ? "选择" : "可以操作！请选择"}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          {actions.canHu && (
            <button
              style={{ ...BTN.base, ...BTN.hu }}
              onClick={() => handleAction({ type: ActionType.Hu, playerIndex: myIndex })}
            >
              胡!
            </button>
          )}

          {actions.canMingGang && gameState.lastDiscard && (
            <button
              style={{ ...BTN.base, ...BTN.gang }}
              onClick={() => handleAction({
                type: ActionType.MingGang,
                playerIndex: myIndex,
                targetTile: gameState.lastDiscard!.tile,
              })}
            >
              杠
            </button>
          )}

          {actions.canPeng && gameState.lastDiscard && (
            <button
              style={{ ...BTN.base, ...BTN.peng }}
              onClick={() => handleAction({
                type: ActionType.Peng,
                playerIndex: myIndex,
                targetTile: gameState.lastDiscard!.tile,
              })}
            >
              碰
            </button>
          )}

          {actions.chiOptions.length > 0 && !showChiPicker && (
            <button
              style={{ ...BTN.base, ...BTN.chi }}
              onClick={() => {
                if (actions.chiOptions.length === 1 && gameState.lastDiscard) {
                  handleAction({
                    type: ActionType.Chi,
                    playerIndex: myIndex,
                    tiles: actions.chiOptions[0] as [TileInstance, TileInstance],
                    targetTile: gameState.lastDiscard.tile,
                  });
                } else {
                  handleShowChiPicker();
                }
              }}
            >
              吃
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
              justifyContent: actions.chiOptions.length <= 2 ? "center" : undefined,
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
                    handleAction({
                      type: ActionType.Chi,
                      playerIndex: myIndex,
                      tiles: combo as [TileInstance, TileInstance],
                      targetTile: gameState.lastDiscard!.tile,
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
