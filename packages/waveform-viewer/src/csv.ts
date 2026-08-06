export interface CSVColumn {
  name: string;
  unit?: string;
  values: Float64Array;
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function exactNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  return Object.is(value, -0) ? "-0" : String(value);
}

export function columnsToCSV(columns: readonly CSVColumn[]): string {
  if (columns.length === 0) return "";
  const rowCount = Math.max(...columns.map((column) => column.values.length));
  const header = columns.map((column) => escapeCell(column.unit ? `${column.name} [${column.unit}]` : column.name)).join(",");
  const rows = [header];
  for (let row = 0; row < rowCount; row += 1) {
    rows.push(columns.map((column) => row < column.values.length ? exactNumber(column.values[row] ?? Number.NaN) : "").join(","));
  }
  return `${rows.join("\r\n")}\r\n`;
}
