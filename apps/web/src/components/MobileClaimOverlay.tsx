import { useState, useRef } from "react";
import { ActionType, isSuitedTile, suitedTilesMatch } from "@fuzhou-mahjong/shared";
import type { AvailableActions, ClientGameState, GameAction, TileInstance, SuitedTile } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface MobileClaimOverlayProps {
  actions: AvailableActions;
  gameState: ClientGameState;
  onAction: (action: GameAction) => void;
}

const BTN = {
  base: {
    fontWeight: "bold" as const,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    minWidth: 56,
    minHeight: 56,
    fontSize: 14,
    padding: "6px 12px",
  },
  hu: { background: "linear-gradient(135deg, #d4a017, #c0392b)", color: "#fff", minWidth: 64, minHeight: 64 },
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

export function MobileClaimOverlay({ actions, gameState, onAction }: MobileClaimOverlayProps) {
  const [showChiPicker, setShowChiPicker] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitingChi, setExitingChi] = useState(false);
  const touchStartY = useRef<number | null>(null);
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
    }, 180);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > 40) {
      handleAction({ type: ActionType.Pass, playerIndex: myIndex });
    }
  };

  return (
    <>
      {/* Bottom bar overlay */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 80,
          background: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          zIndex: "var(--z-claim-overlay)" as any,
          padding: "0 env(safe-area-inset-right, 8px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 8px)",
          transition: "transform 0.18s ease-out",
          transform: exiting ? "translateY(100%)" : "translateY(0)",
          animation: "mobileClaimSlideUp 0.18s ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Skip */}
        {actions.canPass && (
          <button
            style={{ ...BTN.base, ...BTN.pass }}
            onClick={() => handleAction({ type: ActionType.Pass, playerIndex: myIndex })}
          >
            过
          </button>
        )}

        {/* Chi — 1 option: single button */}
        {actions.chiOptions.length === 1 && !showChiPicker && gameState.lastDiscard && (
          <button
            style={{
              ...BTN.base, ...BTN.chi,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
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
            <span style={{ fontSize: 11 }}>吃</span>
          </button>
        )}

        {/* Chi — 2 options: inline side-by-side */}
        {actions.chiOptions.length === 2 && !showChiPicker && gameState.lastDiscard && actions.chiOptions.map((combo, i) => (
          <button
            key={i}
            style={{
              ...BTN.base, ...BTN.chi,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
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
            <span style={{ fontSize: 11 }}>吃</span>
          </button>
        ))}

        {/* Chi — 3+ options: open bottom sheet */}
        {actions.chiOptions.length >= 3 && !showChiPicker && (
          <button
            style={{ ...BTN.base, ...BTN.chi }}
            onClick={handleShowChiPicker}
          >
            吃 ×{actions.chiOptions.length}
          </button>
        )}

        {/* Peng */}
        {actions.canPeng && gameState.lastDiscard && (() => {
          const pengTiles = findMatchingHandTiles(gameState.myHand, gameState.lastDiscard!.tile, 2);
          return (
            <button
              style={{
                ...BTN.base, ...BTN.peng,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}
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
                  <span style={{ fontSize: 11 }}>碰</span>
                </>
              ) : "碰"}
            </button>
          );
        })()}

        {/* Gang */}
        {actions.canMingGang && gameState.lastDiscard && (() => {
          const gangTiles = findMatchingHandTiles(gameState.myHand, gameState.lastDiscard!.tile, 3);
          return (
            <button
              style={{
                ...BTN.base, ...BTN.gang,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}
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
                  <span style={{ fontSize: 11 }}>杠</span>
                </>
              ) : "杠"}
            </button>
          );
        })()}

        {/* Hu */}
        {actions.canHu && (
          <button
            style={{ ...BTN.base, ...BTN.hu }}
            onClick={() => handleAction({ type: ActionType.Hu, playerIndex: myIndex })}
          >
            胡!
          </button>
        )}
      </div>

      {/* Chi picker bottom sheet (3+ options) */}
      {showChiPicker && gameState.lastDiscard && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: "calc(var(--z-claim-overlay) + 1)" as any,
            background: "rgba(0, 0, 0, 0.92)",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: "16px env(safe-area-inset-right, 16px) calc(16px + env(safe-area-inset-bottom, 0px)) env(safe-area-inset-left, 16px)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            transition: "transform 0.18s ease-out",
            transform: exitingChi ? "translateY(100%)" : "translateY(0)",
            animation: "mobileClaimSlideUp 0.18s ease-out",
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={(e) => {
            if (touchStartY.current === null) return;
            const deltaY = e.changedTouches[0].clientY - touchStartY.current;
            touchStartY.current = null;
            if (deltaY > 40) {
              handleHideChiPicker();
            }
          }}
        >
          <div style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
            选择吃牌组合
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {actions.chiOptions.map((combo, i) => (
              <button
                key={i}
                style={{
                  ...BTN.base, ...BTN.chi,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  minHeight: 56,
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
                {combo.map(t => <TileView key={t.id} tile={t} faceUp small />)}
                <div style={HIGHLIGHT_STYLE}>
                  <TileView tile={gameState.lastDiscard!.tile} faceUp small />
                </div>
              </button>
            ))}
          </div>
          <button
            style={{ ...BTN.base, ...BTN.pass, width: "100%", minHeight: 48 }}
            onClick={handleHideChiPicker}
          >
            取消
          </button>
        </div>
      )}

      {/* Keyframe animation */}
      <style>{`
        @keyframes mobileClaimSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
