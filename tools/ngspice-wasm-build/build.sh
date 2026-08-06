#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
BUILD_DIR="$ROOT/build"
DIST_DIR="$ROOT/dist"
SOURCE_URL="https://downloads.sourceforge.net/project/ngspice/ng-spice-rework/46/ngspice-46.tar.gz"
SOURCE_SHA256="a0d1699af1940b06649276dcd6ff5a566c8c0cad01b2f7b5e99dedbb4d64c19b"
EMSDK_VERSION="5.0.7"
EMSDK_DIR="$BUILD_DIR/emsdk"
TARBALL="$BUILD_DIR/ngspice-46.tar.gz"
SOURCE_DIR="$BUILD_DIR/ngspice-46"
OBJ_DIR="$BUILD_DIR/obj"
JOBS=${JOBS:-$(sysctl -n hw.logicalcpu 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || printf '4')}

mkdir -p "$BUILD_DIR" "$DIST_DIR"

if [[ ${USE_SYSTEM_EMCC:-0} == 1 ]]; then
  command -v emcc >/dev/null || { printf 'emcc not found\n' >&2; exit 1; }
else
  if [[ ! -d "$EMSDK_DIR/.git" ]]; then
    git clone --depth 1 --branch "$EMSDK_VERSION" https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
  fi
  "$EMSDK_DIR/emsdk" install "$EMSDK_VERSION"
  "$EMSDK_DIR/emsdk" activate "$EMSDK_VERSION"
  # emsdk_env.sh sets the pinned compiler, Node, Python, and Binaryen paths.
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
fi

EMCC_VERSION=$(emcc --version | sed -n '1p')
if [[ ${USE_SYSTEM_EMCC:-0} != 1 && "$EMCC_VERSION" != *" $EMSDK_VERSION "* ]]; then
  printf 'expected Emscripten %s, got: %s\n' "$EMSDK_VERSION" "$EMCC_VERSION" >&2
  exit 1
fi
printf '%s\n' "$EMCC_VERSION" > "$DIST_DIR/EMSCRIPTEN_VERSION.txt"

if [[ ! -f "$TARBALL" ]]; then
  curl -fL --retry 3 --connect-timeout 30 "$SOURCE_URL" -o "$TARBALL"
fi
ACTUAL_SHA256=$(shasum -a 256 "$TARBALL" | cut -d' ' -f1)
if [[ "$ACTUAL_SHA256" != "$SOURCE_SHA256" ]]; then
  printf 'ngspice source hash mismatch: expected %s, got %s\n' "$SOURCE_SHA256" "$ACTUAL_SHA256" >&2
  exit 1
fi

rm -rf "$SOURCE_DIR" "$OBJ_DIR"
tar -xzf "$TARBALL" -C "$BUILD_DIR"
patch -d "$SOURCE_DIR" -p1 < "$ROOT/patches/0001-async-command-boundary.patch"
mkdir -p "$OBJ_DIR"

export CFLAGS="-O3 -DNDEBUG -DEMSCRIPTEN"
export CPPFLAGS=""
export LDFLAGS="-O3"

cd "$OBJ_DIR"
emconfigure "$SOURCE_DIR/configure" \
  --host=wasm32-unknown-emscripten \
  --enable-static \
  --disable-shared \
  --disable-debug \
  --disable-openmp \
  --disable-xspice \
  --disable-osdi \
  --disable-cider \
  --disable-pss \
  --without-tcl \
  --with-readline=no \
  --with-editline=no \
  --with-fftw3=no \
  --without-x \
  --enable-klu \
  ac_cv_prog_cc_cross=yes \
  ac_cv_func_malloc_0_nonnull=yes \
  ac_cv_func_realloc_0_nonnull=yes

CONFIG_H="$OBJ_DIR/src/include/ngspice/config.h"
grep -q '^#define KLU ' "$CONFIG_H"
grep -q '^/\* #undef XSPICE \*/' "$CONFIG_H"
grep -q '^/\* #undef OSDI \*/' "$CONFIG_H"
grep -q '^/\* #undef CIDER \*/' "$CONFIG_H"
grep -q '^/\* #undef TCL_MODULE \*/' "$CONFIG_H"
grep -q '^/\* #undef WITH_PSS \*/' "$CONFIG_H"
grep -q '^/\* #undef HAVE_GNUREADLINE \*/' "$CONFIG_H"
grep -q '^/\* #undef HAVE_BSDEDITLINE \*/' "$CONFIG_H"
grep -q '^/\* #undef HAVE_LIBFFTW3 \*/' "$CONFIG_H"
grep -q '^#define X_DISPLAY_MISSING 1' "$CONFIG_H"

# Build every static dependency first, then assert required solver and analysis objects exist.
emmake make -j"$JOBS"
test -f "$OBJ_DIR/src/maths/KLU/libKLU_real_la-klu_factor.lo"
test -f "$OBJ_DIR/src/maths/sparse/spfactor.lo"
test -f "$OBJ_DIR/src/frontend/numparam/spicenum.lo"
test -f "$OBJ_DIR/src/spicelib/analysis/span.lo"
test -f "$OBJ_DIR/src/spicelib/analysis/spsetp.lo"
rm -f "$OBJ_DIR/src/ngspice" "$OBJ_DIR/src/ngspice.wasm"

LINK_FLAGS=(
  -O3
  -sASYNCIFY=1
  -sASYNCIFY_IGNORE_INDIRECT=0
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=web,worker,node
  "-sEXPORTED_RUNTIME_METHODS=['FS','callMain','stringToNewUTF8']"
  -sALLOW_MEMORY_GROWTH=1
  -sINITIAL_MEMORY=67108864
  -sMAXIMUM_MEMORY=268435456
  -sSTACK_SIZE=1048576
  -sEXIT_RUNTIME=0
  -sFILESYSTEM=1
  "--post-js=$ROOT/scripts/post.js"
)

emmake make -C "$OBJ_DIR/src" ngspice LDFLAGS="${LINK_FLAGS[*]}"

cp "$OBJ_DIR/src/ngspice" "$DIST_DIR/ngspice.mjs"
cp "$OBJ_DIR/src/ngspice.wasm" "$DIST_DIR/ngspice.wasm"
cp "$SOURCE_DIR/COPYING" "$ROOT/notices/COPYING"
printf '%s\n' "ngspice-46" > "$DIST_DIR/NGSPICE_VERSION.txt"

node "$ROOT/scripts/smoke.mjs"
printf 'Built %s and %s\n' "$DIST_DIR/ngspice.mjs" "$DIST_DIR/ngspice.wasm"
