import type { CandidateIdV2 } from "@opencircuit/design-schema";
import type {
  SourcingRequestPacketInputV1,
  SourcingRequestPacketV1,
} from "@opencircuit/sourcing-schema/request-packet-v1";
import type { DesignerSourcingRequestPacketArtifactV1 } from "./contracts";
import { escapeHtml } from "./view";

export interface SourcingRequestTransferStateV1 {
  readonly candidateId: CandidateIdV2;
  readonly buildQuantity: number;
  readonly region: string;
  readonly currency: string;
  readonly busy: boolean;
}

export async function verifyExactSourcingRequestPacketArtifactV1(
  artifact: Readonly<DesignerSourcingRequestPacketArtifactV1>,
  exactInput: Readonly<SourcingRequestPacketInputV1>,
): Promise<SourcingRequestPacketV1> {
  const { verifySourcingRequestPacketV1 } = await import(
    "@opencircuit/sourcing-schema/request-packet-v1"
  );
  const verified = verifySourcingRequestPacketV1(artifact.content, exactInput);
  let presentedPacket: string;
  try { presentedPacket = JSON.stringify(artifact.packet); }
  catch { throw new Error("Application adapter returned a context-mismatched sourcing request packet"); }
  if (JSON.stringify(verified) !== presentedPacket) {
    throw new Error("Application adapter returned a context-mismatched sourcing request packet");
  }
  return verified;
}

export function renderSourcingRequestTransferV1(
  state: Readonly<SourcingRequestTransferStateV1>,
): string {
  const disabled = state.busy ? " disabled" : "";
  return `<section class="designer-sourcing-request" data-sourcing-request-transfer aria-labelledby="designer-sourcing-request-title" aria-busy="${state.busy}"><header><div><span class="designer-section-code">EXACT BOM · PROVIDER-NEUTRAL TRANSFER</span><h3 id="designer-sourcing-request-title" tabindex="-1">Sourcing request packet</h3></div><code>${escapeHtml(state.candidateId)}</code></header><p>Create a content-addressed request for an external sourcing workflow. It includes exact result/candidate references, the selected-candidate BOM, requested build quantity, and visible policy only. It contains no offers, provider URLs or selection, credentials, commercial observations, ranking evidence, eligibility evidence, or provider authorization.</p><form data-sourcing-request-form><label><span>Build quantity</span><input data-sourcing-request-build-quantity name="buildQuantity" type="number" min="1" max="1000000" step="1" required value="${state.buildQuantity}"${disabled}></label><label><span>Region</span><input data-sourcing-request-region name="region" type="text" maxlength="128" required value="${escapeHtml(state.region)}" autocomplete="country"${disabled}></label><label><span>Currency</span><input data-sourcing-request-currency name="currency" type="text" maxlength="3" minlength="3" pattern="[A-Z]{3}" required value="${escapeHtml(state.currency)}" autocapitalize="characters" spellcheck="false"${disabled}></label><button class="designer-primary-action" type="submit" data-sourcing-request-download${disabled}>${state.busy ? "Preparing exact packet…" : "Download sourcing request JSON"}</button></form><dl><div><dt>Lifecycle</dt><dd>active only</dd></div><div><dt>Backorders</dt><dd>not allowed</dd></div><div><dt>Marketplace</dt><dd>not allowed</dd></div><div><dt>Maximum snapshot age</dt><dd>3,600 seconds</dd></div></dl><small>Local canonical JSON generation only. The packet includes no provider access authority or network destination and adds no app/provider snapshot persistence, ranking, or commercial evaluation.</small></section>`;
}
