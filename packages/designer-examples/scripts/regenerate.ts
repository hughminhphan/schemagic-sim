import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildDesignerExampleGalleryBundle } from "../src/generate";

const artifactsDirectory = fileURLToPath(new URL("../artifacts/", import.meta.url));
const bundle = buildDesignerExampleGalleryBundle();

await mkdir(artifactsDirectory, { recursive: true });
for (const [id, artifact] of bundle.artifacts) {
  await writeFile(fileURLToPath(new URL(`${id}.json`, new URL("../artifacts/", import.meta.url))), artifact.text, "utf8");
}
await writeFile(fileURLToPath(new URL("manifest.json", new URL("../artifacts/", import.meta.url))), bundle.manifestText, "utf8");
