# このリポジトリで作業するときの約束

## 商品マスタ（PIM）は別の作業の線。触らない・消さない

次の場所は「商品マスタ統一（PIM）」の作業で、別のセッションが継続して育てている。
**自分の作業と関係ないなら、この下のファイルは一切変更しない。**

- `functions/api/pim/`（API）・`functions/pim-img/`（画像配信）
- `pim/`（スマホ・PC・管理画面・ガイド・マニュアル）
- `js/pim-client.js`・`js/pim-normalize.js`
- `db/pim-schema.sql`・`db/SETUP_PIM.md`
- `.github/workflows/pim-*.yml`

### 起きたこと（2026-09-14）

booking 撤去のコミット（`58bf7b92`）が、古い main を元に作業していたため、
9/8 にマージ済みの PR #25「SalonPro へ写真を送る」（15 ファイル・399 行）を **丸ごと打ち消して main に直接 push** した。
本番から機能が消えたまま 1 日たち、翌日の作業（PR #26）で気づいて cherry-pick で復元した。

### 二度と起こさないために

1. **コミットする直前に `git fetch origin main` して、最新の main に載せ直す**（`git rebase origin/main` か `git merge origin/main`）。古い main を元に作った差分をそのまま push しない。
2. **自分の差分に「触っていないはずのファイル」が混ざっていないか、`git diff --stat origin/main` で確認する。** 上の PIM の場所が出てきたら、それは自分の変更ではなく「古い状態への巻き戻し」なので、`git checkout origin/main -- <その場所>` で戻してからコミットする。
3. main への直接 push はしない。PR にして「出す前の関所」（`.github/workflows/check.yml`）を通す。関所には「PIM の中身が消えていないか」の段があり、消えていれば赤くなる。
4. PIM 側の要望・不具合はこのセッションの線（`claude/b2b-product-data-unification-*` ブランチ）で扱う。他のセッションで直さない。

## 共通

- 本番は seam.site（Cloudflare Pages）。main にマージすると自動で出る。
- マージは、依頼主が「マージして」と言ったときだけ（障害の応急処置は例外。事後に必ず伝える）。
- パスワード・鍵の値を会話に貼らせない。設定画面や Secrets に入れてもらう。
