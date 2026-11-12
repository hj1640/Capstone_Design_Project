"""Counterexample for the superseded community heuristic, never a food-duration benchmark."""
from pathlib import Path
import tempfile
from synthetic_trust_fixture import Sandbox, experimental_policy

with tempfile.TemporaryDirectory() as folder:
    results=[]
    for index,values in enumerate(([9,10,11,15,16],[16,15,11,10,9])):
        sandbox=Sandbox(Path(folder)/f'{index}.sqlite3',experimental_policy(minimum=5,publish=True))
        for owner,value in enumerate(values): entry=sandbox.add(owner,value)
        stats=sandbox.stats(entry['group'])
        results.append((stats['mean'],stats['qualifying_contributors'],bool(sandbox.rules())))
        print(dict(input=values,mean=stats['mean'],qualifying=stats['qualifying_contributors'],published=bool(sandbox.rules())))
    assert results[0][1:] == (5,True)
    assert results[1][1:] == (4,False)
    assert results[0][0] != results[1][0]
    print('PASS: order-dependent legacy-policy counterexample reproduced; the policy remains disabled.')
