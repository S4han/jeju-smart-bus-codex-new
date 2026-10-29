"""Local development API. Public stop IDs only; no coordinates, keys or request logs."""
import json, os, re, sqlite3, urllib.request, xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
STATIONS={row['id'] for row in json.loads((ROOT/'src/data/stations.json').read_text())}
class ProviderFailure(Exception): pass
class BudgetExhausted(Exception): pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None

def reserve(database):
 # A durable approval budget, not evidence of provider-side billing enforcement.
 with sqlite3.connect(database,timeout=10) as db:
  db.execute('BEGIN IMMEDIATE')
  row=db.execute('SELECT used, ceiling, halted FROM budget WHERE id=1').fetchone()
  if row is None or row[0]>=row[1] or row[2]: raise BudgetExhausted()
  db.execute('UPDATE budget SET used=used+1 WHERE id=1')

def provider_rows(operation,identifier,database):
 reserve(database)
 query=('station=' if operation=='BusArrives' else 'route=')+identifier
 try:
  opener=urllib.request.build_opener(NoRedirect)
  with opener.open('http://busopen.jeju.go.kr/OpenAPI/service/bis/'+operation+'?'+query,timeout=20) as response:
   raw=response.read(2*1024*1024+1)
   if response.status!=200 or len(raw)>2*1024*1024 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper(): raise ProviderFailure()
   root=ET.fromstring(raw)
   if root.findtext('.//resultCode')!='00': raise ProviderFailure()
   return [{child.tag:child.text for child in item} for item in root.findall('.//item')]
 except BudgetExhausted: raise
 except Exception:
  with sqlite3.connect(database) as db: db.execute('UPDATE budget SET halted=1 WHERE id=1')
  raise ProviderFailure() from None

def load_arrivals(station_id,database,request=provider_rows):
 rows=request('BusArrives',station_id,database)
 # Only route IDs actually returned for operating vehicle candidates are queried.
 routes=[]
 for row in rows:
  route=row.get('routeId') or ''; vehicle=row.get('arrvVhId') or ''
  if re.fullmatch(r'\d{9}',route) and re.fullmatch(r'\d+',vehicle) and any(c!='0' for c in vehicle) and route not in routes:
   routes.append(route)
 mapping=[]
 for route in routes[:3]:
  for event in request('StationRoutePr',route,database):
   if event.get('useYn')!='Y': continue
   order=event.get('stationOrd') or ''; direction=event.get('updnDir') or ''; stop=event.get('stationId') or ''
   if event.get('routeId')!=route or not re.fullmatch(r'\d{9}',stop) or not re.fullmatch(r'\d{1,16}',order) or not 0<int(order)<=9007199254740991 or not re.fullmatch(r'\d+',direction):
    raise ProviderFailure()
   mapping.append({'routeId':route,'stationId':stop,'order':int(order),'direction':direction})
 return {'stationId':station_id,'httpStatus':200,'resultCode':'00','rows':rows,'mapping':mapping}

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def respond(self,status,body):
  data=json.dumps(body,ensure_ascii=False).encode()
  if len(data)>2*1024*1024:
   status=502;data=b'{"error":"format"}'
  self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8')
  self.send_header('Cache-Control','no-store'); self.send_header('Referrer-Policy','no-referrer')
  self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
 def do_GET(self): self.respond(405,{'error':'method'})
 def do_POST(self):
  if self.path!='/api/arrivals': return self.respond(404,{'error':'not_found'})
  # Browser same-origin proxy only; no permissive CORS or cross-site requests.
  origin=self.headers.get('Origin')
  if origin:
   parsed=urlsplit(origin)
   if parsed.scheme!='http' or parsed.hostname not in ('localhost','127.0.0.1') or parsed.port not in (5173,4173):
    return self.respond(403,{'error':'origin'})
  if self.headers.get('Sec-Fetch-Site')=='cross-site': return self.respond(403,{'error':'origin'})
  try:
   if self.headers.get('Content-Type','').split(';')[0]!='application/json': raise ValueError()
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<=128 or self.headers.get('Transfer-Encoding'): raise ValueError()
   data=json.loads(self.rfile.read(size))
   if not isinstance(data,dict) or set(data)!={'stationId'} or not isinstance(data['stationId'],str) or data['stationId'] not in STATIONS: raise ValueError()
  except Exception: return self.respond(400,{'error':'input'})
  try: return self.respond(200,load_arrivals(data['stationId'],self.server.database))
  except BudgetExhausted: return self.respond(429,{'error':'verification_budget'})
  except ProviderFailure:
   with sqlite3.connect(self.server.database) as db: db.execute('UPDATE budget SET halted=1 WHERE id=1')
   return self.respond(502,{'error':'upstream'})

if __name__=='__main__':
 # Startup never grants a budget. A separate, explicitly approved ledger is required.
 database=os.environ.get('JEJU_VERIFICATION_BUDGET_DB','/tmp/jeju-no-approved-budget.sqlite')
 if not Path(database).is_file(): raise SystemExit('No approved verification ledger. No provider requests enabled.')
 server=ThreadingHTTPServer(('127.0.0.1',8765),Handler); server.database=database
 server.serve_forever()
