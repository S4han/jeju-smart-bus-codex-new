import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const snapshot=JSON.parse(await readFile('/workspace/scratch/task004-research/bis-30-run-1-snapshot.json','utf8'));
const renderer=await createServer({appType:'custom',logLevel:'error',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {buildArrivalBoard}=await renderer.ssrLoadModule('/src/domain/arrival-board.ts');
 const {ArrivalPanel}=await renderer.ssrLoadModule('/src/ArrivalPanel.tsx');
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const summarize=board=>board.status==='checked'?{status:board.status,validArrivalCount:board.arrivals.length,excluded:board.excluded}:{status:board.status};
 const received=summarize(buildArrivalBoard({...snapshot,nowMs:snapshot.receivedAtMs}));
 const expired=summarize(buildArrivalBoard({...snapshot,nowMs:snapshot.receivedAtMs+60_001}));
 const html=renderToStaticMarkup(createElement(ArrivalPanel,{snapshot,selectedStationId:snapshot.stationId}));
 const current=summarize(buildArrivalBoard({...snapshot,nowMs:Date.now()}));
 const result={checkedAtUtc:new Date().toISOString(),atReceipt:received,after61Seconds:expired,atCheck:current,currentPredictionRendered:html.includes('산출 당시 예측'),source:'current public BIS sample; no provider request during this check'};
 const file='docs/verification/TASK-004-BIS-30-RUN-1.json';const report=JSON.parse(await readFile(file,'utf8'));report.validation=result;await writeFile(file,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(result));
}finally{await renderer.close();}
