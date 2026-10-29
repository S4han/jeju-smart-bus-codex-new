import json,sqlite3,tempfile,unittest,uuid
from pathlib import Path
from unittest.mock import Mock
from concurrent.futures import ThreadPoolExecutor
from server.hosted_api import execute_arrival_request,BudgetUnavailable,ALLOWED_ORIGIN,configured_budget_store
from server.local_api import BudgetExhausted,ProviderFailure
BODY=json.dumps({'stationId':'406000191'}).encode()
def execute(store,request,body=BODY,origin=ALLOWED_ORIGIN):return execute_arrival_request(body,origin,'application/json','same-origin',store,request)
class SqliteTestStore:
 # Test-only shared durable adapter; never used by the Vercel entry.
 def __init__(self,path):self.path=path
 def begin_batch(self,min_used,approved_ceiling):
  with sqlite3.connect(self.path,timeout=10) as db:
   db.execute('BEGIN IMMEDIATE');used,ceiling,halted,lease=db.execute('SELECT used,ceiling,halted,lease FROM budget WHERE id=1').fetchone()
   if used<min_used or ceiling!=approved_ceiling:raise BudgetUnavailable()
   if halted or used>=ceiling:raise BudgetExhausted()
   if lease:raise BudgetUnavailable()
   token=uuid.uuid4().hex;db.execute('UPDATE budget SET lease=? WHERE id=1',(token,));return token
 def reserve(self,batch):
  with sqlite3.connect(self.path,timeout=10) as db:
   db.execute('BEGIN IMMEDIATE');used,ceiling,halted,lease=db.execute('SELECT used,ceiling,halted,lease FROM budget WHERE id=1').fetchone()
   if halted or used>=ceiling:raise BudgetExhausted()
   if lease!=batch:raise BudgetUnavailable()
   db.execute('UPDATE budget SET used=used+1 WHERE id=1')
 def finish_batch(self,batch):
  with sqlite3.connect(self.path) as db:
   if db.execute('UPDATE budget SET lease=NULL WHERE id=1 AND lease=?',(batch,)).rowcount!=1:raise BudgetUnavailable()
 def halt(self,batch):
  with sqlite3.connect(self.path) as db:
   if db.execute('UPDATE budget SET halted=1,lease=NULL WHERE id=1 AND lease=?',(batch,)).rowcount!=1:raise BudgetUnavailable()
