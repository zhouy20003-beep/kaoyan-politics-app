#!/bin/sh
set -eu

export NPM_CONFIG_REGISTRY='https://registry.npmjs.org/'

npm ci --registry='https://registry.npmjs.org/' --no-audit --no-fund
npm run build

cp run.sh dist/run.sh
chmod 755 dist/run.sh
