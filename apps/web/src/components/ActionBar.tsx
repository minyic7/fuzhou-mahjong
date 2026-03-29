import { useState, useEffect, useRef } from "react";
import { ActionType } from "@fuzhou-mahjong/shared";
import type { AvailableActions, ClientGameState, GameAction, TileInstance } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface ActionBarProps {
  actions: AvailableActions | null;
  selectedTileId: number | null;
  gameState: ClientGameState;
  onAction: (action: GameAction) => void;
}

const BTN = {
  base: { padding: "10px 20px", fontSize: 16, fontWeight: "bold" as const, borderRadius: 6, border: "none", margin: 4 },
  hu: { background: "#c41e3a", color: "#fff" },
  gang: { background: "#d4760a", color: "#fff" },
  peng: { background: "#1e6ec4", color: "#fff" },
  chi: { background: "#2e8b57", color: "#fff" },
  discard: { background: "#00b894", color: "#fff", boxShadow: "0 0 8px rgba(0,184,148,0.5)" },
  pass: { background: "#333", color: "#888" },
  draw: { background: "#6a5acd", color: "#fff" },
};

export function ActionBar({ actions, selectedTileId, gameState, onAction }: ActionBarProps) {
  const [showChiPicker, setShowChiPicker] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const myIndex = gameState.myIndex;

  const hasClaimAction = actions
    ? actions.canHu || actions.canPeng || actions.canMingGang || actions.chiOptions.length > 0
    : false;
  const isClaimWindow = hasClaimAction && actions ? !actions.canDiscard : false;

  useEffect(() => {
    if (isClaimWindow && barRef.current) {
      barRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isClaimWindow]);

  if (!actions) {
    const isMyTurn = gameState.currentTurn === gameState.myIndex;
    return (
      <div className="waiting-pulse" style={{
        textAlign: "center", padding: 12, color: "#aaa", fontSize: 14,
        background: "rgba(0,0,0,0.3)", borderRadius: 8, marginTop: 8,
      }}>
        {isMyTurn ? "等待服务器响应..." : "等待其他玩家操作... ⏳"}
      </div>
    );
  }

  const hasAnyAction = actions.canDraw || actions.canDiscard || actions.canHu ||
    actions.canPeng || actions.canMingGang || actions.chiOptions.length > 0 ||
    actions.anGangOptions.length > 0 || actions.buGangOptions.length > 0 || actions.canPass;

  if (!hasAnyAction) return null;

  const selectedTile = selectedTileId !== null
    ? gameState.myHand.find((t) => t.id === selectedTileId) ?? null
    : null;

  return (
    <div ref={barRef} style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      padding: isClaimWindow ? 16 : 12,
      background: isClaimWindow ? "rgba(255,140,0,0.2)" : "rgba(0,0,0,0.5)",
      border: isClaimWindow ? "2px solid #ffa500" : "none",
      borderRadius: 8,
      marginTop: 8,
    }}>
      {isClaimWindow && (
        <div style={{ width: "100%", textAlign: "center", color: "#ffa500", fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>
          可以操作！请选择 👇
        </div>
      )}
      {!isClaimWindow && (actions.canDiscard || actions.canDraw) && (
        <div className="your-turn-prompt" style={{ width: "100%", textAlign: "center", marginBottom: 4 }}>
          <span style={{ color: "#ffd700", fontWeight: "bold", fontSize: 18, textShadow: "0 0 8px rgba(255,215,0,0.6)" }}>
            YOUR TURN — 轮到你了
          </span>
          {actions.canDiscard && (
            <div style={{ color: "#4fc3f7", fontSize: 14, marginTop: 2 }}>
              {selectedTile ? "点击「出牌」确认" : "👆 请先选择一张手牌"}
            </div>
          )}
        </div>
      )}
      {actions.canDraw && (
        <button
          style={{ ...BTN.base, ...BTN.draw }}
          onClick={() => onAction({ type: ActionType.Draw, playerIndex: myIndex })}
        >
          摸牌
        </button>
      )}

      {actions.canDiscard && (
        <button
          style={{ ...BTN.base, ...BTN.discard, opacity: selectedTile ? 1 : 0.5 }}
          disabled={!selectedTile}
          onClick={() => {
            if (selectedTile) {
              onAction({ type: ActionType.Discard, playerIndex: myIndex, tile: selectedTile });
            }
          }}
        >
          出牌
        </button>
      )}

      {actions.canHu && (
        <button
          style={{ ...BTN.base, ...BTN.hu }}
          onClick={() => onAction({ type: ActionType.Hu, playerIndex: myIndex })}
        >
          胡!
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

      {actions.anGangOptions.length > 0 && (
        <button
          style={{ ...BTN.base, ...BTN.gang }}
          onClick={() => onAction({
            type: ActionType.AnGang,
            playerIndex: myIndex,
            tile: actions.anGangOptions[0][0],
          })}
        >
          暗杠
        </button>
      )}

      {actions.buGangOptions.length > 0 && (
        <button
          style={{ ...BTN.base, ...BTN.gang }}
          onClick={() => onAction({
            type: ActionType.BuGang,
            playerIndex: myIndex,
            tile: actions.buGangOptions[0].tile,
          })}
        >
          补杠
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

      {showChiPicker && gameState.lastDiscard && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.chiOptions.map((combo, i) => (
            <button
              key={i}
              style={{ ...BTN.base, ...BTN.chi, display: "flex", gap: 2, alignItems: "center" }}
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
            </button>
          ))}
          <button
            style={{ ...BTN.base, ...BTN.pass }}
            onClick={() => setShowChiPicker(false)}
          >
            取消
          </button>
        </div>
      )}

      {actions.canPass && (
        <button
          style={{ ...BTN.base, ...BTN.pass }}
          onClick={() => onAction({ type: ActionType.Pass, playerIndex: myIndex })}
        >
          过
        </button>
      )}
    </div>
  );
}
