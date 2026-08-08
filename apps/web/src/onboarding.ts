type TourPlacement = "top" | "right" | "bottom" | "left" | "center";

type TourStep = {
  target?: string;
  eyebrow: string;
  title: string;
  body: string;
  tip?: string;
  placement?: TourPlacement;
  prepare?: () => void;
};

const TOUR_STORAGE_KEY = "schemagic.onboarding.v1.completed";

const steps: TourStep[] = [
  {
    eyebrow: "WELCOME TO THE BENCH",
    title: "Make the schematic move.",
    body: "scheMAGIC is a real ngspice circuit bench in your browser. This quick tour shows you how to build, simulate and inspect a circuit.",
    tip: "Your work stays in this browser. No account required.",
    placement: "center",
  },
  {
    target: ".chrome-actions",
    eyebrow: "START HERE",
    title: "Load a known circuit or a real part.",
    body: "Examples gives you verified circuits to explore. Catalog contains reviewed device models, while Import models accepts your own SPICE subcircuits.",
    tip: "Start with an example if you want to learn the controls before drawing.",
    placement: "bottom",
  },
  {
    target: ".symbol-rail",
    eyebrow: "BUILD",
    title: "Place parts and draw wires.",
    body: "Choose a component, then click the canvas to place it. Use Wire for orthogonal connections and Select to move, inspect or box-select parts.",
    tip: "Press R to rotate, X to mirror and Delete to remove a selection.",
    placement: "right",
  },
  {
    target: ".canvas-wrap",
    eyebrow: "LIVING SCHEMATIC",
    title: "Read the circuit while it runs.",
    body: "Wire colour shows voltage and moving marks show current direction. Drag the potentiometer or toggle a switch to see the solve update live.",
    tip: "Drag empty space to pan, use the wheel to zoom and press F to fit.",
    placement: "center",
  },
  {
    target: ".inspector",
    eyebrow: "INSPECT",
    title: "Select a part to edit and measure it.",
    body: "The inspector is where you change values, see pin voltages and branch current, and configure DC sweep, TRAN, AC or NOISE analysis.",
    tip: "Engineering suffixes work as expected: 10k, 4.7u, 2m.",
    placement: "left",
  },
  {
    target: ".analysis-tabs",
    eyebrow: "ANALYSE",
    title: "Choose the question you want to ask.",
    body: "LIVE continuously solves the circuit. DC shows one operating point, DC SWEEP varies sources, TRAN shows change over time, AC produces a Bode response, and NOISE shows output and input-referred spectral density.",
    placement: "bottom",
  },
  {
    target: ".scope-dock",
    eyebrow: "PROBE",
    title: "Click a wire to send it to the scope.",
    body: "Add up to six voltage traces, then use DC SWEEP, TRAN, AC or NOISE to inspect them. The scope includes scale controls, cursors, integrated noise totals and a live potentiometer locus.",
    tip: "Use Open scope if the plot is collapsed.",
    placement: "top",
    prepare: () => {
      const shell = document.querySelector(".app-shell");
      if (shell?.classList.contains("scope-collapsed")) {
        document.querySelector<HTMLButtonElement>("#scope-toggle")?.click();
      }
    },
  },
  {
    target: "#guide-button",
    eyebrow: "KEEP EXPLORING",
    title: "The full guide always lives here.",
    body: "Workspaces auto-save from the name at top left. Use Share URL for a browser link, or export JSON, SPICE and SVG when you need files.",
    tip: "Open Guide any time for visual references, shortcuts and model-import notes.",
    placement: "bottom",
  },
];

