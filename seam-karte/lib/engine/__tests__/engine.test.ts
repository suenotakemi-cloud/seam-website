import { describe, it, expect } from 'vitest';
import rulesFileJson from '../rules.json';
import { runKarteEngine } from '../engine';
import type { Context, RulesFile } from '../types';

const rulesFile = rulesFileJson as unknown as RulesFile;

const ctx: Context = {
  season: 'summer',
  submitted_at: '2026-05-16T00:00:00Z',
};

describe('runKarteEngine — 4 acceptance cases (port of test_engine.py)', () => {
  it('Case 1: ブリーチヘビー → R05 (CRITICAL), R09, R06 fire; R08 suppressed by R09', () => {
    const out = runKarteEngine(
      {
        q1: 'color',
        q2: 'mid_str',
        q3: ['color', 'bleach'],
        q4: ['s1', 's5'],
        q5: 'oily',
        q6: 'gloss',
        q7: 'iron',
        q8: 'ongoing',
        q9: ['pool', 'uv'],
      },
      ctx,
      rulesFile,
    );
    const ids = out.fired_rules.map((f) => f.rule.id);
    expect(ids).toContain('R05');
    expect(ids).toContain('R09');
    expect(ids).toContain('R06');
    expect(ids).not.toContain('R08'); // suppressed by R09
  });

  it('Case 2: 産後フェーズ → R12 fires, R10 suppressed by R12', () => {
    const out = runKarteEngine(
      {
        q1: 'volume',
        q2: 'long_str',
        q3: ['none'],
        q4: ['s7'],
        q5: 'aging',
        q6: 'natural',
        q7: 'dryer',
        q11: ['postpartum'],
      },
      ctx,
      rulesFile,
    );
    const ids = out.fired_rules.map((f) => f.rule.id);
    expect(ids).toContain('R12');
    expect(ids).not.toContain('R10');
  });

  it('Case 3: 健康 (q4=["s0"] のみ) → no rules fire, Midnight Silk returned', () => {
    const out = runKarteEngine(
      {
        q1: 'volume',
        q2: 'mid_str',
        q3: ['none'],
        q4: ['s0'],
        q5: 'normal',
        q6: 'natural',
        q7: 'dryer',
      },
      ctx,
      rulesFile,
    );
    expect(out.fired_rules).toHaveLength(0);
    expect(out.primary_dna).toBe('Midnight Silk');
    expect(out.sub_dna).toBeNull();
    expect(out.warning).toBeUndefined();
  });

  it('Case 4: 髪質改善+ブリーチ → R04 fires, R01 suppressed by R04', () => {
    const out = runKarteEngine(
      {
        q1: 'damage',
        q2: 'mid_str',
        q3: ['straight', 'bleach'],
        q4: ['s2'],
        q5: 'normal',
        q6: 'settle',
        q7: 'iron',
      },
      ctx,
      rulesFile,
    );
    const ids = out.fired_rules.map((f) => f.rule.id);
    expect(ids).toContain('R04');
    expect(ids).not.toContain('R01');
  });
});

describe('runKarteEngine — Lite mode confidence cap', () => {
  it('caps fired confidence at 0.70 when q8 AND q9 are both undefined', () => {
    const out = runKarteEngine(
      {
        q1: 'color',
        q2: 'mid_str',
        q3: ['bleach'],
        q4: ['s5'],
        q5: 'normal',
        q6: 'gloss',
        q7: 'dryer',
      },
      ctx,
      rulesFile,
    );
    for (const f of out.fired_rules) {
      expect(f.confidence).toBeLessThanOrEqual(0.7);
    }
  });

  it('does NOT cap when q8 (or q9) is provided (Standard mode)', () => {
    const out = runKarteEngine(
      {
        q1: 'color',
        q2: 'mid_str',
        q3: ['bleach'],
        q4: ['s5'],
        q5: 'normal',
        q6: 'gloss',
        q7: 'dryer',
        q8: 'recent',
      },
      ctx,
      rulesFile,
    );
    const r09 = out.fired_rules.find((f) => f.rule.id === 'R09');
    expect(r09).toBeDefined();
    expect(r09?.confidence).toBeGreaterThan(0.7);
  });
});

describe('runKarteEngine — output shape', () => {
  it('produces complete KarteOutput structure with store note', () => {
    const out = runKarteEngine(
      {
        q1: 'color',
        q2: 'mid_str',
        q3: ['bleach'],
        q4: ['s5'],
        q5: 'normal',
        q6: 'gloss',
        q7: 'dryer',
      },
      ctx,
      rulesFile,
    );
    expect(out.fired_rules).toBeInstanceOf(Array);
    expect(typeof out.primary_dna).toBe('string');
    expect(out.do_not_list).toBeInstanceOf(Array);
    expect(out.do_add_list).toBeInstanceOf(Array);
    expect(out.store_note).toContain('SEAM Hair Karte診断結果');
    expect(out.store_note).toContain(out.primary_dna);
  });

  it('limits fired_rules to max_fired_rules_in_karte (3)', () => {
    const out = runKarteEngine(
      {
        q1: 'damage',
        q2: 'long_cur',
        q3: ['color', 'bleach', 'straight'],
        q4: ['s1', 's2', 's5', 's7'],
        q5: 'oily',
        q6: 'gloss',
        q7: 'iron',
        q8: 'ongoing',
        q9: ['pool', 'uv'],
        q10: 'unknown',
        q11: ['hormone'],
      },
      ctx,
      rulesFile,
    );
    expect(out.fired_rules.length).toBeLessThanOrEqual(3);
  });

  it('sorts fired rules deterministically (priority → confidence → rule_id)', () => {
    const out = runKarteEngine(
      {
        q1: 'color',
        q2: 'mid_str',
        q3: ['color', 'bleach'],
        q4: ['s1', 's5'],
        q5: 'oily',
        q6: 'gloss',
        q7: 'iron',
        q8: 'ongoing',
        q9: ['pool', 'uv'],
      },
      ctx,
      rulesFile,
    );
    // R05 is CRITICAL → must come first regardless of others' confidence
    expect(out.fired_rules[0]?.rule.id).toBe('R05');
  });
});
