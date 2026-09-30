const fs=require('fs'); const s=fs.readFileSync(process.argv[2],'utf8');
function grab(name){const i=s.indexOf('const '+name+' = {'); if(i<0) throw name; let d=0,j=s.indexOf('{',i); const st=j; for(;j<s.length;j++){const c=s[j]; if(c==='{')d++; else if(c==='}'){d--; if(!d)break;} else if(c==="'"||c==='"'||c==='`'){const q=c; j++; while(j<s.length&&s[j]!==q){if(s[j]==='\\')j++; j++;}}} return (0,eval)('('+s.slice(st,j+1)+')');}
const out={num:grab('TYPE_NUMBER_MAP'),short:grab('TYPE_SHORT_NAME'),prof:grab('CHARACTER_PROFILE'),gem:grab('GEM_LORE'),aff:grab('CHARACTER_PRODUCT_AFFINITY')};
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,1)); console.log(Object.keys(out.num).length,Object.keys(out.gem).length,Object.keys(out.aff).length);
