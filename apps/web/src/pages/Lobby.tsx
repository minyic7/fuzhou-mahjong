import { useState, useEffect } from "react";
import type { RoomListItem, RoomState } from "@fuzhou-mahjong/shared";
import { socket } from "../socket";
import { Button } from "../components/Button";
import { TutorialModal } from "../components/TutorialModal";

interface LobbyProps {
  onJoined: (roomState: RoomState) => void;
}

export function Lobby({ onJoined }: LobbyProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [quickStarting, setQuickStarting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

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

  const handleQuickStart = () => {
    const playerName = name.trim() || `玩家${Math.floor(1000 + Math.random() * 9000)}`;
    setError("");
    setQuickStarting(true);
    socket.emit("quickStart", playerName);
  };

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
    <div className="lobby-page">
    <div className="lobby-content">
      <div className="lobby-header">
        <h1>福州麻将</h1>
        <h2>Fuzhou Mahjong</h2>
      </div>

      <div>
        <input
          type="text"
          placeholder="你的名字 / Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "var(--btn-padding)", fontSize: "var(--lobby-subtitle-font)", boxSizing: "border-box" }}
        />
      </div>

      <div className="lobby-section">
        <Button
          variant="gold"
          size="lg"
          onClick={handleQuickStart}
          disabled={quickStarting}
          className="lobby-create-btn"
          style={{ width: "100%", background: "linear-gradient(135deg, var(--color-bg-button) 0%, var(--color-bg-button-hover) 100%)", border: "2px solid var(--color-gold-border-hover)", boxShadow: "0 0 12px rgba(212, 160, 23, 0.3)" }}
        >
          {quickStarting ? "启动中... / Starting..." : "⚡ 快速开始 / Quick Start"}
        </Button>
        <p className="lobby-hint">
          一键开局，自动匹配 3 个机器人
        </p>
      </div>

      <div className="lobby-section">
        <Button
          variant="gold"
          size="lg"
          onClick={handleCreate}
          disabled={!name.trim()}
          className="lobby-create-btn"
          style={{ width: "100%" }}
        >
          创建房间 / Create Room
        </Button>
        <p className="lobby-hint">
          创建房间后可邀请朋友或添加机器人
        </p>
      </div>

      <hr />

      <h3 className="lobby-section-heading">可用房间 / Available Rooms</h3>
      {rooms.length === 0 ? (
        <p className="lobby-empty-msg">暂无房间 / No rooms available</p>
      ) : (
        <div className="room-card-list">
          {rooms.map((room) => (
            <div key={room.roomId} className="room-card">
              <div className="room-card-row">
                <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: "bold", color: "var(--color-text-primary)", letterSpacing: 4 }}>
                  {room.roomId}
                </span>
                <span className="room-status-badge" style={{ background: room.playerCount >= room.maxPlayers ? "rgba(255,82,82,0.2)" : "rgba(46,125,80,0.3)", color: room.playerCount >= room.maxPlayers ? "var(--color-error)" : "var(--color-text-secondary)", border: `1px solid ${room.playerCount >= room.maxPlayers ? "rgba(255,82,82,0.3)" : "rgba(46,125,80,0.5)"}`, padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>
                  {room.playerCount >= room.maxPlayers ? "已满 / Full" : "等待中 / Waiting"}
                </span>
              </div>
              <div className="room-card-row">
                <div>
                  <div className="player-dots">
                    {Array.from({ length: room.maxPlayers }).map((_, i) => (
                      <span key={i} style={{ width: 10, height: 10, borderRadius: "var(--radius-sm)", background: i < room.playerCount ? "var(--color-bg-button-hover)" : "rgba(184, 134, 11, 0.15)", border: "1px solid rgba(184, 134, 11, 0.3)", display: "inline-block" }} />
                    ))}
                  </div>
                  <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--label-font)" }}>
                    {room.players.join(", ")}
                  </span>
                </div>
                <Button
                  onClick={() => handleJoin(room.roomId)}
                  disabled={!name.trim() || room.playerCount >= room.maxPlayers}
                >
                  加入 / Join
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr />

      <h3 className="lobby-section-heading">手动加入 / Join by Code</h3>
      <div className="lobby-join-row">
        <input
          type="text"
          placeholder="房间号 / Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={4}
          style={{ flex: 1, padding: "var(--btn-padding)", fontSize: "var(--lobby-subtitle-font)", textTransform: "uppercase", letterSpacing: 4, textAlign: "center" }}
        />
        <Button
          onClick={() => handleJoin(roomCode.trim())}
          disabled={!name.trim() || !roomCode.trim()}
        >
          加入 / Join
        </Button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <hr />
      <Button
        variant="secondary"
        onClick={() => setShowTutorial(true)}
        style={{ width: "100%", background: "transparent", border: "1px solid var(--color-gold-border-hover)" }}
      >
        游戏规则 / How to Play
      </Button>

      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
    </div>
  );
}
