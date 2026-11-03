import fs from 'node:fs/promises';
import path from 'node:path';

function letters(number){let value=number,text='';while(value){value--;text=String.fromCharCode(97+value%26)+text;value=Math.floor(value/26);}return text;}
export async function nextVersion(directory,base,extension,date){
  const prefix=`${base} ${date}`,suffix=`.${extension}`;let highest=0;
  for(const name of await fs.readdir(directory)){
    if(!name.startsWith(prefix)||!name.endsWith(suffix))continue;
    const version=name.slice(prefix.length,-suffix.length);if(!/^[a-z]+$/.test(version))continue;
    highest=Math.max(highest,[...version].reduce((value,letter)=>value*26+letter.charCodeAt(0)-96,0));
  }
  return path.join(directory,`${base} ${date}${letters(highest+1)}.${extension}`);
}
