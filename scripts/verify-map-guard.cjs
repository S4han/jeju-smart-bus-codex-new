const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classifyRequest,priorAttemptExists}=require('./map-verification-guard.cjs');
const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');const path=require('node:path');
test('BIS and local API are blocked before any provider routing',()=>{
 for(const url of ['http://localhost:4173/api/arrivals','http://busopen.jeju.go.kr/OpenAPI/service/bis/BusArrives','https://bus.jeju.go.kr/','https://oapi.map.naver.com/api/arrivals'])assert.equal(classifyRequest(url),'bis_blocked');
});
test('only exact localhost origin and three HTTPS map hosts pass',()=>{
 assert.equal(classifyRequest('http://localhost:4173/'),'local');
 for(const host of ['oapi.map.naver.com','nrbe.map.naver.net','static.naver.net'])assert.equal(classifyRequest('https://'+host+'/sample'),'map');
 for(const url of ['http://nrbe.map.naver.net/','https://nrbe.map.naver.net:444/','https://nrbe.map.naver.net.evil.invalid/','http://localhost:8765/','https://kr-col-ext.nelo.navercorp.com/'])assert.equal(classifyRequest(url),'external_blocked');
});
test('either durable result or exclusive reservation prevents another run',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'map-guard-'));const reservation=path.join(root,'once.reserved');
 try{
  assert.equal(priorAttemptExists(root,reservation),false);
  writeFileSync(reservation,'reserved',{flag:'wx'});assert.equal(priorAttemptExists(root,reservation),true);
  rmSync(reservation);mkdirSync(path.join(root,'docs/verification'),{recursive:true});
  writeFileSync(path.join(root,'docs/verification/TASK-004-MAP-FOLLOWUP-RESULT.json'),'{}');
  assert.equal(priorAttemptExists(root,reservation),true);
 }finally{rmSync(root,{recursive:true,force:true});}
});
