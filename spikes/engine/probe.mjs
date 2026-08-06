import { Simulation } from 'eecircuit-engine';
const sim = new Simulation();
await sim.start();
for (const [name, netlist] of Object.entries({
  op:`OpenCircuit diode divider\nV1 in 0 DC 5\nR1 in out 1k\nR2 out 0 2k\nD1 out 0 DTEST\n.model DTEST D(Is=1e-14 N=1)\n.op\n.end\n`,
  tran:`OpenCircuit RC transient\nV1 in 0 PULSE(0 5 0 1u 1u 5m 10m)\nR1 in out 1k\nC1 out 0 1u\n.tran 20u 20m\n.end\n`,
  ac:`OpenCircuit RC AC\nV1 in 0 AC 1\nR1 in out 1k\nC1 out 0 1u\n.ac dec 20 10 100k\n.end\n`
})) {
 sim.setNetList(netlist);
 const r=await sim.runSim();
 console.log(name, r.dataType, r.numPoints, r.variableNames);
 console.log(r.data.map(x=>[x.name,x.values[0],x.values.at(-1)]));
 console.error(sim.getError());
}
