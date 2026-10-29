"""Apply the explicit approval without provider requests or resetting prior usage."""
import argparse, json, os, sqlite3
from pathlib import Path

def apply_approval(database, used_checkpoint, ceiling):
 if type(used_checkpoint) is not int or type(ceiling) is not int or not 0 <= used_checkpoint <= ceiling:
  raise ValueError('Invalid cumulative approval')
 path=Path(database);path.parent.mkdir(parents=True,exist_ok=True)
 try:
  descriptor=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(descriptor);created=True
 except FileExistsError: created=False
 with sqlite3.connect(path,timeout=10) as db:
  db.execute('BEGIN IMMEDIATE')
  if created:
   db.execute('CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER,ceiling INTEGER,halted INTEGER)')
   db.execute('INSERT INTO budget VALUES(1,?,?,0)',(used_checkpoint,used_checkpoint))
  row=db.execute('SELECT used,ceiling,halted FROM budget WHERE id=1').fetchone()
  if row is None or any(type(value) is not int for value in row) or row[0]<0 or row[0]>row[1] or row[2] not in (0,1):
   raise ValueError('Existing ledger cannot be restored automatically')
  used=max(row[0],used_checkpoint)
  if ceiling<row[1] or ceiling<used: raise ValueError('Approval would reduce or invalidate an existing budget')
  db.execute('CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY,used_before INTEGER,ceiling_before INTEGER,used_after INTEGER,ceiling_after INTEGER,recorded_at TEXT DEFAULT CURRENT_TIMESTAMP)')
  if used!=row[0] or ceiling!=row[1]:
   db.execute('INSERT INTO approvals(used_before,ceiling_before,used_after,ceiling_after) VALUES(?,?,?,?)',(row[0],row[1],used,ceiling))
  db.execute('UPDATE budget SET used=?,ceiling=? WHERE id=1',(used,ceiling))
 return {'used':used,'ceiling':ceiling,'remaining':ceiling-used,'halted':bool(row[2]),'restoredFromCheckpoint':created}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--database',default='/workspace/scratch/task004-research/bis-cumulative.sqlite');args=parser.parse_args()
 approval=json.loads((Path(__file__).resolve().parents[1]/'src/data/bis-verification-budget.json').read_text())
 print(json.dumps(apply_approval(args.database,approval['usedCheckpoint'],approval['ceiling'])))
