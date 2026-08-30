import {
  TRUSTED_SUBCIRCUIT_PACKAGE_IDS,
  trustedSubcircuitDescriptor,
  trustedSubcircuitRegistry,
} from "@opencircuit/model-library";

const descriptor = trustedSubcircuitDescriptor(TRUSTED_SUBCIRCUIT_PACKAGE_IDS[0] ?? "");
if (descriptor !== undefined) trustedSubcircuitRegistry.resolve(descriptor.ref);
