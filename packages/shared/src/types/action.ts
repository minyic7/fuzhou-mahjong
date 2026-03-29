import type { TileInstance } from './tile.js';

export enum ActionType {
  Draw = 'draw',
  Discard = 'discard',
  Chi = 'chi',
  Peng = 'peng',
  MingGang = 'mingGang',
  AnGang = 'anGang',
  BuGang = 'buGang',
  Hu = 'hu',
  Pass = 'pass',
}

export interface DrawAction {
  type: ActionType.Draw;
  playerIndex: number;
}

export interface DiscardAction {
  type: ActionType.Discard;
  playerIndex: number;
  tile: TileInstance;
}

export interface ChiAction {
  type: ActionType.Chi;
  playerIndex: number;
  tiles: [TileInstance, TileInstance];
  targetTile: TileInstance;
}

export interface PengAction {
  type: ActionType.Peng;
  playerIndex: number;
  targetTile: TileInstance;
}

export interface MingGangAction {
  type: ActionType.MingGang;
  playerIndex: number;
  targetTile: TileInstance;
}

export interface AnGangAction {
  type: ActionType.AnGang;
  playerIndex: number;
  tile: TileInstance;
}

export interface BuGangAction {
  type: ActionType.BuGang;
  playerIndex: number;
  tile: TileInstance;
}

export interface HuAction {
  type: ActionType.Hu;
  playerIndex: number;
  tile?: TileInstance;
}

export interface PassAction {
  type: ActionType.Pass;
  playerIndex: number;
}

export type GameAction =
  | DrawAction
  | DiscardAction
  | ChiAction
  | PengAction
  | MingGangAction
  | AnGangAction
  | BuGangAction
  | HuAction
  | PassAction;
