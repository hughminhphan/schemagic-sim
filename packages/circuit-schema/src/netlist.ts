import { DEFAULT_TRANSIENT_CONFIG, inspectACConfig, inspectTransientConfig, resolvedACConfig, resolvedPulseWaveform, resolvedSineWaveform } from "./analysis";
import { canonicalizeCircuitForNetlistHash, fnv1a64 } from "./canonical";
import { dcSweepSourceName, inspectDCSweepConfig } from "./dc-sweep";
import { inspectNoiseConfig } from "./noise";
import { componentPinPoints, finiteEngineering, spiceNumber } from "./parts";
import { resolveVoltageProbeNodes } from "./probes";
import { renderBehavioralExpressionV3 } from "./v3-components";
import { assertValidCircuit } from "./validation";
import type { AnalysisMode, BehavioralExpressionV3, BehavioralNodeReferenceV3, CircuitComponent, CircuitDocument, ComponentType, GeneratedNetlist, NetlistLine, Point } from "./types";

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
const acSenseToken=(id:string)=>[...id].map((character)=>/[a-z0-9]/.test(character)?character:/[A-Z]/.test(character)?`_u${character.toLowerCase()}`:character==="_"?"__":character==="."?"_d":character===":"?"_c":"_h").join("");
function seriesSensed(source:string,positive:string,negative:string,internal:string,render:(positive:string,negative:string)=>string):{line:string;current:string}{
  return{line:`${render(positive,internal)}\n${source} ${internal} ${negative} 0`,current:`${source.toLowerCase()}#branch`};
}
const boolParam=(c:CircuitComponent,key:string,fallback=false):boolean=>typeof c.params?.[key]==="boolean"?c.params[key] as boolean:fallback;
const engineeringParam=(c:CircuitComponent,key:string):number|string|undefined=>{const value=c.params?.[key];return typeof value==="number"||typeof value==="string"||value===undefined?value:Number.NaN;};
const throwParam=(c:CircuitComponent):"a"|"b"=>c.params?.throw==="b"?"b":"a";
function add(lines:string[],map:NetlistLine[],text:string,entry:Omit<NetlistLine,"line">):void { for(const part of text.split("\n")){lines.push(entry.componentId?`${part} $ component:${entry.componentId}`:part);map.push({line:lines.length,...entry});} }

export const COMPONENT_CURRENT_VECTOR_POLICY: Readonly<Record<AnalysisMode, "saved" | "unsupported">> = Object.freeze({
  live:"saved",op:"saved","dc-sweep":"saved",tran:"saved",ac:"saved",noise:"unsupported",
});

