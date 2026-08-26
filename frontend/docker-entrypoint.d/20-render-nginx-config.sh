#!/bin/sh
set -eu

export PORT="${PORT:-80}"
export BACKEND_URL="${BACKEND_URL:-http://backend:8000}"
export NGINX_RESOLVER="${NGINX_RESOLVER:-127.0.0.11}"

envsubst '${PORT} ${BACKEND_URL} ${NGINX_RESOLVER}' \
  < /etc/nginx/templates-src/default.conf.template \
  > /etc/nginx/conf.d/default.conf
