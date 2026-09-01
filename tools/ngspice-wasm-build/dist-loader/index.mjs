import createNgspiceModule from "../dist/ngspice.mjs";

export const ENGINE_VERSION = "ngspice-46-opencircuit-wasm1";
export const NGSPICE_VERSION = "ngspice-46";

const debug = (...values) => {
  if (typeof process !== "undefined" && process.env?.OPEN_CIRCUIT_NGSPICE_DEBUG) {
    console.error("[ngspice-wasm]", ...values);
  }
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function nodeWasmBinary() {
  if (typeof process === "undefined" || !process.versions?.node) return undefined;
  const nodeFsPromises = "node:fs/promises";
  const nodeUrl = "node:url";
  const [{ readFile }, { fileURLToPath }] = await Promise.all([
    import(/* @vite-ignore */ nodeFsPromises),
    import(/* @vite-ignore */ nodeUrl),
  ]);
  return readFile(fileURLToPath(new URL("../dist/ngspice.wasm", import.meta.url)));
}

export class NgspiceEngine {
  #moduleFactory;
  #module = null;
  #initPromise = null;
  #ready = deferred();
  #readyReached = false;
  #commandWaiter = null;
  #commands = [];
  #active = null;
  #stdout = [];
  #stderr = [];
  #initInfo = "";
  #initTimingMs = 0;
  #mainError = null;

  constructor(options = {}) {
    this.#moduleFactory = options.moduleFactory ?? createNgspiceModule;
  }

  async init() {
    if (this.#module) return this;
    if (!this.#initPromise) this.#initPromise = this.#initInternal();
    return this.#initPromise;
  }

  async #initInternal() {
    const started = performance.now();
    const wasmBinary = await nodeWasmBinary();
    const wasmUrl = new URL("../dist/ngspice.wasm", import.meta.url);
    this.#module = await this.#moduleFactory({
      noInitialRun: true,
      wasmBinary,
      locateFile: (path) => path.endsWith(".wasm") ? wasmUrl.href : path,
      print: (line = "") => {
        this.#stdout.push(String(line));
        debug("stdout", line);
      },
      printErr: (line = "") => {
        this.#stderr.push(String(line));
        debug("stderr", line);
      },
      opencircuitNextCommand: () => this.#nextCommand(),
    });

    this.#module.FS.writeFile("/spinit", "* OpenCircuit ngspice init file\n");
    this.#module.FS.writeFile(
      "/proc/meminfo",
      "MemTotal: 65536 kB\nMemFree: 65536 kB\nMemAvailable: 65536 kB\n",
    );

    try {
      const mainResult = this.#module.callMain(["-i"]);
      Promise.resolve(mainResult).catch((error) => this.#failMain(error));
    } catch (error) {
      this.#failMain(error);
    }

    await this.#ready.promise;
    if (this.#mainError) throw this.#mainError;
    this.#initInfo = [...this.#stdout, ...this.#stderr].join("\n");
    this.#initTimingMs = performance.now() - started;
    return this;
  }

  async #nextCommand() {
    debug("boundary", { queued: this.#commands.length, active: Boolean(this.#active) });
    if (!this.#readyReached) {
      this.#readyReached = true;
      this.#ready.resolve();
    } else if (this.#active && this.#commands.length === 0) {
      const active = this.#active;
      this.#active = null;
      try {
        const rawfile = active.readRaw ? new Uint8Array(this.#module.FS.readFile("/out.raw")) : null;
        const extraRawfiles = Object.fromEntries((active.extraRawPaths ?? []).map((path) => [path, new Uint8Array(this.#module.FS.readFile(path))]));
        active.resolve({
          rawfile,
          extraRawfiles,
          stdout: this.#stdout.join("\n"),
          stderr: this.#stderr.join("\n"),
          timingMs: performance.now() - active.started,
        });
      } catch (error) {
        active.reject(error);
      }
    }

    while (this.#commands.length === 0) {
      this.#commandWaiter = deferred();
      await this.#commandWaiter.promise;
      this.#commandWaiter = null;
      if (this.#mainError) throw this.#mainError;
    }

    const command = this.#commands.shift();
    debug("command", command);
    return command;
  }

  #failMain(error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    debug("main failure", normalized);
    this.#mainError = normalized;
    if (!this.#readyReached) this.#ready.reject(normalized);
    if (this.#active) {
      this.#active.reject(normalized);
      this.#active = null;
    }
    this.#commandWaiter?.resolve();
  }

  async #execute(commands, { readRaw = false, extraRawPaths = [], prepare } = {}) {
    await this.init();
    if (this.#mainError) throw this.#mainError;
    if (this.#active) throw new Error("ngspice is already running");
    this.#stdout = [];
    this.#stderr = [];
    prepare?.();
    this.#commands = [...commands];
    const completion = deferred();
    this.#active = { ...completion, readRaw, extraRawPaths, started: performance.now() };
    this.#commandWaiter?.resolve();
    return completion.promise;
  }

  async runNetlist(netlist) {
    if (typeof netlist !== "string" || netlist.trim() === "") {
      throw new TypeError("runNetlist requires a non-empty netlist string");
    }
    return this.#execute([
      "source /input.cir",
      "destroy all",
      "run",
      "set filetype=binary",
      "write /out.raw",
    ], {
      readRaw: true,
      prepare: () => {
        try {
          this.#module.FS.unlink("/out.raw");
        } catch (error) {
          if (error?.errno !== 44) throw error;
        }
        this.#module.FS.writeFile("/input.cir", netlist);
      },
    });
  }

  async runNoiseNetlist(netlist) {
    if (typeof netlist !== "string" || netlist.trim() === "") {
      throw new TypeError("runNoiseNetlist requires a non-empty netlist string");
    }
    const integratedPath = "/noise-integrated.raw";
    const result = await this.#execute([
      "source /input.cir",
      "destroy all",
      "run",
      "set filetype=binary",
      "setplot noise1",
      "write /out.raw",
      "setplot noise2",
      `write ${integratedPath}`,
    ], {
      readRaw: true,
      extraRawPaths: [integratedPath],
      prepare: () => {
        for (const path of ["/out.raw", integratedPath]) {
          try {
            this.#module.FS.unlink(path);
          } catch (error) {
            if (error?.errno !== 44) throw error;
          }
        }
        this.#module.FS.writeFile("/input.cir", netlist);
      },
    });
    return { ...result, integratedRawfile: result.extraRawfiles[integratedPath] };
  }

  run(netlist) {
    return this.runNetlist(netlist);
  }

  async reset() {
    if (!this.#module) return;
    await this.#execute(["destroy all", "reset"]);
    for (const path of ["/input.cir", "/out.raw", "/noise-integrated.raw"]) {
      try {
        this.#module.FS.unlink(path);
      } catch (error) {
        if (error?.errno !== 44) throw error;
      }
    }
  }

  get initTimingMs() {
    return this.#initTimingMs;
  }

  get memoryBytes() {
    return this.#module?.getWasmMemoryBytes?.() ?? 0;
  }

  getInitInfo() {
    return this.#initInfo;
  }

  get moduleForTests() {
    return this.#module;
  }
}

export async function createNgspiceEngine(options) {
  const engine = new NgspiceEngine(options);
  await engine.init();
  return engine;
}

export default createNgspiceEngine;
