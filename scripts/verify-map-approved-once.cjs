// Separate one-time user approval; prior reservations/results remain untouched.
const fs=require('node:fs');const path=require('node:path');
// Explicit opt-in, public stop only, no retries, no raw URLs/keys/coordinates in output.
const sdkHost='oapi.map.naver.com';
const {requiredHosts,classifyRequest,priorAttemptExists}=require('./map-verification-guard.cjs');
let allowed=false;
try {
 const policy=JSON.parse(fs.readFileSync('/etc/codex/network-policy.json','utf8'));
 allowed=requiredHosts.every(host=>policy.http_network_policy.egress_rules.some(rule=>rule.host===host));
} catch { console.log('Real Maps preflight: network policy unavailable; no provider request made.');process.exit(2); }
if(!allowed){console.log('Real Maps preflight: required map host not allowed; no provider request made.');process.exit(2);}
if(!process.argv.includes('--live')){console.log('Real Maps preflight ready. Actual verification requires explicit --live; no provider request made.');process.exit(0);}
const {chromium}=require('playwright');
const output=path.resolve(__dirname,'../docs/verification/TASK-004-MAP-APPROVED-RESULT.json');
const reservation=path.resolve(__dirname,'../docs/verification/TASK-004-MAP-APPROVED.reserved');
if(fs.existsSync(reservation)||fs.existsSync(output)){console.log('Real Maps attempt already reserved; no repeat request made.');process.exit(2);}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY,bypass:'localhost,127.0.0.1'},args:['--no-sandbox']});
 let ownsReservation=false;
 const report={status:'unverified',sdkRequests:0,arrivalApiRequests:0,requestsByHost:{},failedByHost:{},cspByHost:{},blockedBisRequests:0,blockedExternalByHost:{},responseStatusByHost:{},failureStage:'setup',priorSdkEntryRequests:2,mapRendered:false,markersMatch:false,networkFailureCodes:{},bisUsed:19,bisLimit:19};
 try {
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.exposeFunction('recordCsp',(host,scheme,directive)=>{const key=scheme+' '+host+' '+directive;report.cspByHost[key]=(report.cspByHost[key]||0)+1;});
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>{
   let host='non-url',scheme='non-url';try{const url=new URL(event.blockedURI);host=url.hostname;scheme=url.protocol;}catch{}
   window.recordCsp(host,scheme,event.effectiveDirective);
  }));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   const classification=classifyRequest(url.href);
   if(classification==='bis_blocked'){
    report.blockedBisRequests++;return route.abort();
   }
   if(classification==='external_blocked'){report.blockedExternalByHost[url.hostname]=(report.blockedExternalByHost[url.hostname]||0)+1;return route.abort();}
   return route.continue();
  });
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.hostname===sdkHost&&url.pathname==='/openapi/v3/maps.js')report.sdkRequests++;
   if(url.pathname==='/api/arrivals')report.arrivalApiRequests++;
   if(!['localhost','127.0.0.1'].includes(url.hostname))report.requestsByHost[url.hostname]=(report.requestsByHost[url.hostname]||0)+1;
  });
  page.on('response',response=>{const host=new URL(response.url()).hostname;if(requiredHosts.includes(host)){const key=host+' '+response.status();report.responseStatusByHost[key]=(report.responseStatusByHost[key]||0)+1;}});
  page.on('requestfailed',request=>{const host=new URL(request.url()).hostname;report.failedByHost[host]=(report.failedByHost[host]||0)+1;const code=request.failure()?.errorText;if(/^net::ERR_[A-Z_]+$/.test(code||'')){const key=host+' '+code;report.networkFailureCodes[key]=(report.networkFailureCodes[key]||0)+1;}});
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
  fs.writeFileSync(reservation,'User approved one additional live map verification after CSP fixes on 2026-10-29. Prior SDK entries: 2. BIS 19/19. Do not retry.',{flag:'wx'});
  ownsReservation=true;
  report.failureStage='tile_wait';
  await consent.click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.station-map img')).some(image=>{
   const url=new URL(image.src);
   return url.hostname==='nrbe.map.naver.net'&&image.complete&&image.naturalWidth>=128&&image.naturalHeight>=128;
  }),undefined,{timeout:20000});
  report.mapRendered=true;
  report.failureStage='marker_boundary';
  const mapIds=await panel.locator('.map-pin').evaluateAll(nodes=>nodes.map(node=>node.dataset.stationId).sort());
  const listIds=(await panel.getByRole('list',{name:'출발지 주변 정류장 목록'}).getByRole('button').allTextContents()).map(text=>text.match(/ID (\d{9})/)[1]).sort();
  report.markersMatch=mapIds.length>0&&JSON.stringify(mapIds)===JSON.stringify(listIds);
  const count=mapIds.length;
  const listed=await panel.getByRole('list',{name:'출발지 주변 정류장 목록'}).getByRole('button').count();
  if(report.sdkRequests!==1||count===0||count!==listed||JSON.stringify(mapIds)!==JSON.stringify(listIds)||report.arrivalApiRequests!==0||report.blockedBisRequests!==0||Object.keys(report.cspByHost).length!==0)throw new Error('map_boundary');
  report.status='tile_and_marker_sample_passed';
  report.failureStage=null;
  await page.screenshot({path:'/workspace/scratch/task004-research/task004-approved-real-map.png',fullPage:true});
 } catch {
  report.status='stopped_without_retry';
  process.exitCode=1;
 } finally {
  await browser.close();
  if(ownsReservation){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report));
 }
})().catch(()=>{console.error('Real Maps verification could not start; no retry.');process.exitCode=1;});
