import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ROOT,jsonRequest,requireEnv} from './helpers.mjs';

export async function resetBlankPlan({solo=false}={}){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({storageState:path.join(ROOT,'auth/planner.json')});
  try{
    const me=await jsonRequest(context,'/api/me');
    assert.equal(me.user?.email,requireEnv('DEMO_PLANNER_EMAIL'),'Planner login must match the authorized owner');
    const before=await jsonRequest(context,'/api/household');
    assert.equal(before.isOwner,true,'Reset requires the household owner');
    const review=await jsonRequest(context,'/api/review');
    assert.ok(['smtp','resend'].includes(review.transport),'Real email delivery must be configured');
    const backup=path.join(ROOT,'auth',`household-before-${Date.now()}.json`);
    await fs.writeFile(backup,JSON.stringify({record:before,review},null,2),{flag:'wx',mode:0o600});
    const reviewer=requireEnv('DEMO_REVIEWER_EMAIL');
    for(const email of before.members.filter(email=>solo||email!==reviewer))await jsonRequest(context,'/api/household/members',{method:'DELETE',data:{email}});
    if(!solo&&!before.members.includes(reviewer))await jsonRequest(context,'/api/household/members',{method:'POST',data:{email:reviewer}});
    const current=await jsonRequest(context,'/api/household');
    const state={...current.state,household:{...current.state.household,adults:solo?1:2,kids4to10:2,kids11to18:0,multipliers:{adult:1,kid4to10:.5,kid11to18:.75}},plan:[],exclude:[],customMeals:[],customItems:[]};
    // Keep one pantry item visible so the on-camera Have it action is meaningful.
    state.household.staples=state.household.staples.filter(id=>id!=='salt');
    await jsonRequest(context,'/api/household',{method:'PUT',headers:{'x-base-version':current.version},data:state});
    await jsonRequest(context,'/api/review/settings',{method:'PUT',data:{...review.settings,reviewers:solo?[]:[{email:reviewer,required:true}]}});
    const after=await jsonRequest(context,'/api/household');
    const settings=await jsonRequest(context,'/api/review');
    assert.deepEqual(after.state,state);assert.deepEqual(after.members,solo?[]:[reviewer]);
    assert.deepEqual(settings.reviewers,solo?[]:[{email:reviewer,required:true}]);
    const report={blankSlots:after.state.plan.length,adults:solo?1:2,youngerKids:2,teens:0,requiredReviewers:solo?0:1,transport:settings.transport,verified:true};
    await fs.writeFile(path.join(ROOT,'reports/reset.json'),JSON.stringify(report,null,2));
    console.log(`Reset verified: blank week, ${after.state.household.adults} adult(s), ${after.members.length} other adults.`);
  }finally{await context.close();await browser.close();}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await resetBlankPlan({solo:process.argv.includes('--solo')});
