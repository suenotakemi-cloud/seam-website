// These URLs are still referenced by LINE callbacks and previously sent messages.
// Remove this gate only with an audited migration of callers and old links.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const pages=['ask','boss','cancel','counseling-spa','counseling','display','index','keepsake','line','line/login/result','model','owner','part','precare','prices','refund','report','setup','shop','square/pay','square/sales','staff-apply','staff-spa','staff'].map(n=>'booking/'+n+'.html');
const required=[...pages,'booking/cs-i18n.js','booking/pc-i18n.js','booking/master-kikuchi.json'];
const missing=required.filter(f=>!existsSync(resolve(root,f)));
assert.deepEqual(missing,[],'Live booking links must not disappear');
assert.match(readFileSync(resolve(root,'_headers'),'utf8'),/\/booking\/\*[\s\S]*?X-Robots-Tag: noindex/);
let scripts=0;
for(const f of required){
 const code=readFileSync(resolve(root,f),'utf8');
 assert.ok(!/(sq0atp-|sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(code),'Credential pattern in '+f);
 if(f.endsWith('.json'))JSON.parse(code);
 if(f.endsWith('.js'))execFileSync(process.execPath,['--check',resolve(root,f)],{stdio:'pipe'});
 for(const m of code.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=/.test(m[1])||!m[2].trim())continue;
  const type=m[1].match(/\btype\s*=\s*["']([^"']+)/i)?.[1];
  if(type&&!['module','text/javascript','application/javascript'].includes(type))continue;
  execFileSync(process.execPath,['--check','--input-type=module'],{input:m[2],stdio:'pipe'});scripts++;
 }
 for(const m of code.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/gi)){
  if(/^(?:https?:|\/\/)/.test(m[1])||m[1].includes('${'))continue;
  assert.ok(existsSync(m[1].startsWith('/')?resolve(root,'.'+m[1]):resolve(dirname(resolve(root,f)),m[1])),'Missing asset: '+f+' -> '+m[1]);
 }
}
console.log(`PASS ${required.length} booking files, ${scripts} inline scripts, JS/JSON/assets/noindex/credential patterns`);
