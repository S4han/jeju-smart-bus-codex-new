import importlib.util,pathlib,tempfile,sqlite3,unittest
spec=importlib.util.spec_from_file_location('approval',pathlib.Path(__file__).parents[1]/'scripts/update-bis-budget.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class BudgetApprovalTest(unittest.TestCase):
 def test_restore_preserves_known_usage_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as directory:
   db=pathlib.Path(directory)/'budget.sqlite'
   result=module.apply_approval(db,19,30)
   self.assertEqual((result['used'],result['ceiling'],result['remaining']),(19,30,11))
   module.apply_approval(db,19,30)
   with sqlite3.connect(db) as connection:
    self.assertEqual(connection.execute('SELECT count(*) FROM approvals').fetchone()[0],1)
 def test_later_usage_and_failure_halt_are_not_reset(self):
  with tempfile.TemporaryDirectory() as directory:
   db=pathlib.Path(directory)/'budget.sqlite';module.apply_approval(db,19,30)
   with sqlite3.connect(db) as connection:connection.execute('UPDATE budget SET used=22,halted=1 WHERE id=1')
   result=module.apply_approval(db,19,30)
   self.assertEqual((result['used'],result['remaining'],result['halted']),(22,8,True))
 def test_increase_enforces_exactly_eleven_more_reservations(self):
  local_spec=importlib.util.spec_from_file_location('api',pathlib.Path(__file__).parents[1]/'server/local_api.py')
  api=importlib.util.module_from_spec(local_spec);local_spec.loader.exec_module(api)
  with tempfile.TemporaryDirectory() as directory:
   db=pathlib.Path(directory)/'budget.sqlite';module.apply_approval(db,19,30)
   for _ in range(11):api.reserve(db)
   with self.assertRaises(api.BudgetExhausted):api.reserve(db)
   with sqlite3.connect(db) as connection:self.assertEqual(connection.execute('SELECT used FROM budget').fetchone()[0],30)
if __name__=='__main__':unittest.main()
