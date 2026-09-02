const entrySearch = new URLSearchParams(window.location.search);
const isDesignerRoute = entrySearch.has("designer")
  || window.location.pathname === "/designer"
  || window.location.pathname === "/designer/";
const isEmbedMode = !isDesignerRoute && entrySearch.get("embed") === "1";

function embedOpenUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("embed");
  return url.toString();
}

function installEmbedInteractionGuard(): void {
  document.documentElement.dataset.embed = "1";
  const allowsEvent = (event: Event): boolean => event.target instanceof Element && Boolean(event.target.closest("[data-embed-open-link]"));
  const refuse = (event: Event): void => {
    if (allowsEvent(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of ["click", "dblclick", "pointerdown", "pointermove", "pointerup", "contextmenu", "input", "change", "submit", "dragstart", "drop"]) {
    window.addEventListener(type, refuse, { capture: true });
  }
  window.addEventListener("wheel", refuse, { capture: true, passive: false });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Tab" || allowsEvent(event)) return;
    refuse(event);
  }, { capture: true });
}

function installEmbedChrome(): void {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  shell?.classList.add("embed-shell");
  const editor = document.querySelector<HTMLElement>(".schematic-editor");
  editor?.setAttribute("aria-readonly", "true");
  editor?.setAttribute("data-readonly", "true");

  for (const selector of [".symbol-rail", ".inspector", ".analysis-tabs", "#editor-host"]) {
    const region = document.querySelector<HTMLElement>(selector);
    region?.setAttribute("inert", "");
    region?.setAttribute("aria-disabled", "true");
  }

  const brandLine = document.querySelector<HTMLElement>(".brand-line");
  if (brandLine && !brandLine.querySelector(".embed-read-only-label")) {
    const label = document.createElement("span");
    label.className = "embed-read-only-label";
    label.textContent = "READ ONLY";
    brandLine.append(label);
  }

  const actions = document.querySelector<HTMLElement>(".chrome-actions");
  if (actions && !actions.querySelector("[data-embed-open-link]")) {
    const link = document.createElement("a");
    link.className = "embed-open-link";
    link.href = embedOpenUrl();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.embedOpenLink = "";
    link.dataset.testid = "embed-open-link";
    link.textContent = "Open in Robonyx";
    actions.append(link);
  }
}

async function bootEntry(): Promise<void> {
  if (!isDesignerRoute) {
    if (isEmbedMode) installEmbedInteractionGuard();
    await import("./main");
    if (isEmbedMode) installEmbedChrome();
    return;
  }
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Application root is missing");
  document.title = "Robonyx Designer";
  document
    .querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute("content", "Robonyx Designer release candidate turns declared electrical requirements into inspectable circuit candidates.");
  const [{ mountDesignerRoute }, { designerApplications }] = await Promise.all([
    import("./features/designer/DesignerRoute"),
    import("./features/designer/applications"),
  ]);
  mountDesignerRoute(root, {
    applications: designerApplications(),
    simulatorPath: "/",
  });
  // Dev-server module URLs are mutable and must never be captured by the
  // production offline cache; doing so breaks later lazy generation imports.
  if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
}

void bootEntry().catch((error: unknown) => {
  const root = document.querySelector<HTMLElement>("#app");
  if (root) {
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = `Robonyx failed to load: ${error instanceof Error ? error.message : String(error)}`;
    root.replaceChildren(alert);
  }
  console.error(error);
});
