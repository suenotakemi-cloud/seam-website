/**
 * Quiz (`/quiz`)
 * Phase 1 placeholder — Lite 7 問 / Bridge / Standard +5 問の実装は Phase 2 で。
 */
export default function QuizPage() {
  return (
    <div className="mx-auto flex min-h-[100svh] max-w-stage flex-col items-center justify-center px-6 py-10 text-center">
      <p className="mb-4 font-serif text-sm italic tracking-[0.3em] text-smoke">
        — QUIZ PLACEHOLDER
      </p>
      <h1 className="font-mincho text-2xl font-medium leading-[1.5] text-obsidian">
        Q1〜Q7 のフロー実装は
        <br />
        Phase 2 で組み込みます。
      </h1>
      <p className="mt-6 max-w-[420px] font-mincho text-sm leading-[1.9] text-smoke">
        このページは Phase 1 のルーティング骨格として用意されたものです。
        質問データは `lib/quiz/questions.ts` に集約予定、状態は Zustand + localStorage で永続化します。
      </p>
    </div>
  );
}
