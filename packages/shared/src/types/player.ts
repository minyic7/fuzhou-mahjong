import type { TileInstance, WindType } from './tile.js';
import type { Meld } from './meld.js';

export interface PlayerState {
  hand: TileInstance[];
  melds: Meld[];
  flowers: TileInstance[];
  discards: TileInstance[];
  seatWind: WindType;
  isDealer: boolean;
  hasDiscardedGold: boolean;
}
