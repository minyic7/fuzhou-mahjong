import { useState } from "react";
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
  discard: { background: "#555", color: "#fff" },
  pass: { background: "#444", color: "#aaa" },
  draw: { background: "#6a5acd", color: "#fff" },
};

export function ActionBar({ actions, selectedTileId, gameState, onAction }: ActionBarProps) {
  const [showChiPicker, setShowChiPicker] = useState(false);
  const myIndex = gameState.myIndex;

  if (!actions) {
    const isMyTurn = gameState.currentTurn === gameState.myIndex;
    return (
      <div style={{
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
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
      padding: 12,
      background: "rgba(0,0,0,0.5)",
      borderRadius: 8,
      marginTop: 8,
    }}>
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
