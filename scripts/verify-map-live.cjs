const fs=require('node:fs');const path=require('node:path');
// Explicit opt-in, public stop only, no retries, no raw URLs/keys/coordinates in output.
const sdkHost='oapi.map.naver.com';
let allowed=false;
try {
 const policy=JSON.parse(fs.readFileSync('/etc/codex/network-policy.json','utf8'));
 allowed=policy.http_network_policy.egress_rules.some(rule=>rule.host===sdkHost);
} catch { console.log('Real Maps preflight: network policy unavailable; no provider request made.');process.exit(2); }
if(!allowed){console.log('Real Maps preflight: SDK host not allowed; no provider request made.');process.exit(2);}
if(!process.argv.includes('--live')){console.log('Real Maps preflight ready. Actual verification requires explicit --live; no provider request made.');process.exit(0);}
const {chromium}=require('playwright');
const output='/workspace/scratch/task004-research/naver-live-result.json';
const reservation='/workspace/scratch/task004-research/naver-live.reserved';
if(fs.existsSync(reservation)){console.log('Real Maps attempt already reserved; no repeat request made.');process.exit(2);}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 let ownsReservation=false;
 const report={status:'unverified',sdkRequests:0,arrivalApiRequests:0,requestsByHost:{},failedByHost:{}};
 try {
  const page=await browser.newPage({viewport:{width:390,height:900}});
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.hostname===sdkHost&&url.pathname==='/openapi/v3/maps.js')report.sdkRequests++;
   if(url.pathname==='/api/arrivals')report.arrivalApiRequests++;
   if(!['localhost','127.0.0.1'].includes(url.hostname))report.requestsByHost[url.hostname]=(report.requestsByHost[url.hostname]||0)+1;
  });
  page.on('requestfailed',request=>{const host=new URL(request.url()).hostname;report.failedByHost[host]=(report.failedByHost[host]||0)+1;});
  await page.goto('http://localhost:4173/');
  const stop=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
  if(!stop)throw new Error('public_stop_unavailable');
  const picker=page.getByRole('region',{name:'출발지 지정',exact:true});
  await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
  await picker.getByRole('list',{name:'출발지 정류장 검색 결과'}).getByRole('button',{name:`${stop.name} · ID ${stop.id}`,exact:true}).click();
  const panel=page.getByRole('region',{name:'출발지 주변 정류장',exact:true});
  const consent=panel.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true});
  await consent.waitFor();
  if(report.sdkRequests!==0||report.arrivalApiRequests!==0)throw new Error('unexpected_early_request');
  fs.mkdirSync(path.dirname(reservation),{recursive:true});
  fs.writeFileSync(reservation,'One explicit real SDK/map verification attempt. Do not retry automatically.',{flag:'wx'});
  ownsReservation=true;
  await consent.click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.station-map img')).some(image=>{
   const url=new URL(image.src);
   return ['simg.pstatic.net','map.pstatic.net'].includes(url.hostname)&&/\/(?:onetile|tile)\//.test(url.pathname)&&image.complete&&image.naturalWidth>=128&&image.naturalHeight>=128;
  }),undefined,{timeout:20000});
  const count=await panel.locator('.map-pin').count();
  const listed=await panel.getByRole('list',{name:'출발지 주변 정류장 목록'}).getByRole('button').count();
  if(report.sdkRequests!==1||count!==listed||report.arrivalApiRequests!==0)throw new Error('map_boundary');
  report.status='tile_and_marker_sample_passed';
  await page.screenshot({path:'/tmp/task004-real-map.png',fullPage:true});
 } catch {
  report.status='stopped_without_retry';
  process.exitCode=1;
 } finally {
  await browser.close();
  if(ownsReservation){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report));
 }
})().catch(()=>{console.error('Real Maps verification could not start; no retry.');process.exitCode=1;});
