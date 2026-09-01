(()=>{
  document.documentElement.classList.add('store-maison-js');
  const boot=()=>{
    [...document.body.children].filter(el=>el.tagName==='HEADER'&&el.id!=='seam-appheader'&&el.id!=='appHeader').forEach(el=>el.remove());
    document.body.classList.add('store-maison');
    const progress=document.createElement('span');
    progress.className='maison-progress';
    progress.setAttribute('aria-hidden','true');
    document.body.append(progress);
    let ticking=false;
    const updateProgress=()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(scrollY/max,1):0})`;ticking=false};
    addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(updateProgress)}},{passive:true});
    updateProgress();
    const targets=[...document.querySelectorAll('main > h1, main > h1 + p, main > h2, main > section, body > section')];
    targets.forEach((el,i)=>{el.classList.add('maison-reveal');el.style.transitionDelay=`${Math.min(i%3,2)*70}ms`});
    if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){targets.forEach(el=>el.classList.add('maison-visible'));return}
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('maison-visible');observer.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px -8%'});
    targets.forEach(el=>observer.observe(el));
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
