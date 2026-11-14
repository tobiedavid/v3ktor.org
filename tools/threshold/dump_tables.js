// Threshold Log data, step 1 of 2: copy the food tables out of The Patch and the Food Trial Log (English and French) as JSON.
// Usage: node dump_tables.js <repo root> <out.json>
const fs=require('fs'); const [,, repo, out]=process.argv;
function arr(src,name){ const i=src.indexOf('const '+name+'=')+('const '+name+'=').length; let d=0,j=i,inS=null;
  for(;;j++){ const c=src[j]; if(inS){ if(c==='\\'){ j++; continue; } if(c===inS) inS=null; continue; } if(c==='"'||c==="'"||c==='`'){ inS=c; continue; } if(c==='[') d++; else if(c===']'){ d--; if(d===0) break; } }
  return (0,eval)('('+src.slice(i,j+1)+')'); }
const g=fs.readFileSync(repo+'/gut/app/index.html','utf8'), gf=fs.readFileSync(repo+'/gut/fr/app/index.html','utf8'), p=fs.readFileSync(repo+'/patch/app/index.html','utf8');
const o={TF:arr(p,'TF'), FD:arr(g,'FD'), FDfr:arr(gf,'FD'), NK:arr(g,'NK')};
fs.writeFileSync(out, JSON.stringify(o));
console.log('The Patch:', o.TF.length, 'foods | Food Trial Log:', o.FD.length, 'foods, French:', o.FDfr.length);