const guideMarkup = `
  <div class="guide-overlay" id="guide-overlay" hidden>
    <section class="guide-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <header class="guide-header">
        <div>
          <span class="guide-kicker">SCHEMAGIC FIELD GUIDE</span>
          <h1 id="guide-title">From blank canvas to a useful trace.</h1>
        </div>
        <div class="guide-header-actions">
          <button class="guide-replay" id="guide-replay">Replay walkthrough</button>
          <button class="guide-close" id="guide-close" aria-label="Close guide">Close</button>
        </div>
      </header>
      <div class="guide-layout">
        <nav class="guide-index" aria-label="Guide sections">
          <span>ON THIS BENCH</span>
          <a href="#guide-start">Start with a circuit</a>
          <a href="#guide-build">Build and edit</a>
          <a href="#guide-live">Read the live view</a>
          <a href="#guide-analysis">Run an analysis</a>
          <a href="#guide-share">Save and share</a>
          <a href="#guide-shortcuts">Shortcuts</a>
        </nav>
        <div class="guide-content">
          <section class="guide-intro">
            <p>scheMAGIC combines a schematic editor, a real ngspice engine and an oscilloscope-style viewer. The references below are live snapshots of the interface you have open now.</p>
            <div class="guide-legend"><span><i class="guide-swatch guide-swatch-voltage"></i> wire voltage</span><span><i class="guide-swatch guide-swatch-current"></i> current direction</span><span><i class="guide-swatch guide-swatch-probe"></i> selected probe</span></div>
          </section>

          <article class="guide-section" id="guide-start">
            <div class="guide-copy"><span class="guide-number">01</span><h2>Start with a circuit</h2><p>Open <strong>Examples</strong> for complete, verified circuits. Use <strong>Catalog</strong> when you need a reviewed manufacturer model, or <strong>Import models</strong> to add a SPICE <code>.subckt</code> from a vendor.</p><p class="guide-note">Imported source stays browser-local. Download JSON when you need to move that project.</p></div>
            <figure class="guide-ui-visual guide-ui-chrome" data-ui-clone=".chrome-actions"><figcaption>LIVE UI · TOP BAR</figcaption></figure>
          </article>

          <article class="guide-section" id="guide-build">
            <div class="guide-copy"><span class="guide-number">02</span><h2>Build and edit</h2><p>Pick a part from the left rail and click to place it. Wire connects pins with right-angle runs. Select a component to move it or edit its value in the inspector.</p><ol><li><strong>Parts rail</strong> — choose Select, Wire or a component.</li><li><strong>Canvas</strong> — place, connect, pan and zoom.</li><li><strong>Inspector</strong> — edit values and read measurements.</li></ol></div>
            <figure class="guide-ui-visual guide-ui-workbench" data-ui-clone=".workbench"><figcaption>LIVE UI · BUILD AREA</figcaption></figure>
          </article>

          <article class="guide-section" id="guide-live">
            <div class="guide-copy"><span class="guide-number">03</span><h2>Read the live view</h2><p>In <strong>LIVE</strong>, the engine resolves every edit. Blue-to-amber wire colour encodes voltage around zero; moving marks encode current direction and magnitude. Select a part for exact pin voltage and branch-current readings.</p><p class="guide-note">Interactive components are meant to move: drag the potentiometer wiper or toggle a switch.</p></div>
            <figure class="guide-ui-visual guide-ui-canvas" data-ui-clone=".canvas-wrap"><figcaption>LIVE UI · SCHEMATIC</figcaption></figure>
          </article>

          <article class="guide-section" id="guide-analysis">
            <div class="guide-copy"><span class="guide-number">04</span><h2>Run an analysis</h2><p>Click a wire to add a voltage probe, then choose the analysis that matches your question.</p><dl><dt>DC</dt><dd>One operating point.</dd><dt>DC SWEEP</dt><dd>Probed values while one source changes, with an optional stepped source.</dd><dt>TRAN</dt><dd>Voltage over time.</dd><dt>AC</dt><dd>Gain and phase over frequency.</dd><dt>NOISE</dt><dd>Output and input-referred noise density plus integrated totals.</dd></dl><p>Set sweep, time, frequency and noise assumptions in the inspector. The scope supports six probes, stepped curve legends, scale controls and cursors.</p></div>
            <figure class="guide-ui-visual guide-ui-scope" data-ui-clone=".scope-dock"><figcaption>LIVE UI · SCOPE</figcaption></figure>
          </article>

          <article class="guide-section" id="guide-share">
            <div class="guide-copy"><span class="guide-number">05</span><h2>Save and share</h2><p>Your current workspace saves automatically in this browser. Click its name at top left to create, rename, duplicate or switch projects.</p><ul><li><strong>Share URL</strong> — copies a circuit link.</li><li><strong>Download JSON</strong> — keeps the full editable project.</li><li><strong>Netlist / SVG</strong> — exports for SPICE or documentation.</li></ul></div>
            <figure class="guide-ui-visual guide-ui-chrome" data-ui-clone=".chrome-actions"><figcaption>LIVE UI · SHARE + EXPORTS</figcaption></figure>
          </article>

          <article class="guide-section" id="guide-shortcuts">
            <div class="guide-copy"><span class="guide-number">06</span><h2>Move quickly</h2><div class="guide-key-grid"><kbd>R</kbd><span>Rotate selection</span><kbd>X</kbd><span>Mirror selection</span><kbd>F</kbd><span>Fit circuit</span><kbd>⌘ / Ctrl Z</kbd><span>Undo</span><kbd>Space + drag</kbd><span>Pan</span><kbd>Wheel</kbd><span>Zoom to cursor</span><kbd>?</kbd><span>Full shortcut sheet</span></div></div>
          </article>
        </div>
      </div>
    </section>
  </div>`;

