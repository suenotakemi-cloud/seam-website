/* トップの動き（BAL 型・案A・所有者 10/10）。home-hybrid-finished.js の組み立て（0/30/40ms）のあとに動く */
(() => {
'use strict';
const isA = true;
document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80),{once:true});
function init(){
 const page=document.querySelector('.sf-page');if(!page)return;
 // Keep the existing facts stable instead of the legacy 1.4s count-up.
 const facts=[...page.querySelectorAll('.sf-proof strong')].map(el=>[el,el.textContent]);
 const factObserver=new MutationObserver(()=>facts.forEach(([el,text])=>{if(el.textContent!==text)el.textContent=text;}));
 facts.forEach(([el])=>factObserver.observe(el,{childList:true,characterData:true,subtree:true}));
 page.querySelectorAll('.sf-pillar').forEach((card,i)=>{
   card.classList.add('motion-card');card.dataset.depth=[.25,1,.5][i];
   const frame=card.querySelector('.sf-p-img');frame.classList.add('motion-frame');
   const img=frame.querySelector('img'),photo=document.createElement('div');photo.className='motion-photo';
   img.before(photo);photo.appendChild(img);
   if(i<2)photo.setAttribute('data-store-color','');
 });
 page.querySelector('.sf-pillars').setAttribute('data-motion-group','');
 page.querySelectorAll('.sf-store').forEach((card,i)=>{
   card.classList.add('motion-card');card.dataset.depth=[.25,1,.5,.8,.5,1][i%6];
   const img=card.querySelector('img'),frame=document.createElement('div'),photo=document.createElement('div');
   frame.className='motion-frame';photo.className='motion-photo';photo.setAttribute('data-store-color','');
   img.before(frame);frame.appendChild(photo);photo.appendChild(img);
 });
 const stage=page.querySelector('.sf-interlude');
 if(stage){stage.setAttribute('data-motion-stage','');const photo=document.createElement('div');photo.className='motion-stage-photo';stage.querySelector('.sf-il-img').appendChild(photo);}
 page.querySelector('.sf-footer').insertAdjacentHTML('afterbegin',"<svg class=\"motion-drawing\" viewBox=\"0 0 680 190\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\"><g stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M135 46 C108 15 61 16 61 48 C61 73 139 70 139 111 C139 151 77 159 48 125\"/><path d=\"M197 27 H282 M197 27 V147 H282 M197 84 H267\"/><path d=\"M325 147 L373 27 L421 147 M341 108 H405\"/><path d=\"M468 147 V27 L526 117 L584 27 V147\"/><path d=\"M28 177 H652\"/></g></svg>");
 start(page);
}
function start(page){

  // Whole translated heading: its outer box remains stable for the observer.
  const seen = new WeakSet();
  const headingSelector = isA ? '.sf-pillar h2,.sf-section>h2,.sf-identity>h2,.sf-online h2,.sf-concerns h2,.sf-seo h2,.sf-corp h2,.sf-fc h2' : '[data-unfold]';
  function prepareHeadings() {
    page.querySelectorAll(headingSelector).forEach(h => {
      h.classList.add('motion-heading');
      if (!h.querySelector(':scope > .motion-heading-inner')) {
        const inner = document.createElement('span'); inner.className = 'motion-heading-inner';
        while (h.firstChild) inner.appendChild(h.firstChild);
        h.appendChild(inner);
      }
    });
  }
  prepareHeadings();
  page.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches)v.pause();}));
  const drawing = page.querySelector('.motion-drawing');
  const paths = drawing ? [...drawing.querySelectorAll('path')] : [];
  paths.forEach(p => { const length = p.getTotalLength(); p.style.strokeDasharray = length; });
  if (!window.gsap || !window.ScrollTrigger) return; // Static, readable fallback
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();
  mm.add({ active:'(prefers-reduced-motion: no-preference)', calm:'(prefers-reduced-motion: reduce)', desktop:'(min-width:768px)' }, ctx => {
    const {active, desktop} = ctx.conditions;
    const headings = [...page.querySelectorAll(headingSelector)];
    if (!active) {
      headings.forEach(h => h.classList.remove('motion-pending','motion-play'));
      paths.forEach(p => p.style.strokeDashoffset = '0');
      page.querySelectorAll('video').forEach(v => v.pause());
      return;
    }
    function reveal(h){h.classList.remove('motion-pending');h.classList.add('motion-play');seen.add(h);observer.unobserve(h);}
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) reveal(entry.target);
    }), {rootMargin:'-25% 0px'});
    function catchSkipped(){headings.forEach(h=>{if(h.classList.contains('motion-pending')&&h.getClientRects().length&&h.getBoundingClientRect().top<innerHeight*.75)reveal(h);});}
    addEventListener('scroll',catchSkipped,{passive:true});
    // 検索エンジンの描画のような縦長の画面（スクロールしない）では何も隠さない
    const tall = innerHeight > 1400;
    headings.forEach(h => {
      // Initial-screen headings and headings already passed are never hidden.
      if (tall || seen.has(h) || h.getBoundingClientRect().top < innerHeight*.75) {seen.add(h); return;}
      h.classList.add('motion-pending'); observer.observe(h);
    });
    const depths = [.25,1,.5,.8,.5,1];
    const cards = [...page.querySelectorAll('.motion-card')];
    cards.forEach((card,i) => {
      const group = card.closest('[data-motion-group]') || card.parentElement;
      const depth = Number(card.dataset.depth || depths[i%depths.length]);
      if (desktop) gsap.fromTo(card,{'--motion-y':'0px'},{'--motion-y':()=>-card.offsetHeight*depth+'px',ease:'none',scrollTrigger:{trigger:group,start:'top bottom',end:'bottom top',scrub:3,invalidateOnRefresh:true}});
      const photo = card.querySelector('.motion-photo');
      const photoDepth = [.25,-.5,.8,-1,.5,-.25][i%6];
      if (photo) gsap.fromTo(photo,{yPercent:(desktop ? 8 : 2)*photoDepth},{yPercent:(desktop ? -8 : -2)*photoDepth,ease:'none',scrollTrigger:{trigger:group,start:'top bottom',end:'bottom top',scrub:3,invalidateOnRefresh:true}});
    });
    // Explicit opt-in; products, finished hair, treatments and skin never enter this list.
    page.querySelectorAll('[data-store-color]').forEach(photo => {
      const frame = photo.closest('.motion-frame') || photo;
      gsap.fromTo(photo,{filter:'grayscale(1)'},{filter:'grayscale(0)',ease:'power1.out',scrollTrigger:{trigger:frame,start:'top 75%',end:'15% 50%',scrub:true,invalidateOnRefresh:true}});
    });
    const stage = page.querySelector('[data-motion-stage]');
    const stagePhoto = stage && stage.querySelector('.motion-stage-photo');
    let exitTween;
    if (stagePhoto) {
      function settle(expand, immediate=false) {
        if (exitTween) exitTween.kill();
        exitTween = gsap.to(stagePhoto,{scale:expand ? innerWidth/stagePhoto.clientWidth : 1,opacity:expand ? 0 : 1,duration:immediate ? 0 : .6,ease:'power1.out',overwrite:true});
      }
      const pin = ScrollTrigger.create({trigger:stage,start:'center center',end:()=>'+='+innerHeight*.5,pin:true,pinSpacing:true,anticipatePin:1,invalidateOnRefresh:true,
        onLeave:()=>settle(true),onEnterBack:()=>settle(false),onLeaveBack:()=>settle(false),onRefresh:self=>settle(self.progress===1,true)});

    }
    let drawObserver;
    if (drawing && !seen.has(drawing) && !tall) {
      gsap.set(drawing,{opacity:0}); paths.forEach(p => gsap.set(p,{strokeDashoffset:p.getTotalLength()}));
      drawObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        seen.add(drawing); drawObserver.disconnect();
        // Observer fires later: register tweens in the media context for cleanup.
        ctx.add(()=>{gsap.to(drawing,{opacity:1,duration:1.3,ease:'power1.out'});gsap.to(paths,{strokeDashoffset:0,duration:2.5,delay:.1,ease:'power1.inOut'});});
      }),{rootMargin:'-25% 0px'});
      drawObserver.observe(drawing);
    }
    return () => {if(exitTween)exitTween.kill();if(stagePhoto)gsap.set(stagePhoto,{clearProps:'transform,opacity'});observer.disconnect();removeEventListener('scroll',catchSkipped);if(drawObserver)drawObserver.disconnect();headings.forEach(h=>h.classList.remove('motion-pending','motion-play'));};
  });
  // Image and font readiness, details toggles and five-language changes remeasure.
  let refreshFrame;
  const refresh = () => {cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(()=>ScrollTrigger.refresh());};
  page.querySelectorAll('img').forEach(img=>{if(!img.complete)img.addEventListener('load',refresh,{once:true});});
  if(document.fonts)document.fonts.ready.then(refresh);
  page.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',refresh));
  addEventListener('seam:langchange',()=>setTimeout(()=>{prepareHeadings();refresh();},50));
  addEventListener('load',refresh,{once:true});
}
})();
