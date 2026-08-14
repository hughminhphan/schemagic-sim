import { canonicalizeCircuitForNetlistHash, fnv1a64 } from "./canonical";
import { dcSweepSourceName, inspectDCSweepConfig } from "./dc-sweep";
import { inspectNoiseConfig } from "./noise";
import { componentPinPoints, parseEngineering } from "./parts";
import { assertValidCircuit } from "./validation";
import type { AnalysisMode, CircuitComponent, CircuitDocument, CircuitProbe, GeneratedNetlist, NetlistLine, Point } from "./types";

const MODELS = {
  npn: ".model OC_GENERIC_NPN NPN(IS=1e-14 BF=100 VAF=100)",
  pnp: ".model OC_GENERIC_PNP PNP(IS=1e-14 BF=100 VAF=100)",
  diode: ".model OC_GENERIC_D D(IS=1e-14 N=1 RS=0.1 CJO=2P)",
  led: ".model OC_LED_RED D(IS=1e-20 N=2 RS=10 EG=1.8 CJO=30P BV=5 IBV=10U)",
  nmos: ".model OC_GENERIC_NMOS NMOS(LEVEL=1 VTO=2 KP=20M LAMBDA=0.02)",
  pmos: ".model OC_GENERIC_PMOS PMOS(LEVEL=1 VTO=-2 KP=10M LAMBDA=0.02)",
  opamp: ".subckt OC_IDEAL_OPAMP INP INN OUT\nEGAIN OUT 0 INP INN 1000000\n.ends OC_IDEAL_OPAMP",
} as const;
const REAL_2N3904 = ".model OC_2N3904 NPN(IS=6.734F BF=255.9 VAF=74.03 IKF=0.2847 ISE=6.734F NE=1.307 BR=6.092 VAR=12.5 IKR=0.1 RC=1 CJE=4.493P TF=0.3012N CJC=3.638P TR=239.5N)";
class UnionFind { private readonly p=new Map<string,string>(); add(k:string){if(!this.p.has(k))this.p.set(k,k)} find(k:string):string{this.add(k);const p=this.p.get(k)!;if(p===k)return k;const r=this.find(p);this.p.set(k,r);return r} union(a:string,b:string){const x=this.find(a),y=this.find(b);if(x!==y)this.p.set(y,x)} }
const pointKey=([x,y]:Point)=>`${x},${y}`;
const suffix=(id:string)=>id.replace(/\D/g,"")||id.replace(/[^a-z0-9]/gi,"");
const spice=(value:number|string|undefined,fallback:number|string):string=>typeof value==="number"?Number(value.toPrecision(12)).toString():typeof value==="string"&&value.trim()?value.trim():String(fallback);
const param=(c:CircuitComponent,key:string,fallback:number|string):string=>spice(c.params?.[key] as number|string|undefined,fallback);
const boolParam=(c:CircuitComponent,key:string,fallback=false):boolean=>typeof c.params?.[key]==="boolean"?c.params[key] as boolean:fallback;
function add(lines:string[],map:NetlistLine[],text:string,entry:Omit<NetlistLine,"line">):void { for(const part of text.split("\n")){lines.push(entry.componentId?`${part} $ component:${entry.componentId}`:part);map.push({line:lines.length,...entry});} }
function probeNode(probe:CircuitProbe,componentNodes:Record<string,string[]>,wireNodes:Record<string,string>):string|undefined { const pin=probe.target.componentPin;return probe.target.wire?wireNodes[probe.target.wire]:pin?componentNodes[pin[0]]?.[pin[1]]:probe.target.node; }

