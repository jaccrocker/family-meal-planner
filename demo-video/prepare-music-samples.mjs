import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ROOT} from './helpers.mjs';
import {musicOptions,musicLicense} from './music-options.mjs';
import {nextVersion} from './versioning.mjs';
import privacy from './alternative-privacy.json' with {type:'json'};

const run=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',data=>{error+=data;});child.on('exit',code=>code===0?resolve():reject(Error(error.slice(-1500))));});
const browser=await chromium.launch({headless:true});const results=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  for(const [index,option] of musicOptions.entries()){
    const source=path.join(ROOT,'public/audio/alternatives',option.id+'.mp3');
    const output=await nextVersion(ROOT,`Meal Planning Music Sample ${option.title}`,'mp4',privacy.date);
    const poster=path.join(ROOT,'reports',option.id+'-music-card.png');
    await page.setContent(`<!doctype html><style>body{margin:0;background:radial-gradient(ellipse at top left,#36543c,#14251d 80%);color:#f8f6ee;font-family:-apple-system,BlinkMacSystemFont,sans-serif}main{padding:65px 85px}small{font-size:15px;letter-spacing:3px;color:#c6efb0}h1{font-size:66px;font-weight:500;margin:50px 0 12px}h2{font-size:24px;color:#c6efb0;font-weight:400;margin:0}p{font-size:25px;max-width:850px;line-height:1.4;color:#d7e4d3;margin-top:35px}footer{position:absolute;bottom:26px;left:85px;font-size:13px;color:#b5c5b9}aside{position:absolute;top:65px;right:85px;font-size:16px;color:#b5c5b9}</style><main><small>FAMILY MEAL PLANNER · MUSIC DIRECTION ${index+1} OF 3</small><aside>30-SECOND AUDITION</aside><h1>${option.title}</h1><h2>${option.artist}</h2><p>${option.mood}</p></main><footer>${option.credit}<br>${musicLicense} · Edited excerpt with matching loudness and fades.</footer>`);
    await page.screenshot({path:poster});
    await run('ffmpeg',['-n','-v','error','-loop','1','-framerate','30','-i',poster,'-ss',String(option.start),'-i',source,'-filter_complex','[1:a]atrim=duration=30,asetpts=PTS-STARTPTS,loudnorm=I=-20:TP=-2:LRA=9,afade=t=in:d=1,afade=t=out:st=28.5:d=1.5,asplit=2[a][visual];[visual]showwaves=s=1110x105:mode=cline:colors=0xc6efb0:rate=30:draw=full[w];[0:v][w]overlay=85:500:shortest=1[v]','-map','[v]','-map','[a]','-t','30','-r','30','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','-metadata',`title=${option.title} | Meal Planning Music Audition`,'-metadata',`artist=${option.artist}`,'-metadata',`comment=${option.credit} ${option.source} ${musicLicense} Excerpt edited, normalized and faded.`,output]);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',output],{encoding:'utf8'}));
    assert.equal(probe.streams.find(s=>s.codec_type==='video').nb_frames,'900');assert.ok(probe.streams.some(s=>s.codec_type==='audio'));assert.equal(Number(probe.format.duration),30);
    results.push({...option,preview:output,license:musicLicense,seconds:30});console.log(`Prepared ${option.title}`);
  }
}finally{await browser.close();}
assert.equal(results.length,3);assert.equal(new Set(results.map(row=>row.id)).size,3);
await fs.writeFile(path.join(ROOT,'reports/music-previews.json'),JSON.stringify({expected:3,actual:results.length,options:results},null,2));
const document=await nextVersion(ROOT,'Meal Planning Music Options','md',privacy.date);
await fs.writeFile(document,`# Meal Planning Music Options\n\nChoose one of the three 30-second samples before the full alternative render. Sample loudness is matched. The final film will retain the existing captions, show only the relevant approval email, and widen the view around every interaction.\n\n${results.map((option,index)=>`## ${index+1}. ${option.title}\n\n${option.mood}.\n\n[Local sample](<${option.preview}>) | [Composer page](${option.source})\n\n${option.credit} [License](${musicLicense}). This sample is an edited audiovisual excerpt, normalized and faded.\n`).join('\n')}\nRecommended starting point: Life of Riley for a warm family feel with clear forward motion. Wallpaper emphasizes an efficient digital workflow; Origami adds more rhythmic character.\n\nAll three are free to use with attribution. Scott Buckley requires credit in the description when publishing to YouTube; keep that credit with the final video.\n`,{flag:'wx'});
console.log('Three versioned samples verified. Full video remains pending music selection.');
