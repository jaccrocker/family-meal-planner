import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT} from './helpers.mjs';
import {scenes} from './scenes.mjs';
import {detailVisibility} from './alternative-camera.mjs';

const id=process.argv[2];assert.match(id??'',/^confidential-[a-z0-9-]+$/);
const directory=path.join(ROOT,'public/clips',id),reportDir=path.join(ROOT,'reports',id);
const capture=JSON.parse(await fs.readFile(path.join(reportDir,'capture.json'),'utf8'));
const editMap=JSON.parse(await fs.readFile(path.join(directory,'edit-map.json'),'utf8'));
const telemetry=JSON.parse(await fs.readFile(path.join(directory,'telemetry.json'),'utf8'));
assert.equal(capture.confidential,true);assert.equal(capture.clips,scenes.length);assert.equal(capture.expectedClips,scenes.length);
const check=capture.checks;
assert.equal(check.initialOtherAdults,0);for(const key of ['addedOtherAdult','plannerSentMessage','gmailApproval','plannerReceivedConfirmation','approved','mobile'])assert.equal(check[key],true,key);
assert.equal(check.household.adults,2);assert.equal(check.persistedSlots,7);assert.equal(check.cartItems,check.storeProof.uniqueProducts);assert.deepEqual(check.storeProof.missingIngredients,[]);
const actual=(await fs.readdir(directory)).filter(name=>name.endsWith('.mp4')).sort();
assert.deepEqual(actual,scenes.map(s=>s.id+'.mp4').sort());
for(const scene of scenes){
  const file=path.join(directory,scene.id+'.mp4');
  assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'),capture.clipHashes.find(s=>s.id===scene.id).sha256);
  const data=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,duration,r_frame_rate','-of','json',file],{encoding:'utf8'})).streams[0];
  assert.equal(Number(data.nb_frames),scene.seconds*30);assert.equal(Number(data.duration),scene.seconds);assert.equal(data.r_frame_rate,'30/1');
  const points=telemetry.filter(e=>e.scene===scene.id);
  for(const point of points)assert.equal(detailVisibility(point.timeMs/1000*30,30,points),0,'Every interaction must be wide');
}
for(const scene of ['scene4a-send','scene4b-gmail','scene4c-approved'])assert.ok(editMap.find(s=>s.scene===scene).parts.some(p=>p.view==='mail'));
// Sample each second of the full film and five frames per second in setup/mail scenes.
// OCR output stays in memory. Only counts are written, with no mailbox text in logs.
const ocr=String.raw`
import concurrent.futures,json,os,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]);clips=root/'public/clips'/sys.argv[2];reports=root/'reports'/sys.argv[2]
scenes=json.loads((reports/'capture.json').read_text())['scenes'];mapping=json.loads((clips/'edit-map.json').read_text());tasks=[]
for scene in scenes:
    density=5 if scene['id'] in ['scene2-setup','scene4a-send','scene4b-gmail','scene4c-approved'] else 1
    for i in range(scene['seconds']*density):
        second=(i+.5)/density
        parts=next(s for s in mapping if s['scene']==scene['id'])['parts']
        part=next(p for p in reversed(parts) if p['fromMs']<=second*1000)
        tasks.append((scene['id'],second,part.get('view')=='mail'))
def inspect(task):
    name,second,mail=task
    cmd=['ffmpeg','-v','error','-ss',str(second),'-i',str(clips/(name+'.mp4')),'-frames:v','1']
    if mail:cmd+=['-vf','crop=980:788:390:112']
    frame=subprocess.check_output(cmd+['-f','image2pipe','-vcodec','png','-'])
    result=subprocess.run(['tesseract','stdin','stdout','--psm','11'],input=frame,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env={**os.environ,'OMP_THREAD_LIMIT':'1'},check=True).stdout.decode()
    import re
    return (bool(re.search(r'Jac\s+Crocker',result,re.I)),bool(re.search(r'Jac\s+C\b',result)),name,second)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(inspect,tasks))
report={'expectedSamples':len(tasks),'actualSamples':len(results),'fullNameLeaks':sum(r[0] for r in results),'aliasSamples':sum(r[1] for r in results),'leakLocations':[{'scene':r[2],'second':r[3]} for r in results if r[0]]}
(reports/'privacy-ocr.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
assert report['expectedSamples']==report['actualSamples'] and report['fullNameLeaks']==0 and report['aliasSamples']>0
`;
execFileSync('python3',['-c',ocr,ROOT,id],{stdio:'inherit'});
await fs.writeFile(path.join(reportDir,'confidential-verification.json'),JSON.stringify({captureId:id,captureReportSha256:createHash('sha256').update(await fs.readFile(path.join(reportDir,'capture.json'))).digest('hex'),clips:scenes.length,frames:5400,workflowVerified:true,clipHashesVerified:true,clickFramingVerified:true,privacyOcrVerified:true},null,2));
console.log('Confidential capture verified. Ten clips, live workflow, private reading panes and camera framing reconciled.');
