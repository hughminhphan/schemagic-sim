import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

const output = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(output, "../..");
const htmlPath = path.join(output, "social-preview.html");
const imagePath = path.join(output, "social-preview.png");
const publicPath = path.join(repo, "apps/web/public/social-preview.png");
const sourcePath = process.env.SOCIAL_SOURCE ?? path.join(output, ".capture-work/social-schematic-source.png");
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4640/";

await mkdir(output, { recursive: true });
await mkdir(path.dirname(sourcePath), { recursive: true });
const browser = await chromium.launch({ headless: true });
const appContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
  colorScheme: "light",
  serviceWorkers: "block",
});
const appPage = await appContext.newPage();
await appPage.goto(baseURL, { waitUntil: "domcontentloaded" });
await appPage.getByTestId("engine-ready").waitFor({ state: "visible", timeout: 45_000 });
await appPage.locator('[data-component-id="c2"] .editor-component-hit').click({ force: true });
await appPage.locator("#wiper-value").evaluate((element) => {
  element.value = "0.55";
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
await appPage.getByTestId("engine-ready").waitFor({ state: "visible", timeout: 45_000 });
await appPage.waitForTimeout(450);
const liveState = await appPage.evaluate(() => ({
  status: document.querySelector("#engine-status")?.textContent?.trim(),
  wiper: document.querySelector("#wiper-percent")?.textContent?.trim(),
  haloOpacity: Number(getComputedStyle(document.querySelector('[data-led-halo="c6"]')).opacity),
  pulses: document.querySelector(".pulse-layer") instanceof HTMLCanvasElement,
  scopeClosed: document.querySelector(".app-shell")?.classList.contains("scope-collapsed"),
}));
await appPage.addStyleTag({ content: ".canvas-status,.vref-legend{display:none!important}" });
await appPage.locator("#canvas-wrap").screenshot({ path: sourcePath });
await appContext.close();

const [schematic, archivo, plexSans, plexMono] = await Promise.all([
  readFile(sourcePath),
  readFile(path.join(repo, "apps/web/public/fonts/archivo-wordmark-subset.woff2")),
  readFile(path.join(repo, "apps/web/public/fonts/ibm-plex-sans-latin-500-normal.woff2")),
  readFile(path.join(repo, "apps/web/public/fonts/ibm-plex-mono-latin-500-normal.woff2")),
]);
await rm(sourcePath, { force: true });
const data = (mime, buffer) => `data:${mime};base64,${buffer.toString("base64")}`;
const html = `<title>scheMAGIC Simulator social preview</title>
<style>
@font-face{font-family:"Archivo Expanded";src:url("${data("font/woff2", archivo)}") format("woff2");font-weight:600}
@font-face{font-family:"IBM Plex Sans";src:url("${data("font/woff2", plexSans)}") format("woff2");font-weight:500}
@font-face{font-family:"IBM Plex Mono";src:url("${data("font/woff2", plexMono)}") format("woff2");font-weight:500}
*{box-sizing:border-box}
html,body{width:1280px;height:640px;margin:0;overflow:hidden;background:#F1EEE8;color:#15181B}
.preview{position:relative;width:1280px;height:640px;background:#F1EEE8}
.schematic{position:absolute;left:36px;top:48px;width:670px;height:544px;overflow:hidden}
.schematic img{display:block;width:100%;height:100%;object-fit:cover;object-position:center center}
.copy{position:absolute;left:754px;top:96px;width:462px;height:448px}
.wordmark{position:absolute;left:0;top:42px;width:430px;white-space:nowrap;font:600 31px/38px "Archivo Expanded",sans-serif;letter-spacing:.035em}
.thesis{position:absolute;left:0;top:114px;width:462px;margin:0;font:500 23.5px/54px "IBM Plex Sans",sans-serif}
.engine{position:absolute;left:0;top:256px;margin:0;font:500 14px/20px "IBM Plex Mono",monospace;letter-spacing:.015em}
</style>
<div class="preview">
  <div class="schematic"><img alt="Live NPN LED bench" src="${data("image/png", schematic)}"></div>
  <section class="copy" aria-label="Product summary">
    <div class="wordmark">scheMAGIC Simulator</div>
    <p class="thesis">Real ngspice in your browser. The schematic shows what the circuit is doing.</p>
    <p class="engine">ngspice-46 · local WASM Worker</p>
  </section>
</div>`;
await writeFile(htmlPath, html);

const renderContext = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1, colorScheme: "light" });
const renderPage = await renderContext.newPage();
await renderPage.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await renderPage.evaluate(() => document.fonts.ready);
const layout = await renderPage.evaluate(() => {
  const rect = (selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  };
  return { wordmark: rect(".wordmark"), thesis: rect(".thesis"), engine: rect(".engine"), schematic: rect(".schematic") };
});
if (layout.wordmark.width > 430 || layout.wordmark.right > 1216 || layout.thesis.right > 1216 || layout.engine.right > 1216) {
  throw new Error(`Social text exceeds safe bounds: ${JSON.stringify(layout)}`);
}
if (layout.wordmark.left < 64 || layout.wordmark.top < 64 || layout.engine.bottom > 576) {
  throw new Error(`Social text enters unsafe margins: ${JSON.stringify(layout)}`);
}
await renderPage.screenshot({ path: imagePath });
await execFileAsync("/usr/bin/sips", ["--matchTo", "/System/Library/ColorSync/Profiles/sRGB Profile.icc", imagePath]);
await copyFile(imagePath, publicPath);
console.log(JSON.stringify({ liveState, layout, htmlPath, imagePath, publicPath }, null, 2));
await browser.close();
