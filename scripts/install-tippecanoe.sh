#!/bin/sh
# Build pinned BSD-2-Clause tool locally. Requires make, g++, sqlite3 and zlib headers.
set -eu
cd "$(dirname "$0")/.."
mkdir -p .tools
if [ ! -d .tools/tippecanoe ]; then
  git clone --depth 1 --branch 2.79.0 https://github.com/felt/tippecanoe.git .tools/tippecanoe
fi
expected=68ab8dcc229f95b8b25877697d5e8d66783af503
[ "$(git -C .tools/tippecanoe rev-parse HEAD)" = "$expected" ]
make -C .tools/tippecanoe -j4