export function generateNetlist(document:CircuitDocument,requestedMode?:AnalysisMode):GeneratedNetlist {
  assertValidCircuit(document);
  const components=[...document.components].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  const wires=[...document.wires].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  const uf=new UnionFind(); const pins=new Map<string,Point[]>();
  for(const wire of wires){const first=pointKey(wire.points[0]!);uf.add(first);for(const point of wire.points.slice(1))uf.union(first,pointKey(point));}
  for(const component of components){const points=componentPinPoints(component);pins.set(component.id,points);for(const point of points)uf.add(pointKey(point));}
  const grounds=components.filter((c)=>c.type==="ground");
  const groundKey=pointKey(pins.get(grounds[0]!.id)![0]!);for(const ground of grounds.slice(1))uf.union(groundKey,pointKey(pins.get(ground.id)![0]!));
  const groundRoot=uf.find(groundKey);const rootNames=new Map<string,string>([[groundRoot,"0"]]);let next=1;
  for(const component of components)for(const point of pins.get(component.id)??[]){const root=uf.find(pointKey(point));if(!rootNames.has(root))rootNames.set(root,`n${next++}`);}
  const nodeAt=(point:Point)=>{const root=uf.find(pointKey(point));if(root===uf.find(groundRoot))return "0";let name=rootNames.get(root);if(!name){name=`n${next++}`;rootNames.set(root,name);}return name;};
  const componentNodes:Record<string,string[]>={};for(const component of components)componentNodes[component.id]=(pins.get(component.id)??[]).map(nodeAt);
  const wireNodes=Object.fromEntries(wires.map((wire)=>[wire.id,nodeAt(wire.points[0]!) ]));
  const documentHash=fnv1a64(canonicalizeCircuitForNetlistHash(document)); const lines:string[]=[];const lineMap:NetlistLine[]=[];const componentCurrents:Record<string,string>={};
  add(lines,lineMap,`scheMAGIC Simulator document ${documentHash}`,{stage:"header"});add(lines,lineMap,`* document-hash ${documentHash}`,{stage:"header"});
  const mode=requestedMode??document.sim.mode;const noiseInputId=mode==="noise"?document.sim.noise?.inputSourceId:undefined;const used=new Set<string>();
  for(const c of components){if(c.type==="ground")continue;const n=componentNodes[c.id]??[];const s=suffix(c.id);let line="";let current="";const noiseReference=c.id===noiseInputId?" AC 1":"";
    switch(c.type){
      case "resistor": line=`R${s} ${n[0]} ${n[1]} ${spice(c.value,"1k")}`;current=`@r${s.toLowerCase()}[i]`;break;
      case "capacitor": line=`C${s} ${n[0]} ${n[1]} ${spice(c.value,"100n")}`;current=`@c${s.toLowerCase()}[i]`;break;
      case "inductor": line=`L${s} ${n[0]} ${n[1]} ${spice(c.value,"1m")}`;current=`@l${s.toLowerCase()}[i]`;break;
      case "vsource": line=`V${s} ${n[0]} ${n[1]} DC ${spice(c.value,5)}${mode==="ac"?` AC ${param(c,"ac",1)}`:noiseReference}`;current=`v${s.toLowerCase()}#branch`;break;
      case "vsource_pulse": line=`V${s} ${n[0]} ${n[1]} PULSE(${param(c,"v1",0)} ${param(c,"v2",c.value??5)} ${param(c,"delay","1m")} ${param(c,"rise","10u")} ${param(c,"fall","10u")} ${param(c,"width","4m")} ${param(c,"period","10m")})${noiseReference}`;current=`v${s.toLowerCase()}#branch`;break;
      case "vsource_sine": line=`V${s} ${n[0]} ${n[1]} SIN(${param(c,"offset",0)} ${spice(c.value,1)} ${param(c,"frequency","1k")})${mode==="ac"?` AC ${param(c,"ac",1)}`:noiseReference}`;current=`v${s.toLowerCase()}#branch`;break;
      case "isource": line=`I${s} ${n[0]} ${n[1]} DC ${spice(c.value,"1m")}${noiseReference}`;current=`@i${s.toLowerCase()}[i]`;break;
      case "switch_spst": line=`R${s} ${n[0]} ${n[1]} ${boolParam(c,"closed")?"1m":"1G"}`;current=`@r${s.toLowerCase()}[i]`;break;
      case "potentiometer": {const total=parseEngineering(c.value,10000);const t=Math.min(.995,Math.max(.005,Number(c.params?.t??.5)));add(lines,lineMap,`R${s}T ${n[0]} ${n[1]} ${Math.max(.001,total*(1-t)).toPrecision(12)}\nR${s}B ${n[1]} ${n[2]} ${Math.max(.001,total*t).toPrecision(12)}`,{stage:"component",componentId:c.id});componentCurrents[c.id]=`@r${s.toLowerCase()}t[i]`;continue;}
      case "diode": line=`D${s} ${n[0]} ${n[1]} OC_GENERIC_D`;current=`@d${s.toLowerCase()}[id]`;used.add("diode");break;
      case "led": line=`D${s} ${n[0]} ${n[1]} OC_LED_RED`;current=`@d${s.toLowerCase()}[id]`;used.add("led");break;
      case "bjt_npn": line=`Q${s} ${n[0]} ${n[1]} ${n[2]} ${c.mpn==="2N3904"?"OC_2N3904":"OC_GENERIC_NPN"}`;current=`@q${s.toLowerCase()}[ic]`;used.add(c.mpn==="2N3904"?"2n3904":"npn");break;
      case "bjt_pnp": line=`Q${s} ${n[0]} ${n[1]} ${n[2]} OC_GENERIC_PNP`;current=`@q${s.toLowerCase()}[ic]`;used.add("pnp");break;
      case "nmos": line=`M${s} ${n[0]} ${n[1]} ${n[2]} ${n[2]} OC_GENERIC_NMOS`;current=`@m${s.toLowerCase()}[id]`;used.add("nmos");break;
      case "pmos": line=`M${s} ${n[0]} ${n[1]} ${n[2]} ${n[2]} OC_GENERIC_PMOS`;current=`@m${s.toLowerCase()}[id]`;used.add("pmos");break;
      case "opamp_ideal": line=`X${s} ${n[0]} ${n[1]} ${n[2]} OC_IDEAL_OPAMP`;used.add("opamp");break;
    }
    add(lines,lineMap,line,{stage:"component",componentId:c.id});if(current)componentCurrents[c.id]=current;
  }
  for(const name of [...used].sort()){const model=name==="2n3904"?REAL_2N3904:MODELS[name as keyof typeof MODELS];if(model)add(lines,lineMap,model,{stage:"model"});}
  const currents=[...new Set(Object.values(componentCurrents))];add(lines,lineMap,`.save all ${currents.join(" ")}`,{stage:"analysis"});
  if(mode==="tran"){const t=document.sim.tran??{tstop:.01,tstep:.00002,maxstep:.00005};add(lines,lineMap,`.tran ${spice(t.tstep,.00002)} ${spice(t.tstop,.01)} 0 ${spice(t.maxstep,.00005)}`,{stage:"analysis"});}
  else if(mode==="ac"){const ac=document.sim.ac??{fstart:10,fstop:1e6,pointsPerDecade:30,sweep:"dec" as const};add(lines,lineMap,`.ac dec ${Math.max(1,Math.round(ac.pointsPerDecade))} ${spice(ac.fstart,10)} ${spice(ac.fstop,1e6)}`,{stage:"analysis"});}
  else if(mode==="noise"){
    const config=document.sim.noise;const inspected=inspectNoiseConfig(document,config);if(!config||!inspected.shape)throw new Error(inspected.issues[0]?.message??"Noise settings are invalid");
    const outputProbe=document.probes.find(probe=>probe.id===config.outputProbeId)!;const outputNode=probeNode(outputProbe,componentNodes,wireNodes);if(!outputNode||outputNode==="0")throw new Error("Choose an output voltage probe that is not connected to ground");
    const input=components.find(component=>component.id===config.inputSourceId)!;add(lines,lineMap,`.temp ${spice(config.temperatureC,27)}`,{stage:"analysis"});add(lines,lineMap,`.noise V(${outputNode}) ${dcSweepSourceName(input)} dec ${Math.max(1,Math.round(config.pointsPerDecade))} ${spice(config.fstart,10)} ${spice(config.fstop,1e6)}`,{stage:"analysis"});
  }
  else if(mode==="dc-sweep"){
    const config=document.sim.dcSweep;const inspected=inspectDCSweepConfig(document,config);if(!config||!inspected.shape)throw new Error(inspected.issues[0]?.message??"DC sweep settings are invalid");
    const primary=components.find(component=>component.id===config.sourceId)!;let command=`.dc ${dcSweepSourceName(primary)} ${spice(config.start,0)} ${spice(config.stop,1)} ${spice(config.step,.1)}`;
    if(config.secondary){const secondary=components.find(component=>component.id===config.secondary!.sourceId)!;command+=` ${dcSweepSourceName(secondary)} ${spice(config.secondary.start,0)} ${spice(config.secondary.stop,1)} ${spice(config.secondary.step,.1)}`;}
    add(lines,lineMap,command,{stage:"analysis"});
  }
  else add(lines,lineMap,".op",{stage:"analysis"});add(lines,lineMap,".end",{stage:"analysis"});
  return {netlist:`${lines.join("\n")}\n`,lineMap,componentNodes,wireNodes,documentHash,componentCurrents};
}
export const interimModels={...MODELS,OC_2N3904:REAL_2N3904} as const;
