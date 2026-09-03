import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const shots=resolve(import.meta.dirname,"../test-results/editor-captures");
const componentPoint=async(page:Page,id:string,point:[number,number])=>page.locator(`[data-component-id="${id}"]`).evaluate((element,[x,y])=>{const matrix=(element as SVGGraphicsElement).getScreenCTM();if(!matrix)throw new Error("Component transform missing");const screen=new DOMPoint(x,y).matrixTransform(matrix);return{x:screen.x,y:screen.y};},point);
const worldPoint=async(page:Page,point:[number,number])=>page.locator(".editor-world").evaluate((element,[x,y])=>{const matrix=(element as SVGGraphicsElement).getScreenCTM();if(!matrix)throw new Error("World transform missing");const screen=new DOMPoint(x,y).matrixTransform(matrix);return{x:screen.x,y:screen.y};},point);
const componentTransformState=async(page:Page,id:string)=>page.locator(`[data-component-id="${id}"]`).evaluate(element=>{const transform=element.getAttribute("transform")??"";const rotationMatch=/rotate\((-?\d+(?:\.\d+)?)\)/.exec(transform);const scaleMatch=/scale\((-?\d+(?:\.\d+)?)\s+/.exec(transform);const rawMirror=(element as SVGGraphicsElement).dataset.mirror;return{rotation:Number((element as SVGGraphicsElement).dataset.rotation??rotationMatch?.[1]??0),mirror:rawMirror===undefined?Number(scaleMatch?.[1]??1)<0:rawMirror==="true"||rawMirror==="1"};});
type PropertyAttachment={componentId:string;property:string;dx:number;dy:number;gap:number};
const propertyAttachments=async(page:Page,componentIds:string[])=>page.evaluate((ids)=>ids.flatMap(componentId=>{const symbol=document.querySelector<SVGGraphicsElement>(`[data-component-id="${componentId}"] .editor-symbol`);if(!symbol)throw new Error(`Missing symbol ${componentId}`);const symbolBox=symbol.getBoundingClientRect();return[...document.querySelectorAll<SVGTextElement>(`[data-label-component-id="${componentId}"]`)].map(label=>{const labelBox=label.getBoundingClientRect();const gapX=Math.max(symbolBox.left-labelBox.right,labelBox.left-symbolBox.right,0);const gapY=Math.max(symbolBox.top-labelBox.bottom,labelBox.top-symbolBox.bottom,0);return{componentId,property:label.dataset.property??"",dx:labelBox.left-symbolBox.left,dy:labelBox.top-symbolBox.top,gap:Math.hypot(gapX,gapY)};});}),componentIds) as Promise<PropertyAttachment[]>;
const expectStableAttachments=(baseline:PropertyAttachment[],current:PropertyAttachment[])=>{expect(current.map(({componentId,property})=>`${componentId}:${property}`).sort()).toEqual(baseline.map(({componentId,property})=>`${componentId}:${property}`).sort());for(const before of baseline){const after=current.find(item=>item.componentId===before.componentId&&item.property===before.property);expect(after,`Missing ${before.componentId} ${before.property} property`).toBeDefined();expect(after!.dx).toBeCloseTo(before.dx,0);expect(after!.dy).toBeCloseTo(before.dy,0);expect(after!.gap).toBeLessThanOrEqual(24);}};
const expectSimulatorHeader=async(page:Page)=>{await expect(page.locator(".wordmark")).toHaveText("Robonyx");await expect(page.getByRole("navigation",{name:"Robonyx products"}).getByText("Simulator",{exact:true})).toHaveAttribute("aria-current","page");};
const loadFreshEditor=async(page:Page)=>{await page.goto("/");await page.evaluate(async()=>{localStorage.clear();localStorage.setItem("schemagic.onboarding.v1.completed","1");sessionStorage.clear();await new Promise<void>(resolve=>{const request=indexedDB.deleteDatabase("schemagic-simulator");request.onsuccess=()=>resolve();request.onerror=()=>resolve();request.onblocked=()=>resolve();});});await page.reload();await expect(page.getByTestId("engine-ready")).toBeVisible({timeout:45_000});await page.waitForFunction(()=>[...document.querySelectorAll<SVGPathElement>("path.editor-wire")].some(wire=>getComputedStyle(wire).stroke!=="rgb(110, 115, 120)"));};
test.beforeAll(()=>mkdirSync(shots,{recursive:true}));
test.describe("cross-browser editor MVP",()=>{
test.beforeEach(async({page})=>loadFreshEditor(page));
test("editor MVP workflow",async({page,context,browserName},testInfo)=>{test.slow();
  if(browserName==="chromium")await context.grantPermissions(["clipboard-read","clipboard-write"],{origin:new URL(page.url()).origin});
  else await page.evaluate(()=>{let value="";Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{value=text;},readText:async()=>value}});});
  if(testInfo.project.name==="chromium")await page.screenshot({path:testInfo.outputPath("default-bench.png"),fullPage:true});
  await expect(page.locator(".generic-tag")).toHaveText("generic");
  await page.locator('[data-component-id="c4"] .editor-component-hit').click({force:true});await expect(page.locator(".inspector .fidelity")).toHaveText("F2");
  await page.locator('[data-component-id="c2"] .editor-component-hit').click({force:true});await expect(page.locator(".generic-tag")).toHaveText("generic");await expect(page.locator("#wiper-percent")).toHaveText("50 %");
  const host=page.locator("#editor-host"),box=await host.boundingBox();if(!box)throw new Error("Editor host is not visible");
  await page.locator('[data-tool="resistor"]').click();await page.mouse.click(box.x+400,box.y+240);await expect(page.locator(".editor-component.selected")).toHaveCount(1);
  const value=page.locator("#component-value");await value.fill("4.7k");await value.evaluate(element=>(element as HTMLInputElement).blur());await expect(page.locator("#component-value")).toHaveValue("4.7k");
  await page.locator('[data-tool="wire"]').click();await page.mouse.click(box.x+384,box.y+240);await page.mouse.click(box.x+368,box.y+240);await page.mouse.dblclick(box.x+416,box.y+240);await expect(page.locator(".editor-wire-group")).toHaveCount(11);
  await page.locator('[data-tool="select"]').click();await page.locator(".schematic-editor").press(process.platform==="darwin"?"Meta+z":"Control+z");await expect(page.locator(".editor-wire-group")).toHaveCount(10);await page.locator(".schematic-editor").press(process.platform==="darwin"?"Meta+Shift+z":"Control+Shift+z");await expect(page.locator(".editor-wire-group")).toHaveCount(11);
  await page.mouse.move(box.x+375,box.y+220);await page.mouse.down();await page.mouse.move(box.x+425,box.y+260);await page.mouse.up();await expect(page.locator(".editor-component.selected")).toHaveCount(1);
  await page.locator(".schematic-editor").press(process.platform==="darwin"?"Meta+c":"Control+c");await page.locator(".schematic-editor").press(process.platform==="darwin"?"Meta+v":"Control+v");await expect(page.locator(".editor-component")).toHaveCount(11);
  await page.getByRole("button",{name:"Share URL"}).click();let copied=await page.evaluate(async()=>{try{return await Promise.race([navigator.clipboard.readText(),new Promise<string>(resolve=>setTimeout(()=>resolve(location.href),1_000))]);}catch{return location.href;}});if(!copied.includes("#c=")){await page.waitForFunction(()=>location.hash.startsWith("#c="));copied=page.url();}expect(copied).toContain("#c=");const shared=await context.newPage();await shared.goto(copied);await expectSimulatorHeader(shared);await expect(shared.locator(".editor-component")).toHaveCount(11);await shared.close();
  await page.waitForTimeout(500);const restored=await context.newPage();await restored.goto("/",{waitUntil:"domcontentloaded"});await expectSimulatorHeader(restored);await expect(restored.locator(".editor-component")).toHaveCount(11);const savedValue=await restored.evaluate(()=>new Promise<string|number|undefined>((resolve,reject)=>{const open=indexedDB.open("schemagic-simulator");open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,id=localStorage.getItem("schemagic.active-workspace");if(!id){resolve(undefined);return;}const request=db.transaction("workspaces").objectStore("workspaces").get(id);request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result?.document?.components?.find((item:{value?:string|number})=>item.value==="4.7k")?.value);};}));expect(savedValue).toBe("4.7k");await restored.close();
  expect(browserName).toMatch(/chromium|firefox|webkit/);
});
});

