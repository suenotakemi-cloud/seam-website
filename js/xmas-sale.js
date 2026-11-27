/* クリスマスセール（〜2026-12-25）トップ最初の画面のすぐ下に出す枠
   期間外は何も出さない（12/26 0時 JST に自動で消える）＝消し忘れなし
   見本の切替: ?xmas=a|b|c （本番は VARIANT の 1 つだけ使う） */
(function(){
  var END=new Date('2026-12-26T00:00:00+09:00').getTime();
  var VARIANT='c';
  var q=(location.search.match(/[?&]xmas=([abc])/)||[])[1];
  if(Date.now()>=END&&!q)return;
  var V=q||VARIANT;
  var T={
    ja:{big:'クリスマスセール',w:'全店舗とオンラインで開催中',r:'12.25 まで',h:'贈る人も 受け取る人も<br>髪からうれしい冬に',s:'12月25日まで クリスマスセール開催中',sc:'全店舗とオンラインショップで',c1:'近くの店舗へ',c2:'オンラインショップへ',d:function(n){return 'あと '+n+' 日';},last:'本日まで'},
    en:{big:'Christmas Sale',w:'At all stores and online',r:'Until Dec 25',h:'A winter that begins<br>with beautiful hair',s:'Christmas Sale through December 25',sc:'At every store and our online shop',c1:'Find a store',c2:'Online shop',d:function(n){return n+(n>1?' days':' day')+' left';},last:'Ends today'},
    zh:{big:'圣诞特卖',w:'全店及线上同步举行',r:'至12月25日',h:'送礼的人 收礼的人<br>都从秀发开始欢喜',s:'圣诞特卖 截至12月25日',sc:'全店及线上商店同步举行',c1:'查找门店',c2:'线上商店',d:function(n){return '还剩 '+n+' 天';},last:'今天截止'},
    tw:{big:'聖誕特賣',w:'全店及線上同步舉行',r:'至12月25日',h:'送禮的人 收禮的人<br>都從秀髮開始歡喜',s:'聖誕特賣 至12月25日',sc:'全店及線上商店同步舉行',c1:'查詢門市',c2:'線上商店',d:function(n){return '還剩 '+n+' 天';},last:'今天截止'},
    ko:{big:'크리스마스 세일',w:'전 매장·온라인 진행 중',r:'12월 25일까지',h:'선물하는 사람도 받는 사람도<br>머릿결부터 기쁜 겨울',s:'크리스마스 세일 12월 25일까지',sc:'전 매장과 온라인숍에서',c1:'매장 찾기',c2:'온라인숍',d:function(n){return n+'일 남음';},last:'오늘 마감'}
  };
  var css=
  '.xs{position:relative;overflow:hidden;isolation:isolate;color:#F6EEDC;padding:52px 22px 46px;text-align:left}'+
  '.xs canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}'+
  '.xs-in{position:relative;max-width:980px;margin:0 auto;display:grid;gap:14px}'+
  '.xs-k{font:italic 500 22px/1 "Cormorant Garamond",Georgia,serif;letter-spacing:.02em;color:#E6C985}'+
  '.xs-h{font-family:"Cormorant Garamond","Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif;font-weight:500;font-size:clamp(25px,6.6vw,44px);line-height:1.42;margin:0;text-wrap:balance}'+
  '.xs-s{font-size:14px;line-height:1.8;margin:0;opacity:.92}.xs-s b{font-weight:500;color:#F6EEDC;letter-spacing:.04em}'+
  '.xs-d{display:inline-block;margin-left:10px;padding-left:10px;border-left:1px solid #E6C98599;font-size:12px;letter-spacing:.1em;color:#E6C985;font-variant-numeric:tabular-nums}'+
  '.xs-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}'+
  '.xs-cta a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:999px;font-size:14px;letter-spacing:.06em;text-decoration:none;transition:transform .2s ease,background-color .2s ease}'+
  '.xs-cta a:active{transform:scale(.98)}.xs-cta a:focus-visible{outline:2px solid #F3D893;outline-offset:3px}'+
  '.xs .xs-p{background:#F6EEDC!important;color:#1A1A1A!important}.xs .xs-g{border:1px solid #F6EEDC99;color:#F6EEDC!important}'+
  /* 最初の画面（ヒーロー）にも：下に金の帯・A は星 C は雪 B は赤い帯 */
  '.xs-hc{position:absolute;inset:0;z-index:3;pointer-events:none}.sf-hero .xs-hr{position:relative;z-index:6;margin:0 auto 22px;display:flex;flex-direction:column;align-items:center;text-decoration:none;text-align:center;color:#fff!important;text-shadow:0 1px 14px #0009;background:none!important;border:0!important;border-radius:0;box-shadow:none;padding:0!important;width:auto!important;height:auto!important;letter-spacing:0!important;font-size:inherit!important}.xs-hr .xs-o{display:flex;align-items:center;gap:12px;color:#E6C985;font-size:9px}.xs-hr .xs-o i{display:block;width:44px;height:1px;background:linear-gradient(90deg,transparent,#E6C985)}.xs-hr .xs-o i+i{background:linear-gradient(90deg,#E6C985,transparent)}.sf-hero .xs-hr strong{display:block;margin-top:10px;font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(42px,12vw,60px);line-height:1;letter-spacing:.005em;white-space:nowrap;color:#fff}.sf-hero .xs-hr em{display:block;margin-top:12px;font-style:normal;font-family:"Shippori Mincho","Yu Mincho","Hiragino Mincho ProN",serif;font-weight:600;font-size:17px;letter-spacing:.38em;padding-left:.38em;white-space:nowrap;color:#fff}.sf-hero .xs-hr span:last-child{display:block;margin-top:9px;font-size:11.5px;letter-spacing:.1em!important;padding-left:.1em;color:#E6C985}@media(hover:hover){.xs-hr:hover strong{color:#F6EEDC!important}}.xs-hr:focus-visible{outline:1px solid #E6C985;outline-offset:8px}.xs-kick-off{display:none!important}@media(max-height:720px){.sf-hero .xs-hr{margin-bottom:12px}.xs-hr .xs-o{display:none!important}.sf-hero .xs-hr strong{margin-top:0;font-size:40px}.sf-hero .xs-hr em{margin-top:8px;font-size:14px}.sf-hero .xs-hr span:last-child{margin-top:6px}}'+
  '@media(hover:hover){.xs-p:hover{background:#fff}.xs-g:hover{background:#ffffff1a}}'+
  /* A 森の夜：深い緑に金の星と飾り */
  '.xs-a{background:radial-gradient(120% 90% at 85% 0%,#1F4636 0%,#10241C 55%,#0A1712 100%)}'+
  '.xs-a .xs-orn{position:absolute;right:-30px;top:50%;transform:translateY(-50%);width:min(52vw,420px);aspect-ratio:3/4;z-index:-1;opacity:.95}'+
  '@media(max-width:640px){.xs-a .xs-orn{opacity:.38;right:-60px}}'+
  /* B 贈りものの箱：深い赤にリボン */
  '.xs-b{background:#5A1420;background-image:linear-gradient(90deg,transparent calc(50% - 15px),#C9A45C calc(50% - 15px),#E6C985 50%,#C9A45C calc(50% + 15px),transparent calc(50% + 15px)),repeating-linear-gradient(135deg,#ffffff07 0 2px,transparent 2px 14px);background-position:78% 0,0 0;background-size:100% 100%,auto;background-repeat:no-repeat,repeat}'+
  '.xs-b .xs-in{grid-template-columns:1fr}.xs-b .xs-gifts{display:flex;gap:10px;margin-top:6px}'+
  '.xs-b .xs-gifts img{width:86px;height:86px;object-fit:cover;border-radius:12px;background:#fff;box-shadow:0 10px 24px #2a050c66;border:3px solid #F6EEDC}'+
  '@media(min-width:760px){.xs-b{background-position:88% 0,0 0}.xs-b .xs-in{grid-template-columns:1.3fr 1fr;align-items:center}.xs-b .xs-gifts{justify-content:flex-end}.xs-b .xs-gifts img{width:120px;height:120px}}'+
  '@media(max-width:759px){.xs-b{background-image:repeating-linear-gradient(135deg,#ffffff07 0 2px,transparent 2px 14px)}}'+
  /* C 雪のショーウィンドウ：店の写真に雪 */
  '.xs-c{background:#14110F url(/images/stores/store_ginza.webp) center/cover;padding:84px 22px 56px}'+
  '.xs-c:before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(180deg,#0c0a09a8 0%,#0c0a0966 40%,#0c0a09e0 100%)}'+
  '.xs-c .xs-in{max-width:560px;padding:26px 22px;border-radius:18px;background:#ffffff14;border:1px solid #ffffff33;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}'+
  '@media(min-width:760px){.xs-c .xs-in{margin-left:max(22px,calc(50% - 490px))}}'+
  '@media(prefers-reduced-transparency:reduce){.xs-c .xs-in{background:#1a1613e6;backdrop-filter:none}}';
  function L(){var l=document.documentElement.lang||'ja';return {'zh-Hans':'zh','zh-Hant':'tw','zh-CN':'zh','zh-TW':'tw'}[l]||l.split('-')[0];}
  function daysLeft(){var ms=END-Date.now();return Math.max(0,Math.ceil(ms/864e5));}
  function orn(){ /* A の飾り：金の線のツリーと星（文字なし） */
    return '<svg class="xs-orn" viewBox="0 0 300 400" fill="none" stroke="#D9B46A" stroke-width="1.2" aria-hidden="true">'+
      '<path d="M150 40l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3z" fill="#E6C985" stroke="none"/>'+
      '<path d="M150 98L96 190h30L74 270h36L52 352h196l-58-82h36l-52-80h30z" opacity=".9"/>'+
      '<path d="M150 98v254M112 190h76M96 270h108" opacity=".35"/>'+
      '<circle cx="118" cy="214" r="5" fill="#C94C4C" stroke="none"/><circle cx="182" cy="236" r="5" fill="#E6C985" stroke="none"/>'+
      '<circle cx="104" cy="300" r="5" fill="#E6C985" stroke="none"/><circle cx="196" cy="318" r="5" fill="#C94C4C" stroke="none"/>'+
      '<circle cx="150" cy="160" r="4" fill="#F6EEDC" stroke="none"/><path d="M128 352v22h44v-22"/></svg>';
  }
  function draw(sec){
    var t=T[L()]||T.ja,n=daysLeft(),dd=n<=1?t.last:t.d(n);
    var gifts=V==='b'?'<div class="xs-gifts" aria-hidden="true"><img src="/images/lp/popular/p03_bykarte.webp" alt=""><img src="/images/lp/popular/p01_aujua.webp" alt=""><img src="/images/lp/popular/p02_kerastase.webp" alt=""></div>':'';
    sec.innerHTML=(V==='a'?orn():'')+'<canvas aria-hidden="true"></canvas><div class="xs-in"><div><p class="xs-k" lang="en">Christmas Sale</p><h2 class="xs-h">'+t.h+'</h2>'+
      '<p class="xs-s"><b>'+t.s+'</b><span class="xs-d">'+dd+'</span><br>'+t.sc+'</p>'+
      '<div class="xs-cta"><a class="xs-p" href="shop.html#stores" data-track-click="xmas_store">'+t.c1+'</a><a class="xs-g" href="onlineshop.html" data-track-click="xmas_online">'+t.c2+'</a></div></div>'+gifts+'</div>';
    snow(sec.querySelector('canvas'),sec);
  }
  function snow(cv,sec){ /* 雪（A は星のまたたき）・動きを減らす設定では止めた 1 枚だけ描く */
    var still=matchMedia('(prefers-reduced-motion: reduce)').matches,ctx=cv.getContext('2d'),W,H,dpr=Math.min(2,devicePixelRatio||1),P=[];
    function size(){W=sec.clientWidth;H=sec.clientHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
    size();var N=Math.round(Math.min(150,W*H/3200));
    for(var i=0;i<N;i++)P.push({x:Math.random()*W,y:Math.random()*H,r:V==='a'?Math.random()*1.6+.4:Math.random()*2.6+.8,v:Math.random()*.35+.15,w:Math.random()*6.28,a:Math.random()*.5+.35});
    function frame(){ctx.clearRect(0,0,W,H);for(var i=0;i<P.length;i++){var p=P[i];
      if(V==='a'){p.w+=.03;ctx.globalAlpha=p.a*(.55+.45*Math.sin(p.w));ctx.fillStyle='#F3D893';}
      else{p.y+=p.v;p.w+=.01;p.x+=Math.sin(p.w)*.3;if(p.y>H+4){p.y=-4;p.x=Math.random()*W;}ctx.globalAlpha=p.a;ctx.fillStyle='#fff';}
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fill();}
      ctx.globalAlpha=1;if(!still&&vis)raf=requestAnimationFrame(frame);}
    var vis=true,raf;frame();
    if(!still&&'IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis){cancelAnimationFrame(raf);frame();}}).observe(sec);
    addEventListener('resize',function(){size();frame();});
  }
  function mount(){
    var page=document.querySelector('.sf-page'),hero=page&&page.querySelector('.sf-hero');if(!hero)return false;
    var fl=document.createElement('link');fl.rel='stylesheet';fl.href='https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&display=swap';document.head.appendChild(fl);
    var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    var sec=document.createElement('section');sec.className='xs xs-'+V;sec.setAttribute('aria-label','Christmas Sale');sec.setAttribute('data-track-view','xmas_'+V);
    var after=page.querySelector('.sf-intl')||hero;after.insertAdjacentElement('afterend',sec);
    if(getComputedStyle(hero).position==='static')hero.style.position='relative';
    var hr=document.createElement('a');hr.className='xs-hr xs-hr-'+V;hr.href='#xmas';hr.setAttribute('data-track-click','xmas_hero');sec.id='xmas';
    hr.addEventListener('click',function(e){e.preventDefault();sec.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
    var kick=hero.querySelector('small');if(kick){kick.classList.add('xs-kick-off');kick.parentNode.insertBefore(hr,kick);}else hero.appendChild(hr);
    if(V!=='b'){var hc=document.createElement('canvas');hc.className='xs-hc';hc.setAttribute('aria-hidden','true');hero.appendChild(hc);snow(hc,hero);}
    function hrText(){var t=T[L()]||T.ja;hr.innerHTML='<span class="xs-o" aria-hidden="true"><i></i>✦<i></i></span><strong lang="en">Christmas Sale</strong>'+(L()==='en'?'':'<em>'+t.big+'</em>')+'<span>'+t.r+' ・ '+t.w+'</span>';}
    function all(){draw(sec);hrText();}
    all();addEventListener('seam:langchange',function(){setTimeout(all,0);});
    return true;
  }
  document.addEventListener('DOMContentLoaded',function(){var k=0;(function t(){if(!mount()&&k++<40)setTimeout(t,100);})();});
})();
