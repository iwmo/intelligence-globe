#!/bin/sh
set -eu

export PORT="${PORT:-80}"
export BACKEND_URL="${BACKEND_URL:-http://backend:8000}"

envsubst '${PORT} ${BACKEND_URL}' \
  < /etc/nginx/templates-src/default.conf.template \
  > /etc/nginx/conf.d/default.conf
