(()=>{
  document.documentElement.classList.add('store-maison-js');
  // 2026-09-26 改訂 第1回：読み進みの線と出てくる演出（opacity:0 で待たせる）をやめた。店舗頁は最初の画面で読めること
  const boot=()=>{
    [...document.body.children].filter(el=>el.tagName==='HEADER'&&el.id!=='seam-appheader'&&el.id!=='appHeader').forEach(el=>el.remove());
    document.body.classList.add('store-maison');
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
