/**
 * Karte Result (`/karte/[id]`)
 * Phase 1 placeholder — 9 セクションのカルテ実装は Phase 3 で。
 */
export default function KartePage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto flex min-h-[100svh] max-w-stage flex-col items-center justify-center px-6 py-10 text-center">
      <p className="mb-4 font-serif text-sm italic tracking-[0.3em] text-smoke">
        — KARTE PLACEHOLDER
      </p>
      <h1 className="mb-4 font-mincho text-2xl font-medium leading-[1.5] text-obsidian">
        カルテ結果ページは
        <br />
        Phase 3 で実装します。
      </h1>
      <p className="font-mono text-xs tracking-[0.15em] text-smoke">KARTE ID · {params.id}</p>
    </div>
  );
}
