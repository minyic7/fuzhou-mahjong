import { useState, useEffect } from "react";
import type { RoomListItem } from "@fuzhou-mahjong/shared";
import { socket } from "../socket";

interface LobbyProps {
  onJoined: () => void;
}

export function Lobby({ onJoined }: LobbyProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<RoomListItem[]>([]);

  useEffect(() => {
    socket.emit("listRooms");

    const onRoomJoined = () => onJoined();
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
    socket.emit("createRoom", name.trim());
  };

  const handleJoin = (code: string) => {
    if (!name.trim()) {
      setError("Please enter your name first");
      return;
    }
    socket.emit("joinRoom", code.toUpperCase(), name.trim());
  };

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 20 }}>
      <h1>福州麻将</h1>
      <h2>Fuzhou Mahjong</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="你的名字 / Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 8, fontSize: 16, boxSizing: "border-box" }}
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

      <h3>可用房间 / Available Rooms</h3>
      {rooms.length === 0 ? (
        <p style={{ color: "#888" }}>暂无房间 / No rooms available</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
              <th style={{ padding: "8px 4px" }}>房间号 / Room</th>
              <th style={{ padding: "8px 4px" }}>玩家 / Players</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.roomId} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 4px", fontFamily: "monospace", fontWeight: "bold" }}>
                  {room.roomId}
                </td>
                <td style={{ padding: "8px 4px" }}>
                  {room.players.join(", ")} ({room.playerCount}/{room.maxPlayers})
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <button
                    onClick={() => handleJoin(room.roomId)}
                    disabled={!name.trim()}
                    style={{ padding: "4px 12px" }}
                  >
                    加入 / Join
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr />

      <h3>手动加入 / Join by Code</h3>
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="房间号 / Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={4}
          style={{ width: "100%", padding: 8, fontSize: 16, textTransform: "uppercase", boxSizing: "border-box" }}
        />
      </div>

      <div>
        <button
          onClick={() => handleJoin(roomCode.trim())}
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
