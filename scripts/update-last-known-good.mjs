import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const assetDir=path.join(root,'public','notion-assets');
const outDir=path.join(root,'public','last-known-good');
const files=['index.json','search-index.json','display-manifest.json','manifest.json'];

async function readJson(name){
  const full=path.join(assetDir,name);
  const parsed=JSON.parse(await fs.readFile(full,'utf8'));
  if(!parsed||typeof parsed!=='object')throw new Error(name+' invalid');
  return parsed;
}
const payload={};
for(const name of files){
  const value=await readJson(name);
  if(name==='index.json'&&(!Array.isArray(value.pages)||!value.pages.length))throw new Error('index.json empty');
  if(name==='search-index.json'&&(!Array.isArray(value.pages)||!value.pages.length))throw new Error('search-index.json empty');
  if((name==='display-manifest.json'||name==='manifest.json')&&!Object.keys(value).length)throw new Error(name+' empty');
  payload[name]=value;
}
await fs.mkdir(outDir,{recursive:true});
for(const [name,value] of Object.entries(payload)){
  await fs.writeFile(path.join(outDir,name),JSON.stringify(value,null,2)+'\n','utf8');
}
await fs.writeFile(path.join(outDir,'meta.json'),JSON.stringify({
  version:1,
  capturedAt:new Date().toISOString(),
  files
},null,2)+'\n','utf8');
console.log('WIKI_LAST_KNOWN_GOOD_FILES='+files.length);
