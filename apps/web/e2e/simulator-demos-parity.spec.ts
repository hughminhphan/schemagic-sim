import { expect, test, type Page } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

interface ExampleComponent {
  id: string;
  type: string;
  value?: unknown;
  label?: { text?: string };
}

interface ExampleDocument {
  components: ExampleComponent[];
  meta: { title: string };
}

interface LabelGeometry {
  component: string;
  property: string;
  text: string;
  side: "left" | "right" | "top" | "bottom" | "overlap";
  gap: number;
  along: number;
  symbolOverlap: number;
  siblingOverlap: number;
}

interface PinLeadGeometry {
  component: string;
  type: string;
  pinIndex: number;
  innerDistance: number;
  outerDistance: number;
  leadLength: number;
  nearestWireVertex: number;
  cue?: {
    distance: number;
  };
}

interface VirtualCueGeometry {
  component: string;
  pinIndex: number;
  role: string;
  width: number;
  height: number;
}

const expectedPinCounts: Readonly<Record<string, number>> = {
  resistor: 2,
  capacitor: 2,
  inductor: 2,
  vsource: 2,
  vsource_pulse: 2,
  vsource_sine: 2,
  isource: 2,
  ground: 1,
  switch_spst: 2,
  potentiometer: 3,
  diode: 2,
  led: 2,
  bjt_npn: 3,
  bjt_pnp: 3,
  nmos: 3,
  pmos: 3,
  opamp_ideal: 3,
  timer_555: 8,
};

const examplesDirectory = resolve(import.meta.dirname, "../../../examples");
const evidenceDirectory = resolve(import.meta.dirname, "../../../spikes/kicad-parity");
const exampleCases = readdirSync(examplesDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const id = name.replace(/\.json$/, "");
    const document = JSON.parse(readFileSync(resolve(examplesDirectory, name), "utf8")) as ExampleDocument;
    return { id, path: `/#example=${id}`, document };
  });
const defaultDocument = exampleCases.find((example) => example.id === "transistor-led-bench")?.document;
if (!defaultDocument) throw new Error("The default transistor-led-bench example is missing");
const demos = [{ id: "default", path: "/", document: defaultDocument }, ...exampleCases] as const;

async function resetSimulator(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("schemagic.onboarding.v1.completed", "1");
    sessionStorage.clear();
    await new Promise<void>((done) => {
      const request = indexedDB.deleteDatabase("schemagic-simulator");
      request.onsuccess = () => done();
      request.onerror = () => done();
      request.onblocked = () => done();
    });
  });
}

async function labelGeometry(page: Page): Promise<LabelGeometry[]> {
  return page.locator(".editor-label[data-label-component-id]").evaluateAll((labels) => {
    const overlapArea = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return labels.flatMap((label) => {
      const componentId = (label as SVGGraphicsElement).dataset.labelComponentId;
      const property = (label as SVGGraphicsElement).dataset.property;
      const component = componentId
        ? document.querySelector<SVGGElement>(`[data-component-id="${CSS.escape(componentId)}"]`)
        : null;
      const symbol = component?.querySelector<SVGGraphicsElement>(".editor-symbol");
      if (!componentId || !property || !component || !symbol) return [];

      const symbolRect = symbol.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const dx = Math.max(symbolRect.left - labelRect.right, labelRect.left - symbolRect.right, 0);
      const dy = Math.max(symbolRect.top - labelRect.bottom, labelRect.top - symbolRect.bottom, 0);
      let side: LabelGeometry["side"] = "overlap";
      if (labelRect.right <= symbolRect.left) side = "left";
      else if (labelRect.left >= symbolRect.right) side = "right";
      else if (labelRect.bottom <= symbolRect.top) side = "top";
      else if (labelRect.top >= symbolRect.bottom) side = "bottom";
      const labelCenterX = (labelRect.left + labelRect.right) / 2;
      const labelCenterY = (labelRect.top + labelRect.bottom) / 2;
      const symbolCenterX = (symbolRect.left + symbolRect.right) / 2;
      const symbolCenterY = (symbolRect.top + symbolRect.bottom) / 2;
      const siblings = labels.filter((candidate) => candidate !== label
        && (candidate as SVGGraphicsElement).dataset.labelComponentId === componentId);

      return [{
        component: componentId,
        property,
        text: label.textContent ?? "",
        side,
        gap: Math.hypot(dx, dy),
        along: side === "left" || side === "right" ? labelCenterY - symbolCenterY : labelCenterX - symbolCenterX,
        symbolOverlap: overlapArea(symbolRect, labelRect),
        siblingOverlap: Math.max(0, ...siblings.map((candidate) => overlapArea(labelRect, candidate.getBoundingClientRect()))),
      }];
    });
  });
}

