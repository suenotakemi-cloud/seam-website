/**
 * SEAM Tailwind 設定（事前ビルド用）
 * 旧来は各HTMLが vendor/tailwindcss.js(407KB) を読み込みブラウザ内でJIT生成していた。
 * これを CI(build-tailwind.yml) で素のCSSへ事前コンパイルし、本番は <link rel=stylesheet css/tailwind.css> を読むだけにする。
 *
 * content: 5ページのHTML + finder の事前コンパイル済みJS（全classNameはリテラル＝確実に拾える）。
 * colors: 5ページのインライン tailwind.config を統合したユニオン（cream は多数派 #F4F0EA に統一。finder の #F6F3EE はほぼ同値）。
 */
module.exports = {
  content: [
    './index.html',
    './shop.html',
    './hairsalon.html',
    './headspa.html',
    './finder.html',
    './js/finder-app.js',
  ],
  theme: {
    extend: {
      colors: {
        ivory:         '#FFFFFF',
        cream:         '#F4F0EA',
        beige:         '#D9CFC3',
        ink:           '#171614',
        charcoal:      '#2E2C28',
        gold:          '#B8945A',
        goldLight:     '#D9BE93',
        line:          '#D9CFC3',
        baseBG:        '#FFFFFF',
        softSection:   '#F6F3EE',
        deepSection:   '#D9CFC3',
        warmFill:      '#E9D8C8',
        highlightFill: '#F4F0EA',
        mainBrown:     '#A87456',
        cinnamon:      '#A87456',
        rose:          '#D7A39A',
        sage:          '#6C7168',
        olive:         '#6C7168',
        taupe:         '#B59F8E',
        sand:          '#D9CFC3',
        bisque:        '#D6C7B0',
        mocha:         '#8C7A63',
        mist:          '#E7E4DE',
        roseBeige:     '#E0C4B5',
        roseAccent:    '#C9A089',
      },
    },
  },
  plugins: [],
};
