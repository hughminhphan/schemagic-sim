# Product Hunt draft

Draft only. Product Hunt is optional, and Hugh decides whether Robonyx is submitted.

## Name

**Robonyx Simulator**

Short form: **Robonyx**

## Tagline options

1. **Real ngspice in your browser, with a schematic that shows what the circuit is doing**
2. **An open-source, local-first circuit simulator with reviewed manufacturer-part models**
3. **Build, simulate, inspect, and share circuits without an account**

## First comment

I built Robonyx to make browser circuit simulation more transparent at two levels: what the solver is doing, and what each manufacturer-part model can honestly claim.

The simulator runs a pinned ngspice-46 WebAssembly build locally in a dedicated Worker. Voltage changes wire colour, current is animated, interactive controls trigger new solves, and the scope supports operating-point, transient, and AC results. There is no account, projects stay in the browser, the app works offline after caching, and share links carry the circuit in the URL.

Manufacturer-part models include provenance, cited test expectations, a fidelity tier, known omissions, native-versus-WebAssembly checks, and independent review. One of the first five gold models failed that review because a TL072 output-swing minimum had been treated as a typical fitting target. It was refit and passed re-review. That correction is part of the public record.

The first release is deliberately bounded. There is no PCB workflow, firmware execution, or detailed MCU peripheral simulation. Analyses are operating point, transient, and AC. Fidelity labels describe tested coverage, not certification.

I would value feedback from people who can break the numerical path, identify missing model disclosures, or nominate parts that deserve careful validation next.
