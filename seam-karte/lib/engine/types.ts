/**
 * SEAM Hair Karte v3.8 — Rule Engine Types
 * engine.pseudo.md / engine.ts リファレンス実装に対応する型定義。
 */

// === Domain primitives ===
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type ConditionOp = 'eq' | 'in' | 'contains' | 'gt' | 'lt';

// === User input ===
export interface UserAnswers {
  q1: string;
  q2: string;
  q3: string[];
  q4: string[];
  q5: string;
  q6: string;
  q7: string;
  q8?: string;
  q9?: string[];
  q10?: string;
  q11?: string[];
  q12?: string;
}

export interface Context {
  season: Season;
  submitted_at: string;
}

// === Rule DSL ===
export interface Condition {
  field?: string;
  op?: ConditionOp;
  value?: unknown;
  score?: number;
  any_of?: Condition[];
  all_of?: Condition[];
}

export interface TriggerSpec {
  all_of?: Condition[];
  any_of?: Condition[];
  boost?: Condition[];
}

export interface Rule {
  id: string;
  name: string;
  name_en: string;
  priority: Priority;
  category: string;
  weight: number;
  trigger: TriggerSpec;
  primary_types: string[];
  actions: {
    do_not: string[];
    do_add: string[];
  };
}

export interface Exclusion {
  if_fired: string;
  suppress: string[];
  reason: string;
}

export interface RulesFile {
  version: string;
  meta: {
    priority_levels: Record<Priority, number>;
    confidence_thresholds: { high: number; medium: number; low: number };
    max_fired_rules_in_karte: number;
  };
  rules: Rule[];
  exclusions: Exclusion[];
}

// === Engine output ===
export interface FiredRule {
  rule: Rule;
  matched: boolean;
  confidence: number;
  score: number;
  priority_score: number;
}

export interface KarteOutput {
  fired_rules: FiredRule[];
  primary_dna: string;
  sub_dna: string | null;
  do_not_list: string[];
  do_add_list: string[];
  store_note: string;
  confidence: number;
  warning?: string;
}