class HostedApiTest(unittest.TestCase):
 def test_missing_store_never_calls_provider(self):
  request=Mock();self.assertIsNone(configured_budget_store());self.assertEqual(execute(None,request)[0],503);request.assert_not_called()
 def test_invalid_origin_or_coordinate_payload_never_reserves(self):
  store=Mock();request=Mock()
  self.assertEqual(execute(store,request,origin='https://unapproved.example')[0],403)
  self.assertEqual(execute(store,request,body=json.dumps({'stationId':'406000191','latitude':0}).encode())[0],400)
  store.reserve.assert_not_called();request.assert_not_called()
 def test_store_failure_or_exhaustion_stops_before_provider(self):
  for failure,status in [(BudgetUnavailable(),503),(BudgetExhausted(),429)]:
   store=Mock();store.reserve.side_effect=failure;request=Mock()
   self.assertEqual(execute(store,request)[0],status);request.assert_not_called()
 def test_current_routes_only_and_response_field_allowlist(self):
  store=Mock();calls=[]
  def request(operation,identifier):
   calls.append(operation)
   if operation=='BusArrives':return [{'routeId':'405000002','arrvVhId':'123','unused':'omit'}]
   return [{'routeId':'405000002','stationId':'406000191','stationOrd':'24','updnDir':'0','useYn':'Y'}]
  status,result=execute(store,request)
  self.assertEqual(status,200);self.assertEqual(calls,['BusArrives','StationRoutePr']);self.assertEqual(store.reserve.call_count,2)
  self.assertNotIn('unused',result['rows'][0]);self.assertEqual(len(result['mapping']),1)
 def test_partial_provider_failure_halts_and_returns_no_partial_rows(self):
  store=Mock();request=Mock(side_effect=[[{'routeId':'405000002','arrvVhId':'123'}],ProviderFailure()])
  status,result=execute(store,request)
  self.assertEqual(status,502);self.assertEqual(result,{'error':'upstream'});self.assertEqual(request.call_count,2);store.halt.assert_called_once_with(store.begin_batch.return_value)
 def test_concurrent_instances_share_exact_remaining_seven_and_persist_restart(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'budget.sqlite'
   with sqlite3.connect(path) as db:
    db.execute('CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER,ceiling INTEGER,halted INTEGER,lease TEXT)');db.execute('INSERT INTO budget VALUES(1,23,30,0,NULL)')
   request=Mock(return_value=[])
   with ThreadPoolExecutor(max_workers=10) as pool:results=list(pool.map(lambda _:execute(SqliteTestStore(path),request)[0],range(20)))
   self.assertLessEqual(results.count(200),7);self.assertTrue(all(status in (200,429,503) for status in results))
   for _ in range(7-results.count(200)):self.assertEqual(execute(SqliteTestStore(path),request)[0],200)
   self.assertEqual(request.call_count,7)
   self.assertEqual(execute(SqliteTestStore(path),request)[0],429);self.assertEqual(request.call_count,7)
   with sqlite3.connect(path) as db:self.assertEqual(db.execute('SELECT used FROM budget').fetchone()[0],30)
 def test_persistent_halt_blocks_next_instance(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'budget.sqlite'
   with sqlite3.connect(path) as db:
    db.execute('CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER,ceiling INTEGER,halted INTEGER,lease TEXT)');db.execute('INSERT INTO budget VALUES(1,23,30,0,NULL)')
   self.assertEqual(execute(SqliteTestStore(path),Mock(side_effect=ProviderFailure()))[0],502)
   request=Mock();self.assertEqual(execute(SqliteTestStore(path),request)[0],429);request.assert_not_called()
 def test_halt_write_failure_keeps_pending_batch_blocked_across_instances(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'budget.sqlite'
   with sqlite3.connect(path) as db:
    db.execute('CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER,ceiling INTEGER,halted INTEGER,lease TEXT)');db.execute('INSERT INTO budget VALUES(1,23,30,0,NULL)')
   store=SqliteTestStore(path);store.halt=Mock(side_effect=BudgetUnavailable())
   self.assertEqual(execute(store,Mock(side_effect=ProviderFailure()))[0],503)
   request=Mock();self.assertEqual(execute(SqliteTestStore(path),request)[0],503);request.assert_not_called()
 def test_reset_or_unapproved_store_ceiling_blocks_provider(self):
  for used,ceiling in [(0,30),(23,31)]:
   with tempfile.TemporaryDirectory() as directory:
    path=Path(directory)/'budget.sqlite'
    with sqlite3.connect(path) as db:
     db.execute('CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER,ceiling INTEGER,halted INTEGER,lease TEXT)');db.execute('INSERT INTO budget VALUES(1,?,?,0,NULL)',(used,ceiling))
    request=Mock();self.assertEqual(execute(SqliteTestStore(path),request)[0],503);request.assert_not_called()
 def test_real_http_entry_has_no_store_headers_and_is_disabled(self):
  import http.client,threading
  from http.server import ThreadingHTTPServer
  from api.arrivals import handler
  server=ThreadingHTTPServer(('127.0.0.1',0),handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=5)
   connection.request('POST','/api/arrivals',body=BODY,headers={'Origin':ALLOWED_ORIGIN,'Content-Type':'application/json'})
   response=connection.getresponse();self.assertEqual(response.status,503);self.assertEqual(response.getheader('Cache-Control'),'no-store');self.assertEqual(response.getheader('Referrer-Policy'),'no-referrer')
   self.assertEqual(json.loads(response.read()),{'error':'budget_store_unavailable'});connection.close()
  finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
