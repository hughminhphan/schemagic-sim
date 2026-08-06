import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";
import { decodeCircuit, encodeCircuit } from "./share";

describe("share payload", () => {
  it("round-trips canonical circuit JSON through deflate-raw base64url", () => {
    const payload = encodeCircuit(demoCircuit);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCircuit(payload)).toEqual(demoCircuit);
  });
});
