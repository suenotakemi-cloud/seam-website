import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import test from 'node:test';
const source=fs.readFileSync(new URL('../../booking/index.html',import.meta.url),'utf8');
const start=source.indexOf('function ktPhotoPick('),end=source.indexOf('/* 画面はチップ',start);assert.ok(start>=0&&end>start);
test('customer switch while compressing a photo cannot change its owner',async()=>{
 const sent=[];let image;const c={KT:{name:'Fixture A',phone:'09000000001',date:'2026-09-08'},Image:class{constructor(){image=this;this.width=10;this.height=10;}},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},document:{createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,/9j/2Q=='})},API:{saveKartePhoto:async p=>{sent.push(p);return {ok:true};}},toast:()=>{}};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);c.ktPhotoPick({});c.KT={name:'Fixture B',phone:'09000000002',date:'2026-09-09'};await image.onload();assert.equal(sent[0].name,'Fixture A');assert.equal(sent[0].phone,'09000000001');assert.equal(sent[0].date,'2026-09-08');
});
