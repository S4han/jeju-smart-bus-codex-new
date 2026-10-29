"""One bounded public-stop verification; preserves cumulative budget, no retries."""
import argparse,importlib.util,json,os,sqlite3,time
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATABASE=Path('/workspace/scratch/task004-research/bis-cumulative.sqlite')
RESERVATION=ROOT/'docs/verification/TASK-004-BIS-30-RUN-1.reserved'
REPORT=ROOT/'docs/verification/TASK-004-BIS-30-RUN-1.json'
SNAPSHOT=Path('/workspace/scratch/task004-research/bis-30-run-1-snapshot.json')
parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args()
policy=json.loads(Path('/etc/codex/network-policy.json').read_text())
if not any(row.get('host')=='busopen.jeju.go.kr' for row in policy['http_network_policy']['egress_rules']):raise SystemExit('BIS host not allowed; no requests.')
if not DATABASE.is_file():raise SystemExit('Approved ledger missing; no requests.')
with sqlite3.connect(DATABASE) as db:before=db.execute('SELECT used,ceiling,halted FROM budget WHERE id=1').fetchone()
approval_file=ROOT/'src/data/bis-verification-budget.json';approval=json.loads(approval_file.read_text())
if before!=(approval['usedCheckpoint'],30,0) or 30-before[0]<4:raise SystemExit('Ledger/checkpoint mismatch or unavailable batch budget; no requests.')
if RESERVATION.exists() or REPORT.exists():raise SystemExit('This verification batch is already reserved; no repeat.')
if not args.live:print('BIS preflight passed. Explicit --live required; no requests.');raise SystemExit()
spec=importlib.util.spec_from_file_location('api',ROOT/'server/local_api.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
with RESERVATION.open('x') as file:file.write('User approved cumulative ceiling 30; public stop, at most 4 provider requests, no automatic retry. Prior usage 19.\n')
report={'startedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'started','usedBefore':before[0],'ceiling':30,'maximumBatchRequests':4,'operations':[],'snapshotSavedOutsideRepository':False}
def tracked(operation,identifier,database):
 if len(report['operations'])>=4:raise RuntimeError('batch_limit')
 entry={'operation':operation,'status':'attempted'};report['operations'].append(entry)
 rows=api.provider_rows(operation,identifier,database)
 entry.update(status='received',rows=len(rows));print(json.dumps(entry),flush=True)
 return rows
try:
 snapshot=api.load_arrivals('406000191',str(DATABASE),request=tracked)
 allowed={'routeId','stationOrd','updnDir','arrvVhId','predictTravTm','leftStation','calcDate'}
 snapshot['rows']=[{key:value for key,value in row.items() if key in allowed} for row in snapshot['rows']]
 snapshot['receivedAtMs']=int(time.time()*1000)
 SNAPSHOT.parent.mkdir(parents=True,exist_ok=True)
 descriptor=os.open(SNAPSHOT,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(descriptor,'w') as file:json.dump(snapshot,file)
 report.update(status='received_without_retry',arrivalRows=len(snapshot['rows']),mappingRows=len(snapshot['mapping']),receivedAtMs=snapshot['receivedAtMs'],snapshotSavedOutsideRepository=True)
except Exception:
 report['status']='stopped_without_retry'
 with sqlite3.connect(DATABASE) as db:db.execute('UPDATE budget SET halted=1 WHERE id=1')
finally:
 with sqlite3.connect(DATABASE) as db:used,ceiling,halted=db.execute('SELECT used,ceiling,halted FROM budget WHERE id=1').fetchone()
 report.update(usedAfter=used,remaining=ceiling-used,halted=bool(halted),finishedAtUtc=datetime.now(timezone.utc).isoformat())
 approval['usedCheckpoint']=max(approval['usedCheckpoint'],used)
 temporary=approval_file.with_suffix('.pending');temporary.write_text(json.dumps(approval,indent=2)+'\n');temporary.replace(approval_file)
 REPORT.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report),flush=True)
if report['status']!='received_without_retry':raise SystemExit(1)
