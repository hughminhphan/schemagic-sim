export type SIUnit =
  | "1"
  | "A"
  | "F"
  | "H"
  | "Hz"
  | "K"
  | "V"
  | "V_s_per_rad"
  | "W"
  | "count"
  | "m"
  | "m2"
  | "ohm"
  | "rad_per_s"
  | "s";

/** A physical value stored in its canonical SI unit. `displayUnit` is presentation-only. */
export interface Quantity<Unit extends SIUnit = SIUnit> {
  value: number;
  unit: Unit;
  displayUnit: string;
}

export type Voltage = Quantity<"V">;
export type Current = Quantity<"A">;
export type Frequency = Quantity<"Hz">;
export type Temperature = Quantity<"K">;
export type Resistance = Quantity<"ohm">;
export type Inductance = Quantity<"H">;
export type Capacitance = Quantity<"F">;
export type Power = Quantity<"W">;
export type Time = Quantity<"s">;
export type Ratio = Quantity<"1">;
export type Length = Quantity<"m">;
export type Area = Quantity<"m2">;
export type Count = Quantity<"count">;
export type AngularVelocity = Quantity<"rad_per_s">;
export type BackEmfConstant = Quantity<"V_s_per_rad">;

export interface QuantityRange<Unit extends SIUnit = SIUnit> {
  minimum: Quantity<Unit>;
  nominal: Quantity<Unit>;
  maximum: Quantity<Unit>;
}
