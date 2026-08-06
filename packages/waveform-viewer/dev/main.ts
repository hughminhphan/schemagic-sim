import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../src/style.css";
import { mount } from "../src";

const sampleCount = 120_000;
const time = new Float64Array(sampleCount);
const input = new Float64Array(sampleCount);
const output = new Float64Array(sampleCount);
const current = new Float64Array(sampleCount);
const reference = new Float64Array(sampleCount);
const sense = new Float64Array(sampleCount);
const ripple = new Float64Array(sampleCount);
for (let index = 0; index < sampleCount; index += 1) {
  const t = index / (sampleCount - 1) * 0.012;
  time[index] = t;
  input[index] = 2.5 + 2.2 * Math.sign(Math.sin(2 * Math.PI * 820 * t));
  output[index] = 2.5 + 1.8 * Math.sin(2 * Math.PI * 820 * t - 0.45) + 0.16 * Math.sin(2 * Math.PI * 4100 * t);
  current[index] = 0.006 + 0.004 * Math.sin(2 * Math.PI * 820 * t - 0.8);
  reference[index] = 1.25 + 0.3 * Math.sin(2 * Math.PI * 410 * t);
  sense[index] = 2.1 + 0.7 * Math.sin(2 * Math.PI * 820 * t + 0.6);
  ripple[index] = 2.5 + 0.22 * Math.sin(2 * Math.PI * 4100 * t);
}

const acCount = 481;
const frequency = new Float64Array(acCount);
const lowpass = new Float64Array(acCount * 2);
const resonant = new Float64Array(acCount * 2);
for (let index = 0; index < acCount; index += 1) {
  const f = 10 ** (1 + index / (acCount - 1) * 6);
  frequency[index] = f;
  const lp = mathDivide(mathComplex(1, 0), mathComplex(1, f / 8200));
  lowpass[index * 2] = lp.re;
  lowpass[index * 2 + 1] = lp.im;
  const w = f / 48_000;
  const denominator = mathComplex(1 - w * w, w / 3.2);
  const bp = mathDivide(mathComplex(0, w / 3.2), denominator);
  resonant[index * 2] = bp.re;
  resonant[index * 2 + 1] = bp.im;
}

function mathComplex(re: number, im: number): { re: number; im: number } {
  return { re, im };
}

function mathDivide(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  const divisor = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / divisor, im: (a.im * b.re - a.re * b.im) / divisor };
}

const viewerElement = document.querySelector<HTMLElement>("#viewer");
if (!viewerElement) throw new Error("Missing viewer element");
const viewer = mount(viewerElement, {
  colors: ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#3FD983", "#E8A244"],
  dashes: [[], [], [], [], [6, 3], [2, 3]],
  unwrapPhase: true,
});

function showTran(): void {
  const start = performance.now();
  viewer.setData({ kind: "tran", vectors: { time, "V(input)": input, "V(output)": output, "I(R1)": current, "V(reference)": reference, "V(sense)": sense, "V(ripple)": ripple } });
  requestAnimationFrame(() => {
    const perf = document.querySelector("#perf");
    if (perf) perf.textContent = `${sampleCount.toLocaleString()} points/trace · first frame ${(performance.now() - start).toFixed(1)} ms`;
  });
  document.body.dataset.view = "tran";
}

function showAC(): void {
  viewer.setData({ kind: "ac", vectors: { frequency, "V(lowpass)": lowpass, "V(bandpass)": resonant } });
  const perf = document.querySelector("#perf");
  if (perf) perf.textContent = `${acCount} complex samples/trace · log frequency`;
  document.body.dataset.view = "ac";
}

document.querySelector("#show-tran")?.addEventListener("click", showTran);
document.querySelector("#show-ac")?.addEventListener("click", showAC);
showTran();

const style = document.createElement("style");
style.textContent = `
  html, body { margin: 0; min-height: 100%; background: #15181B; color: #F1EEE8; font-family: "IBM Plex Sans", sans-serif; }
  body { padding: 28px; }
  main { width: min(1180px, calc(100vw - 56px)); margin: 0 auto; }
  header { height: 36px; display: flex; align-items: center; gap: 24px; border-bottom: 1px solid #2A2F34; font-size: 11px; letter-spacing: .02em; }
  header strong { font-weight: 600; }
  nav { display: flex; height: 100%; }
  nav button { min-width: 54px; padding: 0 10px; border: 0; border-radius: 0; background: transparent; color: #F1EEE8; font: 500 11px "IBM Plex Sans", sans-serif; cursor: pointer; }
  body[data-view="tran"] #show-tran, body[data-view="ac"] #show-ac { border-bottom: 2px solid #1B9350; }
  #perf { margin-left: auto; color: #A9AEB3; font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums; }
  #viewer { height: 650px; }
`;
document.head.append(style);
