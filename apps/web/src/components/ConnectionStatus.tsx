import { useEffect, useState } from "react";
import type { ConnectionState } from "../hooks/useSocket";

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  reconnectAttempt: number;
  timeoutMs: number;
  disconnectedAt: number | null;
}

export function ConnectionStatus({ connectionState, reconnectAttempt, timeoutMs, disconnectedAt }: ConnectionStatusProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!disconnectedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - disconnectedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [disconnectedAt]);

  if (connectionState === "connected" || !disconnectedAt) return null;

  const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
  const progress = Math.min(1, elapsed / timeoutMs);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "var(--overlay-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    }}>
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />

      <div style={{ fontSize: 20, color: "var(--color-text-warm)", fontWeight: "bold" }}>
        {connectionState === "reconnecting" ? "重新连接中... / Reconnecting..." : "连接已断开 / Disconnected"}
      </div>

      <div style={{ fontSize: 16, color: "var(--color-text-secondary)" }}>
        {remaining > 0
          ? `${remaining}s 内重连可恢复游戏 / ${remaining}s to reconnect`
          : "超时 / Timed out"
        }
      </div>

      {reconnectAttempt > 0 && (
        <div style={{ fontSize: 13, color: "#6a9a6a" }}>
          重试 #{reconnectAttempt}
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        width: "min(280px, 80vw)",
        height: 6,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${(1 - progress) * 100}%`,
          height: "100%",
          background: remaining > 10 ? "var(--color-success)" : remaining > 5 ? "var(--color-accent-orange)" : "var(--color-error)",
          borderRadius: 3,
          transition: "width 1s linear, background 0.5s ease",
        }} />
      </div>
    </div>
  );
}
