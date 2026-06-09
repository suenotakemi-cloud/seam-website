/**
 * SEAM Hair Karte v3.8 — Rule Engine Core
 * engine.pseudo.md 13章 + SEAM_Karte_Engine.ts リファレンス実装に準拠。
 * 受け入れ基準のテスト 4 ケース＋21ルール単独発火を満たす。
 *
 * 設計判断:
 * - 擬似コードと参照実装でズレがある場合は参照実装側を正典とする。
 * - Lite mode（q8 と q9 が両方 undefined）は confidence を 0.70 にキャップ。
 * - DNA 解決は lib/dna/resolver.ts に分離（責務分割）。
 */

import { resolvePrimaryDNA, resolveSubDNA } from '../dna/resolver';
import type {
  Condition,
  Context,
  Exclusion,
  FiredRule,
  KarteOutput,
  Rule,
  RulesFile,
  UserAnswers,
} from './types';

const LITE_CONFIDENCE_CAP = 0.70;

// ============================================================
// Public API
// ============================================================

export function runKarteEngine(
  answers: UserAnswers,
  context: Context,
  rulesFile: RulesFile,
): KarteOutput {
  const liteMode = answers.q8 === undefined && answers.q9 === undefined;

  let fired: FiredRule[] = [];
  for (const rule of rulesFile.rules) {
    const result = evaluateRule(rule, answers, context, rulesFile);
    if (result.matched) {
      if (liteMode && result.confidence > LITE_CONFIDENCE_CAP) {
        result.confidence = LITE_CONFIDENCE_CAP;
        result.score = result.priority_score * result.confidence * rule.weight;
      }
      fired.push(result);
    }
  }

  fired = applyExclusions(fired, rulesFile.exclusions);
  fired = sortByScore(fired);

  const topFired = fired.slice(0, rulesFile.meta.max_fired_rules_in_karte);

  const primaryDna = resolvePrimaryDNA(topFired, answers);
  const subDna = resolveSubDNA(topFired, primaryDna);

  const doNotList = uniq(topFired.flatMap((r) => r.rule.actions.do_not));
  const doAddList = uniq(topFired.flatMap((r) => r.rule.actions.do_add));
  const storeNote = buildStoreNote(primaryDna, topFired, answers);
  const confidence = averageConfidence(topFired);

  const output: KarteOutput = {
    fired_rules: topFired,
    primary_dna: primaryDna,
    sub_dna: subDna,
    do_not_list: doNotList,
    do_add_list: doAddList,
    store_note: storeNote,
    confidence,
  };
  // fired_rules が存在するが信頼度が低い場合のみ警告。
  // 全 q4=s0（健康ケース）では topFired が空になり警告は出ない。
  if (topFired.length > 0 && confidence < 0.50) {
    output.warning = '店頭でのご相談を強く推奨します';
  }
  return output;
}

// ============================================================
// Rule evaluation
// ============================================================

export function evaluateRule(
  rule: Rule,
  answers: UserAnswers,
  context: Context,
  rulesFile: RulesFile,
): FiredRule {
  const t = rule.trigger;
  const priorityScore = rulesFile.meta.priority_levels[rule.priority] ?? 0;
  const threshold = rulesFile.meta.confidence_thresholds.medium;

  // all_of も any_of も無い場合は発火不可（boost のみでは発火しない）
  if (!t.all_of && !t.any_of) {
    return { rule, matched: false, confidence: 0, score: 0, priority_score: priorityScore };
  }

  let confidence = 0;

  if (t.all_of && t.all_of.length > 0) {
    for (const cond of t.all_of) {
      if (!matchCondition(cond, answers, context)) {
        return { rule, matched: false, confidence: 0, score: 0, priority_score: priorityScore };
      }
    }
    confidence += 0.5;
  }

  if (t.any_of && t.any_of.length > 0) {
    const anyMatched = t.any_of.some((c) => matchCondition(c, answers, context));
    if (!anyMatched) {
      return { rule, matched: false, confidence: 0, score: 0, priority_score: priorityScore };
    }
    confidence += 0.25;
  }

  if (t.boost) {
    for (const b of t.boost) {
      if (matchCondition(b, answers, context)) {
        confidence += b.score ?? 0;
      }
    }
  }

  confidence = clamp(confidence, 0, 1);
  const finalScore = priorityScore * confidence * rule.weight;

  return {
    rule,
    matched: confidence >= threshold,
    confidence,
    score: finalScore,
    priority_score: priorityScore,
  };
}

