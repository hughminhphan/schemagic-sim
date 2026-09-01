import { describe,expect,it } from "vitest";
import {
  DesignParseErrorV2, canonicalElectricalDesignRequestV2Payload, designRequestHashV2, designSha256Hex,
  migrateDesignRequestV1ToV2, parseElectricalDesignRequestV2,
} from "../src";
import type { BrushedDcMotorDesignRequest } from "../src";

const q=(value:number,unit:any,displayUnit=unit)=>({value,unit,displayUnit});
const request:BrushedDcMotorDesignRequest={format:"schemagic-design-request",schemaVersion:1,application:"motor.brushed-dc",requirements:{supplyVoltage:{minimum:q(9,"V"),nominal:q(12,"V"),maximum:q(16,"V")},motorNominalVoltage:q(12,"V"),continuousCurrent:q(1,"A"),stallCurrent:q(3,"A"),pwmFrequency:q(20_000,"Hz"),logicVoltage:q(3.3,"V"),ambientTemperature:q(300,"K"),operatingModes:["forward","reverse"],currentLimitTarget:null,operatingPoint:{dutyCycle:q(.5,"1"),loadCurrent:q(1,"A"),loadCurrentBasis:"continuous_rating",loadProfile:"steady_state"},motorModel:{windingResistance:q(4,"ohm"),windingResistanceSource:"estimated_from_nominal_voltage_and_stall_current",windingInductance:null,backEmfConstant:null,targetSpeed:null}},objective:"balanced",constraints:{allowedTopologyFamilies:["motor.hbridge.external-nmos","motor.hbridge.integrated"],maximumJunctionTemperature:q(400,"K"),allowedPackages:["QFN","TSSOP"],maximumComponentHeight:null,maximumBoardArea:null,allowEstimatedValues:true,allowUnknownWarnings:true,allowUnknownHardConstraints:true},assumptions:[{id:"a",description:"fixture",source:"fixture",affects:["z","a"]}],libraryVersion:"v1"};

describe("Designer V2 schema compatibility",()=>{
  it("uses standard browser-safe SHA-256",()=>expect(designSha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  it("migrates and canonicalizes declared sets while keeping display units out of identity",()=>{const migrated=migrateDesignRequestV1ToV2(request,"v2");if(migrated.status!=="migrated")throw new Error("migration failed");const parsed=parseElectricalDesignRequestV2({...migrated.request,constraints:{...migrated.request.constraints,allowedPackages:["TSSOP","QFN"]}});if(parsed.application!=="motor.brushed-dc")throw new Error("expected motor request");expect(parsed.constraints.allowedPackages).toEqual(["QFN","TSSOP"]);const display={...parsed,requirements:{...parsed.requirements,continuousCurrent:{...parsed.requirements.continuousCurrent,displayUnit:"mA"}}};expect(designRequestHashV2(display)).toBe(designRequestHashV2(parsed));expect(canonicalElectricalDesignRequestV2Payload(display)).not.toBe(canonicalElectricalDesignRequestV2Payload(parsed));});
  it("returns the shared objective-conflict branch before target validation and rejects duplicate sets",()=>{expect(migrateDesignRequestV1ToV2(request,"", "efficiency")).toEqual({status:"engineering_objective_conflict",sourceObjective:"balanced",suppliedObjective:"efficiency"});const migrated=migrateDesignRequestV1ToV2(request,"v2");if(migrated.status!=="migrated")throw new Error("migration failed");expect(()=>parseElectricalDesignRequestV2({...migrated.request,constraints:{...migrated.request.constraints,allowedPackages:["QFN","QFN"]}})).toThrow(DesignParseErrorV2);});
  it("reports set cardinality overflow as a parser resource limit",()=>{const migrated=migrateDesignRequestV1ToV2(request,"v2");if(migrated.status!=="migrated")throw new Error("migration failed");try{parseElectricalDesignRequestV2({...migrated.request,constraints:{...migrated.request.constraints,allowedPackages:Array.from({length:257},(_,index)=>`P${index}`)}});throw new Error("Expected resource failure");}catch(error){expect(error).toBeInstanceOf(DesignParseErrorV2);expect((error as DesignParseErrorV2).detail).toEqual({code:"resource_limit",stage:"parse",artifact:"electrical_request"});}});
  it("rejects hashable C0/C1, separator, and bidi controls in imported request display strings",()=>{
    const migrated=migrateDesignRequestV1ToV2(request,"v2");if(migrated.status!=="migrated"||migrated.request.application!=="motor.brushed-dc")throw new Error("migration failed");
    const controls=[...Array.from({length:32},(_,index)=>String.fromCharCode(index)),"\u007f",...Array.from({length:32},(_,index)=>String.fromCharCode(0x80+index)),"\u061c","\u200e","\u200f","\u2028","\u2029","\u202a","\u202b","\u202c","\u202d","\u202e","\u2066","\u2067","\u2068","\u2069"];
    for(const control of controls){
      const hostileVersion={...migrated.request,libraryVersion:`v2${control}hostile`};
      expect(designRequestHashV2(hostileVersion)).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(()=>parseElectricalDesignRequestV2(hostileVersion)).toThrow(DesignParseErrorV2);
      const hostileDisplay={...migrated.request,requirements:{...migrated.request.requirements,continuousCurrent:{...migrated.request.requirements.continuousCurrent,displayUnit:`A${control}hostile`}}};
      expect(designRequestHashV2(hostileDisplay)).toBe(designRequestHashV2(migrated.request));
      expect(()=>parseElectricalDesignRequestV2(hostileDisplay)).toThrow(DesignParseErrorV2);
    }
  });
});
