import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const APP='https://meals.example.com';
export const telemetry=[];
let telemetryPath=path.join(ROOT,'public/clips/telemetry.json');
export const setTelemetryPath=value=>{telemetryPath=value;};
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function privacyAndCursor() {
  const pattern=/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]*?(?:jac\.crocker|jaccrock)[A-Z0-9.!#$%&'*+/=?^_`{|}~@-]*(?:\.[A-Z0-9-]+)*|[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com/gi;
  const sensitive=value=>{pattern.lastIndex=0;return pattern.test(value||'');};
  const install=()=>{
    if(document.getElementById('demo-privacy-style'))return;
    const css=document.createElement('style');css.id='demo-privacy-style';
    css.textContent=`*{cursor:none!important}.demo-private{filter:blur(7px);user-select:none;display:inline-block}.demo-private-input,[data-demo-private]{filter:blur(7px)!important}#demo-cursor{position:fixed;left:0;top:0;width:30px;height:38px;z-index:2147483647;pointer-events:none;transform:translate(60vw,40vh);transition:transform .38s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 2px 3px #0009)}.demo-ripple{position:fixed;width:56px;height:56px;border:3px solid #f7a83e;border-radius:50%;pointer-events:none;z-index:2147483646;animation:demo-ripple .65s ease-out forwards}@keyframes demo-ripple{from{opacity:.9;scale:.3}to{opacity:0;scale:1.6}}`;
    document.documentElement.append(css);
    const cursor=document.createElement('div');cursor.id='demo-cursor';cursor.setAttribute('aria-hidden','true');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value] of Object.entries({width:'30',height:'38',viewBox:'0 0 30 38'}))svg.setAttribute(key,value);const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');for(const [key,value] of Object.entries({d:'M3 2L25 23L15 24L20 34L14 37L9 26L3 33Z',fill:'#fffdf5',stroke:'#183b2d','stroke-width':'2.5','stroke-linejoin':'round'}))arrow.setAttribute(key,value);svg.append(arrow);cursor.append(svg);
    document.documentElement.append(cursor);
    window.__demoMove=(x,y)=>{cursor.style.transform=`translate(${x}px,${y}px)`;};
    document.addEventListener('pointermove',e=>window.__demoMove(e.clientX,e.clientY),true);
    document.addEventListener('pointerdown',e=>{const ring=document.createElement('div');ring.className='demo-ripple';ring.style.left=`${e.clientX-28}px`;ring.style.top=`${e.clientY-28}px`;document.documentElement.append(ring);setTimeout(()=>ring.remove(),700);},true);
    const scan=root=>{
      if(root.nodeType!==1&&root.nodeType!==9)return;
      for(const frame of root.querySelectorAll('iframe[srcdoc]')){const html=frame.getAttribute('srcdoc');const alias=html.replace(/Jac\s+Crocker/gi,'Jac C');if(alias!==html)frame.setAttribute('srcdoc',alias);}
      for(const input of root.querySelectorAll('input,textarea'))input.classList.toggle('demo-private-input',input.hasAttribute('data-demo-private')||sensitive(input.value));
      for(const el of root.querySelectorAll('[title],[aria-label],[alt]'))for(const attr of ['title','aria-label','alt']){const value=el.getAttribute(attr);if(value)el.setAttribute(attr,value.replace(/Jac\s+Crocker/gi,'Jac C'));}
      document.title=document.title.replace(/Jac\s+Crocker/gi,'Jac C');
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){
        if(!node.parentElement||node.parentElement.closest('script,style,textarea,input,.demo-private,#demo-cursor'))continue;
        const text=node.nodeValue.replace(/Jac\s+Crocker/gi,'Jac C');if(text!==node.nodeValue)node.nodeValue=text;if(!sensitive(text))continue;
        pattern.lastIndex=0;const frag=document.createDocumentFragment();let last=0;
        for(const match of text.matchAll(pattern)){frag.append(document.createTextNode(text.slice(last,match.index)));const span=document.createElement('span');span.className='demo-private';span.style.cssText='filter:blur(7px);user-select:none;display:inline-block';span.textContent=match[0];frag.append(span);last=match.index+match[0].length;}
        frag.append(document.createTextNode(text.slice(last)));node.replaceWith(frag);
      }
    };
    scan(document);
    const observer=new MutationObserver(records=>{
      observer.disconnect();
      for(const record of records){const target=record.target.nodeType===3?record.target.parentElement:record.target;if(target&&!target.closest?.('.demo-private,#demo-cursor,.demo-ripple'))scan(target);}
      observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','srcdoc']});
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','srcdoc']});
    document.addEventListener('input',e=>{if(e.target.matches('input,textarea'))e.target.classList.toggle('demo-private-input',e.target.hasAttribute('data-demo-private')||sensitive(e.target.value));},true);
  };
  if(document.documentElement)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
}

export async function installHelpers(context){await context.addInitScript(privacyAndCursor);}

export async function moveTo(page,x,y){await page.mouse.move(x,y);await page.evaluate(({x,y})=>window.__demoMove?.(x,y),{x,y});await sleep(420);}

export async function focus(page,locator,sceneStartTime,zoom=2){
  await locator.waitFor({state:'visible'});await locator.scrollIntoViewIfNeeded();await sleep(300);
  const box=await locator.boundingBox();if(!box)throw new Error('Target has no visible bounding box');
  const x=box.x+box.width/2,y=box.y+box.height/2;await moveTo(page,x,y);await sleep(350);
  const size=page.viewportSize();const event={scene:page.__demoScene,timeMs:Date.now()-sceneStartTime,xPercent:x/size.width*100,yPercent:y/size.height*100,zoom};
  telemetry.push(event);await fs.writeFile(telemetryPath,JSON.stringify(telemetry,null,2));return {x,y};
}

export async function smoothClick(page,locator,sceneStartTime,zoomLevel=2){await focus(page,locator,sceneStartTime,zoomLevel);await locator.click();}

export async function scrollTo(page,y,duration=1400){await page.evaluate(({y,duration})=>new Promise(resolve=>{const start=scrollY,t0=performance.now();function tick(now){const t=Math.min((now-t0)/duration,1);const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;scrollTo(0,start+(y-start)*e);if(t<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}),{y,duration});}

export async function jsonRequest(context,route,options){const response=await context.request.fetch(APP+route,options);const label=route.startsWith('/api/r/')?'/api/r/[private]':route;if(!response.ok())throw new Error(`${label} returned ${response.status()}`);return response.json();}
