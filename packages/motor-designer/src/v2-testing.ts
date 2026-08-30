import { designProfileId, type DesignProfileV1, type PartClassId } from "@opencircuit/design-library";
import {
  adaptDesignRecipeV1ToV2, calculateElectricalDesignContextManifestV2ContentHash, calculateElectricalRankingPolicyV2ContentHash, calculateReviewedProfileCatalogV2ContentHash,
  getInstalledCompilerImplementationRefV2,
  type DesignGenerationV2, type ElectricalDesignContextManifestV2,
  type ElectricalMetricDeclarationV2, type ElectricalRankingPolicyV2, type LegacyProfileIdentityV2, type ReviewedProfileCatalogV2,
} from "@opencircuit/design-engine";
import { generateElectricalDesignV2ForTesting, type GenerateElectricalTestContextV2 } from "@opencircuit/design-engine/v2-testing";
import { compareDesignV2Tokens, type BrushedDcMotorDesignRequestV2 } from "@opencircuit/design-schema";
import { SYNTHETIC_MOTOR_CATALOG } from "./catalog";
import { MOTOR_DESIGN_RECIPES } from "./recipes";

const declarations: ElectricalMetricDeclarationV2[] = [
  ["motor.board-area-proxy","m2"],["motor.bom-line-count","count"],["motor.component-count","count"],["motor.efficiency","1"],
  ["motor.loss.conduction","W"],["motor.loss.driver","W"],["motor.loss.gate-drive","W"],["motor.loss.passive","W"],["motor.loss.shunt","W"],["motor.loss.switching","W"],["motor.loss.total","W"],
  ["motor.margin.continuous-current","A"],["motor.margin.logic","V"],["motor.margin.peak-current","A"],["motor.margin.pwm","Hz"],["motor.margin.voltage","V"],
  ["motor.model.dynamic-evidence","1"],["motor.temperature.hottest-junction","K"],
].map(([id,unit])=>({id:id!,unit:unit! as ElectricalMetricDeclarationV2["unit"]})).sort((a,b)=>compareDesignV2Tokens(a.id,b.id));
const legacyProfileIdentities: LegacyProfileIdentityV2[] = [
  ...SYNTHETIC_MOTOR_CATALOG.integratedBridges.map((profile)=>({profileId:profile.id,partClass:"motor.integrated-h-bridge" as const,part:profile.part})),
  ...SYNTHETIC_MOTOR_CATALOG.gateDrivers.map((profile)=>({profileId:profile.id,partClass:"motor.full-bridge-gate-driver" as const,part:profile.part})),
  ...SYNTHETIC_MOTOR_CATALOG.mosfets.map((profile)=>({profileId:profile.id,partClass:"shared.n-channel-power-mosfet" as const,part:profile.part})),
  ...SYNTHETIC_MOTOR_CATALOG.shunts.map((profile)=>({profileId:profile.id,partClass:"shared.current-sense-resistor" as const,part:profile.part})),
  ...SYNTHETIC_MOTOR_CATALOG.resistors.map((profile)=>({profileId:profile.id,partClass:"shared.general-purpose-resistor" as const,part:profile.part})),
  ...SYNTHETIC_MOTOR_CATALOG.capacitors.map((profile)=>({profileId:profile.id,partClass:profile.role==="bulk"?"shared.bulk-capacitor" as const:"shared.mlcc-capacitor" as const,part:profile.part})),
];
const ADAPTED_RECIPES=MOTOR_DESIGN_RECIPES.map((recipe)=>adaptDesignRecipeV1ToV2(recipe,{applications:["motor.brushed-dc"],metricDeclarations:declarations,legacyProfileIdentities})).sort((a,b)=>compareDesignV2Tokens(a.id,b.id));
const motorPareto:ElectricalRankingPolicyV2["paretoCriteria"]=[{source:"metric",metricId:"motor.board-area-proxy",direction:"minimize"},{source:"metric",metricId:"motor.loss.total",direction:"minimize"},{source:"metric",metricId:"motor.temperature.hottest-junction",direction:"minimize"}];
const policyPayload:Omit<ElectricalRankingPolicyV2,"contentHash">={format:"schemagic-electrical-ranking-policy",schemaVersion:2,version:"motor-electrical-ranking-v2.1",application:"motor.brushed-dc",paretoCriteria:motorPareto,rankingProfiles:{area:[{source:"metric",metricId:"motor.board-area-proxy",direction:"minimize"}],balanced:[{source:"metric",metricId:"motor.loss.total",direction:"minimize"},{source:"metric",metricId:"motor.board-area-proxy",direction:"minimize"},{source:"metric",metricId:"motor.temperature.hottest-junction",direction:"minimize"}],efficiency:[{source:"metric",metricId:"motor.efficiency",direction:"maximize"},{source:"metric",metricId:"motor.loss.total",direction:"minimize"}],temperature:[{source:"metric",metricId:"motor.temperature.hottest-junction",direction:"minimize"}]}};
const TEST_RANKING_POLICY={...policyPayload,contentHash:calculateElectricalRankingPolicyV2ContentHash(policyPayload)};

