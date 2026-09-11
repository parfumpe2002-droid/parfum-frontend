#!/usr/bin/env bash
set -euo pipefail
BUILD_ID="${COMMIT_REF:-$(date +%s)}"
sed -i "s/__BUILD_ID__/${BUILD_ID}/g" public_html/service-worker.js
echo "Parfum PWA build: ${BUILD_ID}"