export function generateNetlist(document:CircuitDocument,requestedMode?:AnalysisMode):GeneratedNetlist {
  assertValidCircuit(document);
  const components=[...document.components].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  const wires=[...document.wires].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  const uf=new UnionFind(); const pins=new Map<string,Point[]>();
  for(const wire of wires){const first=pointKey(wire.points[0]!);uf.add(first);for(const point of wire.points.slice(1))uf.union(first,pointKey(point));}
  for(const component of components){const points=componentPinPoints(component);pins.set(component.id,points);for(const point of points)uf.add(pointKey(point));}
  const grounds=components.filter((c)=>c.type==="ground");
  const groundKey=pointKey(pins.get(grounds[0]!.id)![0]!);for(const ground of grounds.slice(1))uf.union(groundKey,pointKey(pins.get(ground.id)![0]!));
  const groundRoot=uf.find(groundKey);const rootNames=new Map<string,string>([[groundRoot,"0"]]);const usedNodeNames=new Set<string>(["0"]);
  for(const wire of wires){if(!wire.netLabel)continue;const root=uf.find(pointKey(wire.points[0]!));rootNames.set(root,wire.netLabel);usedNodeNames.add(wire.netLabel.toLowerCase());}
  let next=1;const anonymousNode=()=>{let name="";do{name=`n${next++}`;}while(usedNodeNames.has(name.toLowerCase()));usedNodeNames.add(name.toLowerCase());return name;};
  for(const component of components)for(const point of pins.get(component.id)??[]){const root=uf.find(pointKey(point));if(!rootNames.has(root))rootNames.set(root,anonymousNode());}
  const nodeAt=(point:Point)=>{const root=uf.find(pointKey(point));if(root===groundRoot)return "0";let name=rootNames.get(root);if(!name){name=anonymousNode();rootNames.set(root,name);}return name;};
  const componentNodes:Record<string,string[]>={};for(const component of components)componentNodes[component.id]=(pins.get(component.id)??[]).map(nodeAt);
  const wireNodes=Object.fromEntries(wires.map((wire)=>[wire.id,nodeAt(wire.points[0]!) ]));
  const internalNode=(preferred:string):string=>{let candidate=preferred,index=2;while(usedNodeNames.has(candidate.toLowerCase()))candidate=`${preferred}_${index++}`;usedNodeNames.add(candidate.toLowerCase());return candidate;};
  const primaryPrefix:Partial<Record<ComponentType,string>>={resistor:"R",capacitor:"C",inductor:"L",vsource:"V",vsource_pulse:"V",vsource_sine:"V",isource:"I",isource_pulse:"I",battery:"V",diode:"D",zener:"D",led:"D",bjt_npn:"Q",bjt_pnp:"Q",nmos:"M",pmos:"M",opamp_ideal:"X",switch_vcontrolled:"S",vcvs:"E",vccs:"G",cccs:"F",ccvs:"H",behavioral_source:"B",transmission_line:"T"};
  const usedDeviceNames=new Set(components.flatMap((component)=>{const prefix=primaryPrefix[component.type];return prefix?[`${prefix}${suffix(component.id)}`.toLowerCase()]:[];}));
  const deviceName=(preferred:string):string=>{let candidate=preferred,index=2;while(usedDeviceNames.has(candidate.toLowerCase()))candidate=`${preferred}_${index++}`;usedDeviceNames.add(candidate.toLowerCase());return candidate;};
  const senseSeries=(component:CircuitComponent,positive:string,negative:string,render:(positive:string,negative:string)=>string,privateName=false)=>{const token=acSenseToken(component.id);return seriesSensed(deviceName(`${privateName?"VOCS_":"VOCS"}${token}`),positive,negative,internalNode(`oc_ac_${token.toLowerCase()}`),render);};
  const documentHash=fnv1a64(canonicalizeCircuitForNetlistHash(document)); const lines:string[]=[];const lineMap:NetlistLine[]=[];const componentCurrents:Record<string,string>={};const dynamicModels:string[]=[];
  add(lines,lineMap,`scheMAGIC Simulator document ${documentHash}`,{stage:"header"});add(lines,lineMap,`* document-hash ${documentHash}`,{stage:"header"});
  const mode=requestedMode??document.sim.mode;
  const noiseInputId=mode==="noise"?document.sim.noise?.inputSourceId:undefined;
  const acConfig=mode==="ac"?resolvedACConfig(document,document.sim.ac):undefined;
  if(mode==="ac"){
    const issues=inspectACConfig(document,document.sim.ac);
    if(issues.length)throw new Error(issues[0]!.message);
  }
  const acStimulus=acConfig?.stimulus;
  const used=new Set<string>();
  for(const c of components){if(c.type==="ground")continue;const n=componentNodes[c.id]??[];const s=suffix(c.id);let line="";let current="";const sourceStimulus=c.id===noiseInputId?" AC 1":c.id===acStimulus?.sourceId?` AC ${spiceNumber(acStimulus.magnitude,1,"AC stimulus magnitude")}${acStimulus.phaseDeg===0?"":` ${spiceNumber(acStimulus.phaseDeg,0,"AC stimulus phase")}`}`:"";
    switch(c.type){
      case "resistor": {const value=spiceNumber(c.value,"1k",`${c.id} resistance`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`R${s} ${positive} ${negative} ${value}`));line=sensed.line;current=sensed.current;}else{line=`R${s} ${n[0]} ${n[1]} ${value}`;current=`@r${s.toLowerCase()}[i]`;}break;}
      case "capacitor": {const value=spiceNumber(c.value,"100n",`${c.id} capacitance`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`C${s} ${positive} ${negative} ${value}`));line=sensed.line;current=sensed.current;}else{line=`C${s} ${n[0]} ${n[1]} ${value}`;current=`@c${s.toLowerCase()}[i]`;}break;}
      case "inductor": {const value=spiceNumber(c.value,"1m",`${c.id} inductance`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`L${s} ${positive} ${negative} ${value}`));line=sensed.line;current=sensed.current;}else{line=`L${s} ${n[0]} ${n[1]} ${value}`;current=`@l${s.toLowerCase()}[i]`;}break;}
      case "vsource": line=`V${s} ${n[0]} ${n[1]} DC ${spiceNumber(c.value,5,`${c.id} voltage`)}${sourceStimulus}`;current=`v${s.toLowerCase()}#branch`;break;
      case "vsource_pulse": {resolvedPulseWaveform(c);line=`V${s} ${n[0]} ${n[1]} PULSE(${spiceNumber(engineeringParam(c,"v1"),0)} ${spiceNumber(engineeringParam(c,"v2"),c.value??5)} ${spiceNumber(engineeringParam(c,"delay"),.001)} ${spiceNumber(engineeringParam(c,"rise"),.00001)} ${spiceNumber(engineeringParam(c,"fall"),.00001)} ${spiceNumber(engineeringParam(c,"width"),.004)} ${spiceNumber(engineeringParam(c,"period"),.01)})${sourceStimulus}`;current=`v${s.toLowerCase()}#branch`;break;}
      case "vsource_sine": {resolvedSineWaveform(c);line=`V${s} ${n[0]} ${n[1]} SIN(${spiceNumber(engineeringParam(c,"offset"),0)} ${spiceNumber(c.value,1)} ${spiceNumber(engineeringParam(c,"frequency"),1000)})${sourceStimulus}`;current=`v${s.toLowerCase()}#branch`;break;}
      case "isource": {const value=spiceNumber(c.value,"1m",`${c.id} current`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`I${s} ${positive} ${negative} DC ${value}${sourceStimulus}`));line=sensed.line;current=sensed.current;}else{line=`I${s} ${n[0]} ${n[1]} DC ${value}${sourceStimulus}`;current=`@i${s.toLowerCase()}[i]`;}break;}
      case "isource_pulse": {const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`I${s} ${positive} ${negative} PULSE(${spiceNumber(engineeringParam(c,"i1"),0)} ${spiceNumber(engineeringParam(c,"i2"),"1m")} ${spiceNumber(engineeringParam(c,"delay"),"1m")} ${spiceNumber(engineeringParam(c,"rise"),"10u")} ${spiceNumber(engineeringParam(c,"fall"),"10u")} ${spiceNumber(engineeringParam(c,"width"),"4m")} ${spiceNumber(engineeringParam(c,"period"),"10m")})${sourceStimulus}`),true);line=sensed.line;current=sensed.current;break;}
      case "battery": line=`V${s} ${n[0]} ${n[1]} DC ${spiceNumber(c.value,9,`${c.id} battery voltage`)}${sourceStimulus}`;current=`v${s.toLowerCase()}#branch`;break;
      case "switch_spst":
      case "switch_pushbutton":
      case "switch_toggle": {const value=boolParam(c,"closed")?"1m":"1G",token=acSenseToken(c.id),resistor=deviceName(c.type==="switch_spst"?`R${s}`:`R_SW_${token}`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`${resistor} ${positive} ${negative} ${value}`),c.type!=="switch_spst");line=sensed.line;current=sensed.current;}else{line=`${resistor} ${n[0]} ${n[1]} ${value}`;current=`@${resistor.toLowerCase()}[i]`;}break;}
      case "switch_spdt": {const active=throwParam(c),token=acSenseToken(c.id),a=deviceName(`R_SW_${token}_A`),b=deviceName(`R_SW_${token}_B`),activeName=active==="a"?a:b,inactiveName=active==="a"?b:a;if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[active==="a"?1:2]!,((positive,negative)=>`${activeName} ${positive} ${negative} 1m`),true);const inactive=`${inactiveName} ${n[0]} ${n[active==="a"?2:1]} 1G`;line=active==="a"?`${sensed.line}\n${inactive}`:`${inactive}\n${sensed.line}`;current=sensed.current;}else{line=`${a} ${n[0]} ${n[1]} ${active==="a"?"1m":"1G"}\n${b} ${n[0]} ${n[2]} ${active==="b"?"1m":"1G"}`;current=`@${activeName.toLowerCase()}[i]`;}break;}
      case "switch_dpdt": {const active=throwParam(c),token=acSenseToken(c.id),a1=deviceName(`R_SW_${token}_A1`),b1=deviceName(`R_SW_${token}_B1`),a2=deviceName(`R_SW_${token}_A2`),b2=deviceName(`R_SW_${token}_B2`),activeName=active==="a"?a1:b1;if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[active==="a"?1:2]!,((positive,negative)=>`${activeName} ${positive} ${negative} 1m`),true);line=active==="a"?`${sensed.line}\n${b1} ${n[0]} ${n[2]} 1G\n${a2} ${n[3]} ${n[4]} 1m\n${b2} ${n[3]} ${n[5]} 1G`:`${a1} ${n[0]} ${n[1]} 1G\n${sensed.line}\n${a2} ${n[3]} ${n[4]} 1G\n${b2} ${n[3]} ${n[5]} 1m`;current=sensed.current;}else{line=`${a1} ${n[0]} ${n[1]} ${active==="a"?"1m":"1G"}\n${b1} ${n[0]} ${n[2]} ${active==="b"?"1m":"1G"}\n${a2} ${n[3]} ${n[4]} ${active==="a"?"1m":"1G"}\n${b2} ${n[3]} ${n[5]} ${active==="b"?"1m":"1G"}`;current=`@${activeName.toLowerCase()}[i]`;}break;}
      case "switch_vcontrolled": {const model=`OC_SW_${acSenseToken(c.id)}`;const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`S${s} ${positive} ${negative} ${n[2]} ${n[3]} ${model}`),true);line=sensed.line;dynamicModels.push(`.model ${model} SW(Ron=${spiceNumber(engineeringParam(c,"ron"),"1m")} Roff=${spiceNumber(engineeringParam(c,"roff"),"1G")} Vt=${spiceNumber(engineeringParam(c,"threshold"),2.5)} Vh=${spiceNumber(engineeringParam(c,"hysteresis"),0)})`);current=sensed.current;break;}
      case "potentiometer": {const total=finiteEngineering(c.value,10000,`${c.id} resistance`);const t=Math.min(.995,Math.max(.005,Number(c.params?.t??.5)));const top=Math.max(.001,total*(1-t)).toPrecision(12),bottom=Math.max(.001,total*t).toPrecision(12),topName=deviceName(`R${s}T`),bottomName=deviceName(`R${s}B`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`${topName} ${positive} ${negative} ${top}`));add(lines,lineMap,`${sensed.line}\n${bottomName} ${n[1]} ${n[2]} ${bottom}`,{stage:"component",componentId:c.id});componentCurrents[c.id]=sensed.current;}else{add(lines,lineMap,`${topName} ${n[0]} ${n[1]} ${top}\n${bottomName} ${n[1]} ${n[2]} ${bottom}`,{stage:"component",componentId:c.id});componentCurrents[c.id]=`@${topName.toLowerCase()}[i]`;}continue;}
      case "diode": line=`D${s} ${n[0]} ${n[1]} OC_GENERIC_D`;current=mode==="ac"?"":`@d${s.toLowerCase()}[id]`;used.add("diode");break;
      case "led": line=`D${s} ${n[0]} ${n[1]} OC_LED_RED`;current=mode==="ac"?"":`@d${s.toLowerCase()}[id]`;used.add("led");break;
      case "bjt_npn": line=`Q${s} ${n[0]} ${n[1]} ${n[2]} ${c.mpn==="2N3904"?"OC_2N3904":"OC_GENERIC_NPN"}`;current=mode==="ac"?"":`@q${s.toLowerCase()}[ic]`;used.add(c.mpn==="2N3904"?"2n3904":"npn");break;
      case "bjt_pnp": line=`Q${s} ${n[0]} ${n[1]} ${n[2]} OC_GENERIC_PNP`;current=mode==="ac"?"":`@q${s.toLowerCase()}[ic]`;used.add("pnp");break;
      case "nmos": line=`M${s} ${n[0]} ${n[1]} ${n[2]} ${n[2]} OC_GENERIC_NMOS`;current=mode==="ac"?"":`@m${s.toLowerCase()}[id]`;used.add("nmos");break;
      case "pmos": line=`M${s} ${n[0]} ${n[1]} ${n[2]} ${n[2]} OC_GENERIC_PMOS`;current=mode==="ac"?"":`@m${s.toLowerCase()}[id]`;used.add("pmos");break;
      case "opamp_ideal": line=`X${s} ${n[0]} ${n[1]} ${n[2]} OC_IDEAL_OPAMP`;used.add("opamp");break;
      case "vcvs": line=`E${s} ${n[0]} ${n[1]} ${n[2]} ${n[3]} ${spiceNumber(engineeringParam(c,"gain"),1)}`;current=`e${s.toLowerCase()}#branch`;break;
      case "vccs": {const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`G${s} ${positive} ${negative} ${n[2]} ${n[3]} ${spiceNumber(engineeringParam(c,"gain"),1)}`),true);line=sensed.line;current=sensed.current;break;}
      case "cccs": {const token=acSenseToken(c.id),sense=deviceName(`VCS_${token}`),sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`F${s} ${positive} ${negative} ${sense} ${spiceNumber(engineeringParam(c,"gain"),1)}`),true);line=`${sense} ${n[2]} ${n[3]} 0\n${sensed.line}`;current=sensed.current;break;}
      case "ccvs": {const sense=deviceName(`VCS_${acSenseToken(c.id)}`);line=`${sense} ${n[2]} ${n[3]} 0\nH${s} ${n[0]} ${n[1]} ${sense} ${spiceNumber(engineeringParam(c,"gain"),1)}`;current=`h${s.toLowerCase()}#branch`;break;}
      case "behavioral_source": {const referenceNode=(reference:BehavioralNodeReferenceV3):string=>reference.kind==="ground"?"0":reference.kind==="wire"?wireNodes[reference.wireId]!:componentNodes[reference.componentId]![reference.pin]!;const expression=renderBehavioralExpressionV3(c.params!.expression as BehavioralExpressionV3,{node:referenceNode});const output=c.params!.output==="current"?"I":"V";if(output==="I"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`B${s} ${positive} ${negative} I=${expression}`),true);line=sensed.line;current=sensed.current;}else{line=`B${s} ${n[0]} ${n[1]} V=${expression}`;current=`b${s.toLowerCase()}#branch`;}break;}
      case "transformer": {const token=acSenseToken(c.id),primary=deviceName(`L_XFMR_${token}_P`),secondary=deviceName(`L_XFMR_${token}_S`),coupling=deviceName(`K_XFMR_${token}`);line=`${primary} ${n[0]} ${n[1]} ${spiceNumber(engineeringParam(c,"primaryInductance"),"10m")}\n${secondary} ${n[2]} ${n[3]} ${spiceNumber(engineeringParam(c,"secondaryInductance"),"10m")}\n${coupling} ${primary} ${secondary} ${spiceNumber(engineeringParam(c,"coupling"),0.999)}`;current=mode==="ac"?"":`@${primary.toLowerCase()}[i]`;break;}
      case "crystal": {const token=acSenseToken(c.id),a=internalNode(`oc_y${s}_a`),b=internalNode(`oc_y${s}_b`),parallel=deviceName(`C_XTAL_${token}_P`),seriesR=deviceName(`R_XTAL_${token}_S`),seriesL=deviceName(`L_XTAL_${token}_S`),seriesC=deviceName(`C_XTAL_${token}_S`);line=`${parallel} ${n[0]} ${n[1]} ${spiceNumber(engineeringParam(c,"parallelCapacitance"),"3p")}\n${seriesR} ${n[0]} ${a} ${spiceNumber(engineeringParam(c,"seriesResistance"),30)}\n${seriesL} ${a} ${b} ${spiceNumber(engineeringParam(c,"seriesInductance"),"10m")}\n${seriesC} ${b} ${n[1]} ${spiceNumber(engineeringParam(c,"seriesCapacitance"),"20f")}`;current=mode==="ac"?"":`@${seriesR.toLowerCase()}[i]`;break;}
      case "transmission_line": line=`T${s} ${n[0]} ${n[1]} ${n[2]} ${n[3]} Z0=${spiceNumber(engineeringParam(c,"impedance"),50)} TD=${spiceNumber(engineeringParam(c,"delay"),"1n")}`;break;
      case "fuse": {const value=boolParam(c,"blown")?spiceNumber(engineeringParam(c,"blownResistance"),"1G"):spiceNumber(c.value,"10m",`${c.id} fuse resistance`),resistor=deviceName(`R_FUSE_${acSenseToken(c.id)}`);if(mode==="ac"){const sensed=senseSeries(c,n[0]!,n[1]!,((positive,negative)=>`${resistor} ${positive} ${negative} ${value}`),true);line=sensed.line;current=sensed.current;}else{line=`${resistor} ${n[0]} ${n[1]} ${value}`;current=`@${resistor.toLowerCase()}[i]`;}break;}
      default: line=`* catalog-only ${c.type} ${s} awaiting its catalog package model`;break;
    }
    add(lines,lineMap,line,{stage:"component",componentId:c.id});if(current)componentCurrents[c.id]=current;
  }
  for(const name of [...used].sort()){const model=name==="2n3904"?REAL_2N3904:MODELS[name as keyof typeof MODELS];if(model)add(lines,lineMap,model,{stage:"model"});}
  for(const model of dynamicModels.sort())add(lines,lineMap,model,{stage:"model"});
  const saveComponentCurrents=COMPONENT_CURRENT_VECTOR_POLICY[mode]==="saved";
  const currents=saveComponentCurrents?[...new Set(Object.values(componentCurrents))]:[];
  if(!saveComponentCurrents)for(const componentId of Object.keys(componentCurrents))delete componentCurrents[componentId];
  add(lines,lineMap,currents.length?`.save all ${currents.join(" ")}`:".save all",{stage:"analysis"});
  if(mode==="tran"){const t={...DEFAULT_TRANSIENT_CONFIG,...document.sim.tran};const issues=inspectTransientConfig(t);if(issues.length)throw new Error(issues[0]!.message);add(lines,lineMap,`.tran ${spiceNumber(t.tstep,.00002)} ${spiceNumber(t.tstop,.01)} 0 ${spiceNumber(t.maxstep,.00005)}`,{stage:"analysis"});}
  else if(mode==="ac"){const ac=acConfig!;add(lines,lineMap,`.ac dec ${Math.max(1,Math.round(ac.pointsPerDecade))} ${spiceNumber(ac.fstart,10)} ${spiceNumber(ac.fstop,1e6)}`,{stage:"analysis"});}
  else if(mode==="noise"){
    const config=document.sim.noise;const inspected=inspectNoiseConfig(document,config);if(!config||!inspected.shape)throw new Error(inspected.issues[0]?.message??"Noise settings are invalid");
    const outputProbe=document.probes.find(probe=>probe.id===config.outputProbeId)!;const outputNodes=resolveVoltageProbeNodes(outputProbe,componentNodes,wireNodes);if(!outputNodes||outputNodes.positiveNode===outputNodes.negativeNode)throw new Error("Choose an output voltage probe that is not connected to the same node on both terminals");
    const outputExpression=outputNodes.negativeNode==="0"?`V(${outputNodes.positiveNode})`:`V(${outputNodes.positiveNode},${outputNodes.negativeNode})`;
    const input=components.find(component=>component.id===config.inputSourceId)!;add(lines,lineMap,`.temp ${spiceNumber(config.temperatureC,27)}`,{stage:"analysis"});add(lines,lineMap,`.noise ${outputExpression} ${dcSweepSourceName(input)} dec ${Math.max(1,Math.round(config.pointsPerDecade))} ${spiceNumber(config.fstart,10)} ${spiceNumber(config.fstop,1e6)}`,{stage:"analysis"});
  }
  else if(mode==="dc-sweep"){
    const config=document.sim.dcSweep;const inspected=inspectDCSweepConfig(document,config);if(!config||!inspected.shape)throw new Error(inspected.issues[0]?.message??"DC sweep settings are invalid");
    const primary=components.find(component=>component.id===config.sourceId)!;let command=`.dc ${dcSweepSourceName(primary)} ${spiceNumber(config.start,0)} ${spiceNumber(config.stop,1)} ${spiceNumber(config.step,.1)}`;
    if(config.secondary){const secondary=components.find(component=>component.id===config.secondary!.sourceId)!;command+=` ${dcSweepSourceName(secondary)} ${spiceNumber(config.secondary.start,0)} ${spiceNumber(config.secondary.stop,1)} ${spiceNumber(config.secondary.step,.1)}`;}
    add(lines,lineMap,command,{stage:"analysis"});
  }
  else add(lines,lineMap,".op",{stage:"analysis"});add(lines,lineMap,".end",{stage:"analysis"});
  return {netlist:`${lines.join("\n")}\n`,lineMap,componentNodes,wireNodes,documentHash,componentCurrents};
}
export const interimModels={...MODELS,OC_2N3904:REAL_2N3904} as const;
