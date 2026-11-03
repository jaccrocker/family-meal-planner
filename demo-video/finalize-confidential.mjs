import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {ROOT,privacyAndCursor} from './helpers.mjs';
import {readmePreview} from './readme-preview.mjs';
import {nextVersion} from './versioning.mjs';
import privacy from './alternative-privacy.json' with {type:'json'};

// Replace the repository shot with the explicitly approved local README preview.
// Retain the verified first 170 seconds and the complete accepted soundtrack.
const input=path.resolve(process.argv[2]);
const reports=path.join(ROOT,'reports');
const original=path.join(ROOT,'family-meal-planner-demo.mp4');
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
assert.equal(await hash(original),privacy.originalMovieSha256);
const names=(await fs.readdir(reports)).filter(name=>/^alternative-props-\d+\.json$/.test(name)).sort();
const props=JSON.parse(await fs.readFile(path.join(reports,names.at(-1)),'utf8'));
assert.equal(props.capture.directory,'clips/confidential-20261102');
const image=path.join(ROOT,'public',props.capture.directory,'local-readme.png');
try{await fs.access(image);}catch{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto('data:text/html,'+encodeURIComponent(await readmePreview()));
    await page.evaluate(privacyAndCursor);await page.evaluate(()=>scrollTo(0,900));await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>/Jac\s+Crocker/i.test(document.body.innerText)),false);
    await page.screenshot({path:image});
  }finally{await browser.close();}
}
props.capture.readmeImage=props.capture.directory+'/local-readme.png';
props.capture.editMap.find(scene=>scene.scene==='scene8-outro').parts[0].host='Local repository / README.md';
const propsFile=path.join(reports,`confidential-local-props-${Date.now()}.json`);await fs.writeFile(propsFile,JSON.stringify(props),{flag:'wx'});
const run=(cmd,args)=>new Promise((resolve,reject)=>{const child=spawn(cmd,args,{stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(Error(`${cmd} failed (${code})`)));});
const require=createRequire(import.meta.url),pkg=require.resolve('@remotion/cli/package.json');
const cli=path.join(path.dirname(pkg),JSON.parse(await fs.readFile(pkg,'utf8')).bin.remotion);
await run('node',[require.resolve('typescript/bin/tsc'),'--project',path.join(ROOT,'tsconfig.json')]);
const outro=path.join(reports,`local-outro-${Date.now()}.mp4`);
await run('node',[cli,'render',path.join(ROOT,'src/index.tsx'),'FamilyMealPlannerAlternative',outro,'--frames','5100-5399','--props',propsFile,'--public-dir',path.join(ROOT,'public'),'--browser-executable',chromium.executablePath(),'--codec','h264','--crf','18','--concurrency','8','--log','error']);
const output=await nextVersion(ROOT,'Family Meal Planner Alternative','mp4',privacy.date);
await run('ffmpeg',['-n','-v','error','-i',input,'-i',outro,'-filter_complex','[0:v]trim=end=170,setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,scale=in_range=auto:out_range=tv[v]','-map','[v]','-map','0:a','-frames:v','5400','-r','30','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-c:a','copy','-t','180','-movflags','+faststart',output]);
const media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output],{encoding:'utf8'}));
const video=media.streams.find(s=>s.codec_type==='video'),audio=media.streams.find(s=>s.codec_type==='audio');
assert.equal(video.width,1920);assert.equal(video.height,1080);assert.equal(video.r_frame_rate,'30/1');assert.equal(Number(video.nb_frames),5400);assert.equal(Number(video.duration),180);assert.equal(Number(media.format.duration),180);assert.equal(Number(audio.duration),180);assert.equal(audio.channels,2);
execFileSync('ffmpeg',['-v','error','-i',output,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
assert.equal(await hash(original),privacy.originalMovieSha256);
// Compare the accepted soundtrack bytes, including packet timing, after the edit.
const audioHash=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a','-c','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim();
assert.equal(audioHash(output),audioHash(input));
const note=await fs.readFile(input.replace(/\.mp4$/,'.md'),'utf8');
await fs.writeFile(output.replace(/\.mp4$/,'.md'),note+'\nThe repository shot uses the approved local README preview. The identifying repository handle is omitted. The first 170 seconds and complete soundtrack are retained from the verified confidential capture. The revised export passes exact video/audio timing and full decode.\n',{flag:'wx'});
const report={output,frames:5400,seconds:180,width:1920,height:1080,fps:30,music:'life-of-riley',audioUnchanged:true,readmeImageSha256:await hash(image),originalPreserved:true,decoded:true,sha256:await hash(output)};
await fs.writeFile(path.join(reports,'alternative-verification.json'),JSON.stringify(report,null,2));
console.log(`Confidential final saved: ${output}`);