type LocalProfile={part:{manufacturerId:string;manufacturerPartNumber:string}};
function profile(partClass:PartClassId,source:LocalProfile):DesignProfileV1{return{format:"schemagic-design-profile",schemaVersion:"1.0.0",partClass,part:source.part,factsSchemaVersion:"1.0.0",commonFacts:{} as never,facts:{}};}
function syntheticProfiles():DesignProfileV1[]{
  const profiles:DesignProfileV1[]=[];
  SYNTHETIC_MOTOR_CATALOG.integratedBridges.forEach((entry)=>profiles.push(profile("motor.integrated-h-bridge",entry)));
  SYNTHETIC_MOTOR_CATALOG.gateDrivers.forEach((entry)=>profiles.push(profile("motor.full-bridge-gate-driver",entry)));
  SYNTHETIC_MOTOR_CATALOG.mosfets.forEach((entry)=>profiles.push(profile("shared.n-channel-power-mosfet",entry)));
  SYNTHETIC_MOTOR_CATALOG.shunts.forEach((entry)=>profiles.push(profile("shared.current-sense-resistor",entry)));
  SYNTHETIC_MOTOR_CATALOG.resistors.forEach((entry)=>profiles.push(profile("shared.general-purpose-resistor",entry)));
  SYNTHETIC_MOTOR_CATALOG.capacitors.forEach((entry)=>profiles.push(profile(entry.role==="bulk"?"shared.bulk-capacitor":"shared.mlcc-capacitor",entry)));
  return profiles.sort((a,b)=>compareDesignV2Tokens(designProfileId(a.partClass,a.part),designProfileId(b.partClass,b.part)));
}
export function createSyntheticMotorDesignContextV2ForTesting(version="designer-v1-reference.1"):GenerateElectricalTestContextV2{
  const sourceRelease={version,contentHash:("sha256:"+"1".repeat(64)) as `sha256:${string}`};
  const catalogPayload:Omit<ReviewedProfileCatalogV2,"contentHash">={format:"schemagic-reviewed-profile-catalog",schemaVersion:2,version,sourceRelease,profiles:syntheticProfiles()};
  const catalog={...catalogPayload,contentHash:calculateReviewedProfileCatalogV2ContentHash(catalogPayload)};
  const manifestPayload:Omit<ElectricalDesignContextManifestV2,"contentHash">={format:"schemagic-electrical-design-context",schemaVersion:2,version,application:"motor.brushed-dc",compiler:getInstalledCompilerImplementationRefV2(),catalog:{version,contentHash:catalog.contentHash,sourceReleaseContentHash:sourceRelease.contentHash},rankingPolicy:{version:TEST_RANKING_POLICY.version,contentHash:TEST_RANKING_POLICY.contentHash},recipes:ADAPTED_RECIPES.map(({id,version:recipeVersion,contentHash,applications,metricDeclarations})=>({id,version:recipeVersion,contentHash,applications,metricDeclarations}))};
  const manifest={...manifestPayload,contentHash:calculateElectricalDesignContextManifestV2ContentHash(manifestPayload)};
  return{testOnly:true,manifest,catalog,rankingPolicy:TEST_RANKING_POLICY,recipes:ADAPTED_RECIPES};
}
export function generateSyntheticMotorDesignV2ForTesting(request:BrushedDcMotorDesignRequestV2):DesignGenerationV2{return generateElectricalDesignV2ForTesting(request,createSyntheticMotorDesignContextV2ForTesting(request.libraryVersion));}
