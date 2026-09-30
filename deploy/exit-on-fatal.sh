#!/bin/sh
set -euo pipefail
printf 'READY\n'
read -r header
echo "exit-on-fatal: ${header}; stopping the container" >&2
kill -TERM "$(cat /tmp/supervisord.pid)"
