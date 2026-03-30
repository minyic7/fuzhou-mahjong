import { useState, useEffect } from "react";
import type { RoomListItem, RoomState } from "@fuzhou-mahjong/shared";
import { socket } from "../socket";

interface LobbyProps {
  onJoined: (roomState: RoomState) => void;
}

export function Lobby({ onJoined }: LobbyProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<RoomListItem[]>([]);

  useEffect(() => {
    socket.emit("listRooms");

    const onRoomJoined = (state: RoomState) => onJoined(state);
    const onError = (msg: string) => setError(msg);
    const onRoomList = (list: RoomListItem[]) => setRooms(list);

    socket.on("roomJoined", onRoomJoined);
    socket.on("error", onError);
    socket.on("roomList", onRoomList);

    return () => {
      socket.off("roomJoined", onRoomJoined);
      socket.off("error", onError);
      socket.off("roomList", onRoomList);
    };
  }, [onJoined]);

  const handleCreate = () => {
    if (!name.trim()) return;
    setError("");
    socket.emit("createRoom", name.trim());
  };

  const handleJoin = (code: string) => {
    if (!name.trim()) {
      setError("请先输入名字 / Enter your name first");
      return;
    }
    setError("");
    socket.emit("joinRoom", code.toUpperCase(), name.trim());
  };

  return (
    <div className="lobby-page" style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 36, color: "#eee", marginBottom: 4 }}>福州麻将</h1>
        <h2 style={{ fontSize: 16, color: "#8fbc8f", fontWeight: 400 }}>Fuzhou Mahjong</h2>
      </div>

      <div>
        <input
          type="text"
          placeholder="你的名字 / Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", fontSize: 16, boxSizing: "border-box" }}
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={!name.trim()}
        className="lobby-create-btn"
        style={{ width: "100%", padding: "14px 12px", fontSize: 18, fontWeight: 600, border: "2px solid rgba(184, 134, 11, 0.4)", background: "#1a5c3a" }}
      >
        创建房间 / Create Room
      </button>
      <p style={{ color: "#8fbc8f", fontSize: 13, textAlign: "center", marginTop: -12 }}>
        一个人也能玩！创建房间后可添加机器人凑满 4 人
      </p>

      <hr />

      <h3 style={{ color: "#d4a017", fontSize: 15, letterSpacing: 1 }}>可用房间 / Available Rooms</h3>
      {rooms.length === 0 ? (
        <p style={{ color: "#8fbc8f", textAlign: "center", padding: "20px 0" }}>暂无房间 / No rooms available</p>
      ) : (
        <div className="room-card-list">
          {rooms.map((room) => (
            <div key={room.roomId} className="room-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: "bold", color: "#eee", letterSpacing: 4 }}>
                  {room.roomId}
                </span>
                <span className="room-status-badge" style={{ background: room.playerCount >= room.maxPlayers ? "rgba(255,82,82,0.2)" : "rgba(46,125,80,0.3)", color: room.playerCount >= room.maxPlayers ? "#ff8a80" : "#8fbc8f", border: `1px solid ${room.playerCount >= room.maxPlayers ? "rgba(255,82,82,0.3)" : "rgba(46,125,80,0.5)"}`, padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>
                  {room.playerCount >= room.maxPlayers ? "已满 / Full" : "等待中 / Waiting"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    {Array.from({ length: room.maxPlayers }).map((_, i) => (
                      <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < room.playerCount ? "#2e7d50" : "rgba(184, 134, 11, 0.15)", border: "1px solid rgba(184, 134, 11, 0.3)", display: "inline-block" }} />
                    ))}
                  </div>
                  <span style={{ color: "#8fbc8f", fontSize: 13 }}>
                    {room.players.join(", ")}
                  </span>
                </div>
                <button
                  onClick={() => handleJoin(room.roomId)}
                  disabled={!name.trim() || room.playerCount >= room.maxPlayers}
                  style={{ padding: "12px 20px", fontSize: 14 }}
                >
                  加入 / Join
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr />

      <h3 style={{ color: "#d4a017", fontSize: 15, letterSpacing: 1 }}>手动加入 / Join by Code</h3>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="房间号 / Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={4}
          style={{ flex: 1, padding: "10px 12px", fontSize: 16, textTransform: "uppercase", letterSpacing: 4, textAlign: "center" }}
        />
        <button
          onClick={() => handleJoin(roomCode.trim())}
          disabled={!name.trim() || !roomCode.trim()}
          style={{ padding: "10px 24px", fontSize: 16 }}
        >
          加入 / Join
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
