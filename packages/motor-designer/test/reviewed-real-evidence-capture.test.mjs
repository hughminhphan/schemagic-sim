import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  STSPIN840_EVIDENCE_SOURCES,
  captureSTSPIN840Evidence,
  createSTSPIN840EvidenceReceipt,
  verifySTSPIN840EvidenceReceipt,
} from "../scripts/capture-reviewed-real-evidence.mjs";

const productBytes = new TextEncoder().encode(`<html><title>STSPIN840 | Product - STMicroelectronics</title><body>${"x".repeat(1100)} TFQFPN</body></html>`);
const pdfBytes = new TextEncoder().encode(`%PDF-1.7\nSTSPIN840\n${"0".repeat(1100)}\n%%EOF\n`);
const capturedAt = "2026-08-24T02:30:00.000Z";

function captureSet() {
  return [
    { id: "stspin840-product-page", bytes: productBytes, contentType: "text/html; charset=utf-8", finalUrl: "https://www.st.com/en/motor-drivers/stspin840.html" },
    { id: "stspin840-datasheet", bytes: pdfBytes, contentType: "application/pdf", finalUrl: "https://www.st.com/resource/en/datasheet/stspin840.pdf" },
  ];
}

function fetchFixture(url) {
  const capture = captureSet().find((entry) => STSPIN840_EVIDENCE_SOURCES.find((source) => source.id === entry.id).url === url);
  return Promise.resolve({
    ok: true,
    status: 200,
    url: capture.finalUrl,
    headers: { get: () => capture.contentType },
    arrayBuffer: async () => capture.bytes.buffer.slice(capture.bytes.byteOffset, capture.bytes.byteOffset + capture.bytes.byteLength),
  });
}

describe("STSPIN840 exact-byte evidence capture", () => {
  it("writes a deterministic official-source receipt outside the repository and verifies every exact byte", async () => {
    const parent = await mkdtemp(join(tmpdir(), "stspin840-capture-test-"));
    const output = join(parent, "capture");
    const receipt = await captureSTSPIN840Evidence({ outputDirectory: output, fetchImpl: fetchFixture, capturedAt });
    expect(receipt).toEqual(createSTSPIN840EvidenceReceipt(captureSet(), capturedAt));
    expect(receipt.sources.map((source) => source.id)).toEqual(["stspin840-product-page", "stspin840-datasheet"]);
    expect(receipt.sources.every((source) => /^sha256:[0-9a-f]{64}$/.test(source.contentHash))).toBe(true);
    expect(JSON.parse(await readFile(join(output, "stspin840-evidence-capture.json"), "utf8"))).toEqual(receipt);
    await expect(verifySTSPIN840EvidenceReceipt(join(output, "stspin840-evidence-capture.json"))).resolves.toEqual({
      status: "verified_exact_bytes",
      capturedAt,
      sources: receipt.sources.map(({ id, contentHash, byteLength, sourceUrl }) => ({ id, contentHash, byteLength, sourceUrl })),
    });
  });

  it("fails closed on unofficial redirects, wrong media, byte tampering, duplicate output, and repository-local vendor artifacts", async () => {
    const unofficial = captureSet();
    unofficial[0] = { ...unofficial[0], finalUrl: "https://st.com.example.invalid/en/motor-drivers/stspin840.html" };
    expect(() => createSTSPIN840EvidenceReceipt(unofficial, capturedAt)).toThrow(/final_url_not_official_st/);

    const wrongMedia = captureSet();
    wrongMedia[1] = { ...wrongMedia[1], contentType: "text/html" };
    expect(() => createSTSPIN840EvidenceReceipt(wrongMedia, capturedAt)).toThrow(/content_type_mismatch/);

    const wrongPdf = captureSet();
    wrongPdf[1] = { ...wrongPdf[1], bytes: new TextEncoder().encode(`%PDF-1.7\n${"0".repeat(1100)}\n%%EOF\n`) };
    expect(() => createSTSPIN840EvidenceReceipt(wrongPdf, capturedAt)).toThrow(/pdf_identity_mismatch/);

    const parent = await mkdtemp(join(tmpdir(), "stspin840-capture-tamper-"));
    const output = join(parent, "capture");
    await captureSTSPIN840Evidence({ outputDirectory: output, fetchImpl: fetchFixture, capturedAt });
    await expect(captureSTSPIN840Evidence({ outputDirectory: output, fetchImpl: fetchFixture, capturedAt })).rejects.toThrow(/output_directory_must_not_exist/);
    await writeFile(join(output, "stspin840.datasheet.pdf"), new TextEncoder().encode(`%PDF-1.7\nSTSPIN840\n${"1".repeat(1100)}\n%%EOF\n`));
    await expect(verifySTSPIN840EvidenceReceipt(join(output, "stspin840-evidence-capture.json"))).rejects.toThrow(/exact_bytes_mismatch/);
    await expect(captureSTSPIN840Evidence({ outputDirectory: join(process.cwd(), "forbidden-capture"), fetchImpl: fetchFixture, capturedAt })).rejects.toThrow(/repository_output_forbidden/);

    const linkedParent = join(parent, "repository-link");
    await symlink(process.cwd(), linkedParent, "dir");
    await expect(captureSTSPIN840Evidence({ outputDirectory: join(linkedParent, "forbidden-linked-capture"), fetchImpl: fetchFixture, capturedAt })).rejects.toThrow(/repository_output_forbidden/);
    expect(() => createSTSPIN840EvidenceReceipt(captureSet(), "August 24, 2026")).toThrow(/capturedAt:rfc3339_required/);
  });

  it("normalizes transport failure to a stable blocker without creating a capture directory", async () => {
    const parent = await mkdtemp(join(tmpdir(), "stspin840-capture-blocked-"));
    const output = join(parent, "capture");
    await expect(captureSTSPIN840Evidence({
      outputDirectory: output,
      capturedAt,
      fetchImpl: async () => { throw new Error("volatile network detail"); },
    })).rejects.toThrow("stspin840-product-page:official_transport_unavailable");
    await expect(readFile(join(output, "stspin840-evidence-capture.json"))).rejects.toMatchObject({ code: "ENOENT" });

    const bodyOutput = join(parent, "body-capture");
    await expect(captureSTSPIN840Evidence({
      outputDirectory: bodyOutput,
      capturedAt,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: "https://www.st.com/en/motor-drivers/stspin840.html",
        headers: { get: () => "text/html" },
        arrayBuffer: async () => { throw new Error("volatile body failure"); },
      }),
    })).rejects.toThrow("stspin840-product-page:official_transport_unavailable");
    await expect(readFile(join(bodyOutput, "stspin840-evidence-capture.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
