import { describe, it, expect } from 'vitest';
import rulesFileJson from '../../engine/rules.json';
import {
  DNA_CATALOG,
  computeTypeScores,
  getDnaProfile,
  resolvePrimaryDNA,
  resolveSubDNA,
} from '../resolver';
import type { FiredRule, Rule, UserAnswers } from '../../engine/types';

function mockFired(ruleId: string, types: string[], score: number, confidence = 0.75): FiredRule {
  const rule: Rule = {
    id: ruleId,
    name: ruleId,
    name_en: ruleId,
    priority: 'HIGH',
    category: 'care',
    weight: 1.0,
    trigger: {},
    primary_types: types,
    actions: { do_not: [], do_add: [] },
  };
  return { rule, matched: true, confidence, score, priority_score: 70 };
}

const healthyAnswers: UserAnswers = {
  q1: 'volume',
  q2: 'mid_str',
  q3: ['none'],
  q4: ['s0'],
  q5: 'normal',
  q6: 'natural',
  q7: 'dryer',
};

const someConcernAnswers: UserAnswers = { ...healthyAnswers, q4: ['s1'] };

describe('Empty fired → fallback DNA', () => {
  it('returns Midnight Silk when q4 is exactly ["s0"]', () => {
    expect(resolvePrimaryDNA([], healthyAnswers)).toBe('Midnight Silk');
  });

  it('returns Crystal Bloom for any other empty-fired case', () => {
    expect(resolvePrimaryDNA([], someConcernAnswers)).toBe('Crystal Bloom');
  });

  it('sub_dna is null when fired is empty', () => {
    expect(resolveSubDNA([], 'Midnight Silk')).toBeNull();
  });
});

describe('Primary DNA — weighted vote', () => {
  it('picks the only type when a single rule fires with one type', () => {
    const fired = [mockFired('R', ['Urban Mineral'], 100)];
    expect(resolvePrimaryDNA(fired, someConcernAnswers)).toBe('Urban Mineral');
  });

  it('splits a rule with N primary_types evenly into N portions', () => {
    const fired = [mockFired('R', ['A', 'B'], 100)];
    const scores = computeTypeScores(fired);
    expect(scores.get('A')).toBe(50);
    expect(scores.get('B')).toBe(50);
  });

  it('aggregates votes across multiple fired rules', () => {
    const fired = [
      mockFired('R-a', ['Urban Mineral'], 100),
      mockFired('R-b', ['Urban Mineral', 'Phoenix Reborn'], 60),
    ];
    // Urban Mineral: 100 + 30 = 130 ; Phoenix Reborn: 30
    expect(resolvePrimaryDNA(fired, someConcernAnswers)).toBe('Urban Mineral');
  });
});

describe('Sub DNA — 20% threshold', () => {
  it('returns sub when within 20% of primary', () => {
    const fired = [
      mockFired('A', ['Aurora Gloss'], 100),
      mockFired('B', ['Bronze Ember'], 90),
    ];
    // primary score: 100 ; sub: 90 → diff 10% < 20% → returned
    expect(resolveSubDNA(fired, 'Aurora Gloss')).toBe('Bronze Ember');
  });

  it('returns null when sub is more than 20% behind primary', () => {
    const fired = [
      mockFired('A', ['Aurora Gloss'], 100),
      mockFired('B', ['Bronze Ember'], 50),
    ];
    expect(resolveSubDNA(fired, 'Aurora Gloss')).toBeNull();
  });

  it('returns null when only one type was voted', () => {
    const fired = [mockFired('A', ['Aurora Gloss'], 100)];
    expect(resolveSubDNA(fired, 'Aurora Gloss')).toBeNull();
  });
});

describe('DNA catalog completeness (lib/dna/types.json)', () => {
  it('contains exactly 16 DNA types', () => {
    expect(DNA_CATALOG.types).toHaveLength(16);
  });

  it('every type has all required fields filled', () => {
    for (const t of DNA_CATALOG.types) {
      expect(t.name, 'name').toBeTypeOf('string');
      expect(t.jp, 'jp').toBeTypeOf('string');
      expect(t.essence, 'essence').toBeTypeOf('string');
      expect(t.keyword, 'keyword').toBeTypeOf('string');
      expect(t.motif, 'motif').toBeTypeOf('string');
      expect(t.palette.bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.palette.accent).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.palette.secondary).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.palette.text).toMatch(/^#[0-9A-F]{6}$/i);
      expect(['cool', 'warm', 'fresh']).toContain(t.palette.mood);
      expect(t.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('fallback types Midnight Silk and Crystal Bloom are present', () => {
    expect(getDnaProfile('Midnight Silk')).toBeDefined();
    expect(getDnaProfile('Crystal Bloom')).toBeDefined();
  });

  it('all DNA names referenced from rules.json exist in the catalog', () => {
    const dnaNames = new Set(DNA_CATALOG.types.map((t) => t.name));
    const rules = (rulesFileJson as { rules: Array<{ id: string; primary_types: string[] }> }).rules;
    for (const r of rules) {
      for (const name of r.primary_types) {
        expect(
          dnaNames.has(name),
          `Rule ${r.id} references DNA "${name}" which is missing from types.json`,
        ).toBe(true);
      }
    }
  });
});
