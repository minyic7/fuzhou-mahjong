import { useEffect, useState } from "react";
import { socket } from "../socket";
import type { RoomState } from "@fuzhou-mahjong/shared";

interface RoomProps {
  initialRoomState: RoomState | null;
}

export function Room({ initialRoomState }: RoomProps) {
  const [room, setRoom] = useState<RoomState | null>(initialRoomState);

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

  if (!room) return <p>Loading...</p>;

  const handleStart = () => {
    socket.emit("startGame");
  };

  const handleLeave = () => {
    socket.emit("leaveRoom");
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: 20 }}>
      <h2>房间 / Room</h2>

      <div style={{
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center",
        padding: 20,
        background: "#f0f0f0",
        borderRadius: 8,
        marginBottom: 20,
        letterSpacing: 8,
      }}>
        {room.roomId}
      </div>

      <h3>玩家 / Players ({room.players.length}/4)</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {room.players.map((p, i) => (
          <li key={i} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            {p.name} {p.isBot && <span style={{ color: "#aab4a0", fontSize: 12 }}>🤖</span>}
          </li>
        ))}
        {Array.from({ length: 4 - room.players.length }).map((_, i) => (
          <li key={`empty-${i}`} style={{ padding: 8, borderBottom: "1px solid #eee", color: "#ccc" }}>
            空位 — 等待玩家或添加机器人
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => socket.emit("addBot")}
          disabled={room.players.length >= 4}
          style={{ flex: 1, padding: 12, fontSize: 16 }}
        >
          +机器人 / +Bot
        </button>
        <button
          onClick={() => socket.emit("removeBot")}
          disabled={!room.players.some((p) => p.isBot)}
          style={{ padding: 12, fontSize: 16 }}
        >
          -机器人
        </button>
        <button
          onClick={handleStart}
          disabled={room.players.length < 4}
          style={{ flex: 1, padding: 12, fontSize: 16 }}
        >
          开始游戏 / Start
        </button>
        <button
          onClick={handleLeave}
          style={{ padding: 12, fontSize: 16 }}
        >
          离开 / Leave
        </button>
      </div>
    </div>
  );
}
