import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './helpers.mjs';

const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const diagram=(labels)=>`<div class="diagram">${labels.map((label,i)=>`<div>${escape(label)}</div>${i<labels.length-1?'<span>→</span>':''}`).join('')}</div>`;
export async function readmePreview(){
  const source=await fs.readFile(path.join(ROOT,'../README.md'),'utf8');
  let mermaid=0;
  const content=source.split(/(```[\s\S]*?```)/g).map(block=>{
    if(block.startsWith('```mermaid')){
      const flows=[['Set up','Pick meals','Muse Spark','Approve','Review','Shop'],['Sent','Reminded','Approved or changes','Ready to shop'],['Plain words','Strict JSON schema','Ingredients per serving','Deterministic quantity engine']];
      return `<section>${diagram(flows[mermaid++]??['Browser','Next.js API','SQLite','Optional services'])}<details><summary>Diagram source from README.md</summary><pre>${escape(block.slice(10,-3))}</pre></details></section>`;
    }
    if(block.startsWith('```'))return `<pre>${escape(block.slice(3,-3))}</pre>`;
    return block.split('\n').map(line=>{
      if(/^#{1,3} /.test(line)){const level=line.match(/^#+/)[0].length;return `<h${level}>${escape(line.slice(level+1))}</h${level}>`;}
      if(!line.trim())return '';
      return `<p>${escape(line).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/`([^`]+)`/g,'<code>$1</code>')}</p>`;
    }).join('\n');
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Family Meal Planner | Local README</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f8fa;color:#1f2328;font:16px/1.7 -apple-system,BlinkMacSystemFont,sans-serif}header{position:sticky;top:0;padding:17px 7%;background:#fff;border-bottom:1px solid #d0d7de;display:flex;justify-content:space-between;z-index:2}.tag{color:#53734c;font-size:13px}main{max-width:1200px;margin:30px auto;background:white;border:1px solid #d0d7de;border-radius:12px;padding:30px 50px}h1{font-size:35px}h2{margin-top:38px;font-size:26px;border-bottom:1px solid #d8dee4;padding-bottom:10px}h3{font-size:21px}p{margin:12px 0}pre{background:#f6f8fa;padding:20px;border-radius:8px;white-space:pre-wrap;font:13px/1.7 monospace}code{background:#eff1f3;padding:2px 5px;border-radius:4px}.diagram{display:flex;align-items:center;justify-content:center;gap:12px;margin:25px 0;background:#f2f7ef;border:1px solid #d7e3d2;padding:28px 18px;border-radius:12px}.diagram div{background:white;border:1px solid #abc19c;border-radius:9px;text-align:center;padding:17px 13px;max-width:200px;font-weight:600;font-size:14px}.diagram span{color:#587c4d;font-size:24px}summary{color:#656d76;font-size:12px}</style></head><body><header><strong>Family Meal Planner / README.md</strong><span class="tag">Local repository preview · MIT license</span></header><main>${content}</main></body></html>`;
}
