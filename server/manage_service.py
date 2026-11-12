"""D-051 operator-only commands; never expose enrollment administration via HTTP."""
import argparse
import json
import os
from pathlib import Path
from service import ServiceAPI

parser = argparse.ArgumentParser()
parser.add_argument('--db', default=os.environ.get('FRIDGE_DB_PATH', '.stage0-service.sqlite3'))
commands = parser.add_subparsers(dest='command', required=True)
invite = commands.add_parser('invite')
invite.add_argument('--label', required=True)
invite.add_argument('--owner', help='Existing service owner for re-enrollment on the same account')
invite.add_argument('--output', required=True, help='Private output file; code is never printed to logs')
backup = commands.add_parser('backup')
backup.add_argument('--output', required=True)
revoke = commands.add_parser('revoke-sessions')
revoke.add_argument('--owner', required=True)
args = parser.parse_args()
Path(args.db).parent.mkdir(parents=True, exist_ok=True)
api = ServiceAPI(args.db)
if args.command == 'invite':
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive create prevents accidentally replacing another person's code.
    with target.open('x', encoding='utf-8') as stream:
        os.chmod(target, 0o600)
        value = api.invite(args.label, args.owner)
        json.dump(value, stream, ensure_ascii=False)
    print(f'Invitation saved to private file: {target}. Owner: {value["ownerId"]}')
elif args.command == 'backup':
    api.backup(args.output)
    print('Backup created and SQLite integrity checked')
else:
    with api.connect() as db:
        db.execute('DELETE FROM service_sessions WHERE owner=?', (args.owner,))
    print('Existing sessions revoked; stored purchase statistics retained')
