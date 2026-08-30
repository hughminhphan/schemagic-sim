import { describe, expect, it } from "vitest";
import {
  getBundledDesignLibraryDocuments,
  type DesignCatalogReleaseV1,
} from "@opencircuit/design-library";
import {
  assessSelectedPassiveCiWiringV1,
  buildDesignerReleaseReadinessReportV1,
  calculateDesignerReleaseReadinessContentHashV1,
} from "../src";

describe("Designer V1 release readiness audit", () => {
  it("is deterministic, content-addressed, and cannot report ready with blocked or unverified gates", () => {
    const first = buildDesignerReleaseReadinessReportV1();
    const second = buildDesignerReleaseReadinessReportV1();
    expect(first).toEqual(second);
    expect(first.contentHash).toBe(calculateDesignerReleaseReadinessContentHashV1(first));
    expect(first.status).toBe("blocked");
    expect(first.gates.some((entry) => entry.status === "blocked")).toBe(true);
    expect(first.gates.some((entry) => entry.status === "unverified")).toBe(true);
    expect(first.gates.map((entry) => entry.id)).toEqual([...first.gates.map((entry) => entry.id)].sort());
    for (const entry of first.gates) {
      expect(entry.blockers).toEqual([...new Set(entry.blockers)].sort());
      if (entry.status === "pass") expect(entry.blockers).toEqual([]);
      else expect(entry.blockers.length).toBeGreaterThan(0);
    }
  }, 15_000);

  it("proves implemented contracts without promoting missing release outcomes", () => {
    const report = buildDesignerReleaseReadinessReportV1();
    const byId = new Map(report.gates.map((entry) => [entry.id, entry]));
    expect(byId.get("contract.data-manifest")?.status).toBe("pass");
    expect(byId.get("contract.constraint-decision-sidecar-v3")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        policy: "production_strict_v1",
        motorPolicyContentHash: "sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0",
        powerPolicyContentHash: "sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6",
        installedMotorPolicyRecipeIds: [
          "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
          "motor.native.integrated-h-bridge.facts-v3-2",
        ],
        installedPowerPolicyRecipeIds: ["power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"],
        motorObservationIdentities: {
          external: {
            resultContentHash: "sha256:01b56be6e6dfc3ca46bb36550f6999571d19bd109e73e99d29d308a69a7733b3",
            decisionContentHash: "sha256:f7dafa7fd6397b7a3fcfe43f12a93e0b05017faa0f91d25ae846584c5afe0604",
            candidateIds: [
              "candidate:v2:sha256:a118ec185d3bbdd54360c94dc6a45476dfdae4f1d6ffb2ac0f6695e485a30152",
              "candidate:v2:sha256:fce7b8a1f83bd1e305e12392a16d8f337e06106c66482640338cf03acdc12382",
            ],
            retainedCandidateCount: 2,
            materializedCandidateCount: 54,
            rejectionCount: 52,
            eligibleCandidateCount: 0,
            gateResistorBomLineCount: 0,
            satisfiedRuleCountPerCandidate: 9,
            blockedRuleCountPerCandidate: 21,
            capacitorRoleBindings: {
              bootstrap: {
                dataKey: "bootstrapProfileId",
                quantityPerAssembly: 2,
                nominalRuleTruth: "pass",
                applicationAdequacy: "unknown",
              },
              local: {
                dataKey: "localProfileId",
                quantityPerAssembly: 1,
                nominalRuleTruth: "pass",
                applicationAdequacy: "unknown",
              },
            },
            gateNetworkRule: {
              truth: "unknown",
              criticality: "safety",
              disposition: "blocked_unknown",
              evidenceContentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135",
            },
          },
          integrated: {
            resultContentHash: "sha256:5d3073a4e68e71f60f2d9eeaabb2ca90da213a3794c6a6779ad83eeefd703044",
            executionContentHash: "sha256:34a59924931a3d6200594670374c5e6d57f07e4722b9d7a92736a0001adc79e4",
            candidateId: "candidate:v2:sha256:3f9953a5582e56cd999070367f1b3c4830bfad4d4e9df55e2ce91891fb5cb16e",
            decisionContentHash: "sha256:27aabbc0fc3d812752e803d3ce15d40457572b2faa1f81def3a8f52ff6d05276",
            retainedCandidateCount: 1,
          },
        },
        powerIntegratedObservationIdentities: {
          resultContentHash: "sha256:0c0beab37c6d04b2bac6cd028035dae9de69855e85ef6e190ccbe5098e25021b",
          candidateId: "candidate:v2:sha256:1fc0e2f47f13060b4606b7cda6e54fae2b297ffbf7873bfe089c37114c444173",
          decisionContentHash: "sha256:7bb304f6a30b58adac8ee9250ec2cda6e4104af965f0d517de0918295228c76c",
          retainedCandidateCount: 1,
          rejectionCount: 0,
          eligibleCandidateCount: 0,
          satisfiedRuleCount: 9,
          blockedRuleCount: 13,
          unknownRuleIds: [
            "power.control.loop-stability",
            "power.inductor.rms-current",
            "power.inductor.saturation-current",
            "power.inductor.selected-value",
            "power.passive.bootstrap-effective-capacitance",
            "power.passive.capacitor-effective-capacitance",
            "power.regulator.current-limit",
            "power.regulator.minimum-off-time",
            "power.regulator.minimum-on-time",
            "power.regulator.output-current",
            "power.request.output-ripple",
            "power.thermal.loss-model",
            "power.thermal.maximum-junction",
          ],
        },
        productionEngineeringGapRuleCount: 0,
        permissiveObservationCandidateCounts: { motorExternal: 2, motorIntegrated: 1, powerIntegrated: 1 },
        eligibleCandidateCounts: { motorExternal: 0, motorIntegrated: 0, powerIntegrated: 0 },
        productionConstraintDecisionUiImplemented: true,
      },
    });
    expect(byId.get("contract.primary-part-customization-observation-v1")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        instructionTransferContractImplemented: true,
        engineObservationImplemented: true,
        targetOnlyPolicyResultImplemented: true,
        browserWorkflowImplemented: true,
        ordinaryGenerationMutation: "none",
        targetConstraintPolicyEligibility: "evaluated",
        selectedPartModel: "not_added",
        commercialAuthority: "not_added",
        customizedTargetStructuralElectricalInspectionExport: "implemented",
        customizedTargetPortableInspectionReceipt: "installed_context_replay_verified_integrity_only",
        customizedTargetFullProductionArtifactAuthorityImplemented: true,
        customizedTargetArtifactKinds: [
          "customized_target_electrical_bom_csv",
          "customized_target_structural_svg",
          "customized_target_engineering_report_html",
          "customized_target_structural_kicad",
          "customized_target_behavioral_scenario_spice",
        ],
        customizedTargetBehavioralScenarioAuthority: "exact_default_behavioral_zero_omission",
        customizedTargetProductionArtifactAuthority: "available_target_only_zero_omission_behavioral",
      },
    });
    expect(byId.get("sourcing.native-v2-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        contentAddressedPolicies: true,
        nativeServiceFactory: true,
        canonicalOperationPermissionConsumers: {
          runtimeLookup: true,
          authorizationIssuance: true,
          trustedVerification: true,
        },
        unsupportedExecutionModeFailsClosed: true,
        approvalReferenceFailClosedCases: ["blank", "control-bearing", "missing", "oversized"],
        blockedLookupSideEffects: { cacheReads: 0, cacheWrites: 0, adapterCalls: 0 },
        legacyV1ExecutionAuthority: "audit_only",
        legacyV1SideEffects: "none",
        rawProviderAdapterPublicSubpaths: "absent",
        providerPoliciesRemainDisabled: true,
      },
    });
    expect(byId.get("sourcing.request-packet-v1")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        coreCanonicalContract: true,
        installedApplicationBoundary: true,
        routePreDownloadAuthority: true,
        exactGenerationBrowserSurface: true,
        staleCompletionBrowserGuard: true,
        bundleLeafIsolation: true,
        explicitNoAuthorityBoundary: true,
        exactAuthorityLayers: ["installed_application_boundary", "designer_route_pre_download"],
        providerAccess: "not_authorized",
        networkCapabilityContract: "prohibited_in_exact_packet_leaf",
        commercialObservations: "not_included",
        appOrProviderSnapshotPersistence: "none",
        rankingOrEligibilityAuthority: "none",
      },
    });
    expect(byId.get("simulation.execution-integrity-contract")?.status).toBe("pass");
    expect(byId.get("simulation.behavioral-application-golden-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        modelTier: "behavioral",
        attestation: "none",
        productionProfilesUsed: false,
        caseIds: [
          "motor.m1.pwm-loaded-steady-state.behavioral",
          "motor.m2.external-nmos.pwm-loaded-steady-state.behavioral",
          "power.p1.startup.behavioral",
          "power.p2.external-fet.startup.behavioral",
        ],
      },
    });
    expect(byId.get("simulation.production-selected-passive-nominal-projection-golden-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        implemented: {
          conditionalContinuousIntegrationWiring: true,
          canonicalExecutionArtifact: true,
          exactProductionObservationIdentity: true,
          generatedProductionIdentityTest: true,
        },
        contractContentHash: "sha256:759ed0914f8dc8034064c4890329c4edc34b32ee6dd0eb3f03c2a3f2ea6e92f8",
        caseId: "power.production.integrated-12v-low-current.ideal-nominal-selected-passives",
        candidateId: "candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a",
        requestHash: "sha256:f21a643aba1a3c8cb75d42ff2e69b4f12a25168becdb68fbf54f720649821cd4",
        resultContentHash: "sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a",
        strictGeneration: {
          requestHash: "sha256:30b8c0fac110f71ce3e71c9347afe725f2a1ad29aa4fdb6bfde8bc87cc73771c",
          resultContentHash: "sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2",
          retainedCandidateCount: 0,
          rejectedCandidateId: "candidate:v2:sha256:88b7d52b012cd7edfda6ba8f5ef0611c7d2ffeff870614ccf9d0dea6f1ca679d",
          rejectionReasonCode: "unknown_constraint_disallowed",
          counts: {
            recipes: 4,
            supportedRecipes: 3,
            enumerated: 1,
            solved: 1,
            matchOutcomes: 1,
            matched: 1,
            checked: 1,
            estimated: 0,
            deduped: 0,
            pareto: 0,
            materialized: 0,
            coverageValidated: 0,
            rejected: 1,
          },
        },
        constraintPolicy: {
          id: "production_strict_v1",
          contentHash: "sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6",
        },
        constraintDecisionContentHash: "sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37",
        observationCounts: {
          recipes: 4,
          supportedRecipes: 3,
          enumerated: 1,
          solved: 1,
          matchOutcomes: 1,
          matched: 1,
          checked: 1,
          estimated: 1,
          deduped: 1,
          pareto: 1,
          materialized: 1,
          coverageValidated: 1,
          rejected: 0,
        },
        observationCandidateCount: 1,
        eligibleCandidateCount: 0,
        recipe: {
          id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
          version: "3.4.6",
          contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
        },
        library: {
          version: "2026-08-27.2",
          contextManifestContentHash: "sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3",
          catalogContentHash: "sha256:0c56438b69da824a08963f5492096a9387eacfc84ac72c572103a7a3239b8890",
          sourceReleaseContentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
        },
        scenario: {
          id: "ideal_pwm_output_stage_transient",
          hash: "a09afbbb72d487c1",
          serializationHash: "550831affe3a64c1",
        },
        netlistContentHash: "sha256:7d0a83af5d553344adaedbd6ab9d2ad86a70630313ab56045e46304c9eaeac97",
        selectedPassiveProfiles: [
          {
            selectedComponentId: "output-capacitor",
            assemblyComponentId: "output-capacitor-1",
            circuitComponentId: "output-capacitor-1",
            physicalInstanceOrdinal: 1,
            selectedLineQuantityPerAssembly: 2,
            representedQuantityPerAssembly: 1,
            profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
            profileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
            manufacturerPartNumber: "GRM32ER71E226KE15L",
            nominalValue: { value: 0.000022, unit: "F" },
            representation: "ideal_nominal_capacitor",
            reviewedOperatingConditionStatus: "outside_or_unproved",
          },
          {
            selectedComponentId: "output-capacitor",
            assemblyComponentId: "output-capacitor-2",
            circuitComponentId: "output-capacitor-2",
            physicalInstanceOrdinal: 2,
            selectedLineQuantityPerAssembly: 2,
            representedQuantityPerAssembly: 1,
            profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
            profileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
            manufacturerPartNumber: "GRM32ER71E226KE15L",
            nominalValue: { value: 0.000022, unit: "F" },
            representation: "ideal_nominal_capacitor",
            reviewedOperatingConditionStatus: "outside_or_unproved",
          },
          {
            selectedComponentId: "power-inductor",
            assemblyComponentId: "power-inductor",
            circuitComponentId: "power-inductor",
            physicalInstanceOrdinal: 1,
            selectedLineQuantityPerAssembly: 1,
            representedQuantityPerAssembly: 1,
            profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
            profileContentHash: "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
            manufacturerPartNumber: "F1F2-0804-100M",
            nominalValue: { value: 0.00001, unit: "H" },
            representation: "ideal_nominal_inductor",
            reviewedOperatingConditionStatus: "outside",
          },
        ],
        primitiveValueBasis: "reviewed_nominal_only",
        productionConstraintEligibility: false,
        currentProductionIdentity: true,
        selectedSemiconductorModelsUsed: false,
        operatingConditionsWithinReviewedEvidence: false,
        modelTier: "behavioral",
        attestation: "none",
        authority: {
          switchingBehavior: "unavailable",
          effectiveCapacitance: "unavailable",
          capacitorEsr: "unavailable",
          capacitorRippleCurrent: "unavailable",
          passiveCurrent: "unavailable",
          loss: "unavailable",
          physicalPassiveModel: "unavailable",
          fullBomModel: "unavailable",
          selectedSemiconductorModel: "unavailable",
          constraintEligibility: "unavailable",
          candidateRanking: "unavailable",
          safety: "unavailable",
        },
        engineClaims: {
          nativeVersion: "ngspice-46",
          nativeSolver: "unverified",
          browserWasmBuildVersion: "ngspice-46-opencircuit-wasm1",
          browserWasmSimulatorVersion: "ngspice-46",
          browserWasmSolver: "KLU",
        },
        executionResultAttached: true,
        executionArtifactAttested: false,
        ciWiringChecks: {
          exactHarnessCommand: true,
          workflowExecutionDefaultsAbsent: true,
          unfilteredPushAndPullRequestTriggers: true,
          uniqueNativeComparisonJob: true,
          repositoryCheckout: true,
          nodeRuntimeSetup: true,
          lockedWorkspaceDependenciesInstalled: true,
          comparisonHarnessDependenciesInstalled: true,
          nativeRuntimeInstalled: true,
          uniqueNativeVersionDetection: true,
          orderedNativeComparisonSteps: true,
          conditionalBehavioralComparison: true,
          hardPersistedArtifactAndCurrentIdentity: true,
          conditionalSelectedPassiveNumericalRerun: true,
        },
        ciExecutionAuthority: {
          mode: "conditional_native_reference",
          referenceNativeVersion: "ngspice-46",
          persistedCurrentIdentityAuthority: "hard_gate",
          matchingReferenceFailureAuthority: "hard_gate",
          nonmatchingNativeVersionFailureAuthority: "informational_soft_fail",
        },
        executionArtifact: {
          contentHash: "sha256:70e821f80e7f16ce75992f152fb9bc3cf2aed48e9de4a0acd9aefc9ec4bb984c",
          byteLength: 11674,
          sampleContentHash: "sha256:8f54e9c2e62ddfefaaa6b33b16dc781677d0b97a1e513590899c40160bb6215d",
          browserReceiptContentHash: "sha256:656edd7163ab6b003b9b481aba170f93992366c03513e2c846b90a2ebc6a51a3",
          nativeSampleCount: 4371,
          browserWasmSampleCount: 4371,
          validation: "canonical_current_identity_bound_regenerated_unattested_ineligible_observation",
        },
      },
    });
    expect(byId.get("simulation.selected-semiconductor-ideal-rdson-projection-golden")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        implemented: {
          closedIdealReviewedRdsonProjectionContract: true,
          exactCurrentProductionObservationIdentity: true,
          exactReviewedProfileAndSource: true,
          exactFourIdealResistorFixture: true,
          generatedCurrentIdentityTest: true,
          nativeAndWasmIdealProjectionRunner: true,
          canonicalExecutionArtifact: true,
          explicitBoundedClaimExclusions: true,
          conditionalContinuousIntegrationWiring: true,
        },
        contractContentHash: "sha256:7ce9e9b453f35e668271b4ce3d00971b669a36de466b57d73dd30b04f73187c9",
        executionResultAttached: true,
        executionArtifactAttested: false,
        currentIdentity: {
          requestHash: "sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f",
          resultContentHash: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176",
          constraintDecisionContentHash: "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e",
          candidateId: "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed",
          candidateIndex: 0,
          candidateEligible: false,
          recipe: {
            id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
            version: "3.1.7",
            contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
          },
          library: {
            version: "2026-08-27.2",
            contextManifestContentHash: "sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38",
            catalogReleaseContentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
          },
        },
        selectedBinding: {
          selectedComponentId: "mosfet",
          profileContentHash: "sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8",
          manufacturerPartNumber: "CSD18540Q5B",
          quantityPerAssembly: 4,
          catalogAdmissionState: "reviewed",
        },
        sourceBinding: {
          contentHash: "sha256:2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0",
        },
        projectionContract: {
          temperatureC: 25,
          gateConditionVoltageV: 10,
          forcedCurrentA: 28,
          reviewedMaximumRdsOhm: 0.0022,
          expectedVoltageDropV: 0.0616,
        },
        ciWiringChecks: {
          exactHarnessCommand: true,
          aggregateHarnessIncludesProjection: true,
          conditionalProjectionRerun: true,
        },
        executionArtifact: {
          contentHash: "sha256:310bc587ab5a54c9f58a725a70201bdb5d9fff7e6ca53e7a4e193ee3b01083b0",
          byteLength: 6743,
          sampleContentHash: "sha256:ce0385f811496395e5cd0bcccb7fa161c88703f195cdf3f554837cb0eee36ca7",
          browserReceiptContentHash: "sha256:7c3387826241f56bb54cb363dbe74300273f1c4d143297e214952dc053b608a5",
          nativeVoltageDropsV: [0.0616, 0.0616, 0.0616, 0.0616],
          browserWasmVoltageDropsV: [0.0616, 0.0616, 0.0616, 0.0616],
        },
        selectedPartDeviceEquationUsed: false,
        physicalFidelityProved: false,
        productionRequestConditionsEvaluated: false,
        productionConstraintEligibility: false,
        rankingAuthority: false,
        fullBomCoverage: false,
      },
    });
    expect(byId.get("simulation.production-selected-semiconductor-dc-golden-contract")).toMatchObject({
      status: "blocked",
      blockers: expect.arrayContaining([
        "selected_semiconductor_application_golden_contract_missing:canonicalExecutionArtifact",
        "selected_semiconductor_application_golden_contract_missing:closedReviewedF1OperatingPointContract",
        "selected_semiconductor_application_golden_contract_missing:exactFourIndependentInstanceFixture",
        "selected_semiconductor_application_golden_contract_missing:exactProductionObservationIdentity",
        "selected_semiconductor_application_golden_contract_missing:exactReviewedOperatingPoint",
        "selected_semiconductor_application_golden_contract_missing:exactSelectedQuantityAndReviewedProfile",
        "selected_semiconductor_application_golden_contract_missing:exactStrictReviewedModelPackage",
        "selected_semiconductor_application_golden_contract_missing:explicitBoundedClaimExclusions",
      ]),
      evidence: {
        implemented: {
          canonicalExecutionArtifact: false,
          closedReviewedF1OperatingPointContract: false,
          exactFourIndependentInstanceFixture: false,
          exactProductionObservationIdentity: false,
          exactReviewedOperatingPoint: false,
          exactSelectedQuantityAndReviewedProfile: false,
          exactStrictReviewedModelPackage: false,
          explicitBoundedClaimExclusions: false,
          generatedProductionIdentityTest: true,
        },
        currentProductionIdentity: false,
        currentProductionIdentityAuthority: "unverified",
        installedExternalLane: "unverified",
      },
    });
    expect(byId.get("catalog.reviewed-release")).toMatchObject({
      status: "blocked",
      evidence: {
        admittedProfileCount: 24,
        admittedPartClassCount: 11,
        manifestCountsMatchCatalogRelease: true,
      },
    });
    expect(byId.get("motor.production-context-v2")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        contextStatus: "ready",
        reason: null,
        catalogVersion: "2026-08-27.2",
        catalogProfileCount: 24,
        reviewedProfileCount: 19,
        compatibleProfileCount: 19,
        installedReadyRecipeIds: [
          "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
          "motor.native.integrated-h-bridge.facts-v3-2",
        ],
      },
    });
    expect(byId.get("motor.primary-evidence")).toMatchObject({
      status: "blocked",
      evidence: {
        catalogAdmittedProfiles: 3,
        generatorEligibleProfiles: 2,
        integratedBridgeCurrentBoundary: {
          authoredNormalPeakCurrentMaximumA: 3.5,
          explanation: "The integrated-bridge tranche's authored normal peak-current ceiling is 3.5 A. DRV8262DDVR's 32 A figure is protection-threshold evidence, not a normal peak or stall-current guarantee.",
        },
        remainingSharedProfileGapCount: 1,
        sharedProfileCoverage: {
          bootstrapCapacitors: {
            factCoverageSatisfied: true,
            roleAuthority: {
              status: "available",
              basis: "exact_recipe_bootstrap_capacitor_role",
            },
            satisfied: true,
            profileIds: [
              "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
              "packages/design-library/parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json",
              "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json",
            ],
            profileContentHashes: [
              "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
              "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
              "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
            ],
            recipeIds: ["motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"],
            dataKey: "bootstrapProfileId",
            quantityPerAssembly: 2,
            nominalFloorF: 0.1e-6,
            nominalFloorStatus: "source_bound_pass",
            applicationAdequacy: "unknown",
          },
          localDecouplingCapacitors: {
            factCoverageSatisfied: true,
            roleAuthority: {
              status: "available",
              basis: "exact_recipe_driver_local_decoupling_capacitor_role",
            },
            satisfied: true,
            profileIds: [
              "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
              "packages/design-library/parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json",
              "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json",
            ],
            profileContentHashes: [
              "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
              "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
              "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
            ],
            recipeIds: ["motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"],
            dataKey: "localProfileId",
            quantityPerAssembly: 1,
            nominalFloorF: 1e-6,
            nominalFloorStatus: "source_bound_pass",
            applicationAdequacy: "unknown",
          },
          currentShunts: {
            factCoverageSatisfied: true,
            roleAuthority: {
              status: "available",
              basis: "part_class_is_role_specific",
            },
            satisfied: true,
            profileIds: [
              "packages/design-library/parts/shared.current-sense-resistor/bourns/CRA2512-FZ-R020ELF.json",
            ],
            recipeIds: ["motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"],
          },
          seriesGateResistors: {
            factCoverageSatisfied: false,
            roleAuthority: {
              status: "not_required",
              basis: "exact_driver_guidance_omits_series_gate_resistors",
            },
            satisfied: true,
            profileIds: [],
            recipeIds: [],
          },
          pulldownResistors: {
            factCoverageSatisfied: true,
            roleAuthority: {
              status: "available",
              basis: "exact_recipe_component_role",
            },
            satisfied: true,
            profileIds: [
              "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json",
              "packages/design-library/parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json",
              "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json",
            ],
            recipeIds: ["motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified"],
          },
        },
        productionContextContractSatisfied: true,
      },
    });
    const motorEvidenceBlockers = byId.get("motor.primary-evidence")?.blockers ?? [];
    expect(motorEvidenceBlockers).toHaveLength(8);
    expect(motorEvidenceBlockers).toContain(
      "application_envelope:The Motor application envelope remains unclosed for stall or peak requirements up to 30 A. The external-FET H-bridge topology is the intended high-current path, but stall duration, pulse duty, MOSFET safe-operating-area, protection response, and transient-thermal evidence are not jointly bound.",
    );
    expect(motorEvidenceBlockers).not.toContain(
      "integrated_coverage:The tranche does not cover stall or peak requirements up to 30 A; DRV8262DDVR's 32 A figure is protection-threshold evidence, while authored normal peak ratings top out at 3.5 A.",
    );
    expect(motorEvidenceBlockers).not.toContain("independent_profile_review_and_admission_pending");
    expect(motorEvidenceBlockers.some((blocker) => (
      blocker.startsWith("application_envelope:")
      || blocker.startsWith("integrated_coverage:")
      || blocker.startsWith("gate_driver_coverage:")
      || blocker.startsWith("shared_profile_gap:")
    ))).toBe(true);
    expect(motorEvidenceBlockers.join("\n")).not.toMatch(/Current shunts:/u);
    expect(motorEvidenceBlockers.join("\n")).not.toMatch(/External N-MOSF profiles:/u);
    expect(motorEvidenceBlockers.join("\n")).not.toMatch(/Supply TVS:/u);
    const sharedCapacitorBlockers = motorEvidenceBlockers.filter((blocker) => (
      blocker.startsWith("shared_profile_gap:Capacitor application evidence:")
    ));
    expect(sharedCapacitorBlockers).toHaveLength(1);
    expect(sharedCapacitorBlockers?.[0]).toMatch(/effective capacitance.*bootstrap QGATE.*bulk transient-energy adequacy remain unknown/u);
    expect(motorEvidenceBlockers.join("\n")).not.toMatch(/Series-gate resistors:/u);
    expect(motorEvidenceBlockers.join("\n")).not.toMatch(/pulldown resistors:/iu);
    expect(byId.get("power.production-context-v2")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        contextStatus: "ready",
        reason: null,
        catalogVersion: "2026-08-27.2",
        catalogProfileCount: 24,
        reviewedProfileCount: 15,
        compatibleProfileCount: 14,
        installedReadyRecipeIds: ["power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"],
        recipeReadiness: expect.arrayContaining([
          {
            recipeId: "power.native.external-fet-synchronous-buck.facts-v3",
            recipeVersion: "3.0.0",
            recognizedContract: true,
            releaseEligible: false,
            ready: false,
          },
          {
            recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
            recipeVersion: "3.4.6",
            recognizedContract: true,
            releaseEligible: true,
            ready: true,
          },
        ]),
      },
    });
    expect(byId.get("power.external-fet-readiness-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        recipeId: "power.native.external-fet-synchronous-buck.facts-v3",
        recipeVersion: "3.0.0",
        recipeContentHash: "sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538",
        contextManifestContentHash: "sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3",
        recognizedContract: true,
        releaseEligible: false,
        ready: false,
        reviewedExternalControllerProfileCount: 0,
        installedConstraintPolicyRecipeIds: ["power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"],
        structuralBomLineCount: 9,
        defaultScenarioId: null,
        modelTier: "unavailable",
      },
    });
    expect(byId.get("power.primary-evidence")?.evidence).toMatchObject({
      admissionEligibleProfileCount: 1,
      admissionBlockerCount: 6,
      factsV2AuthoringGapCount: 6,
      factsV2AuthoringAssessmentCount: 7,
      factsV2ReviewedReleaseReconciliations: [
        expect.objectContaining({
          status: "reconciled",
          failures: [],
          scope: expect.objectContaining({
            claim: "exact_reviewed_release_production_enumeration_only",
            stagedAssessment: "retained_not_promoted",
            sourceProfileId: "real.texas-instruments.tps54302ddcr",
            stagedFactsSchemaVersion: "2.0.0",
            releasedFactsSchemaVersion: "3.3.0",
            recipe: {
              id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
              version: "3.4.6",
              contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
            },
          }),
          evidence: expect.objectContaining({
            admission: expect.objectContaining({ independentlyReviewed: true, allChecksPass: true }),
            recipe: expect.objectContaining({ ready: true, requiredFactsSchemaVersion: "3.3.0" }),
          }),
        }),
      ],
      productionContextContractSatisfied: true,
      draftAuthoringAssessment: {
        decision: "partial_non_admitted_draft",
        selectedProfileId: "real.onsemi.ncp1599mntwg",
        selectedScore: {
          candidateValueCount: 17,
          draftAuthoringBlockerCount: 15,
          sourceBoundClaimCount: 15,
          sourceBoundMandatoryEvidenceCount: 3,
        },
        selectedBlockerCounts: {
          blocked_missing_profile_evidence: 1,
          blocked_missing_source_fact: 4,
          blocked_semantic_mismatch: 2,
          blocked_unrepresentable_condition: 5,
          needs_condition_authoring_and_independent_review: 3,
        },
        authorableProfileCount: 0,
        independentReviewState: "pending",
        admissionState: "isolated_not_admitted",
        draft: expect.objectContaining({
          factsSchemaVersion: "2.0.0",
          partClass: "power.integrated-synchronous-buck-regulator",
          part: { manufacturerId: "onsemi", manufacturerPartNumber: "NCP1599MNTWG" },
        }),
      },
    });
    const expectedProviderIssueCodes = [
      "policy_disabled",
      "authorization_not_approved",
      "approval_reference_invalid",
      "rate_limit_invalid",
      "cache_policy_invalid",
      "deletion_policy_invalid",
      "execution_mode_unavailable",
    ];
    for (const provider of ["digikey", "mouser"]) {
      expect(byId.get(`sourcing.provider.${provider}`)).toMatchObject({
        status: "blocked",
        evidence: {
          provider,
          contentHashValid: true,
          state: "disabled_pending_approval",
          approval: "pending",
          approvalReferenceState: "missing",
          publicHosted: "disabled_pending_approval",
          selfHosted: "disabled_pending_approval",
          operationPermissionIssueCodes: {
            publicHosted: expectedProviderIssueCodes,
            selfHosted: expectedProviderIssueCodes,
          },
        },
      });
    }
    expect(byId.get("simulation.application-golden-coverage")).toMatchObject({
      status: "unverified",
      evidence: {
        behavioralAllTopologyApplicationGoldenContractImplemented: true,
        selectedBehavioralAnalyticSimulationRelationsImplemented: true,
        selectedPassiveNominalPrimitiveGoldenContractImplemented: true,
        selectedPassiveNominalProjectionExecutionArtifactAttached: true,
        idealReviewedRdsonProjectionImplemented: true,
        reviewedSelectedSemiconductorDcGoldenImplemented: false,
      },
    });
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("production_selected_passive_nominal_projection_native_wasm_golden_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("motor_integrated_behavioral_native_wasm_golden_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("power_integrated_behavioral_native_wasm_golden_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("motor_external_nmos_native_wasm_golden_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("power_external_fet_native_wasm_golden_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("selected_behavioral_analytic_simulation_relations_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("production_selected_passive_nominal_projection_native_wasm_execution_artifact_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .not.toContain("reviewed_selected_semiconductor_native_wasm_golden_unverified");
    expect(byId.get("simulation.application-golden-coverage")?.blockers)
      .toEqual([
        "full_bom_selected_part_native_wasm_coverage_unverified",
        "selected_passive_operating_condition_fidelity_unverified",
      ]);
    expect(byId.get("simulation.application-golden-coverage")?.evidence.claimBoundary)
      .toMatch(/canonical current-production identity artifact for one permissive structural observation/u);
    expect(byId.get("simulation.application-golden-coverage")?.evidence.claimBoundary)
      .toMatch(/100 kHz \/ 0\.25 V RMS inductance characterization does not cover the 290 kHz production minimum or 400 kHz behavioral scenario/u);
    expect(byId.get("simulation.application-golden-coverage")?.evidence.claimBoundary)
      .toMatch(/ideal reviewed-RDS\(on\) projection.*61\.6 mV.*does not satisfy the blocked production selected-semiconductor DC contract/u);
    expect(byId.get("designer.synthetic-example-gallery-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        exampleIds: ["m1-compact", "m2-power", "p1-compact", "p2-high-voltage"],
        boundaries: {
          classification: "synthetic_test_fixture",
          allowedUse: "testing_and_ui_examples_only",
          productionProfileCount: 0,
          providerAccess: "none",
          commercialData: "none",
          simulationFidelityClaim: "none",
        },
      },
    });
    expect(byId.get("exports.contract-availability")?.status).toBe("pass");
    expect(byId.get("exports.contract-availability")?.blockers).toEqual([]);
    expect(byId.get("exports.contract-availability")?.evidence).toMatchObject({
      implemented: { structuralKicadV2: true, printableReportV2: true },
      missingRequired: [],
      productionReachability: {
        scenarioSpiceV2: true,
        simulationCsvV2: false,
        simulatorHandoff: false,
        commercialExport: false,
      },
    });
    expect(byId.get("exports.external-kicad-cli-qa-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        attestation: "none",
        externalReportedExecutionResultAssociated: false,
        externalReleaseArtifactAttested: false,
        externalReleaseAttachment: null,
        fixtureIds: ["motor-integrated-v2", "power-integrated-v2"],
      },
    });
    expect(byId.get("web.automated-regression-contracts")).toMatchObject({
      status: "pass",
      evidence: {
        implemented: {
          axePlaywrightPinned: true,
          accessibilityRouteMatrix: true,
          sharedResultOfflineReopen: true,
          designerBundleBudget: true,
          productionPrimaryPartCustomization: true,
          productionRequirementsTransfer: true,
          productionContextExports: true,
          productionBehavioralScenarioSpice: true,
          productionSchematicPreview: true,
          productionDecisionExplorer: true,
          productionExactMpnSearchHandoff: true,
          productionSelectedPartEvidenceDossier: true,
          productionConnectedStructuralCircuits: true,
          strictDefaultCandidateBoundary: true,
          contentAddressedExampleGallery: true,
          staticOfflineNetworkAudit: true,
        },
      },
    });
    expect(byId.get("release.repository-safety-scan")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        scanScope: "git_tracked_and_unignored_untracked",
        boundaries: {
          gitIgnoredWorkingDataExcluded: true,
          providerAuthorizationNotInferred: true,
          publicationRightsNotInferred: true,
        },
      },
    });
    expect(byId.get("release.reproducible-verification")?.blockers)
      .not.toContain("secret_and_proprietary_artifact_scan_unverified");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .toContain("clean_checkout_full_matrix_unverified");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .toContain("manual_accessibility_and_assistive_technology_audit_unverified");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .not.toContain("broader_static_offline_network_audit_unverified");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .toContain("deployed_offline_and_network_behavior_unverified");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .not.toContain("four_fixture_example_gallery_unavailable");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .not.toContain("runtime_performance_and_memory_audit_unverified");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .toContain("runtime_performance_and_memory_release_report_unattached");
    expect(byId.get("release.reproducible-verification")?.blockers)
      .toContain("external_kicad_cli_qa_release_report_unattached");
    expect(byId.get("release.reproducible-verification")?.blockers).toContain("kicad_open_without_repair_unverified");
    expect(byId.get("release.reproducible-verification")?.evidence).toMatchObject({
      cleanCheckoutFullMatrixReportAssociated: false,
      cleanCheckoutFullMatrixArtifactAttested: false,
      cleanCheckoutFullMatrixAttachment: {
        validation: "unattached",
        attestation: "none",
      },
      externalKicadCliQaContractImplemented: true,
      runtimePerformanceMemoryContractImplemented: true,
    });
    expect(byId.get("web.runtime-performance-memory-contract")).toMatchObject({
      status: "pass",
      blockers: [],
      evidence: {
        contractVersion: "2026-08-26.3",
        contractContentHash: "sha256:0b9602bf26211a38e301e830a95dc9e7f7ee7e0c2778beb8c6e8834a8f257928",
      },
    });
    expect(byId.get("web.production-workflow")?.blockers).toEqual([
      "commercial_sourcing_providers_not_authorized",
      "motor_strict_default_verified_candidate_unavailable",
      "power_strict_default_verified_candidate_unavailable",
      "reviewed_selected_part_simulation_fidelity_unavailable",
    ]);
    expect(byId.get("web.production-workflow")?.blockers)
      .not.toContain("customized_target_full_production_artifact_authority_unavailable");
    expect(byId.get("web.production-workflow")?.blockers).not.toContain("motor_generation:null");
    expect(byId.get("web.production-workflow")?.blockers.some((blocker) => blocker.startsWith("motor_generation:"))).toBe(false);
    expect(byId.get("web.production-workflow")?.blockers.some((blocker) => blocker.startsWith("power_generation:"))).toBe(false);
    expect(byId.get("web.production-workflow")?.evidence).toMatchObject({
      motorContextStatus: "ready",
      powerContextStatus: "ready",
      productionConnectedStructuralCircuitContractImplemented: true,
      productionBehavioralScenarioSpiceContractImplemented: true,
      productionRequirementsTransferContractImplemented: true,
      primaryPartCustomizationCoreContractImplemented: true,
      primaryPartCustomizationBrowserWorkflowImplemented: true,
      customizedTargetStructuralElectricalInspectionExportImplemented: true,
      customizedTargetFullProductionArtifactAuthorityImplemented: true,
      customizedTargetPortableInspectionReceiptImplemented: true,
      customizedTargetArtifactKinds: [
        "customized_target_electrical_bom_csv",
        "customized_target_structural_svg",
        "customized_target_engineering_report_html",
        "customized_target_structural_kicad",
        "customized_target_behavioral_scenario_spice",
      ],
      customizedTargetBehavioralScenarioAuthority: "exact_default_behavioral_zero_omission",
      customizedTargetProductionArtifactAuthority: "available_target_only_zero_omission_behavioral",
      strictDefaultCandidateCounts: { motor: 0, power: 0 },
      permissiveInspectionCandidateCounts: { motorExternal: 2, motorIntegrated: 1, powerIntegrated: 1 },
      materialization: "connected_exact_bom_structural_default_plus_separate_generic_behavioral_scenarios",
      currentProductionSurface: "reviewed_motor_and_power_generation_contexts_external_motor_exact_mic4606_2_direct_gate_split_capacitor_roles_54_strict_unknown_policy_rejections_2_permissive_structural_observations_no_series_gate_bom_nominal_capacitance_passes_application_adequacy_unknown_installed_v3_truth_criticality_disposition_zero_eligibility_observation_ui_explicit_unknown_evidence_inspection_canonical_v2_requirements_download_import_share_input_only_explicit_installed_regeneration_primary_part_customization_file_and_r_plus_c_transfer_explicit_adapter_authorized_target_policy_evaluation_customized_target_five_kind_target_only_zero_omission_behavioral_authority_and_bom_svg_portable_receipt_integrity_only_connected_exact_bom_structural_default_separate_generic_behavioral_scenarios_exact_context_scenario_spice_verified_decision_explorer_selected_part_evidence_dossier_exact_mpn_lcsc_search_handoff_exact_result_share_regeneration_exact_engineering_context_bom_svg_report_structural_kicad_exports_and_inline_structural_svg_preview",
    });
    expect(JSON.stringify(report)).toContain("attestation");
    expect(JSON.stringify(report)).toContain("waveform_only_not_ranking");
  });

  it("returns a detached, recursively frozen report", () => {
    const first = buildDesignerReleaseReadinessReportV1();
    const second = buildDesignerReleaseReadinessReportV1();
    const firstGate = first.gates[0];
    const simulationGate = first.gates.find((entry) => entry.id === "simulation.execution-integrity-contract");
    if (firstGate === undefined) throw new Error("Expected at least one release gate");
    if (simulationGate === undefined) throw new Error("Expected the simulation integrity gate");
    const engine = simulationGate.evidence.engine as Record<string, unknown>;

    expect(first).not.toBe(second);
    expect(first.gates).not.toBe(second.gates);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.gates)).toBe(true);
    expect(Object.isFrozen(firstGate)).toBe(true);
    expect(Object.isFrozen(firstGate.blockers)).toBe(true);
    expect(Object.isFrozen(firstGate.evidence)).toBe(true);
    expect(Object.isFrozen(engine)).toBe(true);
    expect(() => {
      (firstGate.evidence as Record<string, unknown>).unexpected = true;
    }).toThrow(TypeError);
    expect(() => {
      (firstGate.blockers as string[]).push("unexpected");
    }).toThrow(TypeError);
    expect(() => {
      engine.id = "unexpected";
    }).toThrow(TypeError);
  });

  it("derives simulation production-profile evidence from the bundled catalog release", () => {
    const report = buildDesignerReleaseReadinessReportV1();
    const documents = getBundledDesignLibraryDocuments();
    const release = documents.catalogRelease as DesignCatalogReleaseV1;
    const simulationGate = report.gates.find((entry) => entry.id === "simulation.application-golden-coverage");

    expect(simulationGate?.status).toBe("unverified");
    expect(simulationGate?.evidence.productionCatalogProfileCount)
      .toBe(release.profiles.length);
  });

  it("derives selected-passive CI authority from executable step structure rather than comments", () => {
    const conditionalExpression = "${{ steps.native-version.outputs.major != '46' }}";
    const nativeInstallStep = [
      "      - name: Install Ubuntu ngspice",
      "        shell: bash",
      "        run: |",
      "          sudo apt-get update",
      "          sudo apt-get install -y ngspice",
      "          sudo mkdir -p /opt/homebrew/bin",
      "          sudo ln -sf \"$(command -v ngspice)\" /opt/homebrew/bin/ngspice",
    ].join("\n");
    const nativeDetectionStep = [
      "      - name: Detect native ngspice version",
      "        id: native-version",
      "        shell: bash",
      "        run: |",
      "          version_output=\"$(ngspice --version 2>&1)\"",
      "          printf '%s\\n' \"$version_output\"",
      "          major=\"$(printf '%s\\n' \"$version_output\" | grep -Eo 'ngspice-[0-9]+' | head -1 | cut -d- -f2 || true)\"",
      "          echo \"major=$major\" >> \"$GITHUB_OUTPUT\"",
      "          echo \"text<<EOF\" >> \"$GITHUB_OUTPUT\"",
      "          echo \"$version_output\" >> \"$GITHUB_OUTPUT\"",
      "          echo \"EOF\" >> \"$GITHUB_OUTPUT\"",
    ].join("\n");
    const unfilteredTriggers = [
      "on:",
      "  push:",
      "  pull_request:",
    ].join("\n");
    const workflow = [
      ...unfilteredTriggers.split("\n"),
      "",
      "jobs:",
      "  native-comparison:",
      "    name: Native versus WASM comparison",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Check out repository",
      "        uses: actions/checkout@v4",
      "      - name: Set up Node.js",
      "        uses: actions/setup-node@v4",
      "        with:",
      "          node-version: 22",
      "          cache: npm",
      "          cache-dependency-path: tools/native-ngspice-reference/package-lock.json",
      "      - name: Install locked workspace dependencies",
      "        shell: bash",
      "        run: npm ci",
      "      - name: Install comparison harness dependencies",
      "        shell: bash",
      "        run: npm ci --prefix tools/native-ngspice-reference",
      ...nativeInstallStep.split("\n"),
      ...nativeDetectionStep.split("\n"),
      "      - name: Run native and WASM comparison and behavioral application-golden suites",
      "        id: comparison",
      "        shell: bash",
      `        continue-on-error: ${conditionalExpression}`,
      "        working-directory: tools/native-ngspice-reference",
      "        env:",
      "          OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE: ${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs",
      "        run: node --test test/*.test.mjs && node suite.mjs && npm run test:application-golden",
      "      - name: Validate selected-passive persisted artifact and current-production identity",
      "        id: selected-passive-detachment",
      "        if: always()",
      "        shell: bash",
      "        working-directory: tools/native-ngspice-reference",
      "        run: node --test test/selected-passive-execution-report.test.mjs && npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-passive-application-golden.test.ts",
      "      - name: Rerun selected-passive native and WASM artifact",
      "        id: selected-passive-rerun",
      "        if: always()",
      "        shell: bash",
      `        continue-on-error: ${conditionalExpression}`,
      "        working-directory: tools/native-ngspice-reference",
      "        env:",
      "          OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE: ${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs",
      "        run: npm run test:selected-passive-application-golden",
      "",
    ].join("\n");
    const harnessPackage = JSON.stringify({
      scripts: {
        "test:selected-passive-application-golden": "npm --prefix ../.. run test --workspace=@opencircuit/sim-engine -- test/selected-passive-application-golden.test.ts && npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-passive-application-golden.mjs --verify-persisted-report",
      },
    });

    expect(assessSelectedPassiveCiWiringV1(workflow, harnessPackage)).toEqual({
      implemented: true,
      checks: {
        exactHarnessCommand: true,
        workflowExecutionDefaultsAbsent: true,
        unfilteredPushAndPullRequestTriggers: true,
        uniqueNativeComparisonJob: true,
        repositoryCheckout: true,
        nodeRuntimeSetup: true,
        lockedWorkspaceDependenciesInstalled: true,
        comparisonHarnessDependenciesInstalled: true,
        nativeRuntimeInstalled: true,
        uniqueNativeVersionDetection: true,
        orderedNativeComparisonSteps: true,
        conditionalBehavioralComparison: true,
        hardPersistedArtifactAndCurrentIdentity: true,
        conditionalSelectedPassiveNumericalRerun: true,
      },
    });
    expect(assessSelectedPassiveCiWiringV1(
      workflow.split("\n").map((line) => `# ${line}`).join("\n"),
      harnessPackage,
    ).implemented).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replaceAll(conditionalExpression, "true"),
      harnessPackage,
    )).toMatchObject({
      implemented: false,
      checks: {
        conditionalBehavioralComparison: false,
        conditionalSelectedPassiveNumericalRerun: false,
      },
    });
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(`${nativeInstallStep}\n`, ""),
      harnessPackage,
    ).checks.nativeRuntimeInstalled).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(nativeDetectionStep, [
        "      - name: Detect native ngspice version",
        "        id: native-version",
        "        shell: bash",
        "        run: echo no-op",
      ].join("\n")),
      harnessPackage,
    ).checks.uniqueNativeVersionDetection).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        "      - name: Install Ubuntu ngspice\n",
        "      - name: Install Ubuntu ngspice\n        if: false\n",
      ),
      harnessPackage,
    ).checks.nativeRuntimeInstalled).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        "    runs-on: ubuntu-latest\n",
        "    runs-on: ubuntu-latest\n    if: false\n",
      ),
      harnessPackage,
    ).checks.uniqueNativeComparisonJob).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        `${nativeInstallStep}\n${nativeDetectionStep}`,
        `${nativeDetectionStep}\n${nativeInstallStep}`,
      ),
      harnessPackage,
    ).checks.orderedNativeComparisonSteps).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        [
          "      - name: Validate selected-passive persisted artifact and current-production identity",
          "        id: selected-passive-detachment",
          "        if: always()",
          "        shell: bash",
        ].join("\n"),
        [
          "      - name: Validate selected-passive persisted artifact and current-production identity",
          "        id: selected-passive-detachment",
          "        if: always()",
          "        shell: echo {0}",
        ].join("\n"),
      ),
      harnessPackage,
    ).checks.hardPersistedArtifactAndCurrentIdentity).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        "      - name: Install Ubuntu ngspice\n",
        "      - name: Install Ubuntu ngspice\n        \"if\": false\n",
      ),
      harnessPackage,
    ).checks.nativeRuntimeInstalled).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        "        if: always()\n        shell: bash\n        working-directory: tools/native-ngspice-reference\n",
        "        if: always()\n        \"continue-on-error\": true\n        shell: bash\n        working-directory: tools/native-ngspice-reference\n",
      ),
      harnessPackage,
    ).checks.hardPersistedArtifactAndCurrentIdentity).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(
        "    runs-on: ubuntu-latest\n",
        "    runs-on: ubuntu-latest\n    needs: skipped-guard\n",
      ),
      harnessPackage,
    ).checks.uniqueNativeComparisonJob).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      `env:\n  BASH_ENV: /tmp/noop\n${workflow}`,
      harnessPackage,
    ).checks.workflowExecutionDefaultsAbsent).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(unfilteredTriggers, "on: workflow_dispatch"),
      harnessPackage,
    ).checks.unfilteredPushAndPullRequestTriggers).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(unfilteredTriggers, "on: []"),
      harnessPackage,
    ).checks.unfilteredPushAndPullRequestTriggers).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(unfilteredTriggers, [
        "on:",
        "  push:",
        "    paths:",
        "      - docs/**",
        "  pull_request:",
      ].join("\n")),
      harnessPackage,
    ).checks.unfilteredPushAndPullRequestTriggers).toBe(false);
    expect(assessSelectedPassiveCiWiringV1(
      workflow.replace(unfilteredTriggers, [
        "\"on\":",
        "  push:",
        "  pull_request:",
      ].join("\n")),
      harnessPackage,
    ).checks.unfilteredPushAndPullRequestTriggers).toBe(false);

    const workflowLines = workflow.split("\n");
    const stepsHeaderIndex = workflowLines.indexOf("    steps:");
    expect(stepsHeaderIndex).toBeGreaterThan(0);
    const stepLines = workflowLines.slice(stepsHeaderIndex + 1).filter((line) => line.length > 0);
    const blockScalarDecoy = [
      "jobs:",
      "  native-comparison:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: |",
      ...stepLines.map((line) => `  ${line}`),
      "",
    ].join("\n");
    expect(assessSelectedPassiveCiWiringV1(blockScalarDecoy, harnessPackage).implemented).toBe(false);

    const splitMarker = "      - name: Validate selected-passive persisted artifact and current-production identity";
    const splitIndex = workflow.indexOf(splitMarker);
    expect(splitIndex).toBeGreaterThan(0);
    const splitJobWorkflow = [
      workflow.slice(0, splitIndex).trimEnd(),
      "  unrelated-job:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      workflow.slice(splitIndex).trimEnd(),
      "",
    ].join("\n");
    expect(assessSelectedPassiveCiWiringV1(splitJobWorkflow, harnessPackage)).toMatchObject({
      implemented: false,
      checks: {
        hardPersistedArtifactAndCurrentIdentity: false,
        conditionalSelectedPassiveNumericalRerun: false,
        orderedNativeComparisonSteps: false,
      },
    });
    expect(assessSelectedPassiveCiWiringV1(workflow, JSON.stringify({
      description: harnessPackage,
      scripts: {},
    })).checks.exactHarnessCommand).toBe(false);

    const report = buildDesignerReleaseReadinessReportV1();
    const selectedPassiveGate = report.gates.find((entry) => (
      entry.id === "simulation.production-selected-passive-nominal-projection-golden-contract"
    ));
    expect(selectedPassiveGate?.evidence.executionResultAttached).toBe(true);
    expect(assessSelectedPassiveCiWiringV1("# comment-only CI", harnessPackage).implemented).toBe(false);
  });
});
