import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  POWER_ADI_EVIDENCE_SOURCES,
  capturePowerAdiEvidence,
  createPowerAdiEvidenceReceipt,
  verifyPowerAdiEvidenceReceipt,
} from "../scripts/capture-adi-evidence.mjs";

const capturedAt = "2026-08-24T03:00:00.000Z";

function sourceBytes(source) {
  if (source.kind === "manufacturer_datasheet") {
    return new TextEncoder().encode(`%PDF-1.7\n${source.identityMarker}\n${"0".repeat(1100)}\n%%EOF\n`);
  }
  return new TextEncoder().encode(`<html><title>${source.identityMarker} | Analog Devices</title><body>${"x".repeat(1100)}</body></html>`);
}

function captureSet() {
  return POWER_ADI_EVIDENCE_SOURCES.map((source) => ({
    id: source.id,
    bytes: sourceBytes(source),
    contentType: `${source.contentType}${source.contentType === "text/html" ? "; charset=utf-8" : ""}`,
    finalUrl: source.url,
  }));
}

function fetchFixture(url) {
  const source = POWER_ADI_EVIDENCE_SOURCES.find((entry) => entry.url === url);
  const bytes = sourceBytes(source);
  return Promise.resolve({
    ok: true,
    status: 200,
    url: source.url,
    headers: { get: () => source.contentType },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
}

describe("Power ADI exact-byte evidence capture", () => {
  it("writes and exactly replays a deterministic six-source receipt outside the repository", async () => {
    const parent = await mkdtemp(join(tmpdir(), "power-adi-capture-test-"));
    const output = join(parent, "capture");
    const receipt = await capturePowerAdiEvidence({ outputDirectory: output, fetchImpl: fetchFixture, capturedAt });
    expect(receipt).toEqual(createPowerAdiEvidenceReceipt(captureSet(), capturedAt));
    expect(receipt.sources.map((source) => source.id)).toEqual(POWER_ADI_EVIDENCE_SOURCES.map((source) => source.id));
    expect(receipt.sources.every((source) => /^sha256:[0-9a-f]{64}$/.test(source.contentHash))).toBe(true);
    expect(JSON.parse(await readFile(join(output, "power-adi-evidence-capture.json"), "utf8"))).toEqual(receipt);
    await expect(verifyPowerAdiEvidenceReceipt(join(output, "power-adi-evidence-capture.json"))).resolves.toEqual({
      status: "verified_exact_bytes",
      capturedAt,
      sources: receipt.sources.map(({ id, contentHash, byteLength, sourceUrl }) => ({ id, contentHash, byteLength, sourceUrl })),
    });
  });

  it("fails closed on redirect, media, identity, tamper, duplicate-output, and repository-output drift", async () => {
    const unofficial = captureSet();
    unofficial[0] = { ...unofficial[0], finalUrl: "https://www.analog.com.example.invalid/en/products/lt8640s.html" };
    expect(() => createPowerAdiEvidenceReceipt(unofficial, capturedAt)).toThrow(/final_url_not_official_analog_devices/);

    const changedPath = captureSet();
    changedPath[0] = { ...changedPath[0], finalUrl: "https://www.analog.com/en/products/lt8640s.html?alternate=1" };
    expect(() => createPowerAdiEvidenceReceipt(changedPath, capturedAt)).toThrow(/final_url_path_mismatch/);

    const alternatePort = captureSet();
    alternatePort[0] = { ...alternatePort[0], finalUrl: "https://www.analog.com:8443/en/products/lt8640s.html" };
    expect(() => createPowerAdiEvidenceReceipt(alternatePort, capturedAt)).toThrow(/final_url_not_official_analog_devices/);

    const wrongMedia = captureSet();
    wrongMedia[1] = { ...wrongMedia[1], contentType: "text/html" };
    expect(() => createPowerAdiEvidenceReceipt(wrongMedia, capturedAt)).toThrow(/content_type_mismatch/);

    const wrongIdentity = captureSet();
    wrongIdentity[1] = { ...wrongIdentity[1], bytes: new TextEncoder().encode(`%PDF-1.7\n${"0".repeat(1100)}\n%%EOF\n`) };
    expect(() => createPowerAdiEvidenceReceipt(wrongIdentity, capturedAt)).toThrow(/pdf_identity_mismatch/);

    const wrongHtmlIdentity = captureSet();
    wrongHtmlIdentity[0] = { ...wrongHtmlIdentity[0], bytes: new TextEncoder().encode(`<html><body>Analog Devices ${"x".repeat(1100)}</body></html>`) };
    expect(() => createPowerAdiEvidenceReceipt(wrongHtmlIdentity, capturedAt)).toThrow(/html_identity_mismatch/);

    const parent = await mkdtemp(join(tmpdir(), "power-adi-capture-tamper-"));
    const output = join(parent, "capture");
    await capturePowerAdiEvidence({ outputDirectory: output, fetchImpl: fetchFixture, capturedAt });
    await expect(capturePowerAdiEvidence({ outputDirectory: output, fetchImpl: fetchFixture, capturedAt })).rejects.toThrow(/output_directory_must_not_exist/);
    await writeFile(join(output, "adi-ltc3895.datasheet.pdf"), new TextEncoder().encode(`%PDF-1.7\nLTC3895\n${"1".repeat(1100)}\n%%EOF\n`));
    await expect(verifyPowerAdiEvidenceReceipt(join(output, "power-adi-evidence-capture.json"))).rejects.toThrow(/exact_bytes_mismatch/);
    await expect(capturePowerAdiEvidence({ outputDirectory: join(process.cwd(), "forbidden-capture"), fetchImpl: fetchFixture, capturedAt })).rejects.toThrow(/repository_output_forbidden/);

    const linkedParent = join(parent, "repository-link");
    await symlink(process.cwd(), linkedParent, "dir");
    await expect(capturePowerAdiEvidence({ outputDirectory: join(linkedParent, "forbidden-linked-capture"), fetchImpl: fetchFixture, capturedAt })).rejects.toThrow(/repository_output_forbidden/);
    expect(() => createPowerAdiEvidenceReceipt(captureSet(), "August 24, 2026")).toThrow(/capturedAt:rfc3339_required/);
  });

  it("normalizes request and response-body transport failures without writing a capture", async () => {
    const parent = await mkdtemp(join(tmpdir(), "power-adi-capture-blocked-"));
    const output = join(parent, "capture");
    await expect(capturePowerAdiEvidence({
      outputDirectory: output,
      capturedAt,
      fetchImpl: async () => { throw new Error("volatile network detail"); },
    })).rejects.toThrow("adi-lt8640s-product:official_transport_unavailable");
    await expect(readFile(join(output, "power-adi-evidence-capture.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const bodyOutput = join(parent, "body-capture");
    await expect(capturePowerAdiEvidence({
      outputDirectory: bodyOutput,
      capturedAt,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: POWER_ADI_EVIDENCE_SOURCES[0].url,
        headers: { get: () => "text/html" },
        arrayBuffer: async () => { throw new Error("volatile body failure"); },
      }),
    })).rejects.toThrow("adi-lt8640s-product:official_transport_unavailable");
    await expect(readFile(join(bodyOutput, "power-adi-evidence-capture.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const httpOutput = join(parent, "http-capture");
    await expect(capturePowerAdiEvidence({
      outputDirectory: httpOutput,
      capturedAt,
      fetchImpl: async () => ({ ok: false, status: 503 }),
    })).rejects.toThrow("adi-lt8640s-product:official_http_503");
    await expect(readFile(join(httpOutput, "power-adi-evidence-capture.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
