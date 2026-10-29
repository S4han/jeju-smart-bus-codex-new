import importlib.util, pathlib, sqlite3, tempfile, unittest
spec=importlib.util.spec_from_file_location('local_api',pathlib.Path(__file__).parents[1]/'server/local_api.py')
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class LocalApiTest(unittest.TestCase):
 def test_budget_is_durable_and_never_reset(self):
  with tempfile.TemporaryDirectory() as directory:
   path=str(pathlib.Path(directory)/'budget.db')
   with sqlite3.connect(path) as db:
    db.execute('CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER,ceiling INTEGER,halted INTEGER)')
    db.execute('INSERT INTO budget VALUES(1,0,2,0)')
   api.reserve(path);api.reserve(path)
   with self.assertRaises(api.BudgetExhausted):api.reserve(path)
   with sqlite3.connect(path) as db:self.assertEqual(db.execute('SELECT used FROM budget').fetchone()[0],2)
 def test_mapping_is_driven_by_current_nonzero_vehicle_routes(self):
  calls=[]
  def request(operation,identifier,_):
   calls.append((operation,identifier))
   if operation=='BusArrives':return [{'routeId':'405000001','arrvVhId':'0'},{'routeId':'405000002','arrvVhId':'123'}]
   return [{'routeId':'405000002','stationId':'406000191','stationOrd':'24','updnDir':'0','useYn':'Y'}]
  result=api.load_arrivals('406000191','unused',request)
  self.assertEqual(calls,[('BusArrives','406000191'),('StationRoutePr','405000002')])
  self.assertEqual(result['mapping'][0]['order'],24)
 def test_failure_stops_without_querying_more_routes(self):
  calls=[]
  def request(operation,identifier,_):
   calls.append(operation)
   if operation=='BusArrives':return [{'routeId':'405000002','arrvVhId':'123'},{'routeId':'405000003','arrvVhId':'124'}]
   raise api.ProviderFailure()
  with self.assertRaises(api.ProviderFailure):api.load_arrivals('406000191','unused',request)
  self.assertEqual(calls,['BusArrives','StationRoutePr'])
if __name__=='__main__':unittest.main()
