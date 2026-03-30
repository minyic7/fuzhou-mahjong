import { isSuitedTile } from '../types/tile.js';
import type { TileInstance } from '../types/tile.js';
import type { GoldState } from '../types/game.js';
import type { PlayerState } from '../types/player.js';
import { MeldType } from '../types/meld.js';
import { WinType } from './winning.js';
import { isGoldTile } from './gold.js';
import { countFlowerGangs } from './retention.js';

export interface ScoreResult {
  flowerScore: number;
  goldScore: number;
  specialMultiplier: number;
  totalScore: number;
  payments: number[];
}

/**
 * Count gold tiles in the winner's hand.
 */
function countGoldInHand(hand: TileInstance[], gold: GoldState): number {
  return hand.filter((t) => isGoldTile(t, gold)).length;
}

/**
 * Calculate flower score for the winner.
 * = individual flowers + flower gang bonus (+2 per gang) + meld gang points + gold in hand
 *
 * Note: gold tile scoring is included here, so no separate gold addition is needed in the
 * total score formula.
 */
function calculateFlowerScore(winner: PlayerState, gold: GoldState | null): number {
  let score = winner.flowers.length;

  // Flower gang bonus: each flower gang adds +2 (since 4 tiles give 6 instead of 4)
  score += countFlowerGangs(winner.flowers) * 2;

  // Meld gang points (winner only)
  for (const meld of winner.melds) {
    switch (meld.type) {
      case MeldType.MingGang:
      case MeldType.BuGang:
        score += 1;
        break;
      case MeldType.AnGang:
        score += 2;
        break;
    }
  }

  // Gold tiles in hand
  if (gold) {
    score += countGoldInHand(winner.hand, gold);
  }

  return score;
}

/**
 * Calculate score using QQ version formula.
 *
 * Discard win: (flowerScore + lianZhuang + 5) × 2 + specialMultiplier
 * Self-draw:   above × 3
 *
 * Payment (modern rules):
 * - Self-draw: each of 3 losers pays totalScore to winner
 * - Discard win: discarder pays 2 × totalScore to winner
 */
export function calculateScore(
  winner: PlayerState,
  winnerIndex: number,
  winType: WinType,
  multiplier: number,
  gold: GoldState | null,
  isSelfDraw: boolean,
  discarderIndex: number | null,
  lianZhuangCount: number,
): ScoreResult {
  const flowerScore = calculateFlowerScore(winner, gold);

  const baseCalc = (flowerScore + lianZhuangCount + 5) * 2 + multiplier;
  const totalScore = isSelfDraw ? baseCalc * 3 : baseCalc;

  // Payment calculation
  const payments = [0, 0, 0, 0];

  if (isSelfDraw) {
    // Each of 3 losers pays totalScore
    for (let i = 0; i < 4; i++) {
      if (i === winnerIndex) {
        payments[i] = totalScore * 3;
      } else {
        payments[i] = -totalScore;
      }
    }
  } else if (discarderIndex !== null) {
    // Discarder pays 2x
    payments[winnerIndex] = totalScore * 2;
    payments[discarderIndex] = -(totalScore * 2);
  }

  return {
    flowerScore,
    goldScore: gold ? countGoldInHand(winner.hand, gold) : 0, // for display breakdown only
    specialMultiplier: multiplier,
    totalScore,
    payments,
  };
}

/**
 * Determine the next dealer and lian zhuang count.
 */
export function getNextDealer(
  currentDealer: number,
  winnerIndex: number | null,
  lianZhuangCount: number,
): { nextDealer: number; nextLianZhuang: number } {
  if (winnerIndex === null) {
    // Draw: dealer continues, lianZhuang preserved
    return { nextDealer: currentDealer, nextLianZhuang: lianZhuangCount };
  }

  if (winnerIndex === currentDealer) {
    // Dealer wins: continue, lianZhuang + 1
    return { nextDealer: currentDealer, nextLianZhuang: lianZhuangCount + 1 };
  }

  // Non-dealer wins: pass dealer counterclockwise, reset lianZhuang
  return { nextDealer: (currentDealer + 1) % 4, nextLianZhuang: 0 };
}
