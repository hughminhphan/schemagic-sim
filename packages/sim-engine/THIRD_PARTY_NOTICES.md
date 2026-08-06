# Third-party notices

This Phase 1 package embeds `eecircuit-engine@1.7.0` and its ngspice WebAssembly payload. The dependency is interim and will be replaced by the project's pinned ngspice build before v0.1.0.

## EEcircuit Engine

Copyright 2023 to 2026 EEcircuit contributors.

License: MIT. The complete license text is distributed in `node_modules/eecircuit-engine/LICENSE` and in the npm package at <https://www.npmjs.com/package/eecircuit-engine/v/1.7.0>.

## ngspice

ngspice includes code derived from Berkeley SPICE, CIDER, XSPICE, and other contributors. The core simulator is distributed under the ngspice BSD license. Source and license materials are available at <https://ngspice.sourceforge.io/> and <https://sourceforge.net/projects/ngspice/files/ng-spice-rework/>.

The embedded engine reports ngspice 45.2+. The project plans to replace it with a pinned ngspice 46 build before v0.1.0.

## SPARSE

SPARSE is the sparse matrix package used by ngspice. Its notices and source are distributed with ngspice. See the ngspice source tree under `src/maths/sparse`.

## SuiteSparse KLU and numparam

The engine build includes SuiteSparse KLU and ngspice numparam components covered by the GNU Lesser General Public License. Corresponding source and license materials are available from the ngspice source distribution and SuiteSparse at <https://github.com/DrTimothyAldenDavis/SuiteSparse>.

This interim npm artifact does not provide relink materials. The project's own pre-v0.1.0 build must ship complete LGPL corresponding source and relink materials.

## Emscripten

The WebAssembly runtime and generated support code are produced with Emscripten. Emscripten is distributed under the MIT license and the University of Illinois/NCSA Open Source License. Source and license materials are available at <https://github.com/emscripten-core/emscripten>.
