#!/usr/bin/env bash
set -euo pipefail

: "${NGSPICE_PREFIX:?Set NGSPICE_PREFIX to the installation directory}"

SOURCE_URL="https://downloads.sourceforge.net/project/ngspice/ng-spice-rework/old-releases/46/ngspice-46.tar.gz"
SOURCE_SHA256="a0d1699af1940b06649276dcd6ff5a566c8c0cad01b2f7b5e99dedbb4d64c19b"
BUILD_ROOT="$(mktemp -d /tmp/schemagic-ngspice46.XXXXXX)"
SOURCE_ARCHIVE="$BUILD_ROOT/ngspice-46.tar.gz"
SOURCE_DIR="$BUILD_ROOT/ngspice-46"
OBJECT_DIR="$BUILD_ROOT/obj"
BUILD_JOBS="${JOBS:-$(nproc)}"

curl -fL --retry 3 --connect-timeout 30 "$SOURCE_URL" -o "$SOURCE_ARCHIVE"
printf '%s  %s\n' "$SOURCE_SHA256" "$SOURCE_ARCHIVE" | sha256sum -c -
tar -xzf "$SOURCE_ARCHIVE" -C "$BUILD_ROOT"
mkdir -p "$OBJECT_DIR"

cd "$OBJECT_DIR"
CFLAGS="-O2 -DNDEBUG" "$SOURCE_DIR/configure" \
  --prefix="$NGSPICE_PREFIX" \
  --enable-static \
  --disable-shared \
  --enable-klu \
  --disable-debug \
  --disable-openmp \
  --disable-xspice \
  --disable-osdi \
  --disable-cider \
  --disable-pss \
  --without-tcl \
  --without-x \
  --with-readline=no \
  --with-editline=no \
  --with-fftw3=no
make -j"$BUILD_JOBS"
make install

VERSION_OUTPUT="$("$NGSPICE_PREFIX/bin/ngspice" --version 2>&1)"
printf '%s\n' "$VERSION_OUTPUT"
grep -q 'ngspice-46' <<< "$VERSION_OUTPUT"
grep -q 'Compiled with KLU Direct Linear Solver' <<< "$VERSION_OUTPUT"