test.describe("Chromium editor interactions",()=>{
test.skip(({browserName})=>browserName!=="chromium","Detailed pointer, geometry and screenshot coverage runs once in Chromium");
test.beforeEach(async({page})=>loadFreshEditor(page));
test("renders live voltage, current and continuous pot drag",async({page})=>{
  const stroke=await page.locator('path.editor-wire[data-wire-id="w1"]').evaluate(element=>getComputedStyle(element).stroke);
  expect(stroke).toContain("oklch");
  expect(stroke).toContain("0.14");
  expect(stroke).not.toBe("rgb(110, 115, 120)");
  const branch=page.getByTestId("branch-current");
  await expect(branch).not.toContainText("--");
  await expect(branch).not.toContainText("–");
  expect((await branch.textContent())?.trim()??"").toMatch(/[0-9]/);

  const potHit=page.locator('[data-pot-hit="c2"]');
  expect(await potHit.evaluate(element=>element.tagName.toLowerCase())).toBe("circle");
  await expect(potHit).toHaveAttribute("data-testid","pot-wiper");
  const points=await Promise.all([0,-2/3,-4/3].map(y=>componentPoint(page,"c2",[0.95,y])));
  await page.mouse.move(points[0]!.x,points[0]!.y);
  await page.mouse.down();
  const displayed:string[]=[];
  for(const point of points.slice(1)){
    await page.mouse.move(point.x,point.y,{steps:4});
    displayed.push((await page.locator("#wiper-percent").textContent())??"");
  }
  expect(new Set(displayed).size).toBeGreaterThan(1);
  expect(displayed.every(value=>value!=="50 %")).toBeTruthy();
  const extremes=await Promise.all([4,-4].map(y=>componentPoint(page,"c2",[0.95,y])));
  await page.mouse.move(extremes[0]!.x,extremes[0]!.y);
  await expect(page.locator("#wiper-percent")).toHaveText("1 %");
  await page.mouse.move(extremes[1]!.x,extremes[1]!.y);
  await expect(page.locator("#wiper-percent")).toHaveText("100 %");
  await page.waitForTimeout(120);
  const haloOpacity=await page.locator('[data-led-halo="c6"]').evaluate(element=>Number(getComputedStyle(element).opacity));
  expect(haloOpacity).toBeGreaterThan(0);
  await expect(page.getByRole("button",{name:"Close scope"})).toBeVisible();
  await expect(page.locator("#scope-host > svg.scope-locus, #scope-host .scope-locus-line")).toHaveCount(0);
  const annotation=page.locator(".oc-waveform-viewer__annotation");
  await expect(annotation).toHaveText("Pot sweep");
  await page.screenshot({path:resolve(shots,"pot-live-drag.png"),fullPage:true});
  await page.mouse.up();
  const keepLocus=page.getByRole("button",{name:"Keep locus"});
  await expect(keepLocus).toBeVisible();
  await keepLocus.click();
  await expect(keepLocus).toBeHidden();
  await expect(annotation).toHaveText("Pot sweep");
  await page.locator(".oc-waveform-viewer__canvas").click();
  await expect(page.locator(".oc-waveform-viewer__readout")).toContainText("A:Pot sweep");
});

test("potentiometer external wiper pin starts a wire without adjusting the wiper",async({page})=>{
  const pinHit=page.locator('[data-pin-hit][data-pin-component="c2"][data-pin-index="1"]');
  expect(await pinHit.evaluate(element=>element.tagName.toLowerCase())).toBe("circle");
  const body=await componentPoint(page,"c2",[-0.4,0]);
  await page.mouse.click(body.x,body.y);
  await expect(page.locator("#wiper-percent")).toHaveText("50 %");
  const pin=await componentPoint(page,"c2",[2,0]);
  const target=await worldPoint(page,[24,26]);
  const wiperBefore=await page.locator("#wiper-percent").textContent();
  const potHitBefore=await page.locator('[data-pot-hit="c2"]').getAttribute("cy");

  await page.mouse.click(pin.x,pin.y);
  await page.mouse.move(target.x,target.y,{steps:4});

  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M20 22");
  await expect(page.locator("#wiper-percent")).toHaveText(wiperBefore??"50 %");
  await expect(page.locator('[data-pot-hit="c2"]')).toHaveAttribute("cy",potHitBefore!);
  await page.keyboard.press("Escape");
  await expect(page.locator(".wire-preview")).toHaveCount(0);
});
test("imports a sanitized model with pin mapping",async({page,context},testInfo)=>{test.skip(testInfo.project.name!=="chromium","Import screenshot is captured once in Chromium");await context.grantPermissions(["clipboard-read","clipboard-write"],{origin:new URL(page.url()).origin});await page.getByRole("button",{name:"Import models"}).click();await page.locator("#model-text").fill(`.subckt SAFE_D A K\n.model DM D(Is=1e-14)\nD1 A K DM\n.ends SAFE_D`);await page.getByRole("button",{name:"Parse and review"}).click();await expect(page.getByText("Parse results")).toBeVisible();await expect(page.getByText("Mapping is complete and bijective.")).toBeVisible();await expect(page.getByText("Blocked items")).toBeVisible();await page.screenshot({path:resolve(shots,"import-models.png"),fullPage:true});await page.locator("[data-subckt-index=\"0\"]").getByRole("button",{name:"Add imported part"}).click();await page.getByRole("dialog",{name:"Import models"}).getByRole("button",{name:"Close"}).click();await expect(page.getByText("IMPORTED",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Place imported SAFE_D"}).click();const box=await page.locator("#editor-host").boundingBox();if(!box)throw new Error("Editor host is not visible");await page.mouse.click(box.x+520,box.y+250);await expect(page.locator(".unverified-tag").last()).toHaveText("imported, unverified");await page.getByRole("button",{name:"Share URL"}).click();let sharedUrl="";await expect.poll(async()=>{sharedUrl=await page.evaluate(()=>navigator.clipboard.readText());return sharedUrl;}).toContain("#c=");const shared=await context.newPage();await shared.goto(sharedUrl);await expect(shared.getByText("IMPORTED",{exact:true})).toBeVisible();await expect(shared.getByRole("button",{name:"Place imported SAFE_D"})).toBeVisible();await shared.close();});
test("renders AC Bode twin panel with a probe",async({page},testInfo)=>{test.skip(testInfo.project.name!=="chromium","Bode screenshot is captured once in Chromium");await page.locator(".editor-hit").first().dispatchEvent("pointerdown",{button:0,pointerId:17,clientX:200,clientY:200});await page.locator(".schematic-editor").dispatchEvent("pointerup",{button:0,pointerId:17,clientX:200,clientY:200});await expect(page.locator(".scope-probe-marker")).toHaveCount(2);await page.locator('[data-mode="ac"]').click();await expect(page.locator("#scope-title")).toHaveText("AC RESPONSE");await expect(page.locator(".oc-waveform-viewer__trace")).toHaveCount(2,{timeout:45_000});await expect(page.locator(".scope-probe-marker")).toHaveCount(2);await page.screenshot({path:resolve(shots,"bode-waveform-viewer.png"),fullPage:true});});
test("captures wire and shortcut states",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Screenshots are captured once in Chromium");
  const host=page.locator("#editor-host"),box=await host.boundingBox();
  if(!box)throw new Error("Editor host is not visible");
  await page.locator('[data-tool="wire"]').click();
  await page.mouse.click(box.x+320,box.y+180);
  await page.mouse.move(box.x+420,box.y+240);
  await expect(page.locator(".wire-preview")).toBeVisible();
  await page.screenshot({path:resolve(shots,"editor-mid-wire.png"),fullPage:true});
  await page.getByRole("button",{name:"Keyboard shortcuts"}).click();
  const shortcuts=page.getByRole("dialog",{name:"Keyboard shortcuts"});
  await expect(shortcuts).toBeVisible();
  for(const label of [
    "Start a wire from the pointer",
    "Drag selection and keep connected wires attached",
    "Move selection and leave connected wires behind",
    "Mirror selection or pending part top/bottom",
    "Join wires at the crossing under the pointer",
    "Remove the last wire corner",
    "Open context actions; right-drag pans",
    "Close or cancel; press again to clear selection",
    "Fit circuit",
    "Pan without changing the circuit",
  ])await expect(shortcuts.getByText(label,{exact:true})).toBeVisible();
  await page.screenshot({path:resolve(shots,"shortcut-help.png"),fullPage:true});
  await shortcuts.getByRole("button",{name:"Close"}).click();
  await page.getByRole("button",{name:"About + licences"}).click();
  const about=page.getByRole("dialog",{name:"About and licences"});
  await expect(about.getByText("ngspice-46")).toBeVisible();
  await expect(about.getByText("KLU and SuiteSparse")).toBeVisible();
  await expect(about.getByText("SPARSE 1.3")).toBeVisible();
  await expect(about.getByText("Emscripten 5.0.7")).toBeVisible();
  await expect(about.getByRole("link")).toHaveCount(4);
});

test("anchor-snap drag keeps attached wires rubber-banded",async({page},testInfo)=>{test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");const edge=await componentPoint(page,"c3",[.5,.45]);const destination=await worldPoint(page,[36,25]);await page.mouse.move(edge.x,edge.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:4});await page.mouse.up();const state=await page.evaluate(()=>{const component=document.querySelector<SVGGElement>('[data-component-id="c3"]');const wire=document.querySelector<SVGPathElement>('path.editor-wire[data-wire-id="w5"]');const next=document.querySelector<SVGPathElement>('path.editor-wire[data-wire-id="w6"]');return{anchor:[Number(component?.dataset.anchorX),Number(component?.dataset.anchorY)],left:wire?.getAttribute("d"),right:next?.getAttribute("d")};});expect(state.anchor).toEqual([36,25]);expect(state.left).toContain("L34 25");expect(state.right).toContain("M38 25");expect(state.left).not.toMatch(/L\d+ \d+L\d+ \d+(?:\.\d+)?/);});

test("wire starts from a dangling pin and magnet-snaps exactly",async({page},testInfo)=>{test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");await page.locator('[data-tool="resistor"]').click();const placement=await worldPoint(page,[26,26]);await page.mouse.move(placement.x,placement.y);await page.mouse.click(placement.x,placement.y);const start=await componentPoint(page,"c10",[2,0]);const end=await worldPoint(page,[34,28]);await page.mouse.move(start.x,start.y);await page.mouse.click(start.x,start.y);await page.mouse.move(end.x,end.y);await expect(page.locator(".wire-preview")).toBeVisible();await page.keyboard.press("Enter");expect(await page.locator(".wire-preview").count()).toBe(0);await page.waitForTimeout(80);const paths=await page.locator("path.editor-wire").evaluateAll(elements=>elements.map(element=>element.getAttribute("d")));expect(paths).toContain("M28 26 L34 26 L34 28");});

test("wire end on another wire inserts a junction",async({page},testInfo)=>{test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");const start=await worldPoint(page,[28,28]);const middle=await worldPoint(page,[28,11]);await page.locator('[data-tool="wire"]').click();await page.mouse.move(start.x,start.y);await page.mouse.click(start.x,start.y);await page.mouse.move(middle.x,middle.y);await page.mouse.click(middle.x,middle.y);const paths=await page.locator("path.editor-wire").evaluateAll(elements=>elements.map(element=>element.getAttribute("d")));expect(paths).toContain("M28 28 L28 11");const d=await page.locator('path.editor-wire[data-wire-id="w1"]').getAttribute("d");expect(d).toContain("L28 11");await expect(page.locator('.connection-node.junction[cx="28"][cy="11"]')).toHaveCount(1);});

test("dangling-pin indicator clears when the pin is wired",async({page},testInfo)=>{test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");await page.locator('[data-tool="resistor"]').click();const placement=await worldPoint(page,[26,26]);await page.mouse.move(placement.x,placement.y);await page.mouse.click(placement.x,placement.y);await expect(page.locator('.pin-open[data-pin-component="c10"]')).toHaveCount(2);const start=await componentPoint(page,"c10",[-2,0]);const end=await worldPoint(page,[22,30]);await page.mouse.move(start.x,start.y);await page.mouse.click(start.x,start.y);await page.mouse.move(end.x,end.y);await page.keyboard.press("Enter");await expect(page.locator('.pin-open[data-pin-component="c10"]')).toHaveCount(1);});

test("real-pointer multi-select drag and directional marquee follow KiCad semantics",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const c3=await componentPoint(page,"c3",[0,0]);
  const c4=await componentPoint(page,"c4",[0,0]);
  await page.mouse.click(c3.x,c3.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(c4.x,c4.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".editor-component.selected")).toHaveCount(2);
  const attachmentsBefore=await propertyAttachments(page,["c3","c4"]);
  expect(attachmentsBefore.map(({componentId,property})=>`${componentId}:${property}`).sort()).toEqual(["c3:reference","c3:value","c4:reference"]);
  const selectionStyle=await page.locator('[data-component-id="c3"] .editor-selection').evaluate(element=>{const style=getComputedStyle(element);return{display:style.display,stroke:style.stroke,strokeWidth:style.strokeWidth,strokeDasharray:style.strokeDasharray,vectorEffect:style.vectorEffect};});
  expect(selectionStyle.display).not.toBe("none");
  expect(selectionStyle.strokeWidth).toBe("1.25px");
  expect(selectionStyle.strokeDasharray).not.toBe("none");
  expect(selectionStyle.vectorEffect).toBe("non-scaling-stroke");
  const componentCursor=await page.locator('[data-component-id="c3"] .editor-component-hit').evaluate(element=>getComputedStyle(element).cursor);
  expect(componentCursor).toBe(await page.locator(".schematic-editor").evaluate(element=>getComputedStyle(element).cursor));

  const destination=await worldPoint(page,[36,26]);
  await page.mouse.move(c3.x,c3.y);
  await page.mouse.down();
  await page.mouse.move(destination.x,destination.y,{steps:6});
  await expect(page.locator(".schematic-editor")).toHaveAttribute("data-interaction","drag");
  const dragCursors=await page.evaluate(()=>({
    root:getComputedStyle(document.querySelector(".schematic-editor")!).cursor,
    component:getComputedStyle(document.querySelector('[data-component-id="c3"] .editor-component-hit')!).cursor,
    pin:getComputedStyle(document.querySelector('[data-pin-hit][data-pin-component="c3"]')!).cursor,
    pot:getComputedStyle(document.querySelector('[data-pot-hit="c2"]')!).cursor,
  }));
  expect(dragCursors).toEqual({root:"grabbing",component:"grabbing",pin:"grabbing",pot:"grabbing"});
  expectStableAttachments(attachmentsBefore,await propertyAttachments(page,["c3","c4"]));
  await page.mouse.up();
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","36");
  await expect(page.locator('[data-component-id="c4"]')).toHaveAttribute("data-anchor-x","48");
  await expect(page.locator('path.editor-wire[data-wire-id="w6"]')).toHaveAttribute("d","M38 26 L46 26");
  expectStableAttachments(attachmentsBefore,await propertyAttachments(page,["c3","c4"]));

  await page.locator(".schematic-editor").press(process.platform==="darwin"?"Meta+z":"Control+z");
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","32");
  await expect(page.locator('[data-component-id="c4"]')).toHaveAttribute("data-anchor-x","44");

  const leftTop=await worldPoint(page,[31,20]);
  const rightBottom=await worldPoint(page,[33,24]);
  await page.mouse.move(leftTop.x,leftTop.y);
  await page.mouse.down();
  await page.mouse.move(rightBottom.x,rightBottom.y,{steps:3});
  await expect(page.locator(".selection-box")).toHaveAttribute("data-selection-direction","contain");
  const containStyle=await page.locator(".selection-box").evaluate(element=>{const style=getComputedStyle(element);return{fill:style.fill,stroke:style.stroke,strokeWidth:style.strokeWidth,strokeDasharray:style.strokeDasharray,vectorEffect:style.vectorEffect,cursor:getComputedStyle(document.querySelector(".schematic-editor")!).cursor};});
  expect(containStyle.fill).toBe("rgba(232, 162, 68, 0.16)");
  expect(containStyle.stroke).toBe("rgb(232, 162, 68)");
  expect(containStyle.strokeWidth).toBe("1.25px");
  expect(containStyle.strokeDasharray).toBe("none");
  expect(containStyle.vectorEffect).toBe("non-scaling-stroke");
  expect(containStyle.cursor).toBe("crosshair");
  await page.mouse.up();
  await expect(page.locator('[data-component-id="c3"]')).not.toHaveClass(/selected/);

  await page.mouse.move(rightBottom.x,leftTop.y);
  await page.mouse.down();
  await page.mouse.move(leftTop.x,rightBottom.y,{steps:3});
  await expect(page.locator(".selection-box")).toHaveAttribute("data-selection-direction","crossing");
  const crossingStyle=await page.locator(".selection-box").evaluate(element=>{const style=getComputedStyle(element);return{fill:style.fill,stroke:style.stroke,strokeWidth:style.strokeWidth,strokeDasharray:style.strokeDasharray,vectorEffect:style.vectorEffect,cursor:getComputedStyle(document.querySelector(".schematic-editor")!).cursor};});
  expect(crossingStyle.fill).toBe("rgba(46, 134, 200, 0.12)");
  expect(crossingStyle.stroke).toBe("rgb(46, 134, 200)");
  expect(crossingStyle.strokeWidth).toBe("1.25px");
  expect(crossingStyle.strokeDasharray).toContain("6px");
  expect(crossingStyle.vectorEffect).toBe("non-scaling-stroke");
  expect(crossingStyle.cursor).toBe("cell");
  await page.mouse.up();
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);

  const command=process.platform==="darwin"?"Meta":"Control";
  await page.keyboard.down(command);
  await page.mouse.click(c3.x,c3.y);
  await page.keyboard.up(command);
  await expect(page.locator('[data-component-id="c3"]')).not.toHaveClass(/selected/);
  await page.keyboard.down("Shift");
  await page.mouse.click(c3.x,c3.y);
  await page.keyboard.up("Shift");
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);
});

test("component placement exposes grid, object-snap and modifier feedback",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const nearWire=await worldPoint(page,[26,10.45]);
  await page.locator('[data-tool="resistor"]').click();
  await page.mouse.move(nearWire.x,nearWire.y);
  await expect(page.locator(".schematic-editor")).toHaveAttribute("data-interaction","place");
  const placementCursors=await page.evaluate(()=>({
    root:getComputedStyle(document.querySelector(".schematic-editor")!).cursor,
    pin:getComputedStyle(document.querySelector('[data-pin-hit][data-pin-component="c2"]')!).cursor,
    pot:getComputedStyle(document.querySelector('[data-pot-hit="c2"]')!).cursor,
  }));
  expect(placementCursors).toEqual({root:"copy",pin:"copy",pot:"copy"});
  await expect(page.locator(".placement-ghost")).toHaveAttribute("data-anchor-y","11");
  await expect(page.locator('.snap-indicator[data-snap-kind="segment"]')).toBeVisible();
  await page.mouse.click(nearWire.x,nearWire.y);
  await expect(page.locator('[data-component-id="c10"]')).toHaveAttribute("data-anchor-y","11");
  await expect(page.locator('path.editor-wire[data-wire-id="w1"]')).toHaveAttribute("d",/L24 11$/);
  await expect(page.locator('path.editor-wire[data-wire-id="w10"]')).toHaveAttribute("d","M28 11 L58 11");
  await expect(page.locator('.pin-open[data-pin-component="c10"]')).toHaveCount(0);

  const withoutObjectSnap=await worldPoint(page,[36,10.2]);
  await page.locator('[data-tool="resistor"]').click();
  await page.keyboard.down("Shift");
  await page.mouse.move(withoutObjectSnap.x,withoutObjectSnap.y);
  await expect(page.locator(".placement-ghost")).toHaveAttribute("data-anchor-y","10");
  await expect(page.locator(".snap-indicator")).toHaveCount(0);
  await page.mouse.click(withoutObjectSnap.x,withoutObjectSnap.y);
  await page.keyboard.up("Shift");
  await expect(page.locator('[data-component-id="c11"]')).toHaveAttribute("data-anchor-y","10");
  await expect(page.locator('.pin-open[data-pin-component="c11"]')).toHaveCount(2);

  const offGrid=await worldPoint(page,[26.37,27.42]);
  const command=process.platform==="darwin"?"Meta":"Control";
  await page.locator('[data-tool="resistor"]').click();
  await page.keyboard.down(command);
  await page.mouse.move(offGrid.x,offGrid.y);
  await page.mouse.click(offGrid.x,offGrid.y);
  await page.keyboard.up(command);
  const anchor=await page.locator('[data-component-id="c12"]').evaluate(element=>[Number((element as SVGGElement).dataset.anchorX),Number((element as SVGGElement).dataset.anchorY)]);
  expect(anchor[0]).toBeCloseTo(26.37,1);
  expect(anchor[1]).toBeCloseTo(27.42,1);
  expect(anchor.some(value=>!Number.isInteger(value))).toBeTruthy();
});

test("wire corners backtrack, switch posture and cancel without deleting selection",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const selected=await componentPoint(page,"c3",[0,0]);
  await page.mouse.click(selected.x,selected.y);
  await page.locator('[data-tool="wire"]').click();
  const start=await worldPoint(page,[24,27]);
  const first=await worldPoint(page,[27,27]);
  const second=await worldPoint(page,[30,27]);
  await page.mouse.click(start.x,start.y);
  await page.mouse.move(first.x,first.y);
  await page.mouse.click(first.x,first.y);
  await page.mouse.move(second.x,second.y);
  await page.mouse.click(second.x,second.y);
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27 L30 27");
  const previewStyle=await page.locator(".wire-preview").evaluate(element=>{const style=getComputedStyle(element);return{stroke:style.stroke,strokeWidth:style.strokeWidth,strokeDasharray:style.strokeDasharray,vectorEffect:style.vectorEffect,cursor:style.cursor};});
  expect(previewStyle.strokeWidth).toBe("1.25px");
  expect(previewStyle.strokeDasharray).toContain("6px");
  expect(previewStyle.vectorEffect).toBe("non-scaling-stroke");
  expect(previewStyle.cursor).toBe(await page.locator(".schematic-editor").evaluate(element=>getComputedStyle(element).cursor));
  await page.keyboard.press("Backspace");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27 L27 27");
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);

  const diagonal=await worldPoint(page,[30,30]);
  await page.mouse.move(diagonal.x,diagonal.y);
  const before=await page.locator(".wire-preview").getAttribute("d");
  await page.keyboard.press("/");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-bend","vertical-first");
  expect(await page.locator(".wire-preview").getAttribute("d")).not.toBe(before);

  const undo=process.platform==="darwin"?"Meta+z":"Control+z";
  await page.keyboard.press(undo);
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-checkpoints","1");
  await page.keyboard.press(undo);
  await expect(page.locator(".wire-preview")).toHaveCount(0);
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);

  const menu=page.locator(".schematic-context-menu");
  await page.mouse.click(start.x,start.y);
  await page.mouse.move(first.x,first.y);
  await page.mouse.click(first.x,first.y,{button:"right"});
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("data-context-mode","wire");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");
  await expect(menu.locator('[data-context-action="undo-wire-segment"]')).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");
  await page.mouse.click(first.x,first.y,{button:"right"});
  await menu.locator('[data-context-action="cancel-wire"]').click();
  await expect(menu).toBeHidden();
  await expect(page.locator(".wire-preview")).toHaveCount(0);
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);

  await page.mouse.click(start.x,start.y);
  await page.mouse.move(first.x,first.y);
  await page.mouse.click(first.x,first.y);
  await page.mouse.move(diagonal.x,diagonal.y);
  await page.mouse.click(diagonal.x,diagonal.y,{button:"right"});
  await menu.locator('[data-context-action="undo-wire-segment"]').click();
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");
  const postureBefore=await page.locator(".wire-preview").getAttribute("d");
  await page.mouse.click(diagonal.x,diagonal.y,{button:"right"});
  await menu.locator('[data-context-action="switch-wire-posture"]').click();
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-bend","vertical-first");
  expect(await page.locator(".wire-preview").getAttribute("d")).not.toBe(postureBefore);
  const wireCount=await page.locator(".editor-wire-group").count();
  await page.mouse.click(diagonal.x,diagonal.y,{button:"right"});
  await menu.locator('[data-context-action="finish-wire"]').click();
  await expect(page.locator(".wire-preview")).toHaveCount(0);
  await expect(page.locator(".editor-wire-group")).toHaveCount(wireCount+1);
  await page.locator(".schematic-editor").press(undo);
  await expect(page.locator(".editor-wire-group")).toHaveCount(wireCount);
  await page.keyboard.press("Escape");
  await expect(page.locator(".schematic-editor")).toHaveAttribute("data-interaction","select");

  await page.locator('[data-tool="wire"]').click();
  await page.mouse.click(start.x,start.y);
  await page.mouse.move(first.x,first.y);
  await page.keyboard.press("Enter");
  await page.locator('[data-tool="select"]').click();
  await page.mouse.click(first.x,first.y);
  await expect(page.locator(".schematic-editor")).toHaveAttribute("data-interaction","wire-active");
  await page.mouse.move(diagonal.x,diagonal.y);
  await expect(page.locator(".wire-preview")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("right drag pans without editing and right click opens tool-specific actions",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const world=page.locator(".editor-world");
  const menu=page.locator(".schematic-context-menu");
  const geometry=()=>page.evaluate(()=>({
    components:[...document.querySelectorAll<SVGGElement>("[data-component-id]")].map(element=>[element.dataset.componentId,element.dataset.anchorX,element.dataset.anchorY,element.dataset.rotation,element.dataset.mirror]),
    wires:[...document.querySelectorAll<SVGPathElement>("path.editor-wire")].map(element=>[element.dataset.wireId,element.getAttribute("d")]),
  }));
  await page.evaluate(()=>{
    const state=window as Window&{__editorContextPrevented?:boolean[];__editorPointerCapture?:string[]};
    state.__editorContextPrevented=[];
    state.__editorPointerCapture=[];
    const root=document.querySelector(".schematic-editor")!;
    root.addEventListener("contextmenu",event=>state.__editorContextPrevented!.push(event.defaultPrevented));
    root.addEventListener("gotpointercapture",()=>state.__editorPointerCapture!.push("got"));
    root.addEventListener("lostpointercapture",()=>state.__editorPointerCapture!.push("lost"));
  });
  const geometryBefore=await geometry();
  const transformBefore=await world.getAttribute("transform");
  const start=await worldPoint(page,[26,27]);
  const destination={x:start.x+72,y:start.y+44};

  await page.mouse.move(start.x,start.y);
  await page.mouse.down({button:"right"});
  await page.mouse.move(destination.x,destination.y,{steps:5});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await expect(menu).toBeHidden();
  await expect(editor).toHaveCSS("cursor","grabbing");
  await expect.poll(()=>page.evaluate(()=>(window as Window&{__editorPointerCapture?:string[]}).__editorPointerCapture?.includes("got"))).toBe(true);
  expect(await world.getAttribute("transform")).not.toBe(transformBefore);
  await page.keyboard.press("Escape");
  await expect(world).toHaveAttribute("transform",transformBefore!);
  await page.mouse.up({button:"right"});
  await expect(menu).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>(window as Window&{__editorPointerCapture?:string[]}).__editorPointerCapture?.includes("lost"))).toBe(true);
  expect(await geometry()).toEqual(geometryBefore);

  await page.evaluate(()=>{(window as Window&{__editorPointerCapture?:string[]}).__editorPointerCapture=[];});
  await page.mouse.move(start.x,start.y);
  await page.mouse.down({button:"right"});
  await page.mouse.move(destination.x,destination.y,{steps:5});
  await page.mouse.up({button:"right"});
  await expect(menu).toBeHidden();
  const committedTransform=await world.getAttribute("transform");
  expect(committedTransform).not.toBe(transformBefore);
  await expect.poll(()=>page.evaluate(()=>(window as Window&{__editorPointerCapture?:string[]}).__editorPointerCapture)).toEqual(["got","lost"]);
  await expect(editor).toHaveAttribute("data-interaction","select");
  expect(await geometry()).toEqual(geometryBefore);
  await editor.press(process.platform==="darwin"?"Meta+z":"Control+z");
  await expect(world).toHaveAttribute("transform",committedTransform!);
  expect(await geometry()).toEqual(geometryBefore);

  const middleStart=await worldPoint(page,[26,27]);
  const middleTransform=await world.getAttribute("transform");
  await page.mouse.move(middleStart.x,middleStart.y);
  await page.mouse.down({button:"middle"});
  await page.mouse.move(middleStart.x+28,middleStart.y+18,{steps:3});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await page.mouse.up({button:"middle"});
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(middleTransform);
  const spaceStart=await worldPoint(page,[26,27]);
  const spaceTransform=await world.getAttribute("transform");
  await page.keyboard.down("Space");
  await page.mouse.move(spaceStart.x,spaceStart.y);
  await page.mouse.down();
  await page.mouse.move(spaceStart.x+24,spaceStart.y-16,{steps:3});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(spaceTransform);
  expect(await geometry()).toEqual(geometryBefore);

  await page.locator('[data-tool="wire"]').click();
  const wireStart=await worldPoint(page,[24,27]);
  const wireEnd=await worldPoint(page,[27,27]);
  await page.mouse.click(wireStart.x,wireStart.y);
  await page.mouse.move(wireEnd.x,wireEnd.y);
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");
  const activeMiddleTransform=await world.getAttribute("transform");
  await page.mouse.down({button:"middle"});
  await page.mouse.move(wireEnd.x+36,wireEnd.y+24,{steps:4});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await page.keyboard.press("Escape");
  await expect(world).toHaveAttribute("transform",activeMiddleTransform!);
  await page.mouse.up({button:"middle"});
  await expect(editor).toHaveAttribute("data-interaction","wire-active");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");

  const activeSpaceStart=await worldPoint(page,[27,27]);
  const activeSpaceTransform=await world.getAttribute("transform");
  await page.keyboard.down("Space");
  await page.mouse.move(activeSpaceStart.x,activeSpaceStart.y);
  await page.mouse.down();
  await page.mouse.move(activeSpaceStart.x+32,activeSpaceStart.y-20,{steps:4});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(activeSpaceTransform);
  await expect(editor).toHaveAttribute("data-interaction","wire-active");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");

  const rightStart=await worldPoint(page,[27,27]);
  const activeTransform=await world.getAttribute("transform");
  const activeDestination={x:rightStart.x+56,y:rightStart.y+32};
  await page.mouse.move(rightStart.x,rightStart.y);
  await page.mouse.down({button:"right"});
  await page.mouse.move(activeDestination.x,activeDestination.y,{steps:5});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await expect(menu).toBeHidden();
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");
  expect(await geometry()).toEqual(geometryBefore);
  await page.keyboard.press("Escape");
  await expect(world).toHaveAttribute("transform",activeTransform!);
  await page.mouse.up({button:"right"});
  await expect(menu).toBeHidden();
  await expect(editor).toHaveAttribute("data-interaction","wire-active");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");

  await page.mouse.move(rightStart.x,rightStart.y);
  await page.mouse.down({button:"right"});
  await page.mouse.move(activeDestination.x,activeDestination.y,{steps:5});
  await page.mouse.up({button:"right"});
  await expect(menu).toBeHidden();
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(activeTransform);
  await expect(editor).toHaveAttribute("data-interaction","wire-active");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");

  await page.evaluate(()=>{(window as Window&{__editorContextPrevented?:boolean[]}).__editorContextPrevented=[];});
  await page.mouse.click(activeDestination.x,activeDestination.y,{button:"right"});
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("data-context-mode","wire");
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M24 27");
  await expect.poll(()=>page.evaluate(()=>(window as Window&{__editorContextPrevented?:boolean[]}).__editorContextPrevented?.at(-1))).toBe(true);
  expect(await geometry()).toEqual(geometryBefore);
  await menu.locator('[data-context-action="cancel-wire"]').click();
  await expect(menu).toBeHidden();
  await expect(page.locator(".wire-preview")).toHaveCount(0);
  expect(await geometry()).toEqual(geometryBefore);
});

test("right-click object actions preserve selection and drive component and wire gestures",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const menu=page.locator(".schematic-context-menu");
  const undo=process.platform==="darwin"?"Meta+z":"Control+z";
  const openComponentMenu=async()=>{
    const point=await componentPoint(page,"c3",[0,0]);
    await page.mouse.click(point.x,point.y,{button:"right"});
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("data-context-mode","selection");
  };

  await openComponentMenu();
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);
  await expect(menu.locator('[data-context-action="move"]')).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.locator('[data-context-action="delete"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(menu.locator('[data-context-action="move"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.locator('[data-context-action="drag"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.locator('[data-component-id="c3"]')).toHaveClass(/selected/);

  await openComponentMenu();
  const blank=await worldPoint(page,[24,18]);
  await page.mouse.click(blank.x,blank.y);
  await expect(menu).toBeHidden();
  await expect(page.locator(".editor-component.selected")).toHaveCount(0);

  const c3=await componentPoint(page,"c3",[0,0]);
  await page.mouse.click(c3.x,c3.y);
  const c4=await componentPoint(page,"c4",[0,0]);
  await page.keyboard.down("Shift");
  await page.mouse.click(c4.x,c4.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".editor-component.selected")).toHaveCount(2);
  await openComponentMenu();
  await expect(page.locator(".editor-component.selected")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-component.selected")).toHaveCount(0);

  await openComponentMenu();
  await menu.locator('[data-context-action="rotate-ccw"]').click();
  expect(await componentTransformState(page,"c3")).toEqual({rotation:270,mirror:false});
  await editor.press(undo);
  expect(await componentTransformState(page,"c3")).toEqual({rotation:0,mirror:false});

  await openComponentMenu();
  await menu.locator('[data-context-action="mirror-x"]').click();
  expect(await componentTransformState(page,"c3")).toEqual({rotation:0,mirror:true});
  await editor.press(undo);
  expect(await componentTransformState(page,"c3")).toEqual({rotation:0,mirror:false});

  await openComponentMenu();
  await menu.locator('[data-context-action="mirror-y"]').click();
  expect(await componentTransformState(page,"c3")).toEqual({rotation:180,mirror:true});
  await editor.press(undo);
  expect(await componentTransformState(page,"c3")).toEqual({rotation:0,mirror:false});

  const leftBefore=await page.locator('path.editor-wire[data-wire-id="w5"]').getAttribute("d");
  const rightBefore=await page.locator('path.editor-wire[data-wire-id="w6"]').getAttribute("d");
  const destination=await worldPoint(page,[36,25]);
  await openComponentMenu();
  await menu.locator('[data-context-action="drag"]').click();
  await expect(editor).toHaveAttribute("data-interaction","drag");
  await page.mouse.move(destination.x,destination.y,{steps:5});
  await page.mouse.click(destination.x,destination.y);
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","36");
  expect(await page.locator('path.editor-wire[data-wire-id="w5"]').getAttribute("d")).not.toBe(leftBefore);
  await editor.press(undo);
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","32");
  await expect(page.locator('path.editor-wire[data-wire-id="w5"]')).toHaveAttribute("d",leftBefore!);
  await expect(page.locator('path.editor-wire[data-wire-id="w6"]')).toHaveAttribute("d",rightBefore!);

  await openComponentMenu();
  await menu.locator('[data-context-action="move"]').click();
  await expect(editor).toHaveAttribute("data-interaction","move");
  await page.mouse.move(destination.x,destination.y,{steps:5});
  await page.mouse.click(destination.x,destination.y);
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","36");
  await expect(page.locator('path.editor-wire[data-wire-id="w5"]')).toHaveAttribute("d",leftBefore!);
  await expect(page.locator('path.editor-wire[data-wire-id="w6"]')).toHaveAttribute("d",rightBefore!);
  await editor.press(undo);

  await openComponentMenu();
  await menu.locator('[data-context-action="delete"]').click();
  await expect(page.locator('[data-component-id="c3"]')).toHaveCount(0);
  await editor.press(undo);
  await expect(page.locator('[data-component-id="c3"]')).toHaveCount(1);

  const segment=await worldPoint(page,[38,11]);
  const nearSegment={x:segment.x,y:segment.y+4};
  await page.mouse.click(nearSegment.x,nearSegment.y,{button:"right"});
  await expect(menu).toBeVisible();
  await expect(page.locator('.editor-wire-group[data-wire-id="w1"]')).toHaveClass(/selected/);
  await expect(menu.locator('[data-context-action="rotate-ccw"]')).toHaveCount(0);
  await menu.locator('[data-context-action="drag"]').click();
  await expect(editor).toHaveAttribute("data-interaction","wire-reroute");
  await page.keyboard.press("Escape");

  await page.mouse.click(nearSegment.x,nearSegment.y,{button:"right"});
  await menu.locator('[data-context-action="move"]').click();
  await expect(editor).toHaveAttribute("data-interaction","wire-block-move");
  await page.keyboard.press("Escape");
});

test("middle and Space pans preserve keyboard G and M gestures",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const world=page.locator(".editor-world");
  const component=page.locator('[data-component-id="c3"]');
  const leftWire=page.locator('path.editor-wire[data-wire-id="w5"]');
  const rightWire=page.locator('path.editor-wire[data-wire-id="w6"]');
  const origin=await componentPoint(page,"c3",[0,0]);
  const componentBefore=await component.getAttribute("transform");
  const leftBefore=await leftWire.getAttribute("d");
  const rightBefore=await rightWire.getAttribute("d");
  await page.mouse.click(origin.x,origin.y);

  await page.keyboard.press("g");
  await expect(editor).toHaveAttribute("data-interaction","drag");
  const gViewBefore=await world.getAttribute("transform");
  await page.mouse.down({button:"middle"});
  await page.mouse.move(origin.x+48,origin.y+28,{steps:4});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await page.mouse.up({button:"middle"});
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(gViewBefore);
  await expect(editor).toHaveAttribute("data-interaction","drag");
  await expect(component).toHaveAttribute("transform",componentBefore!);
  await expect(leftWire).toHaveAttribute("d",leftBefore!);
  await expect(rightWire).toHaveAttribute("d",rightBefore!);
  await page.keyboard.press("Escape");

  await page.keyboard.press("m");
  await expect(editor).toHaveAttribute("data-interaction","move");
  const mViewBefore=await world.getAttribute("transform");
  const mPointer=await worldPoint(page,[32,22]);
  await page.keyboard.down("Space");
  await page.mouse.move(mPointer.x,mPointer.y);
  await page.mouse.down();
  await page.mouse.move(mPointer.x+44,mPointer.y-24,{steps:4});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  await page.keyboard.press("Escape");
  await expect(world).toHaveAttribute("transform",mViewBefore!);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect(editor).toHaveAttribute("data-interaction","move");
  await expect(component).toHaveAttribute("transform",componentBefore!);
  await expect(leftWire).toHaveAttribute("d",leftBefore!);
  await expect(rightWire).toHaveAttribute("d",rightBefore!);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveAttribute("data-interaction","select");
});

test("wheel and fit stay isolated from a live pan and persist coherently afterward",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const world=page.locator(".editor-world");
  const storedView=()=>page.evaluate(()=>new Promise<{pan:[number,number];zoom:number}|undefined>((resolve,reject)=>{
    const open=indexedDB.open("schemagic-simulator");
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const id=localStorage.getItem("schemagic.active-workspace");
      if(!id){resolve(undefined);return;}
      const request=open.result.transaction("workspaces").objectStore("workspaces").get(id);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>resolve(request.result?.document?.view);
    };
  }));
  const viewFromTransform=(transform:string)=>{
    const match=/translate\(([-\d.eE]+) ([-\d.eE]+)\) scale\(([-\d.eE]+)\)/.exec(transform);
    if(!match)throw new Error(`Unexpected world transform: ${transform}`);
    return{pan:[Number(match[1]),Number(match[2])] as [number,number],zoom:Number(match[3])/8};
  };
  const viewError=(actual:{pan:[number,number];zoom:number}|undefined,expected:{pan:[number,number];zoom:number})=>actual
    ?Math.max(Math.abs(actual.pan[0]-expected.pan[0]),Math.abs(actual.pan[1]-expected.pan[1]),Math.abs(actual.zoom-expected.zoom))
    :Number.POSITIVE_INFINITY;
  await expect.poll(storedView).toBeDefined();
  const transformBefore=(await world.getAttribute("transform"))!;
  await expect.poll(async()=>viewError(await storedView(),viewFromTransform(transformBefore))).toBeLessThan(1e-8);
  const start=await worldPoint(page,[26,27]);
  const destination={x:start.x+68,y:start.y+42};

  await page.mouse.move(start.x,start.y);
  await page.mouse.down({button:"right"});
  await page.mouse.move(destination.x,destination.y,{steps:4});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  const rightPanTransform=await world.getAttribute("transform");
  await page.mouse.wheel(0,-240);
  await page.keyboard.press("f");
  await expect(world).toHaveAttribute("transform",rightPanTransform!);
  await page.keyboard.press("Escape");
  await expect(world).toHaveAttribute("transform",transformBefore);
  await page.mouse.up({button:"right"});

  const middleStart=await worldPoint(page,[26,27]);
  await page.mouse.move(middleStart.x,middleStart.y);
  await page.mouse.down({button:"middle"});
  await page.mouse.move(middleStart.x-52,middleStart.y+30,{steps:4});
  await expect(editor).toHaveAttribute("data-interaction","panning");
  const middlePanTransform=await world.getAttribute("transform");
  await page.mouse.wheel(0,240);
  await page.keyboard.press("f");
  await expect(world).toHaveAttribute("transform",middlePanTransform!);
  await editor.dispatchEvent("pointercancel",{pointerId:1});
  await page.mouse.up({button:"middle"});
  await expect(world).toHaveAttribute("transform",transformBefore);
  await expect.poll(async()=>viewError(await storedView(),viewFromTransform(transformBefore))).toBeLessThan(1e-8);

  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({timeout:45_000});
  await expect(world).toHaveAttribute("transform",transformBefore);
  const zoomPoint=await worldPoint(page,[30,22]);
  await page.mouse.move(zoomPoint.x,zoomPoint.y);
  await page.mouse.wheel(0,-240);
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(transformBefore);
  const zoomedTransform=await world.getAttribute("transform");
  await editor.press("f");
  await expect.poll(()=>world.getAttribute("transform")).not.toBe(zoomedTransform);
  const fittedTransform=(await world.getAttribute("transform"))!;
  const fittedView=viewFromTransform(fittedTransform);
  await expect.poll(async()=>viewError(await storedView(),fittedView)).toBeLessThan(1e-8);
  await page.reload();
  await expect(page.getByTestId("engine-ready")).toBeVisible({timeout:45_000});
  await expect(world).toHaveAttribute("transform",fittedTransform);
});

test("G reroutes connected wires, M detaches, and Escape restores the gesture",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const origin=await componentPoint(page,"c3",[0,0]);
  const destination=await worldPoint(page,[36,25]);
  const leftBefore=await page.locator('path.editor-wire[data-wire-id="w5"]').getAttribute("d");
  const rightBefore=await page.locator('path.editor-wire[data-wire-id="w6"]').getAttribute("d");
  await page.mouse.click(origin.x,origin.y);
  await page.keyboard.press("g");
  await page.mouse.move(destination.x,destination.y,{steps:4});
  await page.keyboard.press("r");
  await page.keyboard.press("x");
  await expect(page.locator(".schematic-editor")).toHaveAttribute("data-interaction","drag");
  await expect(page.locator('.pin-open[data-pin-component="c3"]')).toHaveCount(0);
  expect(await page.locator('path.editor-wire[data-wire-id="w5"]').getAttribute("d")).not.toBe(leftBefore);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("transform","translate(32 22) rotate(0) scale(1 1)");
  await expect(page.locator('path.editor-wire[data-wire-id="w5"]')).toHaveAttribute("d",leftBefore!);
  await expect(page.locator('path.editor-wire[data-wire-id="w6"]')).toHaveAttribute("d",rightBefore!);

  await page.mouse.move(origin.x,origin.y);
  await page.keyboard.press("m");
  await page.mouse.move(destination.x,destination.y,{steps:4});
  await page.mouse.click(destination.x,destination.y);
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","36");
  await expect(page.locator('path.editor-wire[data-wire-id="w5"]')).toHaveAttribute("d",leftBefore!);
  await expect(page.locator('.pin-open[data-pin-component="c3"]')).toHaveCount(2);
  await page.locator(".schematic-editor").press(process.platform==="darwin"?"Meta+z":"Control+z");
  await expect(page.locator('[data-component-id="c3"]')).toHaveAttribute("data-anchor-x","32");
});

test("real-pointer wire segment reroute supports cancel and undo",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const wire=page.locator('path.editor-wire[data-wire-id="w1"]');
  const hit=page.locator('path.editor-hit[data-wire-id="w1"]');
  const original=await wire.getAttribute("d");
  expect(original).toBeTruthy();
  const segment=await worldPoint(page,[38,11]);
  const nearSegment={x:segment.x,y:segment.y+4};
  const rerouted=await worldPoint(page,[38,13]);
  const wireStyleBefore=await wire.evaluate(element=>{const style=getComputedStyle(element);return{stroke:style.stroke,strokeWidth:style.strokeWidth};});
  const hitStyle=await hit.evaluate(element=>{const style=getComputedStyle(element);return{strokeWidth:style.strokeWidth,vectorEffect:style.vectorEffect,pointerEvents:style.pointerEvents,cursor:style.cursor};});
  expect(hitStyle.strokeWidth).toBe("10px");
  expect(hitStyle.vectorEffect).toBe("non-scaling-stroke");
  expect(hitStyle.pointerEvents).toBe("stroke");
  expect(hitStyle.cursor).toBe(await editor.evaluate(element=>getComputedStyle(element).cursor));
  await page.mouse.click(nearSegment.x,nearSegment.y);
  await expect(page.locator('.editor-wire-group[data-wire-id="w1"]')).toHaveClass(/selected/);
  const selectedWireStyle=await wire.evaluate(element=>{const style=getComputedStyle(element);return{stroke:style.stroke,strokeWidth:style.strokeWidth};});
  expect(selectedWireStyle.strokeWidth).toBe("2.8px");
  expect(selectedWireStyle.stroke).not.toBe(wireStyleBefore.stroke);

  await page.mouse.move(nearSegment.x,nearSegment.y);
  await page.mouse.down();
  await page.mouse.move(rerouted.x,rerouted.y,{steps:5});
  await expect(editor).toHaveAttribute("data-interaction","wire-reroute");
  const rerouteCursors=await page.evaluate(()=>({
    root:getComputedStyle(document.querySelector(".schematic-editor")!).cursor,
    wire:getComputedStyle(document.querySelector('path.editor-hit[data-wire-id="w1"]')!).cursor,
    pin:getComputedStyle(document.querySelector('[data-pin-hit][data-pin-component="c2"]')!).cursor,
    pot:getComputedStyle(document.querySelector('[data-pot-hit="c2"]')!).cursor,
  }));
  expect(rerouteCursors).toEqual({root:"move",wire:"move",pin:"move",pot:"move"});
  expect(await wire.getAttribute("d")).not.toBe(original);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(wire).toHaveAttribute("d",original!);

  await page.mouse.move(nearSegment.x,nearSegment.y);
  await page.mouse.down();
  await page.mouse.move(rerouted.x,rerouted.y,{steps:5});
  await page.mouse.up();
  await expect(wire).toHaveAttribute("d",/L18 11 L18 13 L58 13 L58 11$/);
  await editor.press(process.platform==="darwin"?"Meta+z":"Control+z");
  await expect(wire).toHaveAttribute("d",original!);

  const transformBeforeZoom=await page.locator(".editor-world").getAttribute("transform");
  await page.mouse.move(segment.x,segment.y);
  await page.mouse.wheel(0,-240);
  await expect.poll(()=>page.locator(".editor-world").getAttribute("transform"),{message:"Wheel input should change the world transform before the zoomed hit test"}).not.toBe(transformBeforeZoom);
  const zoomedSegment=await worldPoint(page,[38,11]);
  const nearZoomedSegment={x:zoomedSegment.x,y:zoomedSegment.y+4};
  const zoomedTarget=await worldPoint(page,[38,9]);
  expect(await hit.evaluate(element=>getComputedStyle(element).strokeWidth)).toBe("10px");
  await page.mouse.click(nearZoomedSegment.x,nearZoomedSegment.y);
  await expect(page.locator('.editor-wire-group[data-wire-id="w1"]')).toHaveClass(/selected/);
  await page.mouse.move(nearZoomedSegment.x,nearZoomedSegment.y);
  await page.mouse.down();
  await page.mouse.move(zoomedTarget.x,zoomedTarget.y,{steps:5});
  await expect(editor).toHaveAttribute("data-interaction","wire-reroute");
  expect(await wire.getAttribute("d")).not.toBe(original);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(wire).toHaveAttribute("d",original!);
});

test("real-pointer wire-only block drag translates the selected set atomically",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const firstWire=page.locator('path.editor-wire[data-wire-id="w5"]');
  const secondWire=page.locator('path.editor-wire[data-wire-id="w6"]');
  const first=await worldPoint(page,[25,22]);
  const second=await worldPoint(page,[38,22]);
  const gridTarget=await worldPoint(page,[29.4,26.4]);
  const firstOriginal=await firstWire.getAttribute("d");
  const secondOriginal=await secondWire.getAttribute("d");
  expect(firstOriginal).toBe("M20 22 L30 22");
  expect(secondOriginal).toBe("M34 22 L42 22");

  await page.mouse.click(first.x,first.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(second.x,second.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".editor-wire-group.selected")).toHaveCount(2);

  await page.mouse.move(first.x,first.y);
  await page.mouse.down();
  await page.mouse.move(gridTarget.x,gridTarget.y,{steps:5});
  await expect(editor).toHaveAttribute("data-interaction","wire-block-move");
  const blockCursors=await page.evaluate(()=>({
    root:getComputedStyle(document.querySelector(".schematic-editor")!).cursor,
    pin:getComputedStyle(document.querySelector('[data-pin-hit][data-pin-component="c2"]')!).cursor,
    pot:getComputedStyle(document.querySelector('[data-pot-hit="c2"]')!).cursor,
  }));
  expect(blockCursors).toEqual({root:"grabbing",pin:"grabbing",pot:"grabbing"});
  await expect(firstWire).toHaveAttribute("d","M24 26 L34 26");
  await expect(secondWire).toHaveAttribute("d","M38 26 L46 26");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(firstWire).toHaveAttribute("d",firstOriginal!);
  await expect(secondWire).toHaveAttribute("d",secondOriginal!);
  await expect(page.locator(".editor-wire-group.selected")).toHaveCount(2);

  const command=process.platform==="darwin"?"Meta":"Control";
  await page.mouse.move(first.x,first.y);
  await page.mouse.down();
  await page.keyboard.down(command);
  await page.mouse.move(gridTarget.x,gridTarget.y,{steps:5});
  await page.mouse.up();
  await page.keyboard.up(command);
  await expect(firstWire).toHaveAttribute("d","M24.4 26.4 L34.4 26.4");
  await expect(secondWire).toHaveAttribute("d","M38.4 26.4 L46.4 26.4");

  await editor.press(process.platform==="darwin"?"Meta+z":"Control+z");
  await expect(firstWire).toHaveAttribute("d",firstOriginal!);
  await expect(secondWire).toHaveAttribute("d",secondOriginal!);
  await editor.press(process.platform==="darwin"?"Meta+Shift+z":"Control+y");
  await expect(firstWire).toHaveAttribute("d","M24.4 26.4 L34.4 26.4");
  await expect(secondWire).toHaveAttribute("d","M38.4 26.4 L46.4 26.4");
});

