import type { GameAction } from './action.js';
import type { GamePhase, GoldState } from './game.js';
import type { TileInstance } from './tile.js';
import type { Meld } from './meld.js';

// ─── Room ────────────────────────────────────────────────────────

export interface RoomState {
  roomId: string;
  players: { name: string; ready: boolean; isBot?: boolean }[];
  maxPlayers: 4;
}

// ─── Client-visible game state ───────────────────────────────────

export interface OtherPlayerView {
  name: string;
  isBot?: boolean;
  flowers: TileInstance[];
  melds: Meld[];
  handCount: number;
  discards: TileInstance[];
  hasDiscardedGold: boolean;
}

export interface ClientGameState {
  phase: GamePhase;
  myHand: TileInstance[];
  myFlowers: TileInstance[];
  myMelds: Meld[];
  myName: string;
  myDiscards: TileInstance[];
  otherPlayers: OtherPlayerView[];
  currentTurn: number;
  myIndex: number;
  dealerIndex: number;
  lianZhuangCount: number;
  gold: GoldState | null;
  wallRemaining: number;
  lastDiscard: { tile: TileInstance; playerIndex: number } | null;
  tenpaiTiles: import('../types/tile.js').SuitedTile[];
  lastDrawnTileId: number | null;
  myHasDiscardedGold: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────

export interface AvailableActions {
  canDraw: boolean;
  canDiscard: boolean;
  chiOptions: TileInstance[][];
  canPeng: boolean;
  canMingGang: boolean;
  anGangOptions: TileInstance[][];
  buGangOptions: { tile: TileInstance; meldIndex: number }[];
  canHu: boolean;
  canPass: boolean;
}

export interface ActionResult {
  success: boolean;
  message?: string;
}

export interface ScoreBreakdown {
  flowerScore: number;
  goldScore: number;
  specialMultiplier: number;
  lianZhuangCount: number;
  totalScore: number;
}

export interface CumulativeData {
  scores: number[];  // cumulative total per seat index (matches scores array order)
  roundsPlayed: number;
}

export interface GameOverResult {
  winnerId: number | null;
  winType: string;
  scores: number[];
  breakdown?: ScoreBreakdown;
  playerNames?: string[];
  cumulative?: CumulativeData;
  allHands?: {
    hand: TileInstance[];
    melds: Meld[];
    flowers: TileInstance[];
  }[];
}

// ─── Room List ───────────────────────────────────────────────────

export interface RoomListItem {
  roomId: string;
  playerCount: number;
  maxPlayers: 4;
  players: string[];
}

// ─── Socket.IO event contracts ───────────────────────────────────

export interface ClientEvents {
  createRoom: (playerName: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  leaveRoom: () => void;
  listRooms: () => void;
  startGame: () => void;
  playerAction: (action: GameAction) => void;
  rejoinGame: (playerId: string) => void;
  nextRound: () => void;
  addBot: () => void;
  removeBot: () => void;
  quickStart: (playerName: string) => void;
}

export interface PlayerDisconnectedEvent {
  playerIndex: number;
  playerName: string;
  timeoutMs: number;
}

export interface PlayerReconnectedEvent {
  playerIndex: number;
  playerName: string;
}

export interface ServerEvents {
  roomCreated: (roomId: string) => void;
  roomJoined: (roomState: RoomState) => void;
  roomUpdated: (roomState: RoomState) => void;
  roomList: (rooms: RoomListItem[]) => void;
  gameStarted: (gameState: ClientGameState) => void;
  gameStateUpdate: (gameState: ClientGameState) => void;
  actionRequired: (availableActions: AvailableActions) => void;
  actionResult: (result: ActionResult) => void;
  gameOver: (result: GameOverResult) => void;
  error: (message: string) => void;
  playerIdAssigned: (playerId: string) => void;
  playerDisconnected: (event: PlayerDisconnectedEvent) => void;
  playerReconnected: (event: PlayerReconnectedEvent) => void;
}
