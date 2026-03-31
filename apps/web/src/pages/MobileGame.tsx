import type { ClientGameState } from "@fuzhou-mahjong/shared";
import { useGameLogic } from "../hooks/useGameLogic";
import { MobileGameTable } from "../components/MobileGameTable";
import { MobileClaimOverlay } from "../components/MobileClaimOverlay";
import { MobileGameOverModal } from "../components/MobileGameOverModal";
import { CenterAction } from "../components/CenterAction";
import { TileCounter } from "../components/TileCounter";
import { Button } from "../components/Button";
import { useState } from "react";

interface MobileGameProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function MobileGame({ initialGameState, onLeave }: MobileGameProps) {
  const game = useGameLogic({ initialGameState, onLeave });
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!game.gameState) {
    return (
      <div className="loading-state" style={{ minHeight: "100dvh" }}>
        <div className="spinner" />
        等待游戏数据...
      </div>
    );
  }

  const gs = game.gameState;
  const otherPlayers = gs.otherPlayers;
  const { myIndex } = gs;
  const lastDiscardTileId = gs.lastDiscard?.tile.id ?? null;
  const lastDiscardPlayerIndex = gs.lastDiscard?.playerIndex ?? -1;

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden" }}>
      {/* Portrait rotation overlay */}
      {game.isPortrait && (
        <div className="portrait-rotate-overlay">
          <div className="portrait-title">福州麻将</div>
          <div className="portrait-phone-icon phone-rotate-icon">📱</div>
          <div className="portrait-msg">请将手机横屏以获得最佳体验</div>
          <div className="portrait-hint">
            Please rotate your device to landscape mode. The game table requires a wider screen to
            display properly.
          </div>
        </div>
      )}

      {/* Screen flash */}
      {game.showFlash && (
        <>
          <div className="screen-flash" />
          <div className="border-flash" />
        </>
      )}

      {/* Toast notifications */}
      <div className="game-toast-container compact">
        {game.toasts.map((t) => (
          <div key={t.id} className="game-toast">
            {t.message}
          </div>
        ))}
      </div>

      {/* Center action announcements */}
      <CenterAction display={game.centerAction} gold={gs.gold} />

      {/* Game table with all player areas */}
      <MobileGameTable
        gameState={gs}
        selectedTileId={game.selectedTileId}
        onTileSelect={game.handleTileSelect}
        claimableTileIds={game.claimableTileIds}
        canDiscard={game.effectiveCanDiscard}
        onDiscard={game.handleDiscardById}
        canHu={game.canHuSelf}
        onHu={game.handleHu}
        kongTileIds={game.kongTileIds}
        onAnGang={game.handleAnGang}
        onBuGang={game.handleBuGang}
        disconnectedPlayers={game.disconnectedPlayers}
        lastDiscardTileId={lastDiscardTileId}
        lastDiscardPlayerIndex={lastDiscardPlayerIndex}
        claimActive={game.isClaimWindow}
      />

      {/* Claim overlay */}
      {game.isClaimWindow && game.actions && (
        <MobileClaimOverlay
          actions={game.actions}
          gameState={gs}
          onAction={game.handleAction}
        />
      )}

      {/* Tile counter */}
      <div style={{
        position: "fixed",
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        left: "calc(12px + env(safe-area-inset-left, 0px))",
        zIndex: "var(--z-tile-counter)" as any,
      }}>
        <TileCounter gameState={gs} />
      </div>

      {/* Settings gear button */}
      <div style={{
        position: "fixed",
        top: "calc(4px + env(safe-area-inset-top, 0px))",
        right: "calc(4px + env(safe-area-inset-right, 0px))",
        zIndex: "var(--z-settings-btn)" as any,
      }}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Settings"
          style={{
            width: 36, height: 36, minHeight: 36, borderRadius: "50%",
            background: "var(--overlay-bg)", border: "1px solid var(--color-gold-border-hover)",
            color: "var(--color-text-secondary)", fontSize: 18, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >⚙</button>
        {settingsOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            zIndex: "var(--z-settings-dropdown)" as any,
            background: "var(--overlay-bg)", border: "1px solid var(--color-gold-border-hover)",
            borderRadius: "var(--radius-md)", padding: 4, minWidth: 130,
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            <Button
              variant="secondary"
              size="sm"
              style={{ justifyContent: "flex-start", width: "100%", border: "none" }}
              onClick={game.handleToggleMute}
            >{game.muted ? "🔇" : "🔊"} 音效{game.muted ? "开启" : "关闭"}</Button>
            {game.onLeave && (
              <Button
                variant="danger"
                size="sm"
                style={{ justifyContent: "flex-start", width: "100%", border: "none" }}
                onClick={game.handleRequestLeave}
              >🚪 退出游戏</Button>
            )}
          </div>
        )}
      </div>

      {/* Leave confirmation modal */}
      {game.showLeaveConfirm && (
        <div className="confirm-modal-backdrop">
          <div className="confirm-modal">
            <p className="confirm-modal-title">确定要退出吗？</p>
            <p className="confirm-modal-subtitle">退出后本局将由机器人代打</p>
            <div className="confirm-modal-actions">
              <Button variant="secondary" onClick={() => game.setShowLeaveConfirm(false)}>取消</Button>
              <Button variant="danger" onClick={game.handleConfirmLeave}>退出游戏</Button>
            </div>
          </div>
        </div>
      )}

      {/* Game-over modal */}
      {game.gameOver && (
        <MobileGameOverModal
          gameOver={game.gameOver}
          gameState={gs}
          winTypeNames={game.winTypeNames}
          sessionSummary={game.sessionSummary}
          onNextRound={game.handleNextRound}
          onLeaveOrShowSummary={game.handleLeaveOrShowSummary}
          onSessionSummaryClose={game.handleSessionSummaryClose}
          onLeave={game.onLeave}
        />
      )}
    </div>
  );
}
