#!/usr/bin/env bash
set -euo pipefail

backup_path="${1:?backup path required}"
drill="/tmp/tutela-restore-drill-20260918"
port="55439"

test -f "$backup_path"
test ! -e "$drill"
mkdir -p "$drill/pkg" "$drill/socket"
cd "$drill"
apt-get download postgresql-17 >/dev/null
deb="$(find "$drill" -maxdepth 1 -name 'postgresql-17_*.deb' -print -quit)"
test -n "$deb"
dpkg-deb -x "$deb" "$drill/pkg"
bin="$drill/pkg/usr/lib/postgresql/17/bin"

"$bin/initdb" -D "$drill/data" --auth=trust --no-locale -E UTF8 >/dev/null
"$bin/pg_ctl" -D "$drill/data" -l "$drill/postgres.log" \
  -o "-h 127.0.0.1 -p $port -k $drill/socket" start >/dev/null
cleanup() {
  "$bin/pg_ctl" -D "$drill/data" stop -m fast >/dev/null 2>&1 || true
}
trap cleanup EXIT

/usr/bin/createdb -h 127.0.0.1 -p "$port" tutela_restore
sudo cp "$backup_path" "$drill/source.dump"
sudo chown "$(id -u):$(id -g)" "$drill/source.dump"
/usr/bin/pg_restore --exit-on-error --no-owner --no-acl \
  -h 127.0.0.1 -p "$port" -d tutela_restore "$drill/source.dump"
echo RESTORE_SUCCEEDED

/usr/bin/psql -h 127.0.0.1 -p "$port" -d tutela_restore -At <<'SQL'
SELECT 'journal=' || count(*) FROM public.tutela_migration_journal;
SELECT 'users=' || count(*) FROM public.users;
SELECT 'offers=' || count(*) FROM public.offers;
SELECT 'orders=' || count(*) FROM public.orders;
SELECT 'contracts=' || count(*) FROM public.contracts;
SELECT 'latest_migration=' || migration_identifier
FROM public.tutela_migration_journal
WHERE execution_status = 'succeeded'
ORDER BY execution_timestamp DESC NULLS LAST, recorded_at DESC
LIMIT 1;
SELECT 'invalid_order_contract_links=' || count(*)
FROM public.contracts contract
LEFT JOIN public.orders source ON source.id = contract.order_id
WHERE source.id IS NULL;
SQL

cleanup
trap - EXIT
echo RESTORE_DRILL_STOPPED
