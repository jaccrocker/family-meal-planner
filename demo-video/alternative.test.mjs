import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {detailVisibility} from './alternative-camera.mjs';
import {nextVersion} from './versioning.mjs';
import telemetry from './public/clips/telemetry.json' with {type:'json'};

test('every captured interaction shows the complete interface at click time',()=>{
  for(const point of telemetry){const points=telemetry.filter(p=>p.scene===point.scene);for(const seconds of [-.2,0,.4,.7])assert.equal(detailVisibility((point.timeMs/1000+seconds)*30,30,points),0,`${point.scene} at ${point.timeMs}`);}
  assert.equal(detailVisibility(3000,30,[{timeMs:1000}]),1);
});
test('file versions advance without replacing an existing deliverable',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'meal-demo-versions-'));
  try{
    assert.equal(path.basename(await nextVersion(directory,'Family Meal Planner Alternative','mp4','20261102')),'Family Meal Planner Alternative 20261102a.mp4');
    for(let n=0;n<26;n++)await fs.writeFile(path.join(directory,`Family Meal Planner Alternative 20261102${String.fromCharCode(97+n)}.mp4`),'fixture',{flag:'wx'});
    assert.equal(path.basename(await nextVersion(directory,'Family Meal Planner Alternative','mp4','20261102')),'Family Meal Planner Alternative 20261102aa.mp4');
    assert.equal(await fs.readFile(path.join(directory,'Family Meal Planner Alternative 20261102a.mp4'),'utf8'),'fixture');
    await fs.writeFile(path.join(directory,'Music Preview 20261102b.mp4'),'fixture',{flag:'wx'});
    assert.equal(path.basename(await nextVersion(directory,'Music Preview','mp4','20261102')),'Music Preview 20261102c.mp4');
  }finally{await fs.rm(directory,{recursive:true});}
});
