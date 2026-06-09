import Link from 'next/link';

/**
 * Hero (`/`)
 * Phase 1 placeholder — 構造とコピーのみ。
 * 詳細実装（フェードイン演出・スタッツ装飾・装飾罫線）は Phase 2 で。
 */
export default function HeroPage() {
  return (
    <div className="mx-auto flex min-h-[100svh] max-w-stage flex-col justify-between px-6 py-10">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <span className="font-serif text-lg tracking-[0.18em]">SEAM</span>
          <span className="ml-2 font-sans text-[10px] tracking-[0.3em] text-smoke">
            HAIR KARTE V3.8
          </span>
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center py-12">
        <p className="mb-6 font-serif text-sm italic tracking-[0.3em] text-smoke">
          — DECODE YOUR HAIR
        </p>

        <h1 className="mb-8 font-mincho text-3xl font-medium leading-[1.4] tracking-[0.02em] text-obsidian">
          髪質だけで選ばない。
          <br />
          履歴まで見て、
          <br />
          今の髪に必要なケアを。
        </h1>

        <p className="font-mincho text-sm leading-[1.9] text-smoke">
          表面的な悩みではなく、根本原因から解読する。
          21 の推論ルールと 16 の Hair DNA で、今のあなたの髪に必要なケアをプロファイル化します。
        </p>
      </section>

      <section className="grid grid-cols-3 border-y border-line py-5">
        <Stat value="21" label="推論ルール" />
        <Stat value="16" label="HAIR DNA" />
        <Stat value="90" label="秒で完了" />
      </section>

      <section className="mt-8">
        <Link
          href="/quiz"
          className="block w-full bg-obsidian px-6 py-5 text-center font-sans text-sm tracking-[0.18em] text-ivory transition-colors duration-300 ease-seam hover:bg-champagne-deep"
        >
          いまの髪を言い当ててみる →
        </Link>
        <p className="mt-3 text-center font-sans text-[10px] tracking-[0.25em] text-smoke">
          — 7 問・約 90 秒・無料 —
        </p>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-3xl font-light tracking-[0.04em] text-obsidian">{value}</div>
      <div className="mt-1 font-sans text-[10px] tracking-[0.25em] text-smoke">{label}</div>
    </div>
  );
}
