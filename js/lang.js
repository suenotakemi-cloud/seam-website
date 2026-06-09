/* ══════════════════════════════════════
   SEAM — 共通 言語切り替えモジュール
   全ページで読み込む。
   ページ固有の翻訳は各ページの SEAM_PAGE_I18N に定義。
══════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 対応言語定義 ── */
  const LANGS = {
    ja: { label: 'JP', htmlLang: 'ja' },
    en: { label: 'EN', htmlLang: 'en' },
    zh: { label: 'CN', htmlLang: 'zh-Hans' },
    tw: { label: 'TW', htmlLang: 'zh-Hant' },
    ko: { label: 'KR', htmlLang: 'ko' }
  };

  /* ── localStorage キー（全ページ共有） ── */
  const STORAGE_KEY = 'seamLang';

  /* ── 現在の言語取得 ── */
  function getSavedLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved && LANGS[saved]) ? saved : 'ja';
  }

  /* ── 言語を適用する ── */
  function applyLang(lang) {
    if (!LANGS[lang]) lang = 'ja';

    /* 1. <html lang=""> 更新 */
    document.documentElement.lang = LANGS[lang].htmlLang;

    /* 2. data-lang スパン切替（salon / headspa 方式） */
    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('active', el.dataset.lang === lang);
    });
    document.querySelectorAll('[data-lang-inline]').forEach(el => {
      el.classList.toggle('active', el.dataset.langInline === lang);
    });

    /* 3. data-i18n 要素の更新（index / brand / shop 方式） */
    const dict = (window.SEAM_PAGE_I18N && window.SEAM_PAGE_I18N[lang])
      ? window.SEAM_PAGE_I18N[lang]
      : null;
    if (dict) {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) {
          el.innerHTML = dict[key];
        }
      });
    }

    /* 4. ヘッダーラベル更新 */
    const labelEl = document.getElementById('langCurrentLabel');
    if (labelEl) labelEl.textContent = LANGS[lang].label;

    /* 5. モーダル内アクティブ表示 */
    document.querySelectorAll('.lang-option[data-l]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.l === lang);
    });

    /* 6. 保存 */
    localStorage.setItem(STORAGE_KEY, lang);

    /* 7. ページ固有コールバック */
    if (typeof window.onLangChange === 'function') {
      window.onLangChange(lang);
    }
  }

  /* ── モーダル開閉 ── */
  function initModal() {
    const overlay   = document.getElementById('langOverlay');
    const toggleBtn = document.getElementById('langToggleBtn');
    if (!overlay || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      overlay.classList.toggle('open');
    });

    /* オーバーレイ外クリックで閉じる */
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    /* 言語選択ボタン */
    overlay.querySelectorAll('.lang-option[data-l]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyLang(btn.dataset.l);
        overlay.classList.remove('open');
      });
    });

    /* ESC キーで閉じる */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') overlay.classList.remove('open');
    });
  }

  /* ── DOMContentLoaded で初期化 ── */
  document.addEventListener('DOMContentLoaded', () => {
    initModal();
    applyLang(getSavedLang());
  });

  /* 外部から呼び出せるように公開 */
  window.SEAM_LANG = { apply: applyLang, get: getSavedLang };
})();
