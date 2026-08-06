import type { SimulationDiagnostic, SimulationErrorCode } from "./types";

export function embeddedComponentAtLine(netlist: string, line: number): string | undefined {
  const sourceLine = netlist.split(/\r?\n/)[line - 1];
  return sourceLine?.match(/\$\s*component:([a-z0-9_-]+)/i)?.[1];
}

export function classifyEngineError(message: string): SimulationErrorCode {
  const text = message.toLowerCase();
  if (/converg|timestep too small|singular matrix|iteration limit/.test(text)) return "CONVERGENCE";
  if (/parse|syntax|unknown parameter|unknown device|model .* not found|fatal error in netlist/.test(text)) return "PARSE";
  if (/limit|too large|exceeds|timeout/.test(text)) return "LIMIT";
  return "ENGINE";
}

export function parseEngineDiagnostics(netlist: string, output: string): SimulationDiagnostic[] {
  const useful = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /error|warning|converg|singular|timestep|unknown|fatal/i.test(line));
  if (useful.length === 0) return [];
  return useful.slice(-12).map((message) => {
    const matchedLine = message.match(/(?:line|at line)\s+(\d+)/i);
    const netLine = matchedLine ? Number(matchedLine[1]) : undefined;
    const componentId = netLine ? embeddedComponentAtLine(netlist, netLine) : undefined;
    const stage = classifyEngineError(message) === "CONVERGENCE" ? "solve" as const : "parse" as const;
    return {
      stage,
      message: message.replace(/\$\s*component:[a-z0-9_-]+/gi, "").trim(),
      ...(netLine ? { netLine } : {}),
      ...(componentId ? { componentId } : {}),
    };
  });
}
