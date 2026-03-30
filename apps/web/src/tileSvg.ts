// FluffyStuff riichi-mahjong-tiles SVGs via jsDelivr CDN
// License: MIT (https://github.com/FluffyStuff/riichi-mahjong-tiles)

const BASE = "https://cdn.jsdelivr.net/gh/FluffyStuff/riichi-mahjong-tiles@master/Regular";

import type { Tile } from "@fuzhou-mahjong/shared";
import { isSuitedTile } from "@fuzhou-mahjong/shared";

const SUIT_MAP: Record<string, string> = { wan: "Man", bing: "Pin", tiao: "Sou" };
const WIND_MAP: Record<string, string> = { east: "Ton", south: "Nan", west: "Shaa", north: "Pei" };
const DRAGON_MAP: Record<string, string> = { red: "Chun", green: "Hatsu", white: "Haku" };

function makeFlowerSvg(char: string, color: string, label: string, labelColor: string): string {
  // viewBox matches FluffyStuff tiles (300×400) for consistent proportions
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><text x="150" y="210" text-anchor="middle" dominant-baseline="central" font-family="serif" font-size="170" font-weight="bold" fill="${color}">${char}</text><text x="150" y="350" text-anchor="middle" font-family="sans-serif" font-size="50" fill="${labelColor}" opacity="0.7">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const FLOWER_SVGS: Record<string, Record<string, string>> = {
  season: {
    spring: makeFlowerSvg("春", "#2e7d32", "Spring", "#2e7d32"),
    summer: makeFlowerSvg("夏", "#c62828", "Summer", "#c62828"),
    autumn: makeFlowerSvg("秋", "#e65100", "Autumn", "#e65100"),
    winter: makeFlowerSvg("冬", "#1565c0", "Winter", "#1565c0"),
  },
  plant: {
    plum: makeFlowerSvg("梅", "#ad1457", "Plum", "#ad1457"),
    orchid: makeFlowerSvg("蘭", "#6a1b9a", "Orchid", "#6a1b9a"),
    bamboo: makeFlowerSvg("竹", "#2e7d32", "Bamboo", "#2e7d32"),
    chrysanthemum: makeFlowerSvg("菊", "#f9a825", "Mum", "#f9a825"),
  },
};

export function getTileSvgUrl(tile: Tile): string | null {
  if (isSuitedTile(tile)) {
    const suit = SUIT_MAP[tile.suit];
    return suit ? `${BASE}/${suit}${tile.value}.svg` : null;
  }
  switch (tile.kind) {
    case "wind": return WIND_MAP[tile.windType] ? `${BASE}/${WIND_MAP[tile.windType]}.svg` : null;
    case "dragon": return DRAGON_MAP[tile.dragonType] ? `${BASE}/${DRAGON_MAP[tile.dragonType]}.svg` : null;
    case "season": return FLOWER_SVGS.season[tile.seasonType] ?? null;
    case "plant": return FLOWER_SVGS.plant[tile.plantType] ?? null;
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
