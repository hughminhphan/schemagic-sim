/**
 * Types-only package facade.
 *
 * Customized-target rendering is an internal capability invoked only after an
 * application leaf authorizes an exact source/result object pair. This public
 * subpath intentionally has no runtime exports.
 */
export type {
  PrimaryPartCustomizedArtifactBlockedRuleV1,
  PrimaryPartCustomizedArtifactErrorCodeV1,
  PrimaryPartCustomizedArtifactKindV1,
  PrimaryPartCustomizedArtifactMetadataV1,
  PrimaryPartCustomizedArtifactScenarioV1,
  PrimaryPartCustomizedArtifactV1,
  PrimaryPartCustomizedInstalledArtifactV1,
  PrimaryPartCustomizedInstalledArtifactKindV1,
  PrimaryPartCustomizedReplayableArtifactV1,
  PrimaryPartCustomizedReplayableArtifactKindV1,
} from "./primary-part-customized-artifact-v1";
