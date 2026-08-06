import { describe, expect, it } from "vitest";
import { PARTS, canonicalizeCircuit, deserializeCircuit, generateNetlist, type CircuitComponent, type CircuitDocument } from "../src";
const base: CircuitDocument={format:"opencircuit-circuit",version:1,meta:{title:"test"},components:[{id:"c1",type:"vsource",value:5,pos:[0,2],rot:0,mirror:false},{id:"c2",type:"ground",pos:[0,4],rot:0,mirror:false}],wires:[],probes:[],sim:{mode:"op"}};
describe("circuit schema",()=>{
  it("round trips canonical undo snapshots deterministically",()=>{const snapshot=canonicalizeCircuit({...base,components:[...base.components].reverse()});expect(canonicalizeCircuit(deserializeCircuit(snapshot))).toBe(snapshot);expect(snapshot).toBe(canonicalizeCircuit(deserializeCircuit(snapshot)));});
  it("excludes view from hash netlist equality",()=>{expect(generateNetlist({...base,view:{pan:[2,3],zoom:2}}).netlist).toBe(generateNetlist({...base,view:{pan:[99,1],zoom:.5}}).netlist);});
  for(const part of PARTS.filter((entry)=>entry.type!=="ground")) it(`emits ${part.type}`,()=>{const first=part.pins[0]??[0,0];const device:CircuitComponent={id:"c1",type:part.type,pos:[10,10],rot:0,mirror:false,...(part.defaultValue!==undefined?{value:part.defaultValue}:{}),...(part.type==="switch_spst"?{params:{closed:true}}:{})};const ground:CircuitComponent={id:"c2",type:"ground",pos:[10+first[0],10+first[1]],rot:0,mirror:false};const doc:CircuitDocument={...base,components:[device,ground],wires:[]};expect(()=>generateNetlist(doc)).not.toThrow();expect(generateNetlist(doc).netlist).toContain(".end\n");});
});
