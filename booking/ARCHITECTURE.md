# Salon Town Booking — アーキテクチャ / 将来のかんざしSaaS連携

## 基本方針：自社エンジンが「予約マスタ」

```
                       ┌─────────────────────────────┐
   顧客の予約入口 ───▶ │  自社予約エンジン（マスタ在庫） │ ◀── スタッフ操作（台帳）
   ・自社サイト        │  ・在庫/重複ガード            │
   ・LINE(LIFF)        │  ・ステータス/顧客/リピート     │
   ・Google予約リンク  │  ・Square決済                 │
   ・Instagram         └──────────────┬──────────────┘
                                       │ SyncProvider（差し込み口）
                        ┌──────────────┼───────────────┐
                        ▼              ▼               ▼
                   かんざしSaaS     Square Bookings   通知メール取込
                （HPB/楽天/minimo）   （公式API）      （読み取り）
```

予約の「正」は常に自社エンジン。外部（かんざし等）へは **SyncProvider** 経由で反映する。
これにより、かんざしが使えない時は自社＋メール取込で回り、契約後は SyncProvider を差し替えるだけで
HPB/楽天/minimo への書き込み同期が有効になる（= ベンダーロックインを避けた設計）。

## SyncProvider インターフェース（`index.html` 内）

```js
const SyncProvider = {
  provider: 'local',            // 'kanzashi' | 'square' に差し替え
  async push(reservation){},    // 予約の新規/更新を外部へ送信
  async cancel(reservationId){},// キャンセルを外部へ送信
};
```

`addReservation()` 成功時に `SyncProvider.push()` を呼ぶフックは実装済み（現在 no-op）。
かんざし連携時は、この2メソッドを実装するだけで全チャネルに反映される。

## かんざしSaaS連携の実装方針（契約後）

かんざしは「予約システム → かんざし → 各ポータル」という連携モデル（STORES予約・LiME 等と同型）。
本アプリを **かんざしの連携元（予約システム側）** として接続する。

1. **スタッフ対応づけ**: 本アプリの `STAFF`（及川/ANZU/CHIKA）↔ かんざし側スタッフID
2. **メニュー対応づけ**: `MENUS` ↔ かんざし側メニュー
3. **SyncProvider = kanzashi 実装**:
   - `push(r)`: サーバー(Cloudflare Worker)経由でかんざしへ予約を送信 → かんざしがHPB/楽天/minimoの枠を更新
   - `cancel(id)`: 同様にキャンセルを伝搬
   - 認証情報（APIキー等）は **Worker のシークレット**に置く（決済・売上と同じ方針。フロントに置かない）
4. **取り込み（逆方向）**: かんザし → 本アプリは、かんざしのWebhook or ポーリングを Worker で受け、`addReservation()` で台帳へ

> ⚠️ かんざし規約は「HPB仕様変更で連携停止・損害免責」。SyncProvider を疎結合にしておくことで、
> 連携が切れても自社エンジン＋メール取込に**フォールバック**できる（= 事業継続性を確保）。

## 現状の連携レイヤ整理

| チャネル | 方式 | 状態 |
|---|---|---|
| 自社 / LINE / Google / Instagram | 自社エンジン直結 | クリーン・実装済 |
| Square 予約 | Bookings API（公式） | クリーン・連携先候補 |
| Square 決済 | Web Payments SDK | 実装・検証済 |
| HPB / 楽天 / minimo（読み取り） | 通知メール取込 | 実装済（シミュレータ） |
| HPB / 楽天 / minimo（書き込み） | **かんざしSaaS（SyncProvider）** | 差し込み口を用意・契約後に実装 |
