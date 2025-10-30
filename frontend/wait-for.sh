#!/usr/bin/env bash
# wait-for.sh
# Usage: ./wait-for.sh host:port -- command args...

set -e

hostport="$1"
shift

host="${hostport%:*}"
port="${hostport#*:}"

echo "⏳ Waiting for $host:$port to be ready..."

while ! nc -z "$host" "$port"; do
  sleep 1
done

echo "✅ $host:$port is up — starting app"
exec "$@"