test("reference and value properties stay upright and adjacent through the rotation-mirror matrix",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  await page.locator('[data-tool="resistor"]').click();
  const placement=await worldPoint(page,[26,28]);
  await page.mouse.click(placement.x,placement.y);
  const component=page.locator('[data-component-id="c10"]');
  const properties=page.locator('[data-label-component-id="c10"]');
  await expect(properties).toHaveCount(2);
  for(let mirror=0;mirror<2;mirror+=1){
    for(let rotation=0;rotation<4;rotation+=1){
      const state=await page.evaluate(()=>{
        const symbol=document.querySelector<SVGGraphicsElement>('[data-component-id="c10"] .editor-symbol')!.getBoundingClientRect();
        return [...document.querySelectorAll<SVGGraphicsElement>('[data-label-component-id="c10"]')].map(label=>{
          const box=label.getBoundingClientRect();
          const dx=Math.max(symbol.left-box.right,box.left-symbol.right,0);
          const dy=Math.max(symbol.top-box.bottom,box.top-symbol.bottom,0);
          return{gap:Math.hypot(dx,dy),transform:label.getAttribute("transform")};
        });
      });
      expect(state.every(item=>item.transform===null)).toBeTruthy();
      expect(Math.max(...state.map(item=>item.gap))).toBeLessThanOrEqual(17);
      await page.keyboard.press("r");
    }
    if(mirror===0)await page.keyboard.press("x");
  }
  await expect(component).toHaveClass(/selected/);
});

