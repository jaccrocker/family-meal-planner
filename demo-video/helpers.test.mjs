import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installHelpers} from './helpers.mjs';
import {scenes} from './scenes.mjs';
import {storeProof} from './store-proof.mjs';

test('privacy masks email substrings and live inputs while leaving status badges readable',async()=>{
  const browser=await chromium.launch({headless:true});const context=await browser.newContext();await installHelpers(context);const page=await context.newPage();
  try{
    await page.goto('data:text/html,<body><div id="reviewer">Send to demo-account-1@example.com <button>Required</button><b>Approved</b></div><input value="demo-account-2@example.com"><div id="dynamic"></div></body>');
    await page.waitForSelector('.demo-private');
    await page.evaluate(()=>{document.querySelector('#dynamic').textContent='Partner other@gmail.com is ready';});
    await page.waitForFunction(()=>document.querySelectorAll('.demo-private').length===2);
    const result=await page.evaluate(()=>({
      masked:[...document.querySelectorAll('.demo-private')].every(n=>getComputedStyle(n).filter==='blur(7px)'),
      required:getComputedStyle(document.querySelector('button')).filter,
      approved:getComputedStyle(document.querySelector('b')).filter,
      input:getComputedStyle(document.querySelector('input')).filter,
      surrounding:document.querySelector('#reviewer').childNodes[0].textContent,
      cursor:getComputedStyle(document.querySelector('#demo-cursor')).pointerEvents,
    }));
    assert.equal(result.masked,true);assert.equal(result.required,'none');assert.equal(result.approved,'none');assert.equal(result.input,'blur(7px)');assert.equal(result.surrounding,'Send to ');assert.equal(result.cursor,'none');
  }finally{await browser.close();}
});
test('scene boundaries cover exactly 180 seconds without gaps',()=>{
  let expected=0;for(const scene of scenes){assert.equal(scene.from,expected);expected+=scene.seconds*30;}assert.equal(expected,5400);assert.equal(scenes.length,10);
});
test('store reconciliation counts shared product IDs and rejects omitted ingredients',async()=>{
  const browser=await chromium.launch({headless:true});const page=await browser.newPage();
  try{
    await page.setContent(`<base href="https://customers.dev.instacart.tools"><main>${[['fresh basil','1-basil'],['thai basil','1-basil'],['asparagus','2-asparagus']].map(([name,id])=>`<article><a href="/products/${id}">Product</a><button aria-label="unselect item"></button><p>1 package ${name}</p></article>`).join('')}</main>`);
    const expected=['fresh basil','thai basil','asparagus'];const proof=await storeProof(page,expected);
    assert.equal(proof.selectedLines,3);assert.equal(proof.uniqueProducts,2);assert.equal(proof.mergedProducts.length,1);assert.deepEqual(proof.missingIngredients,[]);
    await page.locator('article').last().evaluate(node=>node.remove());await assert.rejects(()=>storeProof(page,expected),/Every ingredient needs/);
  }finally{await browser.close();}
});

test('confidential capture aliases names, including late content, and masks an address from its first character',async()=>{
  const browser=await chromium.launch({headless:true});const context=await browser.newContext();await installHelpers(context);const page=await context.newPage();
  try{
    await page.goto('data:text/html,<body><div id="name">Jac Crocker</div><input data-demo-private><div id="late"></div><iframe title="Email preview" sandbox srcdoc="<p>Jac Crocker planned meals</p>"></iframe></body>');
    await page.waitForFunction(()=>document.querySelector('#name').textContent==='Jac C');
    await page.locator('input').pressSequentially('j');
    assert.equal(await page.locator('input').evaluate(n=>getComputedStyle(n).filter),'blur(7px)');
    await page.evaluate(()=>document.querySelector('#late').textContent='Jac Crocker planned meals');
    await page.waitForFunction(()=>document.querySelector('#late').textContent==='Jac C planned meals');
    // Rewrite sandboxed preview HTML before it can display the original name.
    await page.waitForFunction(()=>document.querySelector('iframe').getAttribute('srcdoc').includes('Jac C planned meals'));
    const frame=page.frames()[1];await frame.waitForSelector('p');
    assert.equal(await frame.locator('p').innerText(),'Jac C planned meals');
  }finally{await browser.close();}
});

test('privacy installs on a Trusted Types protected email document',async()=>{
  const browser=await chromium.launch({headless:true});const page=await browser.newPage();
  try{
    await page.goto('data:text/html,'+encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="require-trusted-types-for 'script'"><p>Jac Crocker</p><p>demo-account-2@example.com</p>`));
    await page.evaluate((await import('./helpers.mjs')).privacyAndCursor);
    assert.equal(await page.locator('p').first().innerText(),'Jac C');
    assert.equal(await page.locator('.demo-private').evaluate(n=>getComputedStyle(n).filter),'blur(7px)');
    assert.equal(await page.locator('#demo-cursor svg').count(),1);
  }finally{await browser.close();}
});
