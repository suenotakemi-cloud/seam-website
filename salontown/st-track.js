/* salon.town 匿名アクセス計測（cookieなし・個人情報なし）
   送り先: /api/salontown-ev  → Cloudflare D1 salontown_events
   計測するもの: ページ表示 / どの章をどれだけ見たか / ボタン（CTA）の押下 / 流入元とUTM / 端末種別 / 言語
   計測しないもの: 氏名・連絡先・IPアドレス・入力内容 */
(function(){
  if(!window.fetch||!window.JSON)return;
  if(/\/(admin|inbox)\.html$/.test(location.pathname))return;
  var API='/api/salontown-ev';
  function rid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36);}
  function store(sess,k,v){try{(sess?sessionStorage:localStorage).setItem(k,v);}catch(e){}}
  function read(sess,k){try{return (sess?sessionStorage:localStorage).getItem(k)||'';}catch(e){return '';}}
  // 匿名ID（端末ごとの乱数。名前や連絡先とは結び付けない）
  var vid=read(0,'st_vid');if(!vid){vid=rid();store(0,'st_vid',vid);}
  // セッション（30分操作がなければ新しい訪問として数える）
  var now=Date.now(),sid=read(1,'st_sid'),last=+read(1,'st_last')||0;
  var newSession=!sid||now-last>30*60*1000;
  if(newSession){sid=rid();store(1,'st_sid',sid);}
  store(1,'st_last',String(now));
  // 流入情報は訪問の最初のページで決めて、そのセッション中は引き継ぐ
  var q=new URLSearchParams(location.search);
  function refHost(){try{if(!document.referrer)return '';var h=new URL(document.referrer).hostname.replace(/^www\./,'');return h===location.hostname?'':h;}catch(e){return '';}}
  var ctx=null;try{ctx=JSON.parse(read(1,'st_ctx')||'null');}catch(e){}
  if(newSession||!ctx){
    ctx={ref:refHost(),utm_source:q.get('utm_source')||'',utm_medium:q.get('utm_medium')||'',utm_campaign:q.get('utm_campaign')||'',
      landing:location.pathname+(q.get('src')?'?src='+q.get('src'):''),src:q.get('src')||''};
    store(1,'st_ctx',JSON.stringify(ctx));
  }
  var device=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?(/iPad|Tablet/i.test(navigator.userAgent)?'tablet':'mobile'):'desktop';
  var path=location.pathname.replace(/\/index\.html$/,'/');
  var queue=[];
  function lang(){return document.documentElement.getAttribute('lang')||'ja';}
  function push(e,extra){var ev={e:e,p:path,lang:lang()};if(extra)for(var k in extra)if(extra[k]!=null&&extra[k]!=='')ev[k]=extra[k];queue.push(ev);}
  function flush(){
    if(!queue.length)return;
    var body=JSON.stringify({ev:queue.splice(0,50),ctx:{vid:vid,sid:sid,device:device,ref:ctx.ref,utm_source:ctx.utm_source,utm_medium:ctx.utm_medium,utm_campaign:ctx.utm_campaign,landing:ctx.landing,src:ctx.src}});
    var sent=false;
    try{if(navigator.sendBeacon)sent=navigator.sendBeacon(API,new Blob([body],{type:'application/json'}));}catch(e){}
    if(!sent){try{fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:true}).catch(function(){});}catch(e){}}
    if(queue.length)flush();
  }
  // ① ページ表示
  push('pv',{sec:location.hash?location.hash.slice(1):''});
  flush();
  // ② 章ごとの滞在時間（画面の3割以上に映っている間を数える）
  var secs={},open={},started=Date.now(),maxDepth=0;
  function tick(){var t=Date.now();for(var id in open){secs[id]=(secs[id]||0)+(t-open[id]);open[id]=t;}}
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){var t=Date.now();es.forEach(function(x){var id=x.target.id;if(!id)return;if(x.isIntersecting){if(!(id in open))open[id]=t;}else if(id in open){secs[id]=(secs[id]||0)+(t-open[id]);delete open[id];}});},{threshold:.3});
    Array.prototype.forEach.call(document.querySelectorAll('section[id]'),function(s){io.observe(s);});
  }
  window.addEventListener('scroll',function(){var h=document.documentElement.scrollHeight-innerHeight;if(h>0){var d=Math.round((scrollY/h)*100);if(d>maxDepth)maxDepth=d;}},{passive:true});
  var flushedLeave=false;
  function leave(){
    tick();
    var total=0;
    for(var id in secs){var s=Math.round(secs[id]/1000);if(s>=1){push('sec',{sec:id,dur:s});total+=s;}secs[id]=0;}
    var dur=Math.round((Date.now()-started)/1000);
    if(!flushedLeave){push('leave',{dur:dur,depth:maxDepth});flushedLeave=true;}
    flush();
  }
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){leave();}else{started=Date.now();for(var id in open)open[id]=Date.now();}});
  window.addEventListener('pagehide',leave);
  // ③ ボタン・リンクの押下（相談・AI受付・画面を見る・言語切替 など）
  document.addEventListener('click',function(e){
    var a=e.target.closest('a,button');if(!a)return;
    var href=a.getAttribute('href')||'',label=(a.getAttribute('data-track')||a.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
    var secEl=a.closest('section[id],header,footer'),sec=secEl?(secEl.tagName==='SECTION'?secEl.id:secEl.tagName==='HEADER'?'hdr':'footer'):'';
    var kind='';
    if(a.id==='langBtn'||a.id==='langBtnM'){kind='lang';}
    else if(a.hasAttribute('data-track')){kind=a.getAttribute('data-track');label=a.getAttribute('data-label')||label;}
    else if(/contact\.html/.test(href)){kind='cta_ai';}
    else if(/inquiry\.html|#contact/.test(href)||a.hasAttribute('data-type')){kind='cta_form';label=(a.getAttribute('data-type')?'['+a.getAttribute('data-type')+'] ':'')+label;}
    else if(/screens\.html/.test(href)){kind='cta_screens';}
    else if(/^#/.test(href)&&href.length>1){kind='nav';label=href.slice(1);}
    else if(/^https?:/.test(href)&&!/salon\.town|seam\.site/.test(href)){kind='outbound';label=href.slice(0,60);}
    if(!kind)return;
    push('click',{sec:sec,label:label,kind:kind});
    flush();
  },true);
  // ④ ページ側からの通知（フォーム送信完了・AI受付の開始と終了）: window.stTrack('form_sent',{label:'salon'})
  window.stTrack=function(name,extra){push(name,extra||{});flush();};
})();
