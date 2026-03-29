import {
  Suit,
  WindType,
  DragonType,
  SeasonType,
  PlantType,
} from '../types/tile.js';
import type { SuitedTile, Tile, TileInstance } from '../types/tile.js';

type SuitedValue = SuitedTile['value'];

export function createAllTiles(): TileInstance[] {
  const tiles: TileInstance[] = [];
  let id = 0;

  // 108 suited tiles: 3 suits × 9 values × 4 copies
  for (const suit of [Suit.Wan, Suit.Bing, Suit.Tiao]) {
    for (let value = 1; value <= 9; value++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({
          id: id++,
          tile: { kind: 'suited', suit, value: value as SuitedValue },
        });
      }
    }
  }

  // 16 wind tiles: 4 types × 4 copies
  for (const windType of [WindType.East, WindType.South, WindType.West, WindType.North]) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, tile: { kind: 'wind', windType } });
    }
  }

  // 12 dragon tiles: 3 types × 4 copies
  for (const dragonType of [DragonType.Red, DragonType.Green, DragonType.White]) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, tile: { kind: 'dragon', dragonType } });
    }
  }

  // 4 season tiles: 1 each
  for (const seasonType of [SeasonType.Spring, SeasonType.Summer, SeasonType.Autumn, SeasonType.Winter]) {
    tiles.push({ id: id++, tile: { kind: 'season', seasonType } });
  }

  // 4 plant tiles: 1 each
  for (const plantType of [PlantType.Plum, PlantType.Orchid, PlantType.Bamboo, PlantType.Chrysanthemum]) {
    tiles.push({ id: id++, tile: { kind: 'plant', plantType } });
  }

  return tiles;
}

export function shuffleTiles(tiles: TileInstance[]): TileInstance[] {
  const result = [...tiles];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
