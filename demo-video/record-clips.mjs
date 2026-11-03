import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {APP,ROOT,installHelpers,smoothClick,focus,scrollTo,sleep,jsonRequest,telemetry} from './helpers.mjs';
import {scenes} from './scenes.mjs';
import {readmePreview} from './readme-preview.mjs';
import {storeProof} from './store-proof.mjs';

const runId=String(Date.now());const rawDir=path.join(ROOT,'raw',runId);await fs.mkdir(rawDir,{recursive:true});
await fs.writeFile(path.join(ROOT,'reports/capture-attempt.json'),JSON.stringify({runId,status:'recording'}));
const localHtml=await readmePreview();
const localServer=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(localHtml);});
await new Promise(resolve=>localServer.listen(0,'127.0.0.1',resolve));
const localUrl=`http://127.0.0.1:${localServer.address().port}`;
const browser=await chromium.launch({headless:true});
const resumed=process.argv.includes('--resume')?JSON.parse(await fs.readFile(path.join(ROOT,'reports/capture-checkpoint.json'),'utf8')):null;
const retryShop=process.argv.includes('--retry-shop');assert.ok(!retryShop||resumed,'A shop retry requires a complete checkpoint');
const contexts=[];const ranges=(resumed?.scenes??[]).filter(scene=>!retryShop||scene.id!=='scene6-shop');const checks=resumed?.checks??{};
if(resumed)telemetry.push(...resumed.telemetry.filter(event=>!retryShop||event.scene!=='scene6-shop'));
const launch=async(profile,mobile=false)=>{
  const context=await browser.newContext({storageState:path.join(ROOT,`auth/${profile}.json`),viewport:mobile?{width:390,height:844}:{width:1440,height:900},recordVideo:{dir:rawDir,size:mobile?{width:390,height:844}:{width:1440,height:900}},...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:1}:{}),colorScheme:'light'});
  await installHelpers(context);contexts.push(context);return context;
};
const newPage=async context=>{const p=await context.newPage();p.__videoOrigin=Date.now();p.setDefaultTimeout(30_000);return p;};
const stamp=page=>(Date.now()-page.__videoOrigin)/1000;
let active;
async function scene(id,page,actions){
  if(ranges.some(range=>range.id===id)){console.log(`Reusing checkpoint ${id}`);return;}
  const spec=scenes.find(s=>s.id===id);page.__demoScene=id;
  active={...spec,page,start:stamp(page),startTime:Date.now(),skips:[],parts:[],telemetryStart:telemetry.length};
  console.log(`Recording ${id} (${spec.seconds}s)`);
  await actions(active.startTime);
  const skipped=active.skips.reduce((n,s)=>n+s.end-s.start,0);
  const elapsed=stamp(page)-active.start-skipped;
  if(elapsed<spec.seconds)await sleep((spec.seconds-elapsed)*1000+100);
  active.end=stamp(page);active.parts=active.parts.length?active.parts:[{page,start:active.start,end:active.end}];
  const duration=active.parts.reduce((n,p)=>n+p.end-p.start,0)-skipped;
  const scale=Math.min(1,spec.seconds/duration);
  assert.ok(scale>=.75,`${id} is too long to edit cleanly; shorten its waits before retrying`);
  for(const e of telemetry.slice(active.telemetryStart)){
    const wall=active.startTime+e.timeMs;let edited=0;
    for(const part of active.parts){
      const start=part.page.__videoOrigin+part.start*1000,end=part.page.__videoOrigin+part.end*1000;
      const cuts=active.skips.filter(s=>s.start>part.start&&s.end<part.end);
      if(wall>=start&&wall<=end){
        const raw=(wall-part.page.__videoOrigin)/1000;
        const removed=cuts.reduce((n,s)=>n+Math.max(0,Math.min(raw,s.end)-s.start),0);
        e.timeMs=Math.max(0,(edited+(wall-start)/1000-removed)*scale*1000);break;
      }
      edited+=part.end-part.start-cuts.reduce((n,s)=>n+s.end-s.start,0);
    }
  }
  ranges.push({...active,scale});ranges.sort((a,b)=>a.from-b.from);active=null;
  const checkpoint=[];
  for(const range of ranges)checkpoint.push({id:range.id,seconds:range.seconds,from:range.from,scale:range.scale,skips:range.skips,parts:await Promise.all(range.parts.map(async part=>({start:part.start,end:part.end,host:part.host,file:part.file??await part.page.video().path()})))});
  await fs.writeFile(path.join(ROOT,'reports/capture-checkpoint.json'),JSON.stringify({scenes:checkpoint,checks,telemetry},null,2));
}
async function waitForParser(page,promise){
  const start=stamp(page);const result=await promise;const end=stamp(page);
  if(end-start>4)active.skips.push({start:start+2,end:end-1});
  return result.json();
}
const nav=(page,step,time)=>smoothClick(page,page.locator(`nav a[href="/${step}"]`),time,1.15);
const appReady=async page=>{await page.getByRole('link',{name:'Open your planner',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);};
const run=async(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>{err+=d;});p.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} failed: ${err.slice(-1500)}`)));});

try{
  const planner=await launch('planner');const reviewer=await launch('reviewer');
  // The gateway admits the owner; reviewer identity comes from the email token.
  // Reuse only the owner's existing gateway login, never their Google cookies.
  const gateway=(await planner.cookies(APP)).filter(c=>c.name==='CF_Authorization');
  assert.ok(gateway.length,'The authorized Cloudflare gateway session is required');
  await reviewer.addCookies(gateway);
  const p=await newPage(planner);await p.goto(APP);await appReady(p);
  const gmail=await newPage(reviewer);
  const search='https://mail.google.com/mail/u/0/#search/'+encodeURIComponent('subject:(Approve the meal plan) newer_than:1d');
  await gmail.goto(search);await gmail.getByRole('textbox',{name:/Search mail/}).waitFor();await sleep(1200);
  checks.plannerAccount=(await jsonRequest(planner,'/api/me')).user?.email==='demo-account-1@example.com';assert.ok(checks.plannerAccount);
  if(!resumed)assert.equal((await jsonRequest(planner,'/api/household')).state.plan.length,0,'Run reset before recording');
  else{
    assert.equal((await jsonRequest(planner,'/api/review')).review.id,checks.sentReviewId,'The checkpoint review must still be current');
    await p.getByRole('link',{name:'Open your planner',exact:true}).click();await p.locator('nav a[href="/approve"]').click();
  }
  const library=JSON.parse(await fs.readFile(path.join(ROOT,'../src/data/meals.json'),'utf8'));
  assert.equal(library.length,33);checks.libraryMeals=library.length;

  await scene('scene1-landing',p,async t=>{
    await sleep(2000);await scrollTo(p,520,2200);await sleep(1900);await scrollTo(p,1050,2200);await sleep(2200);await scrollTo(p,0,2400);await sleep(1000);
    await smoothClick(p,p.getByRole('link',{name:'Open your planner',exact:true}),t,1.6);await p.getByRole('heading',{name:'Set up your household'}).waitFor();
  });
  await scene('scene2-setup',p,async t=>{
    const servingsBox=await p.getByText('adult servings per meal').boundingBox();
    await fs.writeFile(path.join(ROOT,'public/clips/focus-points.json'),JSON.stringify({servings:{xPercent:(servingsBox.x+servingsBox.width/2)/1440*100,yPercent:(servingsBox.y+servingsBox.height/2)/900*100}}));
    await sleep(1300);await smoothClick(p,p.getByRole('button',{name:'Fewer Kids 4 to 10',exact:true}),t,2);await sleep(2200);
    await focus(p,p.getByText('adult servings per meal'),t,2);await sleep(1500);
    await smoothClick(p,p.getByRole('button',{name:'More Kids 4 to 10',exact:true}),t,2);await sleep(2000);
    await focus(p,p.getByText('Other adults',{exact:true}),t,1.45);await sleep(1500);await scrollTo(p,0,1000);
    checks.household=(await jsonRequest(planner,'/api/household')).state.household;
  });
  await scene('scene3-meals',p,async t=>{
    await nav(p,'meals',t);await p.getByRole('heading',{name:'Week plan',exact:true}).waitFor();
    assert.equal(await p.getByText('Not planned',{exact:true}).count(),7);checks.blankDays=7;await sleep(2000);
    const names=library.filter(m=>m.type==='Dinner'&&!m.name.match(/takeout/i)).slice(0,7).map(m=>m.name);
    for(const name of names){const row=p.locator('li').filter({has:p.getByText(name,{exact:true})});await smoothClick(p,row.getByRole('button',{name:/Add to/}),t,1.2);}
    await scrollTo(p,0,800);await sleep(1000);
    await smoothClick(p,p.getByText('Wed',{exact:true}),t,1.4);
    const input=p.getByPlaceholder('e.g. Tacos');await smoothClick(p,input,t,2);
    await input.pressSequentially('Lemon herb salmon with roasted asparagus',{delay:65});await sleep(400);
    const response=p.waitForResponse(r=>r.url().endsWith('/api/parse')&&r.request().method()==='POST',{timeout:120_000});
    await smoothClick(p,p.locator('form').filter({has:input}).getByRole('button',{name:/Add to/}),t,1.8);
    let parsed=await waitForParser(p,response);
    if(parsed.question){
      checks.clarifyingQuestion=true;await sleep(1800);
      const follow=p.waitForResponse(r=>r.url().endsWith('/api/parse')&&r.request().method()==='POST',{timeout:120_000});
      await smoothClick(p,p.getByRole('button',{name:parsed.options[0],exact:true}),t,1.8);parsed=await waitForParser(p,follow);
    }
    assert.ok(parsed.meal?.ingredients?.length,'Live custom meal must have structured ingredients');
    checks.parsedIngredients=parsed.meal.ingredients.length;checks.customMeal=parsed.meal.name;
    await sleep(1200);await scrollTo(p,0,1200);
    await focus(p,p.locator('span.inline-flex').filter({hasText:parsed.meal.name}).first(),t,1.65);await sleep(1800);
    const searchMeals=p.getByPlaceholder('Search meals');await searchMeals.fill('Lemon');await sleep(800);
    await focus(p,p.locator('li').filter({hasText:parsed.meal.name}).first(),t,1.55);await sleep(1700);
    const state=(await jsonRequest(planner,'/api/household')).state;
    assert.equal(state.plan.length,7);assert.ok(state.plan.some(e=>e.day==='Wed'&&e.mealId===parsed.meal.id));assert.ok(state.customMeals.some(m=>m.id===parsed.meal.id));
    checks.persistedSlots=state.plan.length;await scrollTo(p,0,800);
  });
  let sentReview;
  await scene('scene4a-send',p,async t=>{
    await nav(p,'approve',t);await p.getByRole('heading',{name:'Get the plan approved'}).waitFor();
    await p.getByRole('button',{name:'Required',exact:true}).waitFor();await sleep(1700);
    await focus(p,p.getByRole('button',{name:'Required',exact:true}),t,1.8);await sleep(1700);
    const response=p.waitForResponse(r=>r.url().endsWith('/api/review')&&r.request().method()==='POST');
    await smoothClick(p,p.getByRole('button',{name:/Send the updated plan|Send for approval/}),t,1.8);
    const result=await response;assert.equal(result.ok(),true,'Approval email send must succeed');
    sentReview=(await jsonRequest(planner,'/api/review')).review;
    assert.ok(sentReview?.requests?.some(r=>r.email==='demo-account-2@example.com'&&r.required));checks.sentReviewId=sentReview.id;await sleep(1300);
  });
  // Poll before the inbox shot, keeping email delivery latency out of the film.
  let latest;
  let emailReady=false;
  if(!ranges.some(range=>range.id==='scene4b-gmail')){
  for(let n=0;n<18;n++){
    await gmail.goto(search);await gmail.reload({waitUntil:'domcontentloaded'});await gmail.getByRole('textbox',{name:/Search mail/}).waitFor();await sleep(1300);
    latest=gmail.locator('tr.zA').filter({hasText:'Approve the meal plan'}).first();
    if(await latest.count()){
      await latest.click();const approve=gmail.getByRole('link',{name:'Approve',exact:true}).last();await approve.waitFor();
      const href=await approve.getAttribute('href');const target=new URL(href);
      if(target.hostname==='meals.example.com'&&target.pathname.startsWith('/r/')){
        const tokenView=await jsonRequest(reviewer,'/api'+target.pathname);
        emailReady=tokenView.review.status==='open'&&tokenView.request.status==='pending'&&tokenView.request.email==='demo-account-2@example.com';
      }
      if(emailReady){await gmail.goto(search);await latest.waitFor();await sleep(500);break;}
    }
    await sleep(2000);
  }
  assert.ok(emailReady,'The newly sent open review must arrive in reviewer Gmail');
  }
  await scene('scene4b-gmail',gmail,async t=>{
    await sleep(1200);await smoothClick(gmail,latest,t,1.8);
    const approve=gmail.getByRole('link',{name:'Approve',exact:true}).last();await approve.waitFor();await sleep(1500);
    const approveHref=await approve.getAttribute('href');assert.ok(approveHref);
    const popupPromise=reviewer.waitForEvent('page',{timeout:15000});
    await smoothClick(gmail,approve,t,1.8);
    const switchAt=stamp(gmail);const popup=await popupPromise;popup.__videoOrigin=Date.now();popup.__demoScene='scene4b-gmail';
    await popup.waitForLoadState('domcontentloaded');
    await popup.getByText('You approved this plan. Thanks.',{exact:true}).waitFor({timeout:30_000});await sleep(2500);
    // Use the inbox for the first shot and the actual approval confirmation for the second.
    active.parts=[{page:gmail,start:active.start,end:switchAt,host:'mail.google.com'},{page:popup,start:.4,end:stamp(popup),host:'meals.example.com'}];
    checks.gmailApproval=true;
  });
  // Refresh review data by navigating through the actual step links.
  await p.locator('nav a[href="/meals"]').click();await p.locator('nav a[href="/approve"]').click();
  await p.getByText('Approved',{exact:true}).waitFor({timeout:35_000});
  await scene('scene4c-approved',p,async t=>{
    await sleep(1000);await focus(p,p.getByText('Approved',{exact:true}),t,2.2);await sleep(3500);
    checks.approved=(await jsonRequest(planner,'/api/review')).review.requests.find(r=>r.email==='demo-account-2@example.com')?.status==='approved';assert.ok(checks.approved);
  });
  await scene('scene5-review',p,async t=>{
    await nav(p,'review',t);await p.getByRole('heading',{name:'Review your cart'}).waitFor();await sleep(1600);
    const chicken=p.locator('li').filter({has:p.locator('div.font-semibold').filter({hasText:/chicken/i})}).first();
    await smoothClick(p,chicken.getByRole('link',{name:'Why',exact:true}),t,2);await p.getByRole('heading',{name:/Why .*chicken/i}).waitFor();
    await focus(p,p.getByRole('table'),t,1.55);await sleep(4000);
    await smoothClick(p,p.getByRole('link',{name:'Back to the cart'}),t,1.2);
    const staple=p.locator('li').filter({has:p.locator('div.font-semibold').filter({hasText:/^salt\s/})}).first();
    if(!await staple.count())throw new Error('Salt must be visible for the pantry Have it demonstration');
    await smoothClick(p,staple.getByRole('button',{name:'Have it',exact:true}),t,1.8);await sleep(1400);
    await focus(p,p.getByText('Already have:',{exact:true}).locator('..'),t,1.5);await sleep(2300);
    checks.pantryExcluded=(await jsonRequest(planner,'/api/household')).state.exclude.includes('salt');assert.ok(checks.pantryExcluded);await scrollTo(p,0,1600);
  });
  await scene('scene6-shop',p,async t=>{
    await nav(p,'shop',t);await p.getByRole('heading',{name:'Send the list to Instacart'}).waitFor();await sleep(1500);
    const response=p.waitForResponse(r=>r.url().endsWith('/api/instacart')&&r.request().method()==='POST',{timeout:60_000});
    const popupPromise=planner.waitForEvent('page',{timeout:60_000});
    await smoothClick(p,p.getByRole('button',{name:'Shop on Instacart',exact:true}),t,1.8);
    const result=await(await response).json();assert.equal(result.mode,'live','Instacart must return a real sandbox link');
    checks.instacartLines=result.request.line_items.length;
    const switchAt=stamp(p);const store=await popupPromise;store.__videoOrigin=Date.now();store.__demoScene='scene6-shop';
    await store.waitForLoadState('domcontentloaded');
    checks.storeHost=new URL(store.url()).hostname;assert.equal(checks.storeHost,'customers.dev.instacart.tools','Shopping must remain in the sandbox');
    const add=store.getByRole('button',{name:/Add \d+ items? to cart/});
    await store.waitForFunction(expected=>document.querySelectorAll('[aria-label="unselect item"]').length===expected,checks.instacartLines,{timeout:60_000});await sleep(1000);
    checks.storeProof=await storeProof(store,result.request.line_items.map(line=>line.name));
    const storeStart=stamp(store);await sleep(1200);
    await scrollTo(store,570,1800);await sleep(1200);await scrollTo(store,0,1300);
    // Add to the reversible sandbox guest cart. Sign-in remains the human's step.
    const matchedItems=Number((await add.innerText()).match(/\d+/)[0]);assert.equal(matchedItems,checks.storeProof.uniqueProducts);
    await smoothClick(store,add,t,1.6);await sleep(800);
    const beforeLogin=stamp(store);
    // Return to the list with the guest cart retained, leaving sign-in to the shopper.
    await store.goto(result.url,{waitUntil:'domcontentloaded'});await add.waitFor({timeout:30_000});await sleep(1500);
    const cart=store.getByRole('button',{name:/^View Cart\./});
    const cartCount=Number((await cart.innerText()).trim());assert.equal(cartCount,matchedItems,'Sandbox cart must contain every selected matched product');
    const afterLogin=stamp(store);await focus(store,cart,t,1.8);await sleep(2500);checks.cartItems=cartCount;checks.matchedItems=matchedItems;
    active.parts=[{page:p,start:active.start,end:switchAt,host:'meals.example.com'},{page:store,start:storeStart,end:beforeLogin,host:checks.storeHost},{page:store,start:afterLogin,end:stamp(store),host:checks.storeHost}];
  });
  const mobile=await launch('planner',true);const phone=await newPage(mobile);await phone.goto(APP);await appReady(phone);await phone.getByRole('link',{name:'Open your planner',exact:true}).click();await phone.locator('nav a[href="/meals"]').click();await phone.getByRole('heading',{name:'Week plan',exact:true}).waitFor();await sleep(600);
  await scene('scene7-mobile',phone,async t=>{
    await sleep(3100);await smoothClick(phone,phone.locator('nav a[href="/review"]'),t,1);await phone.getByRole('heading',{name:'Review your cart'}).waitFor();await sleep(2200);checks.mobile=true;
  });
  const repo=await newPage(planner);const github=await repo.goto('https://github.com/jaccrocker/family-meal-planner');
  if(github.status()===404){await repo.goto(localUrl);checks.outroSource='Local README preview (repository is private)';}
  else{await repo.locator('article.markdown-body').waitFor();checks.outroSource='GitHub repository';}
  await scrollTo(repo,900,500);
  await scene('scene8-outro',repo,async()=>{
    await scrollTo(repo,2200,2500);await sleep(2200);const cut=stamp(repo);
    await p.locator('header a').filter({hasText:'Family Meal Planner'}).click();await appReady(p);await scrollTo(p,0,200);const start=stamp(p);await sleep(5000);
    active.parts=[{page:repo,start:active.start,end:cut,host:checks.outroSource.startsWith('Local')?'Local repository / README.md':'github.com/jaccrocker/family-meal-planner'},{page:p,start,end:stamp(p),host:'meals.example.com'}];
  });

  for(const context of contexts)await context.close();
  for(const range of ranges){
    const inputs=[],filters=[],labels=[];let index=0;
    for(const part of range.parts){
      const cuts=range.skips.filter(s=>s.start>part.start&&s.end<part.end).sort((a,b)=>a.start-b.start);
      let start=part.start;const slices=[];
      for(const cut of cuts){slices.push({start,end:cut.start});start=cut.end;}slices.push({start,end:part.end});
      for(const slice of slices){const file=part.file??await part.page.video().path();inputs.push('-ss',slice.start.toFixed(3),'-t',(slice.end-slice.start).toFixed(3),'-i',file);filters.push(`[${index}:v]setpts=(PTS-STARTPTS)*${range.scale},fps=30,setsar=1[v${index}]`);labels.push(`[v${index}]`);index++;}
    }
    const filter=filters.join(';')+`;${labels.join('')}concat=n=${index}:v=1:a=0,tpad=stop_mode=clone:stop_duration=20,trim=duration=${range.seconds},fps=30[out]`;
    await run('ffmpeg',['-y',...inputs,'-filter_complex',filter,'-map','[out]','-frames:v',String(range.seconds*30),'-r','30','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','fast','-an',path.join(ROOT,'public/clips',range.id+'.mp4')]);
    console.log(`Encoded ${range.id}: ${range.seconds*30} frames`);
  }
  await fs.writeFile(path.join(ROOT,'public/clips/telemetry.json'),JSON.stringify(telemetry,null,2));
  const editMap=ranges.map(range=>{let ms=0;return {scene:range.id,parts:range.parts.map(part=>{const fromMs=ms;ms+=(part.end-part.start)*range.scale*1000;return {fromMs,host:part.host??'meals.example.com'};})};});
  await fs.writeFile(path.join(ROOT,'public/clips/edit-map.json'),JSON.stringify(editMap,null,2));
  const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const clipHashes=await Promise.all(scenes.map(async s=>({id:s.id,sha256:await hash(path.join(ROOT,'public/clips',s.id+'.mp4'))})));
  await fs.writeFile(path.join(ROOT,'reports/capture.json'),JSON.stringify({runId,checks,clipHashes,telemetrySha256:await hash(path.join(ROOT,'public/clips/telemetry.json')),scenes:ranges.map(({id,seconds,from,scale})=>({id,seconds,from,scale})),clips:ranges.length,expectedClips:scenes.length},null,2));
  await fs.writeFile(path.join(ROOT,'reports/capture-attempt.json'),JSON.stringify({runId,status:'complete'}));
  console.log('Capture complete. All real workflow assertions passed.');
}catch(error){await fs.writeFile(path.join(ROOT,'reports/capture-error.txt'),`${error.stack}\n`);throw error;}
finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();localServer.close();}
