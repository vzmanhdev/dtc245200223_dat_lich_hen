#!/bin/sh
# Runs beside the Nginx master in its own container; no cross-container PID namespace.
set -eu
rotate_once() {
    if [ -f /logs/access.log ] && [ "$(wc -c < /logs/access.log)" -gt "${LOG_MAX_BYTES:-10485760}" ]; then
        [ ! -f /logs/access.log.1 ] || mv /logs/access.log.1 /logs/access.log.2
        mv /logs/access.log /logs/access.log.1
        kill -USR1 1
    fi
}
if [ "${1:-}" = '--once' ]; then
    rotate_once
else
    while sleep 60; do rotate_once; done
fi
