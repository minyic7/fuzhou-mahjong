import { useState } from "react";
import { socket } from "../socket";

interface LobbyProps {
  onJoined: () => void;
}

export function Lobby({ onJoined }: LobbyProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    socket.emit("createRoom", name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    socket.emit("joinRoom", roomCode.trim().toUpperCase(), name.trim());
  };

  socket.on("roomJoined", () => {
    onJoined();
  });

  socket.on("error", (msg) => {
    setError(msg);
  });

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: 20 }}>
      <h1>福州麻将</h1>
      <h2>Fuzhou Mahjong</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="你的名字 / Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 8, fontSize: 16 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          style={{ width: "100%", padding: 12, fontSize: 16 }}
        >
          创建房间 / Create Room
        </button>
      </div>

      <hr />

      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="房间号 / Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={4}
          style={{ width: "100%", padding: 8, fontSize: 16, textTransform: "uppercase" }}
        />
      </div>

      <div>
        <button
          onClick={handleJoin}
          disabled={!name.trim() || !roomCode.trim()}
          style={{ width: "100%", padding: 12, fontSize: 16 }}
        >
          加入房间 / Join Room
        </button>
      </div>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
