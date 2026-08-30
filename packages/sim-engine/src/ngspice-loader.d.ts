declare module "*.mjs" {
  export const ENGINE_VERSION: "ngspice-46-opencircuit-wasm1";
  export const NGSPICE_VERSION: "ngspice-46";
  export interface NgspiceRunResult {
    rawfile: Uint8Array;
    integratedRawfile?: Uint8Array;
    stdout: string;
    stderr: string;
    timingMs: number;
  }
  export interface NgspiceEngine {
    runNetlist(netlist: string): Promise<NgspiceRunResult>;
    runNoiseNetlist(netlist: string): Promise<NgspiceRunResult>;
    getInitInfo(): string;
    readonly memoryBytes: number;
  }
  export function createNgspiceEngine(): Promise<NgspiceEngine>;
}
