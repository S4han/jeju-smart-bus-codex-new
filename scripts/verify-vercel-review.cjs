const {chromium}=require('playwright');const assert=require('node:assert/strict');
const fs=require('node:fs');const http=require('node:http');
(async()=>{
 assert.deepEqual(fs.readdirSync('review-dist'),['index.html']);
 const html=fs.readFileSync('review-dist/index.html');
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.equal(config.outputDirectory,'review-dist');assert.equal(config.framework,null);
 const headers=Object.fromEntries(config.headers[0].headers.map(({key,value})=>[key,value]));
 const server=http.createServer((request,response)=>{
  response.writeHead(request.url==='/'?200:404,{'Content-Type':'text/html; charset=utf-8',...headers});
  response.end(request.url==='/'?html:'');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});let forbidden=0,errors=0;
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin||url.pathname.startsWith('/api/')){forbidden++;return route.abort();}
    return route.continue();
   });
   page.on('pageerror',()=>{errors++;});
   const response=await page.goto(origin+'/');
   assert.equal(response.headers()['cache-control'],'no-store');
   assert.equal(response.headers()['referrer-policy'],'no-referrer');
   const stop=JSON.parse(fs.readFileSync('src/data/stations.json','utf8')).find(row=>row.id==='406000191');
   for(const label of ['출발지','목적지']){
    const picker=page.getByRole('region',{name:label+' 지정',exact:true});
    await picker.getByLabel('정류장명',{exact:true}).fill(stop.name);
    await picker.getByRole('list',{name:label+' 정류장 검색 결과'}).getByRole('button',{name:stop.name+' · ID '+stop.id,exact:true}).click();
    await page.getByRole('region',{name:label+' 주변 정류장',exact:true}).getByRole('list').getByRole('button').filter({hasText:'ID '+stop.id}).click();
   }
   assert.equal(await page.getByRole('button',{name:'화면 미리보기에서는 실시간 조회를 제공하지 않습니다',exact:true}).isDisabled(),true);
   assert.equal(await page.getByRole('button',{name:'동의하고 정류장 지도 보기',exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(forbidden,0);assert.equal(errors,0);await page.close();
   console.log('Vercel review output '+width+'px: stop/origin/destination selection works; map/API disabled; no external requests; no-store passed (local hosting simulation).');
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(()=>{console.error('Vercel review artifact verification failed; no configured values logged.');process.exitCode=1;});
