import type { TileInstance } from './tile.js';

export enum MeldType {
  Chi = 'chi',
  Peng = 'peng',
  MingGang = 'mingGang',
  AnGang = 'anGang',
  BuGang = 'buGang',
}

export interface Meld {
  type: MeldType;
  tiles: TileInstance[];
  sourceTile?: TileInstance;
  sourcePlayer?: number;
}
