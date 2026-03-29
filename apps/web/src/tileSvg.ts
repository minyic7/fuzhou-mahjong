// FluffyStuff riichi-mahjong-tiles SVGs via jsDelivr CDN
// License: MIT (https://github.com/FluffyStuff/riichi-mahjong-tiles)

const BASE = "https://cdn.jsdelivr.net/gh/FluffyStuff/riichi-mahjong-tiles@master/Regular";

import type { Tile } from "@fuzhou-mahjong/shared";
import { isSuitedTile } from "@fuzhou-mahjong/shared";

const SUIT_MAP: Record<string, string> = { wan: "Man", bing: "Pin", tiao: "Sou" };
const WIND_MAP: Record<string, string> = { east: "Ton", south: "Nan", west: "Shaa", north: "Pei" };
const DRAGON_MAP: Record<string, string> = { red: "Chun", green: "Hatsu", white: "Haku" };

export function getTileSvgUrl(tile: Tile): string | null {
  if (isSuitedTile(tile)) {
    const suit = SUIT_MAP[tile.suit];
    return suit ? `${BASE}/${suit}${tile.value}.svg` : null;
  }
  switch (tile.kind) {
    case "wind": return WIND_MAP[tile.windType] ? `${BASE}/${WIND_MAP[tile.windType]}.svg` : null;
    case "dragon": return DRAGON_MAP[tile.dragonType] ? `${BASE}/${DRAGON_MAP[tile.dragonType]}.svg` : null;
    default: return null; // Season/plant tiles don't have SVGs in this set
  }
}

export const TILE_BACK_URL = `${BASE}/Back.svg`;

// Preload common tiles
export function preloadTileSvgs() {
  const urls: string[] = [TILE_BACK_URL];
  for (const suit of ["Man", "Pin", "Sou"]) {
    for (let v = 1; v <= 9; v++) urls.push(`${BASE}/${suit}${v}.svg`);
  }
  for (const name of ["Ton", "Nan", "Shaa", "Pei", "Chun", "Hatsu", "Haku"]) {
    urls.push(`${BASE}/${name}.svg`);
  }
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}
