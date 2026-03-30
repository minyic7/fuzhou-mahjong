import { useState } from "react";
import { ActionType } from "@fuzhou-mahjong/shared";
import type { AvailableActions, ClientGameState, GameAction, TileInstance } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface ClaimOverlayProps {
  actions: AvailableActions;
  gameState: ClientGameState;
  onAction: (action: GameAction) => void;
}

const BTN = {
  base: {
    padding: "12px 24px", fontSize: 18, fontWeight: "bold" as const,
    borderRadius: 8, border: "none", minHeight: 48, minWidth: 48,
    cursor: "pointer",
  },
  hu: { background: "#c41e3a", color: "#fff" },
  peng: { background: "#1e6ec4", color: "#fff" },
  gang: { background: "#d4760a", color: "#fff" },
  chi: { background: "#2e8b57", color: "#fff" },
  pass: { background: "#444", color: "#ccc" },
};

export function ClaimOverlay({ actions, gameState, onAction }: ClaimOverlayProps) {
  const [showChiPicker, setShowChiPicker] = useState(false);
  const myIndex = gameState.myIndex;

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        animation: "overlayFadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && showChiPicker) {
          setShowChiPicker(false);
        }
      }}
    >
      <div style={{
        background: "rgba(15,30,25,0.95)",
        border: "2px solid #ffa500",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        maxWidth: "90vw",
        animation: "overlayScaleIn 0.2s ease-out",
      }}>
        <div style={{ color: "#ffa500", fontWeight: "bold", fontSize: 16, marginBottom: 4 }}>
          可以操作！请选择
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          {actions.canHu && (
            <button
              style={{ ...BTN.base, ...BTN.hu }}
              onClick={() => onAction({ type: ActionType.Hu, playerIndex: myIndex })}
            >
              胡!
            </button>
          )}

          {actions.canMingGang && gameState.lastDiscard && (
            <button
              style={{ ...BTN.base, ...BTN.gang }}
              onClick={() => onAction({
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
              onClick={() => onAction({
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
                  onAction({
                    type: ActionType.Chi,
                    playerIndex: myIndex,
                    tiles: actions.chiOptions[0] as [TileInstance, TileInstance],
                    targetTile: gameState.lastDiscard.tile,
                  });
                } else {
                  setShowChiPicker(true);
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
              style={{ ...BTN.base, ...BTN.pass, fontSize: 14, padding: "8px 20px", minHeight: 40 }}
              onClick={() => onAction({ type: ActionType.Pass, playerIndex: myIndex })}
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
          }}>
            <div style={{ textAlign: "center", fontSize: 13, color: "#aaa", marginBottom: 8 }}>
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
                    padding: "10px 16px",
                    minHeight: 56,
                    scrollSnapAlign: "start",
                    flexShrink: 0,
                    borderRadius: 10,
                    border: "2px solid rgba(46,139,87,0.6)",
                  }}
                  onClick={() => {
                    onAction({
                      type: ActionType.Chi,
                      playerIndex: myIndex,
                      tiles: combo as [TileInstance, TileInstance],
                      targetTile: gameState.lastDiscard!.tile,
                    });
                    setShowChiPicker(false);
                  }}
                >
                  {combo.map((t) => (
                    <TileView key={t.id} tile={t} faceUp small />
                  ))}
                  <div style={{
                    border: "2px solid #ffa500",
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
                  fontSize: 14,
                  padding: "10px 20px",
                  minHeight: 56,
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                }}
                onClick={() => setShowChiPicker(false)}
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
