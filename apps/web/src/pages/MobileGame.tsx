import type { ClientGameState } from "@fuzhou-mahjong/shared";

interface MobileGameProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function MobileGame({ initialGameState, onLeave }: MobileGameProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "var(--color-table-felt)", color: "var(--color-text-primary)", padding: 20, textAlign: "center" }}>
      <h1>Mobile View</h1>
      <p>Coming soon — optimized mobile game experience</p>
      {initialGameState && (
        <p>Players: {initialGameState.otherPlayers.length + 1}</p>
      )}
      {onLeave && <button onClick={onLeave} style={{ marginTop: 20, padding: "10px 20px" }}>Leave Game</button>}
    </div>
  );
}
