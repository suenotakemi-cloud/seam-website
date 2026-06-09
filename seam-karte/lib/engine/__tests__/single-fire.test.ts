/**
 * 21 ルール × 単独発火テスト
 *
 * runKarteEngine 経由ではなく evaluateRule を直接呼ぶことで、
 * 排他ルール（exclusions）に左右されずに各ルール単独の trigger 評価を検証する。
 *
 * 注: R07 は any_of(+0.25) + boost(+0.15) = 0.40 が最大で、
 *     threshold 0.50 に届かないため現 rules.json では発火不可能。
 *     これを「現データの構造的制約」として明示的にテストする。
 */

import { describe, it, expect } from 'vitest';
import rulesFileJson from '../rules.json';
import { evaluateRule } from '../engine';
import type { Context, RulesFile, UserAnswers } from '../types';

const rulesFile = rulesFileJson as unknown as RulesFile;

// 中立な base — 他ルールに副作用を起こしにくい値で構成
const baseAnswers: UserAnswers = {
  q1: 'scalp',
  q2: 'mid_str',
  q3: ['none'],
  q4: ['s0'],
  q5: 'normal',
  q6: 'natural',
  q7: 'dryer',
};

const baseContext: Context = {
  season: 'summer',
  submitted_at: '2026-05-16T00:00:00Z',
};

function build(overrides: Partial<UserAnswers>): UserAnswers {
  return { ...baseAnswers, ...overrides };
}

function getRule(id: string) {
  const rule = rulesFile.rules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found in rules.json`);
  return rule;
}

interface FireCase {
  id: string;
  desc: string;
  answers: Partial<UserAnswers>;
  context?: Context;
  expectMatched: boolean;
  notes?: string;
}

const cases: FireCase[] = [
  { id: 'R01', desc: 'ブリーチ履歴 + 毛先ザラ', answers: { q3: ['bleach'], q4: ['s2'] }, expectMatched: true },
  { id: 'R02', desc: '縮毛矯正 + うねり再発', answers: { q3: ['straight'], q1: 'frizz' }, expectMatched: true },
  { id: 'R03', desc: 'パーマ + うねり', answers: { q3: ['perm'], q1: 'frizz' }, expectMatched: true },
  { id: 'R04', desc: '縮毛+ブリーチ + ダメージ', answers: { q3: ['straight', 'bleach'], q1: 'damage' }, expectMatched: true },
  { id: 'R05', desc: '泡立ち悪化 (s1)', answers: { q4: ['s1'] }, expectMatched: true },
  { id: 'R06', desc: 'アイロン + 毛先ザラ', answers: { q7: 'iron', q4: ['s2'] }, expectMatched: true },
  {
    id: 'R07',
    desc: 'UV/プール + カラー悩み（boost 込みでも 0.40 < threshold 0.50）',
    answers: { q9: ['uv'], q1: 'color' },
    expectMatched: false,
    notes: '現 rules.json の構造的制約。R07 を発火可能にするには rules.json 側に all_of を追加するか、boost score を引き上げる必要あり。',
  },
  { id: 'R08', desc: 'カラー履歴 + カラー悩み', answers: { q3: ['color'], q1: 'color' }, expectMatched: true },
  { id: 'R09', desc: 'ブリーチ + 黄ばみ (s5)', answers: { q3: ['bleach'], q4: ['s5'] }, expectMatched: true },
  { id: 'R10', desc: '抜け毛 (s7) + エイジング', answers: { q4: ['s7'], q5: 'aging' }, expectMatched: true },
  { id: 'R11', desc: '脂性頭皮 + 頭皮悩み', answers: { q5: 'oily', q1: 'scalp' }, expectMatched: true },
  { id: 'R12', desc: '産後 + 抜け毛 boost', answers: { q11: ['postpartum'], q4: ['s7'] }, expectMatched: true },
  {
    id: 'R13',
    desc: '冬季 + 乾燥悩み',
    answers: { q1: 'dryness' },
    context: { season: 'winter', submitted_at: '2026-12-01T00:00:00Z' },
    expectMatched: true,
  },
  { id: 'R14', desc: '乾燥頭皮 + 乾燥悩み', answers: { q5: 'dry', q1: 'dryness' }, expectMatched: true },
  { id: 'R15', desc: 'ホルモン + うねり', answers: { q11: ['hormone'], q1: 'frizz' }, expectMatched: true },
  { id: 'R16', desc: '食生活偏り + ダメージ', answers: { q11: ['diet'], q1: 'damage' }, expectMatched: true },
  { id: 'R17', desc: '根元ベタ毛先カサ (s3)', answers: { q4: ['s3'] }, expectMatched: true },
  { id: 'R18', desc: 'ボリューム喪失 + 重さ (s4)', answers: { q1: 'volume', q4: ['s4'] }, expectMatched: true },
  { id: 'R19', desc: 'スタイリング剤蓄積 (s4 + s1)', answers: { q4: ['s4', 's1'] }, expectMatched: true },
  { id: 'R20', desc: 'アイロン + 毛先ザラ (R06 重複域)', answers: { q7: 'iron', q4: ['s2'] }, expectMatched: true },
  { id: 'R21', desc: 'まとまらない (s6) + シャンプー不明', answers: { q4: ['s6'], q10: 'unknown' }, expectMatched: true },
];

describe('Single-fire evaluation for each of 21 rules', () => {
  it.each(cases)('$id — $desc', ({ id, answers, context, expectMatched }) => {
    const rule = getRule(id);
    const result = evaluateRule(rule, build(answers), context ?? baseContext, rulesFile);
    if (expectMatched) {
      expect(
        result.matched,
        `Rule ${id} expected to match but got confidence=${result.confidence}`,
      ).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(rulesFile.meta.confidence_thresholds.medium);
    } else {
      expect(result.matched).toBe(false);
    }
  });

  it('coverage: all 21 rules are represented in the test table', () => {
    const covered = new Set(cases.map((c) => c.id));
    expect(covered.size).toBe(21);
    for (const r of rulesFile.rules) {
      expect(covered.has(r.id), `Rule ${r.id} is missing from the single-fire test table`).toBe(true);
    }
    expect(rulesFile.rules).toHaveLength(21);
  });
});
