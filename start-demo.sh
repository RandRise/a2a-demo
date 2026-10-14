#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -d node_modules/@a2a-js/sdk ]; then
  echo 'First run: run npm ci in this folder.'
  exit 1
fi
echo 'Open http://127.0.0.1:8780 after the server starts.'
exec npm start
