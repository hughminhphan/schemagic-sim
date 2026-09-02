# Third-party notices

Robonyx Simulator includes third-party software and font files. This file records the material distributed with the project and points to the authoritative engine notice bundle.

The Robonyx Simulator codebase itself is licensed under Apache-2.0. Component model packages carry their own MIT licences. Those project licences do not replace the third-party terms below.

## ngspice-46 WebAssembly engine

The distributed engine is built from ngspice-46, official tag commit `ebdaf58ec76a06ffaac7e0f138360dd1cf5ee4b6`, with runtime support emitted by Emscripten 5.0.7.

The authoritative engine notices are committed at:

- `tools/ngspice-wasm-build/notices/THIRD_PARTY_NOTICES.txt`
- `tools/ngspice-wasm-build/notices/COPYING`
- `tools/ngspice-wasm-build/notices/LGPL-2.1.txt`
- `tools/ngspice-wasm-build/notices/SOURCE.md`

The web distribution also carries these files under `apps/web/public/notices/` so users of the deployed application can read them.

### ngspice analog core and device models

Copyright (c) 2025 by ngspice team. All rights reserved.

Copyright 1985 - 2018, Regents of the University of California and others.

The ngspice analog core and device models are distributed under the modified BSD terms reproduced in the authoritative engine notice bundle and in the complete upstream `COPYING` file listed above. Those terms require retention of the copyright notice, licence conditions, and disclaimer, and prohibit endorsement without specific permission.

### SPARSE 1.3

Copyright (c) 1985,86,87,88,89,90 by Kenneth S. Kundert and the University of California.

Permission to use, copy, modify, and distribute this software and its documentation for any purpose and without fee is hereby granted, provided that the copyright notices appear in all copies and supporting documentation and that the authors and the University of California are properly credited. The authors and the University of California make no representations as to the suitability of this software for any purpose. It is provided `as is`, without express or implied warranty.

### KLU and bundled SuiteSparse components

KLU is derived from SuiteSparse 3.7.0. Copyright 2004-2009, Tim Davis. AMD portions name Timothy A. Davis, Patrick R. Amestoy, and Iain S. Duff.

The ngspice-46 `COPYING` file identifies all files in `src/maths/KLU` as LGPLv2. These components are distributed under GNU LGPL version 2.1 or later where stated by their source.

The complete LGPL 2.1 text is at `tools/ngspice-wasm-build/notices/LGPL-2.1.txt`. Corresponding source, exact upstream pins, the committed local patch set, build configuration, retained relink materials, and one-command rebuild instructions are described in `tools/ngspice-wasm-build/notices/SOURCE.md`. The executable build and modification inputs are committed at `tools/ngspice-wasm-build/build.sh` and `tools/ngspice-wasm-build/patches/`.

Recipients may reverse engineer the engine for the purpose of debugging modifications to the LGPL components. Modified LGPL components must be distributed under the applicable LGPL terms.

### numparam

Numparam: an add-on library for electronic circuit analysis front-ends.

Copyright (C) 2002 Georg Post.

Numparam is free software. It may be redistributed and modified under the GNU Lesser General Public License as published by the Free Software Foundation, either version 2 of the licence, or at the recipient's option, any later version. It is distributed without warranty.

The complete LGPL text and the same corresponding-source and rebuild path listed for KLU apply. See `tools/ngspice-wasm-build/notices/LGPL-2.1.txt` and `tools/ngspice-wasm-build/notices/SOURCE.md`.

### Emscripten runtime

The engine contains runtime support emitted by Emscripten 5.0.7. Emscripten is available under the MIT licence and the University of Illinois/NCSA Open Source License. Its bundled musl libc is MIT licensed.

Copyright (c) 2010-2014 Emscripten authors. See the Emscripten AUTHORS file.

The complete Emscripten MIT and University of Illinois/NCSA terms used for this distribution are reproduced in `tools/ngspice-wasm-build/notices/THIRD_PARTY_NOTICES.txt`. The upstream licence is also available at <https://github.com/emscripten-core/emscripten/blob/5.0.7/LICENSE>.

## Production JavaScript packages

The production dependency audit is recorded in `docs/LICENSING.md`. The following third-party npm packages are present in the production dependency tree.

### MIT-licensed packages

- Ajv 8.20.0, copyright (c) 2015-2021 Evgeny Poberezkin.
- ajv-formats 3.0.1, copyright (c) 2020 Evgeny Poberezkin.
- fast-deep-equal 3.1.3, copyright (c) 2017 Evgeny Poberezkin.
- json-schema-traverse 1.0.0, copyright (c) 2015-2021 Evgeny Poberezkin.
- require-from-string 2.0.2, copyright (c) Vsevolod Strukchinsky.
- fflate 0.8.2, copyright (c) 2023 Arjun Barrett.

The MIT terms for these packages are:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### fast-uri 3.1.5

Copyright (c) 2011-2021, Gary Court until <https://github.com/garycourt/uri-js/commit/a1acf730b4bba3f1097c9f52e7d9d3aba8cdcaae>.

Copyright (c) 2021-present The Fastify team <https://github.com/fastify/fastify#team>.

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. The names of any contributors may not be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES, INCLUDING PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES, LOSS OF USE, DATA, OR PROFITS, OR BUSINESS INTERRUPTION, HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT, INCLUDING NEGLIGENCE OR OTHERWISE, ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Bundled fonts

The web application bundles Archivo, IBM Plex Sans, and IBM Plex Mono font files.

- Archivo: copyright 2020 The Archivo Project Authors, <https://github.com/Omnibus-Type/Archivo>.
- IBM Plex Sans: copyright 2017 IBM Corp. All rights reserved.
- IBM Plex Mono: copyright 2017 IBM Corp. All rights reserved.

Each font is distributed under the SIL Open Font License, Version 1.1. Copies specific to each bundled font are included in `apps/web/public/fonts/`.

### SIL Open Font License, Version 1.1

Copyright holders retain their copyright in the Font Software.

Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:

1. Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.
2. Original or Modified Versions of the Font Software may be bundled, redistributed, and/or sold with any software, provided that each copy contains the copyright notice and this licence. These may be included as stand-alone text files, human-readable headers, or appropriate machine-readable metadata that users can view.
3. No Modified Version of the Font Software may use a Reserved Font Name unless the corresponding Copyright Holder gives explicit written permission. This restriction applies only to the primary font name presented to users.
4. The names of the Copyright Holders or Authors may not be used to promote, endorse, or advertise a Modified Version, except to acknowledge their contributions or with explicit written permission.
5. The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this licence. This requirement does not apply to documents created using the Font Software.

The licence becomes null and void if these conditions are not met.

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, INCLUDING GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

## KiCad symbol artwork

The schematic editor includes converted artwork from the official KiCad symbol libraries, pinned to commit `f0811ce7f108212a1305fce0dc1d164749cdf8c4` from <https://gitlab.com/kicad/libraries/kicad-symbols> and fetched on 2026-08-13.

The selected source symbols are distributed under the Creative Commons Attribution-ShareAlike 4.0 International licence (CC-BY-SA 4.0), with KiCad's exception for electronic designs and generated files. The exact source files, checksums, attribution, complete upstream licence notice, and exception are preserved under `packages/schematic-editor/vendor/kicad-symbols/`.

The KiCad libraries are compiled by the KiCad community and provided without warranty of any kind, express or implied.
