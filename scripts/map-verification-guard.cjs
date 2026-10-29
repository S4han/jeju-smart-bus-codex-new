const fs=require('node:fs');
const path=require('node:path');
const requiredHosts=['oapi.map.naver.com','nrbe.map.naver.net','static.naver.net'];
function classifyRequest(raw){
 const url=new URL(raw);
 if(url.pathname.startsWith('/api/')||['bus.jeju.go.kr','busopen.jeju.go.kr'].includes(url.hostname))return 'bis_blocked';
 if(url.origin==='http://localhost:4173')return 'local';
 if(url.protocol==='https:'&&url.port===''&&requiredHosts.includes(url.hostname))return 'map';
 return 'external_blocked';
}
function priorAttemptExists(root,reservation){
 return fs.existsSync(reservation)||fs.existsSync(path.join(root,'docs/verification/TASK-004-MAP-FOLLOWUP-RESULT.json'));
}
module.exports={requiredHosts,classifyRequest,priorAttemptExists};