test("zoomed real-pointer edit preserves transforms, magnetic starts, insertion gaps, cancel and undo",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium","Interaction geometry runs once in Chromium");
  const editor=page.locator(".schematic-editor");
  const editorBox=await editor.boundingBox();
  if(!editorBox)throw new Error("Editor is not visible");
  const world=page.locator(".editor-world");
  const transformBeforeZoom=await world.getAttribute("transform");
  await page.mouse.move(editorBox.x+editorBox.width/2,editorBox.y+editorBox.height/2);
  await page.mouse.wheel(0,-240);
  await expect.poll(()=>world.getAttribute("transform"),{message:"Pointer-wheel zoom should update the editor transform"}).not.toBe(transformBeforeZoom);

  await page.locator('[data-tool="resistor"]').click();
  const initialPlacement=await worldPoint(page,[26,28]);
  await page.mouse.click(initialPlacement.x,initialPlacement.y);
  const component=page.locator('[data-component-id="c10"]');
  await expect(component).toHaveAttribute("data-anchor-x","26");
  await expect(component).toHaveAttribute("data-anchor-y","28");

  const body=await componentPoint(page,"c10",[0,0]);
  const transformedDestination=await worldPoint(page,[30,26]);
  await page.mouse.move(body.x,body.y);
  await page.mouse.down();
  await page.mouse.move(transformedDestination.x,transformedDestination.y,{steps:6});
  await page.keyboard.press("r");
  await page.keyboard.press("x");
  expect(await componentTransformState(page,"c10")).toEqual({rotation:270,mirror:true});
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(component).toHaveAttribute("data-anchor-x","26");
  await expect(component).toHaveAttribute("data-anchor-y","28");
  expect(await componentTransformState(page,"c10")).toEqual({rotation:0,mirror:false});

  const exactPin=await componentPoint(page,"c10",[2,0]);
  const nearPin={x:exactPin.x+6,y:exactPin.y+2};
  const wireTarget=await worldPoint(page,[34,30]);
  await page.mouse.click(nearPin.x,nearPin.y);
  await page.mouse.move(wireTarget.x,wireTarget.y,{steps:4});
  await expect(page.locator(".wire-preview")).toHaveAttribute("data-committed","M28 28");
  const zoomedPreviewStyle=await page.locator(".wire-preview").evaluate(element=>{const style=getComputedStyle(element);return{strokeWidth:style.strokeWidth,vectorEffect:style.vectorEffect};});
  expect(zoomedPreviewStyle).toEqual({strokeWidth:"1.25px",vectorEffect:"non-scaling-stroke"});
  await page.keyboard.press("Escape");
  await expect(page.locator(".wire-preview")).toHaveCount(0);

  const bodyForDrop=await componentPoint(page,"c10",[0,0]);
  const exactExistingWire=await worldPoint(page,[26,11]);
  const nearExistingWire={x:exactExistingWire.x,y:exactExistingWire.y-6};
  await page.mouse.move(bodyForDrop.x,bodyForDrop.y);
  await page.mouse.down();
  await page.mouse.move(nearExistingWire.x,nearExistingWire.y,{steps:8});
  await expect(page.locator('.snap-indicator[data-snap-kind="segment"]')).toBeVisible();
  await page.mouse.up();
  await expect(component).toHaveAttribute("data-anchor-y","11");
  await expect(page.locator('path.editor-wire[data-wire-id="w1"]')).toHaveAttribute("d",/L24 11$/);
  await expect(page.locator('path.editor-wire[data-wire-id="w10"]')).toHaveAttribute("d",/^M28 11/);
  await expect(page.locator('.pin-open[data-pin-component="c10"]')).toHaveCount(0);

  const bridgesInsertedComponent=await page.locator("path.editor-wire").evaluateAll(elements=>elements.some(element=>{
    const coordinates=(element.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
    const points=Array.from({length:Math.floor(coordinates.length/2)},(_,index)=>[coordinates[index*2]!,coordinates[index*2+1]!] as const);
    return points.slice(1).some((point,index)=>{
      const previous=points[index]!;
      return previous[1]===11&&point[1]===11&&Math.min(previous[0],point[0])<=24&&Math.max(previous[0],point[0])>=28;
    });
  }));
  expect(bridgesInsertedComponent,"No wire may electrically bypass the inserted resistor").toBeFalsy();

  await editor.press(process.platform==="darwin"?"Meta+z":"Control+z");
  await expect(component).toHaveAttribute("data-anchor-x","26");
  await expect(component).toHaveAttribute("data-anchor-y","28");
  await expect(page.locator("path.editor-wire")).toHaveCount(10);
  const bridgeRestored=await page.locator('path.editor-wire[data-wire-id="w1"]').evaluate(element=>{
    const coordinates=(element.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
    const points=Array.from({length:Math.floor(coordinates.length/2)},(_,index)=>[coordinates[index*2]!,coordinates[index*2+1]!] as const);
    return points.slice(1).some((point,index)=>{
      const previous=points[index]!;
      return previous[1]===11&&point[1]===11&&Math.min(previous[0],point[0])<=24&&Math.max(previous[0],point[0])>=28;
    });
  });
  expect(bridgeRestored,"Undo should restore the original continuous wire").toBeTruthy();
});
});