async function pinLeadGeometry(page: Page, components: ExampleComponent[]): Promise<PinLeadGeometry[]> {
  return page.locator(".editor-component").evaluateAll((renderedComponents, expectedComponents) => {
    const distance = (a: DOMPoint, b: DOMPoint) => Math.hypot(a.x - b.x, a.y - b.y);
    const screenPoint = (element: SVGGraphicsElement, point: DOMPoint) => {
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error("Rendered SVG element has no screen CTM");
      return point.matrixTransform(matrix);
    };
    const wireVertices = Array.from(document.querySelectorAll<SVGPathElement>("path.editor-wire")).flatMap((wire) => {
      const numbers = (wire.getAttribute("d")?.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
      const vertices: DOMPoint[] = [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        vertices.push(screenPoint(wire, new DOMPoint(numbers[index], numbers[index + 1])));
      }
      return vertices;
    });
    const expectedById = new Map(expectedComponents.map((component) => [component.id, component]));

    return renderedComponents.flatMap((componentElement) => {
      const component = componentElement as SVGGElement;
      const componentId = component.dataset.componentId;
      const expected = componentId ? expectedById.get(componentId) : undefined;
      if (!componentId || !expected) throw new Error(`Unexpected rendered component ${componentId ?? "<missing id>"}`);
      const anchor = screenPoint(component, new DOMPoint(0, 0));
      const leads = Array.from(component.querySelectorAll<SVGPathElement>(".editor-symbol .pin-lead"));

      return leads.map((lead, pinIndex) => {
        const length = lead.getTotalLength();
        const start = screenPoint(lead, lead.getPointAtLength(0));
        const end = screenPoint(lead, lead.getPointAtLength(length));
        const startDistance = distance(start, anchor);
        const endDistance = distance(end, anchor);
        const outer = startDistance >= endDistance ? start : end;
        const innerDistance = Math.min(startDistance, endDistance);
        const outerDistance = Math.max(startDistance, endDistance);
        const cueElement = document.querySelector<SVGGElement>(
          `.virtual-connection-cue[data-virtual-component="${CSS.escape(componentId)}"][data-virtual-pin="${pinIndex}"]`,
        );
        const cuePath = cueElement?.querySelector<SVGGraphicsElement>("path");
        let cue: PinLeadGeometry["cue"];
        if (cueElement && cuePath) {
          const bounds = cuePath.getBBox();
          const center = screenPoint(cuePath, new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
          cue = {
            distance: distance(outer, center),
          };
        }

        return {
          component: componentId,
          type: expected.type,
          pinIndex,
          innerDistance,
          outerDistance,
          leadLength: distance(start, end),
          nearestWireVertex: wireVertices.length ? Math.min(...wireVertices.map((vertex) => distance(outer, vertex))) : Number.POSITIVE_INFINITY,
          cue,
        };
      });
    });
  }, components);
}

async function virtualCueGeometry(page: Page): Promise<VirtualCueGeometry[]> {
  return page.locator(".virtual-connection-cue").evaluateAll((cues) => cues.map((cueElement) => {
    const cue = cueElement as SVGGElement;
    const path = cue.querySelector<SVGGraphicsElement>("path");
    if (!path) throw new Error("Virtual connection cue has no marker path");
    const rect = path.getBoundingClientRect();
    return {
      component: cue.dataset.virtualComponent ?? "",
      pinIndex: Number(cue.dataset.virtualPin),
      role: cue.dataset.virtualRole ?? "",
      width: rect.width,
      height: rect.height,
    };
  }));
}

function expectedProperties(component: ExampleComponent): { reference: number; value: number } {
  return {
    reference: component.type !== "ground" && Boolean(component.label?.text) ? 1 : 0,
    value: component.value !== undefined && component.type !== "ground" && component.type !== "switch_spst" ? 1 : 0,
  };
}

function assertLabelGeometry(demoId: string, geometry: LabelGeometry[]): void {
  for (const label of geometry) {
    const identity = `${demoId}:${label.component}:${label.property}:${label.text}`;
    expect(label.side, `${identity} overlaps its symbol`).not.toBe("overlap");
    expect(label.symbolOverlap, `${identity} overlaps its symbol`).toBeLessThanOrEqual(0.5);
    expect(label.siblingOverlap, `${identity} overlaps another property label`).toBeLessThanOrEqual(0.5);
    expect(label.gap, `${identity} is detached from its symbol`).toBeLessThanOrEqual(24);
  }
}

function assertPinLeadGeometry(demoId: string, components: ExampleComponent[], geometry: PinLeadGeometry[]): void {
  const geometryByComponent = new Map<string, PinLeadGeometry[]>();
  for (const lead of geometry) geometryByComponent.set(lead.component, [...(geometryByComponent.get(lead.component) ?? []), lead]);

  for (const component of components) {
    const leads = geometryByComponent.get(component.id) ?? [];
    const expectedCount = expectedPinCounts[component.type];
    expect(expectedCount, `${demoId}:${component.id} has an unknown symbol type`).toBeDefined();
    expect(leads, `${demoId}:${component.id} rendered pin-lead count`).toHaveLength(expectedCount!);
    for (const lead of leads) {
      const identity = `${demoId}:${lead.component}:${lead.type}:pin${lead.pinIndex}`;
      if (lead.type === "ground") {
        expect(lead.leadLength, `${identity} is the sole allowed zero-length lead`).toBeLessThanOrEqual(0.1);
      } else {
        expect(lead.leadLength, `${identity} has a collapsed connector lead`).toBeGreaterThan(0.5);
        expect(lead.outerDistance - lead.innerDistance, `${identity} points inward toward its component anchor`).toBeGreaterThan(0.5);
      }
      const connectionDistance = Math.min(lead.nearestWireVertex, lead.cue?.distance ?? Number.POSITIVE_INFINITY);
      expect(connectionDistance, `${identity} does not land on a rendered wire vertex or its validated virtual cue`).toBeLessThanOrEqual(1.1);
      if (lead.cue) {
        expect(lead.cue.distance, `${identity} virtual cue is displaced from the pin endpoint`).toBeLessThanOrEqual(1.1);
      }
    }
  }
}

async function assertExpectedVirtualCues(page: Page, demoId: string): Promise<void> {
  if (demoId !== "opamp-noninverting") {
    await expect(page.locator(".virtual-connection-cue"), `${demoId} has an unexpected virtual connection`).toHaveCount(0);
    return;
  }

  const cues = await virtualCueGeometry(page);
  const identities = cues
    .map(({ component, pinIndex, role }) => ({ component, pinIndex, role }))
    .sort((left, right) => `${left.component}:${left.pinIndex}:${left.role}`.localeCompare(`${right.component}:${right.pinIndex}:${right.role}`));
  expect(identities).toEqual([
    { component: "c1", pinIndex: 0, role: "VCC" },
    { component: "c2", pinIndex: 0, role: "VEE" },
  ]);
  for (const cue of cues) {
    expect(cue.width, `${cue.role} cue should stay visibly screen-sized`).toBeGreaterThan(4);
    expect(cue.height, `${cue.role} cue should stay visibly screen-sized`).toBeGreaterThan(4);
    expect(Math.abs(cue.width - cue.height), `${cue.role} cue marker should be square`).toBeLessThanOrEqual(1);
  }
}

for (const demo of demos) {
  test(`${demo.id} has stable attached labels and no visually dangling pins`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Visual evidence is captured once in Chromium");

    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await resetSimulator(page);
    const [pathname, hash = ""] = demo.path.split("#");
    await page.goto(`${pathname}?parity=${demo.id}${hash ? `#${hash}` : ""}`);
    await expect(page.getByTestId("engine-ready")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".error-toast")).toHaveCount(0);
    await expect(page.locator(".editor-component")).toHaveCount(demo.document.components.length);
    await expect(page.locator(".pin-open")).toHaveCount(0);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    let expectedTotal = 0;
    for (const component of demo.document.components) {
      const expected = expectedProperties(component);
      expectedTotal += expected.reference + expected.value;
      const labels = page.locator(`[data-label-component-id="${component.id}"]`);
      await expect(page.locator(`[data-label-component-id="${component.id}"][data-property="reference"]`), `${demo.id}:${component.id} reference label count`).toHaveCount(expected.reference);
      await expect(page.locator(`[data-label-component-id="${component.id}"][data-property="value"]`), `${demo.id}:${component.id} value label count`).toHaveCount(expected.value);
      await expect(labels, `${demo.id}:${component.id} total property label count`).toHaveCount(expected.reference + expected.value);
    }
    await expect(page.locator(".editor-label[data-label-component-id]")).toHaveCount(expectedTotal);

    const beforeZoom = await labelGeometry(page);
    expect(beforeZoom, `${demo.id} should render expected component properties`).toHaveLength(expectedTotal);
    assertLabelGeometry(demo.id, beforeZoom);
    const pinsBeforeZoom = await pinLeadGeometry(page, demo.document.components);
    assertPinLeadGeometry(demo.id, demo.document.components, pinsBeforeZoom);
    await assertExpectedVirtualCues(page, demo.id);

    const stagedBaseline = testInfo.outputPath(`${demo.id}-baseline.png`);
    const stagedZoomed = testInfo.outputPath(`${demo.id}-zoomed.png`);
    mkdirSync(dirname(stagedBaseline), { recursive: true });

    await page.screenshot({
      path: stagedBaseline,
      fullPage: true,
      animations: "disabled",
    });

    const editor = page.locator(".schematic-editor");
    const editorBox = await editor.boundingBox();
    if (!editorBox) throw new Error(`${demo.id} editor is not visible`);
    const world = page.locator(".editor-world");
    const transformBefore = await world.getAttribute("transform");
    await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height / 2);
    await page.mouse.wheel(0, -240);
    await expect.poll(() => world.getAttribute("transform"), { message: `${demo.id} should respond to real pointer-wheel zoom` }).not.toBe(transformBefore);

    const afterZoom = await labelGeometry(page);
    assertLabelGeometry(`${demo.id}:zoomed`, afterZoom);
    const pinsAfterZoom = await pinLeadGeometry(page, demo.document.components);
    assertPinLeadGeometry(`${demo.id}:zoomed`, demo.document.components, pinsAfterZoom);
    await assertExpectedVirtualCues(page, demo.id);
    expect(afterZoom, `${demo.id} should keep all component properties after zoom`).toHaveLength(expectedTotal);
    const afterByKey = new Map(afterZoom.map((label) => [`${label.component}:${label.property}`, label]));
    for (const before of beforeZoom) {
      const key = `${before.component}:${before.property}`;
      const after = afterByKey.get(key);
      expect(after, `${demo.id}:${key} is missing after zoom`).toBeDefined();
      expect(after!.side, `${demo.id}:${key} changed side after zoom`).toBe(before.side);
      expect(Math.abs(after!.gap - before.gap), `${demo.id}:${key} changed symbol gap after zoom`).toBeLessThanOrEqual(2.5);
      expect(Math.abs(after!.along - before.along), `${demo.id}:${key} shifted along its symbol after zoom`).toBeLessThanOrEqual(2.5);
    }

    await page.screenshot({
      path: stagedZoomed,
      fullPage: true,
      animations: "disabled",
    });

    await page.waitForTimeout(100);
    await expect(page.locator(".error-toast")).toHaveCount(0);
    expect(browserErrors).toEqual([]);

    // Promotion is deliberately last: a failed assertion can leave staging artifacts,
    // but cannot overwrite a previously reviewed evidence image.
    mkdirSync(evidenceDirectory, { recursive: true });
    copyFileSync(stagedBaseline, resolve(evidenceDirectory, `${demo.id}.png`));
    copyFileSync(stagedZoomed, resolve(evidenceDirectory, `${demo.id}-zoomed.png`));
  });
}
