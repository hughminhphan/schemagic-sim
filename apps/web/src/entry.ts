import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root is missing");

if (new URLSearchParams(location.search).has("designer")) {
  document.title = "scheMAGIC Designer";
  document
    .querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute("content", "scheMAGIC Designer is a separate guided circuit-design product.");

  app.innerHTML = `<main class="designer-boundary" data-product="designer">
    <header class="designer-boundary__chrome">
      <span class="wordmark">scheMAGIC</span>
      <nav class="product-switch" aria-label="scheMAGIC products">
        <a class="product-link" href="/" aria-label="Open scheMAGIC Simulator">Simulator</a>
        <span class="product-current designer-product-current" aria-current="page"><span class="product-status" aria-hidden="true"></span>Designer</span>
      </nav>
      <span class="designer-boundary__build">LOCAL PRODUCT HANDOFF</span>
    </header>
    <section class="designer-boundary__stage" aria-labelledby="designer-boundary-title">
      <div class="designer-boundary__copy">
        <p class="designer-boundary__eyebrow">DESIGNER / SEPARATE WORKSPACE</p>
        <h1 id="designer-boundary-title">Designer isn’t bundled in this Simulator preview.</h1>
        <p class="designer-boundary__lede">This local build is intentionally scoped to drawing, wiring, and simulating circuits. Designer is a separate product workflow, with its own workspace and design tools.</p>
        <a class="designer-boundary__return" href="/">
          <span aria-hidden="true">←</span>
          Return to Simulator
        </a>
      </div>
      <div class="designer-boundary__map" aria-hidden="true">
        <span class="designer-boundary__map-label">PRODUCT BOUNDARY</span>
        <svg viewBox="0 0 620 340" role="presentation">
          <path class="designer-boundary__trace" d="M34 173h100v-82h132v82h88v76h118v-76h114" />
          <path class="designer-boundary__trace designer-boundary__trace--muted" d="M134 91v164h132V91m88 158V91h118v164" />
          <g class="designer-boundary__node">
            <rect x="100" y="58" width="68" height="66" />
            <text x="134" y="86">DESIGN</text><text x="134" y="102">INTENT</text>
          </g>
          <g class="designer-boundary__node">
            <rect x="232" y="140" width="68" height="66" />
            <text x="266" y="168">PART</text><text x="266" y="184">CHOICE</text>
          </g>
          <g class="designer-boundary__node">
            <rect x="320" y="216" width="68" height="66" />
            <text x="354" y="244">DESIGN</text><text x="354" y="260">OUTPUT</text>
          </g>
          <g class="designer-boundary__node">
            <rect x="438" y="140" width="68" height="66" />
            <text x="472" y="168">SIMULATE</text><text x="472" y="184">+ VERIFY</text>
          </g>
          <circle class="designer-boundary__terminal" cx="34" cy="173" r="5" />
          <circle class="designer-boundary__terminal" cx="586" cy="173" r="5" />
        </svg>
        <p>Designer workspace unavailable in this build</p>
      </div>
    </section>
  </main>`;
} else {
  await import("./main");
}
