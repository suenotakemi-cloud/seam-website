/**
 * SEAM Hair Karte v3.8 — Hair DNA Resolver
 * fired ルールから 16 Hair DNA タイプを決定する。
 * 擬似コード 8章 + 参照実装 (computeTypeScores / resolvePrimaryDNA / resolveSubDNA) 準拠。
 *
 * フォールバック:
 *  - fired が空 かつ q4 == ['s0']  → Midnight Silk（健康）
 *  - fired が空 かつ それ以外        → Crystal Bloom（予防）
 *
 * Sub DNA:
 *  - Primary とのスコア差が 20% 未満のときだけ併記。離れていれば null。
 */

import type { FiredRule, UserAnswers } from '../engine/types';
import dnaCatalog from './types.json';

// ============================================================
// DNA profile types
// ============================================================

export type DnaPaletteMood = 'cool' | 'warm' | 'fresh';

export interface DnaPalette {
  bg: string;
  accent: string;
  secondary: string;
  mood: DnaPaletteMood;
  text: string;
}

export interface DnaProfile {
  name: string;
  jp: string;
  palette: DnaPalette;
  keyword: string;
  motif: string;
  essence: string;
  tags: string[];
}

export interface DnaCatalog {
  version: string;
  types: DnaProfile[];
}

export const DNA_CATALOG = dnaCatalog as DnaCatalog;

const FALLBACK_HEALTHY: string = 'Midnight Silk';
const FALLBACK_PREVENTIVE: string = 'Crystal Bloom';
const SUB_DNA_THRESHOLD = 0.20;

// ============================================================
// Public API
// ============================================================

export function getDnaProfile(name: string): DnaProfile | undefined {
  return DNA_CATALOG.types.find((t) => t.name === name);
}

export function resolvePrimaryDNA(fired: FiredRule[], answers: UserAnswers): string {
  if (fired.length === 0) {
    if (answers.q4.length === 1 && answers.q4[0] === 's0') {
      return FALLBACK_HEALTHY;
    }
    return FALLBACK_PREVENTIVE;
  }

  const scores = computeTypeScores(fired);
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  // computeTypeScores は fired が非空である限り 1件以上のエントリを返すので、
  // 念のためのフォールバックだけ付けておく。
  return top ? top[0] : FALLBACK_PREVENTIVE;
}

export function resolveSubDNA(fired: FiredRule[], primary: string): string | null {
  if (fired.length === 0) return null;

  const scores = computeTypeScores(fired);
  const filtered = [...scores.entries()]
    .filter(([k]) => k !== primary)
    .sort((a, b) => b[1] - a[1]);

  const top = filtered[0];
  if (!top) return null;

  const primaryScore = scores.get(primary) ?? 0;
  if (primaryScore <= 0) return null;

  const subScore = top[1];
  if ((primaryScore - subScore) / primaryScore < SUB_DNA_THRESHOLD) {
    return top[0];
  }
  return null;
}

// ============================================================
// Internal: weighted vote
// ============================================================

export function computeTypeScores(fired: FiredRule[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const fr of fired) {
    const types = fr.rule.primary_types;
    if (types.length === 0) continue;
    const portion = fr.score / types.length;
    for (const t of types) {
      scores.set(t, (scores.get(t) ?? 0) + portion);
    }
  }
  return scores;
}
