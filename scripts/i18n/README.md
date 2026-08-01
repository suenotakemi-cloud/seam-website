# ページ多言語化ツール（2026-08-01 新設）

海外のお客様に見つけてもらうため、店舗7ページ・地域LP19ページを en/zh/tw/ko に対応させた。
CI（`.github/scripts/build-i18n.js`）は `data-i18n` 属性と `window.SEAM_PAGE_I18N` を読んで
`/en/ /zh/ /tw/ /ko/` に静的ページを生成する。**このディレクトリはその材料を作る側。**

## ファイル

| | |
|---|---|
| `dict.json` | 共通辞書 788件。`{ "日本語": { en, zh, tw, ko } }`。**同じ日本語は全ページで同じ訳になる** |
| `inject_pages.js` | 店舗7 + 地域LP19 に `data-i18n` と辞書を焼き込む |
| `fill_gaps.js` | 既存の多言語ページ（index/shop/brand/hairsalon/headspa/onlineshop）で、あとから追加されて `data-i18n` が付いていないブロックを埋める |
| `enrich_schema.py` | 構造化データに `Store` 併記・`currenciesAccepted`・銀座の免税を足す |

## 使い方

```bash
npm i --no-save jsdom@^24          # node_modules はコミットしないこと（過去にCIを5回落とした）
export SP="$PWD"                   # dict.json と node_modules の在処
node scripts/i18n/inject_pages.js . --dry   # まず必ず dry run
node scripts/i18n/inject_pages.js .
node .github/scripts/build-i18n.js          # /en /zh /tw /ko を生成
```

## 設計の要点

**マークアップは触らない。** 訳文は元のHTMLの「日本語テキストノードだけ」を差し替えて組み立てる。
だから `<br>` や `<a>` の位置・クラス・href は言語をまたいで完全に同じになる。

**安全弁: ja の往復一致。** 各ブロックについて ja を組み立て直し、元の innerHTML と
1文字でも違ったら**書き込まずに中止する**。一致 = マークアップ無傷の証明。

## 踏んだ罠（同じ書き方をするなら必ず対処すること）

1. **SVG配下の要素は jsdom の `tagName` が小文字**（`svg`/`path`/`circle`）。
   `SKIP.has(tagName)` に当たらず、素朴に walk すると `<path>` を空要素として書き出して
   閉じタグが消え、SVGが壊れる。→ `namespaceURI` で判定して丸ごと `outerHTML` を使う。
2. **`attr.value` は実体参照が解決済みで返る**。書き戻すとき `&` を `&amp;` に戻さないと
   `href="...&amp;brand=x"` が `&brand=x` になる。
3. **HTMLコメントは nodeType 8**。text と element だけ見ていると注記が消える
   （「名古屋のヘアは休止中」のような運用メモが落ちた）。
4. **子孫に `data-i18n` がある要素を単位にしない**。入れ物ごと訳文で上書きしてしまい、
   中の個別訳が消える。`querySelector('[data-i18n]')` で除外する。
5. **既存ページの辞書リテラルは手書きなので触らない**。`fill_gaps.js` は
   `</body>` 直前に「マージするスクリプト」を足す方式。CI の `extractI18N` は
   `SEAM_PAGE_I18N` を含む全スクリプトを同じ sandbox で順に流すので、この足し方で正しく合流する。

## 注意

`build_local_pages.py` を再実行すると地域LP19枚が**上書きされて `data-i18n` が消える**。
再生成したら必ず `inject_pages.js` を流し直すこと。

免税は **銀座本店のみ**。しかも輸出免税は物品が対象なので、
`salon-*` / `headspa-*`（役務）のノードには書かない。
