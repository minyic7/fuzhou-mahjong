// Suited tiles: Wan (万), Bing (饼), Tiao (条)
export enum Suit {
  Wan = 'wan',
  Bing = 'bing',
  Tiao = 'tiao',
}

export interface SuitedTile {
  kind: 'suited';
  suit: Suit;
  value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

// Flower tiles: Wind, Dragon, Season, Plant
export enum WindType {
  East = 'east',
  South = 'south',
  West = 'west',
  North = 'north',
}

export enum DragonType {
  Red = 'red',
  Green = 'green',
  White = 'white',
}

export enum SeasonType {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
}

export enum PlantType {
  Plum = 'plum',
  Orchid = 'orchid',
  Bamboo = 'bamboo',
  Chrysanthemum = 'chrysanthemum',
}

export interface WindTile {
  kind: 'wind';
  windType: WindType;
}

export interface DragonTile {
  kind: 'dragon';
  dragonType: DragonType;
}

export interface SeasonTile {
  kind: 'season';
  seasonType: SeasonType;
}

export interface PlantTile {
  kind: 'plant';
  plantType: PlantType;
}

export type FlowerTile = WindTile | DragonTile | SeasonTile | PlantTile;

export type Tile = SuitedTile | FlowerTile;

export interface TileInstance {
  id: number; // 0-143
  tile: Tile;
}

export function isSuitedTile(tile: Tile): tile is SuitedTile {
  return tile.kind === 'suited';
}

export function isFlowerTile(tile: Tile): tile is FlowerTile {
  return tile.kind !== 'suited';
}
