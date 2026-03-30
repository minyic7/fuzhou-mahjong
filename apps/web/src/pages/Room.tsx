import { useEffect, useState } from "react";
import { socket } from "../socket";
import type { RoomState, CumulativeData } from "@fuzhou-mahjong/shared";
import { Button } from "../components/Button";

interface RoomProps {
  initialRoomState: RoomState | null;
  sessionScores?: CumulativeData | null;
}

const WIND_LABELS = ["东 East", "南 South", "西 West", "北 North"];

export function Room({ initialRoomState, sessionScores }: RoomProps) {
  const [room, setRoom] = useState<RoomState | null>(initialRoomState);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    const onRoomJoined = (state: RoomState) => setRoom(state);
    const onRoomUpdated = (state: RoomState) => setRoom(state);

    socket.on("roomJoined", onRoomJoined);
    socket.on("roomUpdated", onRoomUpdated);

    return () => {
      socket.off("roomJoined", onRoomJoined);
      socket.off("roomUpdated", onRoomUpdated);
    };
  }, []);

  if (!room) return <div className="loading-state"><div className="spinner" />加载房间...</div>;

  const handleStart = () => {
    socket.emit("startGame");
  };

  const handleLeave = () => {
    socket.emit("leaveRoom");
  };

  // Build 4 seat slots: filled players + empty seats
  const seats = Array.from({ length: 4 }, (_, i) => {
    const player = room.players[i];
    return {
      index: i,
      player: player ?? null,
      wind: WIND_LABELS[i],
    };
  });

  return (
    <div className="room-page" style={{ display: "flex", justifyContent: "center", padding: "max(16px, 3vh) max(12px, 3vw)" }}>
    <div style={{ maxWidth: 480, width: "100%" }}>
      <h2 style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: 15, fontWeight: 400, marginBottom: 20 }}>房间 / Room</h2>

      {/* Mahjong table seat layout */}
      <div className="seat-layout">
        {/* Top seat */}
        <div className="seat-slot" style={{ gridArea: "top" }}>
          <SeatCard seat={seats[2]} score={sessionScores?.scores[2]} />
        </div>
        {/* Left seat */}
        <div className="seat-slot" style={{ gridArea: "left" }}>
          <SeatCard seat={seats[3]} score={sessionScores?.scores[3]} />
        </div>
        {/* Center: room ID */}
        <div className="table-center" style={{ gridArea: "center" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>ROOM</div>
          <div style={{ fontSize: 28, fontWeight: "bold", fontFamily: "monospace", letterSpacing: 6, color: "var(--color-text-gold)" }}>
            {room.roomId}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6 }}>
            {room.players.length}/4 玩家
          </div>
          {sessionScores && sessionScores.roundsPlayed > 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-gold)", marginTop: 4 }}>
              已完成 {sessionScores.roundsPlayed} 局
            </div>
          )}
        </div>
        {/* Right seat */}
        <div className="seat-slot" style={{ gridArea: "right" }}>
          <SeatCard seat={seats[1]} score={sessionScores?.scores[1]} />
        </div>
        {/* Bottom seat */}
        <div className="seat-slot" style={{ gridArea: "bottom" }}>
          <SeatCard seat={seats[0]} score={sessionScores?.scores[0]} />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Button
          onClick={() => socket.emit("addBot")}
          disabled={room.players.length >= 4}
          style={{ flex: 1, minWidth: 120 }}
        >
          +机器人 / +Bot
        </Button>
        <Button
          variant="secondary"
          onClick={() => socket.emit("removeBot")}
          disabled={!room.players.some((p) => p.isBot)}
        >
          -机器人
        </Button>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <Button
          variant="gold"
          size="lg"
          onClick={handleStart}
          disabled={room.players.length < 4}
          className="lobby-create-btn"
          style={{ flex: 1 }}
        >
          开始游戏 / Start
        </Button>
        <Button
          variant="danger"
          onClick={() => setShowLeaveConfirm(true)}
        >
          离开 / Leave
        </Button>
      </div>
      {showLeaveConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'rgba(15,30,25,0.97)', border: '2px solid rgba(184,134,11,0.4)', borderRadius: 12, padding: '24px', maxWidth: 360, textAlign: 'center' }}>
            <p style={{ fontSize: 18, marginBottom: 16 }}>确定要离开房间吗？</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button variant='secondary' onClick={() => setShowLeaveConfirm(false)}>取消</Button>
              <Button variant='danger' onClick={handleLeave}>离开</Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

function SeatCard({ seat, score }: { seat: { index: number; player: { name: string; isBot?: boolean } | null; wind: string }; score?: number }) {
  const { player, wind } = seat;
  const isEmpty = !player;

  return (
    <div className={`seat-card ${isEmpty ? "seat-empty" : "seat-filled"}`}>
      <div style={{ fontSize: 11, color: "var(--color-text-gold)", marginBottom: 4, letterSpacing: 1 }}>{wind}</div>
      {player ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
            {player.name}
          </div>
          {player.isBot && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>🤖 Bot</div>}
          {score != null && (
            <div style={{
              fontSize: 12, fontWeight: "bold", marginTop: 2,
              color: score > 0 ? "#ffd700" : score < 0 ? "#f44336" : "#8fbc8f",
            }}>
              {score > 0 ? "+" : ""}{score}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: "rgba(143,188,143,0.5)" }}>空位 / Empty</div>
      )}
    </div>
  );
}
