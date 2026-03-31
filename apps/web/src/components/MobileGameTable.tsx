import type { ClientGameState } from "@fuzhou-mahjong/shared";

interface MobileGameTableProps {
  gameState: ClientGameState | null;
}

export function MobileGameTable({ gameState }: MobileGameTableProps) {
  const handCount = gameState?.myHand.length ?? 0;
  const otherPlayers = gameState?.otherPlayers ?? [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "10% 80% 10%",
        gridTemplateRows: "1fr",
        width: "100%",
        height: "100dvh",
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        boxSizing: "border-box",
        background: "var(--color-table-felt, #1a472a)",
        color: "var(--color-text-primary, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Left Opponent */}
      <div
        style={{
          gridColumn: 1,
          gridRow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.08)",
          borderRight: "1px solid rgba(255,255,255,0.15)",
          writingMode: "vertical-rl",
          fontSize: "0.75rem",
        }}
      >
        {otherPlayers[2]?.name ?? "Left Opponent"}
      </div>

      {/* Center column */}
      <div
        style={{
          gridColumn: 2,
          gridRow: 1,
          display: "grid",
          gridTemplateRows: "20% 20% 60%",
          minHeight: 0,
        }}
      >
        {/* Top Opponent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.06)",
            borderBottom: "1px solid rgba(255,255,255,0.15)",
            fontSize: "0.8rem",
          }}
        >
          {otherPlayers[1]?.name ?? "Top Opponent"}
        </div>

        {/* Game Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 4,
            fontSize: "0.75rem",
            opacity: 0.8,
          }}
        >
          <span>
            {gameState
              ? `Round ${gameState.roundsPlayed + 1} · Wall: ${gameState.wallRemaining}`
              : "Waiting for game..."}
          </span>
        </div>

        {/* My Hand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.1)",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          My Hand ({handCount} tiles)
        </div>
      </div>

      {/* Right Opponent */}
      <div
        style={{
          gridColumn: 3,
          gridRow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.08)",
          borderLeft: "1px solid rgba(255,255,255,0.15)",
          writingMode: "vertical-rl",
          fontSize: "0.75rem",
        }}
      >
        {otherPlayers[0]?.name ?? "Right Opponent"}
      </div>
    </div>
  );
}
