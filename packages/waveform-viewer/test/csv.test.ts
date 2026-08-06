import { describe, expect, it } from "vitest";
import { columnsToCSV } from "../src/csv";

describe("CSV export", () => {
  it("exports exact samples with units and CRLF rows", () => {
    const csv = columnsToCSV([
      { name: "time", unit: "s", values: Float64Array.from([0, 0.000001, 0.2]) },
      { name: "V(out)", unit: "V", values: Float64Array.from([1 / 3, -0, Infinity]) },
    ]);
    expect(csv).toBe("time [s],V(out) [V]\r\n0,0.3333333333333333\r\n0.000001,-0\r\n0.2,Infinity\r\n");
  });

  it("quotes headers containing commas", () => {
    expect(columnsToCSV([{ name: "V(a,b)", unit: "V", values: Float64Array.from([1]) }]))
      .toBe('"V(a,b) [V]"\r\n1\r\n');
  });
});
