const isDesignerRoute = new URLSearchParams(window.location.search).has("designer")
  || window.location.pathname === "/designer"
  || window.location.pathname === "/designer/";

async function bootEntry(): Promise<void> {
  if (!isDesignerRoute) {
    await import("./main");
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