const tourMarkup = `
  <div class="tour-layer" id="tour-layer" hidden>
    <div class="tour-spotlight" id="tour-spotlight" aria-hidden="true"></div>
    <section class="tour-card" id="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      <header class="tour-card-header"><span id="tour-eyebrow"></span><button id="tour-skip">Skip tour</button></header>
      <div class="tour-progress" id="tour-progress" aria-label="Walkthrough progress"></div>
      <h2 id="tour-title"></h2>
      <p id="tour-body"></p>
      <p class="tour-tip" id="tour-tip"></p>
      <footer class="tour-actions">
        <button class="tour-back" id="tour-back">Back</button>
        <span id="tour-count"></span>
        <button class="tour-next" id="tour-next">Next</button>
      </footer>
    </section>
  </div>`;

function completedTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberTour(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "1");
  } catch {
    // The walkthrough still works when storage is unavailable.
  }
}

function cloneUiReference(host: HTMLElement): void {
  const selector = host.dataset.uiClone;
  const source = selector ? document.querySelector<HTMLElement>(selector) : null;
  if (!source) return;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add("guide-ui-clone");
  clone.setAttribute("aria-hidden", "true");
  [clone, ...clone.querySelectorAll<HTMLElement>("*")].forEach((element) => {
    element.removeAttribute("id");
    element.removeAttribute("for");
    element.setAttribute("tabindex", "-1");
    if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) element.disabled = true;
  });
  const originals = source.querySelectorAll<HTMLCanvasElement>("canvas");
  const copies = clone.querySelectorAll<HTMLCanvasElement>("canvas");
  originals.forEach((canvas, index) => {
    const copy = copies[index];
    if (!copy) return;
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d")?.drawImage(canvas, 0, 0);
  });
  host.querySelector(".guide-ui-clone")?.remove();
  host.append(clone);
}