// ============================================================
// Condition matcher
// ============================================================

function matchCondition(cond: Condition, answers: UserAnswers, context: Context): boolean {
  if (cond.any_of) {
    return cond.any_of.some((c) => matchCondition(c, answers, context));
  }
  if (cond.all_of) {
    return cond.all_of.every((c) => matchCondition(c, answers, context));
  }

  if (!cond.field || !cond.op) return false;
  const value = getField(cond.field, answers, context);
  if (value === undefined || value === null) return false;

  switch (cond.op) {
    case 'eq':
      return value === cond.value;
    case 'in':
      return Array.isArray(cond.value) && (cond.value as unknown[]).includes(value);
    case 'contains':
      return Array.isArray(value) && (value as unknown[]).includes(cond.value);
    case 'gt':
      return typeof value === 'number' && typeof cond.value === 'number' && value > cond.value;
    case 'lt':
      return typeof value === 'number' && typeof cond.value === 'number' && value < cond.value;
    default:
      throw new Error(`Unknown operator: ${String(cond.op)}`);
  }
}

function getField(field: string, answers: UserAnswers, context: Context): unknown {
  if (field.startsWith('context.')) {
    const key = field.slice('context.'.length);
    return (context as unknown as Record<string, unknown>)[key];
  }
  return (answers as unknown as Record<string, unknown>)[field];
}

// ============================================================
// Exclusions
// ============================================================

export function applyExclusions(fired: FiredRule[], exclusions: Exclusion[]): FiredRule[] {
  const firedIds = new Set(fired.map((f) => f.rule.id));
  const suppressed = new Set<string>();
  for (const ex of exclusions) {
    if (firedIds.has(ex.if_fired)) {
      ex.suppress.forEach((id) => suppressed.add(id));
    }
  }
  return fired.filter((f) => !suppressed.has(f.rule.id));
}

// ============================================================
// Sort with deterministic tie-breaker
// ============================================================

export function sortByScore(fired: FiredRule[]): FiredRule[] {
  return [...fired].sort((a, b) => {
    if (a.priority_score !== b.priority_score) {
      return b.priority_score - a.priority_score;
    }
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return a.rule.id.localeCompare(b.rule.id);
  });
}

// ============================================================
// Store note builder
// ============================================================

const FINISH_LABEL: Record<string, string> = {
  gloss: 'ツヤ・うるおい重視',
  light: '軽さ・ふんわり感',
  settle: 'まとまり・収まり',
  natural: 'ナチュラル・素髪感',
};

function buildStoreNote(primary: string, fired: FiredRule[], answers: UserAnswers): string {
  const ruleSummary = fired.map((f) => `${f.rule.id} ${f.rule.name}`).join(' / ');
  const adviceCore = fired
    .slice(0, 2)
    .flatMap((f) => f.rule.actions.do_add.slice(0, 1))
    .join(' → ');

  return [
    'SEAM Hair Karte診断結果：',
    `Type: ${primary}`,
    `現象: ${ruleSummary || '予防フェーズ'}`,
    `希望仕上がり: ${FINISH_LABEL[answers.q6] ?? '—'}`,
    `相談内容: ${adviceCore || '現状維持＋季節調整'}`,
  ].join('\n');
}

// ============================================================
// Utilities
// ============================================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function averageConfidence(fired: FiredRule[]): number {
  if (fired.length === 0) return 0;
  return fired.reduce((s, f) => s + f.confidence, 0) / fired.length;
}
