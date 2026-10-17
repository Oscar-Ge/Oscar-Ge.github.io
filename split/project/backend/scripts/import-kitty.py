"""Read a Kittysplit export without changing it; emit the initial ledger."""
import json,sys
from collections import Counter
from decimal import Decimal,ROUND_HALF_UP
from pathlib import Path
import openpyxl
SCALE=1_000_000
rows=list(openpyxl.load_workbook(sys.argv[1],data_only=True).active.values)
h=next(i for i,r in enumerate(rows) if r[:3]==('Date','Who paid','Type'))
names=list(rows[h][6:-1]);entries=[]
for i in range(h+1,len(rows)):
 r=rows[i]
 if not hasattr(r[0],'strftime'):break
 assert r[4]=='USD' and r[2] in ('Expense','Income')
 cents=int((Decimal(str(r[3]))*100).quantize(Decimal(1),rounding=ROUND_HALF_UP))
 shares={n:int((Decimal(str(r[6+j] or 0))*100*SCALE).quantize(Decimal(1),rounding=ROUND_HALF_UP)) for j,n in enumerate(names)}
 delta=cents*SCALE-sum(shares.values());assert abs(delta)<=len(names)
 shares[next(n for n,a in shares.items() if a>0)]+=delta
 entries.append(dict(id=f'kitty-r{i+1}',kind=r[2].lower(),date=r[0].strftime('%Y-%m-%d'),payerId=r[1],amountCents=cents,description=str(r[5] or ''),shares=shares,splitMode='imported',category='other',notes=str(r[-1] or ''),sourceRow=i+1,deletedAt=None))
h=next(i for i,r in enumerate(rows) if r[:3]==('Date','Paid by','Paid to'))
for i in range(h+1,len(rows)):
 r=rows[i]
 if not hasattr(r[0],'strftime'):break
 assert r[4]=='USD'
 cents=int((Decimal(str(r[3]))*100).quantize(Decimal(1),rounding=ROUND_HALF_UP))
 entries.append(dict(id=f'kitty-r{i+1}',kind='transfer',date=r[0].strftime('%Y-%m-%d'),payerId=r[1],payeeId=r[2],amountCents=cents,description=str(r[5] or 'Settlement'),shares={},splitMode='transfer',category='transfer',notes=str(r[6] or ''),sourceRow=i+1,deletedAt=None))
balances={n:0 for n in names}
for e in entries:
 sign=-1 if e['kind']=='income' else 1
 balances[e['payerId']]+=sign*e['amountCents']*SCALE
 if e['kind']=='transfer':balances[e['payeeId']]-=e['amountCents']*SCALE
 else:
  for n,a in e['shares'].items():balances[n]-=sign*a
expected={};h=next(i for i,r in enumerate(rows) if r[0]=='Participant' and r[1]=='Total shares')
for r in rows[h+1:h+1+len(names)]:expected[r[0]]=int((Decimal(str(r[6]))*100).quantize(Decimal(1),rounding=ROUND_HALF_UP))
actual={n:int((Decimal(u)/SCALE).quantize(Decimal(1),rounding=ROUND_HALF_UP)) for n,u in balances.items()}
assert actual==expected,(actual,expected)
counts=dict(Counter(e['kind'] for e in entries));total=sum(e['amountCents'] for e in entries if e['kind']=='expense')
assert len(entries)==344 and total==3524121
book=dict(schemaVersion=1,id='d6',title='d6',currency='USD',members=[dict(id=n,name=('wenchao zhang' if n=='zhao' else n),active=True) for n in names],entries=entries,importInfo=dict(file=Path(sys.argv[1]).name,counts=counts,expectedBalances=expected,totalExpenseCents=total))
book['rentRule']=dict(enabled=True,startMonth='2026-11',payerId='ge',memberIds=dict(yuan='yuan',zhang='zhao',xu='xu',ge='ge'))
p=Path(sys.argv[2]);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(book,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(records=len(entries),counts=counts,totalExpenseCents=total,balances=actual)))
