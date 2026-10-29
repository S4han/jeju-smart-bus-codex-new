const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const port of [5173,4173]) {
   const page=await browser.newPage({viewport:{width:390,height:844}});let external=0;
   page.on('request',request=>{if(!['127.0.0.1','localhost'].includes(new URL(request.url()).hostname))external++;});
   await page.goto(`http://127.0.0.1:${port}/`);
   await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
   await page.getByRole('heading',{name:'어디로 가시나요?',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.staticPreview),undefined);
   assert.equal(external,0);
   console.log(`App entry ${port}: root path renders runnable app, not static Index, no external requests`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(()=>{console.error('App entry verification failed');process.exitCode=1;});
