import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './helpers.mjs';
import {scenes} from './scenes.mjs';

const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
const clips=[];
for(const scene of scenes){
  const file=path.join(ROOT,'public/clips',`${scene.id}.mp4`);const data=probe(file);const v=data.streams.find(s=>s.codec_type==='video');
  assert.equal(Number(v.nb_frames),scene.seconds*30,`${scene.id} frame count`);assert.equal(v.r_frame_rate,'30/1');
  const mobile=scene.profile==='mobile';assert.equal(v.width,mobile?390:1440);assert.equal(v.height,mobile?844:900);
  clips.push({id:scene.id,frames:Number(v.nb_frames),seconds:Number(v.duration)});
}
const expectedIds=scenes.map(s=>s.id).sort();
const actualIds=(await fs.readdir(path.join(ROOT,'public/clips'))).filter(f=>f.endsWith('.mp4')).map(f=>f.slice(0,-4)).sort();assert.deepEqual(actualIds,expectedIds,'Reconcile actual clips against the independent scene manifest');
const capture=JSON.parse(await fs.readFile(path.join(ROOT,'reports/capture.json'),'utf8'));assert.equal(capture.clips,10);assert.equal(capture.expectedClips,10);
const attempt=JSON.parse(await fs.readFile(path.join(ROOT,'reports/capture-attempt.json'),'utf8'));assert.equal(attempt.runId,capture.runId);assert.equal(attempt.status,'complete');
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
for(const clip of capture.clipHashes)assert.equal(await hash(path.join(ROOT,'public/clips',clip.id+'.mp4')),clip.sha256,`Clip integrity: ${clip.id}`);
assert.equal(await hash(path.join(ROOT,'public/clips/telemetry.json')),capture.telemetrySha256,'Telemetry must belong to the complete capture');
for(const field of ['plannerAccount','gmailApproval','approved','pantryExcluded','mobile'])assert.equal(capture.checks[field],true,field);
assert.equal(capture.checks.blankDays,7);assert.equal(capture.checks.libraryMeals,33);assert.equal(capture.checks.persistedSlots,7);assert.ok(capture.checks.parsedIngredients>0);assert.ok(capture.checks.instacartLines>0);
assert.equal(capture.checks.storeHost,'customers.dev.instacart.tools');assert.ok(capture.checks.cartItems>0);assert.equal(capture.checks.cartItems,capture.checks.matchedItems);
assert.equal(capture.checks.storeProof.expectedLines,capture.checks.instacartLines);assert.equal(capture.checks.storeProof.selectedLines,capture.checks.instacartLines);assert.deepEqual(capture.checks.storeProof.missingIngredients,[]);assert.equal(new Set(capture.checks.storeProof.mapping.map(row=>row.productId)).size,capture.checks.cartItems,'Cart count must match unique product IDs, including shared matches');
const telemetry=JSON.parse(await fs.readFile(path.join(ROOT,'public/clips/telemetry.json'),'utf8'));
for(const point of telemetry){assert.ok(expectedIds.includes(point.scene));assert.ok(point.timeMs>=0);assert.ok(point.xPercent>=0&&point.xPercent<=100);assert.ok(point.yPercent>=0&&point.yPercent<=100);}
const report={clips,expectedClips:10,actualClips:clips.length,totalFrames:clips.reduce((n,c)=>n+c.frames,0),telemetryEvents:telemetry.length};assert.equal(report.totalFrames,5400);
if(!process.argv.includes('--clips-only')){
  const file=path.join(ROOT,'family-meal-planner-demo.mp4');const data=probe(file);const v=data.streams.find(s=>s.codec_type==='video');const a=data.streams.find(s=>s.codec_type==='audio');
  assert.equal(v.width,1920);assert.equal(v.height,1080);assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_frames),5400);assert.equal(Number(v.duration),180);assert.equal(v.pix_fmt,'yuv420p');assert.ok(a,'Ambient audio track is required');
  // Fully decode the finished file, so corrupt frames cannot pass metadata checks.
  execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
  report.output={file,width:v.width,height:v.height,frames:Number(v.nb_frames),fps:v.r_frame_rate,duration:Number(v.duration),audio:a.codec_name,bytes:Number(data.format.size),decoded:true};
  const meanVolume=file=>{const result=spawnSync('ffmpeg',['-hide_banner','-i',file,'-vn','-t','180','-af','aformat=channel_layouts=stereo,volumedetect','-f','null','-'],{encoding:'utf8'});assert.equal(result.status,0);const match=result.stderr.match(/mean_volume: (-?[\d.]+) dB/);assert.ok(match,'Audio must contain a measurable signal');return Number(match[1]);};
  const gain=meanVolume(file)-meanVolume(path.join(ROOT,'public/audio/ambient-bg.mp3'));
  assert.ok(Math.abs(gain-20*Math.log10(.35))<.6,'Ambient audio must be mixed at 35% volume');report.output.audioGainDb=Math.round(gain*10)/10;
}
await fs.writeFile(path.join(ROOT,'reports/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
