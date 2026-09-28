const base=String(process.env.LOAD_BASE_URL||'').replace(/\/$/,'');
const paths=String(process.env.LOAD_PATHS||'/').split(',').map(v=>v.trim()).filter(Boolean);
const concurrency=Math.max(1,Math.min(5,Number(process.env.LOAD_CONCURRENCY)||3));
const rounds=Math.max(1,Math.min(5,Number(process.env.LOAD_ROUNDS)||2));
const maxP95=Math.max(1000,Number(process.env.LOAD_MAX_P95_MS)||5000);
if(!base)throw new Error('LOAD_BASE_URL required');

async function hit(pathname){
  const started=performance.now();
  const response=await fetch(base+pathname,{headers:{'cache-control':'no-cache','user-agent':'chunbong-light-load-smoke/1.0'}});
  await response.arrayBuffer();
  return {path:pathname,status:response.status,ms:Math.round(performance.now()-started)};
}
const jobs=[];
for(let round=0;round<rounds;round++)for(const pathname of paths)for(let i=0;i<concurrency;i++)jobs.push(pathname);
const rows=[];
for(let i=0;i<jobs.length;i+=concurrency){
  rows.push(...await Promise.all(jobs.slice(i,i+concurrency).map(hit)));
}
let failed=false;
for(const pathname of paths){
  const group=rows.filter(row=>row.path===pathname).sort((a,b)=>a.ms-b.ms);
  const p95=group[Math.min(group.length-1,Math.floor(group.length*.95))]?.ms||0;
  const max=group.at(-1)?.ms||0;
  const bad=group.filter(row=>row.status<200||row.status>=400);
  console.log(`${pathname} requests=${group.length} p95=${p95}ms max=${max}ms errors=${bad.length}`);
  if(bad.length||p95>maxP95)failed=true;
}
if(failed)process.exitCode=1;