export function initOnboarding(): void {
  document.body.insertAdjacentHTML("beforeend", `${guideMarkup}${tourMarkup}`);

  const guideButton = document.querySelector<HTMLButtonElement>("#guide-button");
  const guide = document.querySelector<HTMLElement>("#guide-overlay");
  const tour = document.querySelector<HTMLElement>("#tour-layer");
  const card = document.querySelector<HTMLElement>("#tour-card");
  const spotlight = document.querySelector<HTMLElement>("#tour-spotlight");
  if (!guideButton || !guide || !tour || !card || !spotlight) return;

  let stepIndex = 0;
  let returnFocus: HTMLElement | null = null;

  const closeGuide = () => {
    guide.hidden = true;
    returnFocus?.focus();
  };

  const openGuide = () => {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : guideButton;
    tour.hidden = true;
    guide.hidden = false;
    guide.querySelectorAll<HTMLElement>("[data-ui-clone]").forEach(cloneUiReference);
    document.querySelector<HTMLButtonElement>("#guide-close")?.focus();
  };

  const positionStep = () => {
    if (tour.hidden) return;
    const step = steps[stepIndex]!;
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    if (!target || target.getBoundingClientRect().width === 0) {
      tour.classList.add("tour-without-target");
      spotlight.hidden = true;
      card.classList.add("tour-card-centered");
      card.style.removeProperty("left");
      card.style.removeProperty("top");
      return;
    }

    const padding = 6;
    const rect = target.getBoundingClientRect();
    tour.classList.remove("tour-without-target");
    spotlight.hidden = false;
    spotlight.style.left = `${Math.max(0, rect.left - padding)}px`;
    spotlight.style.top = `${Math.max(0, rect.top - padding)}px`;
    spotlight.style.width = `${Math.min(innerWidth, rect.right + padding) - Math.max(0, rect.left - padding)}px`;
    spotlight.style.height = `${Math.min(innerHeight, rect.bottom + padding) - Math.max(0, rect.top - padding)}px`;
    card.classList.remove("tour-card-centered");

    const gap = 18;
    const margin = 14;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    let left = rect.left + (rect.width - cardWidth) / 2;
    let top = rect.bottom + gap;
    const placement = step.placement ?? "bottom";
    if (placement === "top") top = rect.top - cardHeight - gap;
    if (placement === "right") {
      left = rect.right + gap;
      top = rect.top + (rect.height - cardHeight) / 2;
    }
    if (placement === "left") {
      left = rect.left - cardWidth - gap;
      top = rect.top + (rect.height - cardHeight) / 2;
    }
    if (placement === "center") {
      left = rect.left + (rect.width - cardWidth) / 2;
      top = rect.top + (rect.height - cardHeight) / 2;
    }
    left = Math.max(margin, Math.min(innerWidth - cardWidth - margin, left));
    top = Math.max(margin, Math.min(innerHeight - cardHeight - margin, top));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  };

  const renderStep = () => {
    const step = steps[stepIndex]!;
    step.prepare?.();
    document.querySelector<HTMLElement>("#tour-eyebrow")!.textContent = step.eyebrow;
    document.querySelector<HTMLElement>("#tour-title")!.textContent = step.title;
    document.querySelector<HTMLElement>("#tour-body")!.textContent = step.body;
    const tip = document.querySelector<HTMLElement>("#tour-tip")!;
    tip.textContent = step.tip ?? "";
    tip.hidden = !step.tip;
    document.querySelector<HTMLElement>("#tour-count")!.textContent = `${stepIndex + 1} / ${steps.length}`;
    const back = document.querySelector<HTMLButtonElement>("#tour-back")!;
    const next = document.querySelector<HTMLButtonElement>("#tour-next")!;
    back.disabled = stepIndex === 0;
    next.textContent = stepIndex === steps.length - 1 ? "Start experimenting" : stepIndex === 0 ? "Start walkthrough" : "Next";
    const progress = document.querySelector<HTMLElement>("#tour-progress")!;
    progress.innerHTML = steps.map((_, index) => `<i class="${index <= stepIndex ? "active" : ""}"></i>`).join("");
    requestAnimationFrame(positionStep);
  };

  const closeTour = (remember = true) => {
    if (remember) rememberTour();
    tour.hidden = true;
    guideButton.focus();
  };

  const openTour = (index = 0) => {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : guideButton;
    guide.hidden = true;
    tour.hidden = false;
    stepIndex = index;
    renderStep();
    document.querySelector<HTMLButtonElement>("#tour-next")?.focus();
  };

  guideButton.addEventListener("click", openGuide);
  document.querySelector<HTMLButtonElement>("#guide-close")?.addEventListener("click", closeGuide);
  document.querySelector<HTMLButtonElement>("#guide-replay")?.addEventListener("click", () => openTour());
  document.querySelector<HTMLButtonElement>("#tour-skip")?.addEventListener("click", () => closeTour());
  document.querySelector<HTMLButtonElement>("#tour-back")?.addEventListener("click", () => {
    if (stepIndex > 0) {
      stepIndex -= 1;
      renderStep();
    }
  });
  document.querySelector<HTMLButtonElement>("#tour-next")?.addEventListener("click", () => {
    if (stepIndex === steps.length - 1) {
      closeTour();
      return;
    }
    stepIndex += 1;
    renderStep();
  });

  window.addEventListener("resize", positionStep);
  window.addEventListener("keydown", (event) => {
    const activeModal = !tour.hidden ? card : !guide.hidden ? guide.querySelector<HTMLElement>(".guide-sheet") : null;
    if (activeModal && event.key === "?") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (activeModal && event.key === "Tab") {
      const focusable = [...activeModal.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first && last && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (first && last && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (!tour.hidden) {
      if (event.key === "Escape") closeTour();
      if (event.key === "ArrowRight") document.querySelector<HTMLButtonElement>("#tour-next")?.click();
      if (event.key === "ArrowLeft") document.querySelector<HTMLButtonElement>("#tour-back")?.click();
      return;
    }
    if (!guide.hidden && event.key === "Escape") closeGuide();
  }, { capture: true });

  if (!completedTour()) window.setTimeout(() => openTour(), 350);
}
