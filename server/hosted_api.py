"""Hosted boundary. A durable store must be explicitly wired before any BIS request."""
import json
from http.server import BaseHTTPRequestHandler
from typing import Protocol
from server.local_api import ROOT, STATIONS, BudgetExhausted, ProviderFailure, fetch_provider_rows, load_arrivals

APPROVAL=json.loads((ROOT/'src/data/bis-verification-budget.json').read_text())
ALLOWED_ORIGIN='https://jeju-smart-bus-codex-new.vercel.app'
class BudgetUnavailable(Exception): pass
class SharedBudget(Protocol):
 def begin_batch(self,min_used,ceiling): ...  # Durable single-owner pending flag; never auto-expire after a crash.
 def reserve(self,batch): ... # Atomic durable increment, verifying ownership before every request.
 def finish_batch(self,batch): ...
 def halt(self,batch): ...    # If this write fails, the durable pending flag must still block new work.

def configured_budget_store():
 # No shared store is connected. Never substitute SQLite in /tmp or a memory counter.
 return None

def execute_arrival_request(body,origin,content_type,fetch_site,store,request=fetch_provider_rows):
 if origin!=ALLOWED_ORIGIN or fetch_site=='cross-site': return 403,{'error':'origin'}
 try:
  if content_type.split(';')[0]!='application/json' or not 0<len(body)<=128: raise ValueError()
  data=json.loads(body)
  if not isinstance(data,dict) or set(data)!={'stationId'} or not isinstance(data['stationId'],str) or data['stationId'] not in STATIONS: raise ValueError()
 except Exception: return 400,{'error':'input'}
 if store is None: return 503,{'error':'budget_store_unavailable'}
 operations=0
 batch=None
 def reserved_request(operation,identifier,_):
  nonlocal operations
  if operations>=4: raise ProviderFailure()
  store.reserve(batch)
  operations+=1
  return request(operation,identifier)
 try:
  batch=store.begin_batch(APPROVAL['usedCheckpoint'],APPROVAL['ceiling'])
  result=load_arrivals(data['stationId'],None,request=reserved_request)
  fields={'routeId','stationOrd','updnDir','arrvVhId','predictTravTm','leftStation','calcDate'}
  result['rows']=[{key:value for key,value in row.items() if key in fields} for row in result['rows']]
  if len(json.dumps(result,ensure_ascii=False).encode())>2*1024*1024: raise ProviderFailure()
  store.finish_batch(batch)
  return 200,result
 except BudgetExhausted:
  if batch is not None:
   try: store.finish_batch(batch)
   except Exception: return 503,{'error':'budget_store_unavailable'}
  return 429,{'error':'verification_budget'}
 except BudgetUnavailable: return 503,{'error':'budget_store_unavailable'}
 except Exception:
  if batch is None: return 503,{'error':'budget_store_unavailable'}
  try: store.halt(batch)
  except Exception: return 503,{'error':'budget_store_unavailable'}
  return 502,{'error':'upstream'}

class handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def respond(self,status,body):
  raw=json.dumps(body,ensure_ascii=False).encode()
  self.send_response(status)
  for key,value in {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Length':str(len(raw))}.items():self.send_header(key,value)
  self.end_headers();self.wfile.write(raw)
 def do_GET(self): self.respond(405,{'error':'method'})
 def do_POST(self):
  if self.path!='/api/arrivals': return self.respond(404,{'error':'not_found'})
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=128 or self.headers.get('Transfer-Encoding'): raise ValueError()
  except Exception:return self.respond(400,{'error':'input'})
  status,body=execute_arrival_request(self.rfile.read(length),self.headers.get('Origin'),self.headers.get('Content-Type',''),self.headers.get('Sec-Fetch-Site'),configured_budget_store())
  self.respond(status,body)
