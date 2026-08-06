# Corresponding source and rebuild information

## Pins

- ngspice release: `ngspice-46`
- official tag commit: `ebdaf58ec76a06ffaac7e0f138360dd1cf5ee4b6`
- official source archive: <https://downloads.sourceforge.net/project/ngspice/ng-spice-rework/46/ngspice-46.tar.gz>
- SHA-256: `a0d1699af1940b06649276dcd6ff5a566c8c0cad01b2f7b5e99dedbb4d64c19b`
- release Emscripten SDK: `5.0.7`, emcc commit `263db4cffa6f9fc2ec514a70abac81362ea41849`
- Emscripten SDK source: <https://github.com/emscripten-core/emsdk/tree/5.0.7>
- Homebrew bootstrap installation observed during development: `emcc 6.0.5-git`

The upstream tarball is not stored in this repository. `build.sh` downloads it into the ignored `build/` directory and rejects any archive whose SHA-256 does not match the value above.

## OpenCircuit modifications

The complete modification set is:

- `patches/0001-async-command-boundary.patch`: replaces interactive stdin only under Emscripten with an Asyncify command-return bridge at ngspice's frontend input boundary.
- `dist-loader/index.mjs`: supplies commands, captures output, writes netlists to MEMFS, and copies binary rawfile bytes out of MEMFS.

No ngspice source file is replaced. XSPICE, OSDI, CIDER, PSS, tclspice, readline, editline, FFTW3, X11, and shared-library targets are disabled by the configure profile. KLU, SPARSE, numparam, and S-parameter analysis remain included.

## One-command rebuild and relink

Requirements are Git, curl, patch, tar, a POSIX shell, make, autoconf tooling, and Python. On macOS, Homebrew's `emscripten` package was installed as a bootstrap check, but the release build does not depend on Homebrew's moving version.

From this directory run:

```sh
bash build.sh
```

`build.sh` performs these reproducible steps:

1. clones and activates Emscripten SDK 5.0.7 under ignored `build/emsdk/`;
2. downloads and verifies the official ngspice-46 archive;
3. extracts a clean source tree and applies every patch in the declared patch set;
4. configures a static cross-build with KLU and the recorded exclusions;
5. compiles all intermediate objects and static libraries under ignored `build/obj/`;
6. relinks the CLI with Asyncify, a 64 MiB initial heap, a 256 MiB maximum heap, MEMFS, ESM output, and a separate WebAssembly file;
7. writes `dist/ngspice.mjs` and `dist/ngspice.wasm`, then runs the smoke test.

To modify or replace KLU or numparam, edit the verified source under `build/ngspice-46/` after extraction, or add another committed patch, then rerun the configure, make, and final relink commands recorded in `build.sh`. The retained `build/obj/` tree contains the intermediate objects and static libraries for a direct relink. Deleting `build/` and rerunning `bash build.sh` reconstructs those materials from corresponding source.

Set `USE_SYSTEM_EMCC=1` only for development experiments. Release artifacts must be built with the default pinned Emscripten 5.0.7 path.

The generated ngspice engine and LGPL components may be reverse engineered for the purpose of debugging modifications to those LGPL components.
