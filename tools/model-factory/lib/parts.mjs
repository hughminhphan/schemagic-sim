const quantity = (value, unit, conditions, pageReference, sourceKind = "typical") => ({
  value,
  unit,
  conditions,
  page_reference: pageReference,
  source_kind: sourceKind
});

const fitPoint = (current, voltage, citation, sourceKind = "digitized_typical_curve") => ({
  current: quantity(current, "A", "TA = 25 degC", citation, sourceKind),
  voltage: quantity(voltage, "V", `IF = ${current} A, TA = 25 degC`, citation, sourceKind)
});

export const PARTS = {
  "1N4148": {
    slug: "1N4148",
    manufacturerSlug: "vishay",
    identity: {
      canonical_mpn: "1N4148",
      manufacturer: "Vishay Intertechnology",
      description: "Small-signal fast switching silicon diode",
      electrical_family: "diode",
      aliases: ["1N4148-TAP", "1N4148TR", "1N914"],
      package: { name: "DO-35", standard: "DO-204AH" }
    },
    source: {
      url: "https://www.vishay.com/docs/81857/1n4148.pdf",
      revision: "Rev. 1.6, 07-Nov-2024",
      pages: ["p. 1", "p. 2", "p. 3"]
    },
    facts: {
      schema_version: "1.0.0",
      extraction_method: "pdftotext plus manual structuring and curve digitization",
      fit_conditions: {
        temperature: quantity(25, "degC", "Typical characteristics ambient unless stated", "p. 2 heading")
      },
      fit_points: [
        fitPoint(1e-5, 0.40, "p. 2 fig. 2, 25 degC curve"),
        fitPoint(1e-4, 0.49, "p. 2 fig. 2, 25 degC curve"),
        fitPoint(1e-3, 0.59, "p. 2 fig. 2, 25 degC curve"),
        fitPoint(1e-2, 0.70, "p. 2 fig. 2, 25 degC curve"),
        fitPoint(1e-1, 0.86, "p. 2 fig. 2, 25 degC curve")
      ],
      electrical_limits: {
        reverse_voltage: quantity(75, "V", "TA = 25 degC", "p. 1 absolute maximum ratings", "maximum"),
        repetitive_peak_reverse_voltage: quantity(100, "V", "TA = 25 degC", "p. 1 absolute maximum ratings", "maximum"),
        forward_continuous_current: quantity(0.3, "A", "TA = 25 degC", "p. 1 absolute maximum ratings", "maximum"),
        reverse_current_20v: quantity(25e-9, "A", "VR = 20 V, TA = 25 degC", "p. 2 electrical characteristics", "maximum")
      },
      derived_model_inputs: {
        CJO: quantity(4e-12, "F", "VR = 0 V, f = 1 MHz, VHF = 50 mV", "p. 2 electrical characteristics", "maximum"),
        TT: quantity(4e-9, "s", "IF = 10 mA, VR = 6 V, iR = 0.1 x IR, RL = 100 ohm", "p. 2 electrical characteristics", "maximum")
      }
    },
    component: {
      modelName: "OC_VISHAY_1N4148",
      domain_coverage: { dc: "fitted", ac: "fitted", transient: "approx", noise: "none", thermal: "none", digital: "none" },
      supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "Fitted at 25 degC from 10 uA to 100 mA forward current. Reverse operation is bounded to 75 V without avalanche modeling.",
      numeric_bounds: [
        { quantity: "forward_current", minimum: 1e-5, maximum: 0.1, unit: "A", conditions: "Fitted typical DC range at 25 degC", placeholder: false },
        { quantity: "reverse_voltage", minimum: 0, maximum: 75, unit: "V", conditions: "Rated reverse-voltage envelope; avalanche omitted", placeholder: false },
        { quantity: "ambient_temperature", minimum: 25, maximum: 25, unit: "degC", conditions: "Fit reference temperature", placeholder: false }
      ],
      omissions: [
        "Breakdown and avalanche behavior are not modeled.",
        "Temperature scaling was not fitted beyond the ngspice diode defaults.",
        "TT is a first-order charge-storage approximation from one reverse-recovery specification.",
        "CJO uses the datasheet maximum zero-bias capacitance, not a typical C-V curve.",
        "Package self-heating, noise, process spread, and ageing are omitted."
      ]
    }
  },
  "WP7113ID": {
    slug: "WP7113ID",
    manufacturerSlug: "kingbright",
    identity: {
      canonical_mpn: "WP7113ID",
      manufacturer: "Kingbright",
      description: "5 mm high-efficiency red through-hole LED",
      electrical_family: "led",
      aliases: [],
      package: { name: "T-1 3/4 5 mm", standard: "Kingbright through-hole lamp" }
    },
    source: {
      url: "https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf",
      revision: "Spec DSAF0012 / 1101005042 Rev V.14A, 01/08/2026",
      pages: ["p. 1", "p. 2", "p. 3"]
    },
    facts: {
      schema_version: "1.0.0",
      extraction_method: "pdftotext plus manual structuring and curve digitization",
      fit_conditions: {
        temperature: quantity(25, "degC", "Electrical and optical characteristics", "p. 2 heading")
      },
      fit_points: [
        fitPoint(0.002, 1.68, "p. 3 forward current vs. forward voltage curve"),
        fitPoint(0.004, 1.75, "p. 3 forward current vs. forward voltage curve"),
        fitPoint(0.008, 1.84, "p. 3 forward current vs. forward voltage curve"),
        fitPoint(0.010, 1.90, "p. 2 electrical characteristics", "typical_table"),
        fitPoint(0.012, 1.92, "p. 3 forward current vs. forward voltage curve"),
        fitPoint(0.016, 1.97, "p. 3 forward current vs. forward voltage curve"),
        fitPoint(0.020, 2.00, "p. 3 forward current vs. forward voltage curve")
      ],
      electrical_limits: {
        forward_voltage_10ma_typical: quantity(1.9, "V", "IF = 10 mA, TA = 25 degC", "p. 2 electrical characteristics", "typical"),
        forward_voltage_10ma_maximum: quantity(2.3, "V", "IF = 10 mA, TA = 25 degC", "p. 2 electrical characteristics", "maximum"),
        reverse_current_5v: quantity(10e-6, "A", "VR = 5 V, TA = 25 degC", "p. 2 electrical characteristics", "maximum"),
        reverse_voltage: quantity(5, "V", "TA = 25 degC", "p. 2 absolute maximum ratings", "maximum"),
        forward_current: quantity(0.03, "A", "TA = 25 degC", "p. 2 absolute maximum ratings", "maximum")
      },
      optical_metadata: {
        peak_wavelength: quantity(627, "nm", "IF = 10 mA, TA = 25 degC", "p. 2 electrical and optical characteristics", "typical"),
        dominant_wavelength: quantity(617, "nm", "IF = 10 mA, TA = 25 degC", "p. 2 electrical and optical characteristics", "typical"),
        luminous_intensity: quantity(50, "mcd", "IF = 10 mA", "p. 1 selection guide", "typical")
      },
      derived_model_inputs: {}
    },
    component: {
      modelName: "OC_KINGBRIGHT_WP7113ID",
      domain_coverage: { dc: "fitted", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" },
      supported_analyses: ["operating_point", "dc_sweep"],
      operating_summary: "Fitted typical DC forward behavior at 25 degC from 2 mA to 20 mA. Reverse voltage is limited to 5 V.",
      numeric_bounds: [
        { quantity: "forward_current", minimum: 0.002, maximum: 0.02, unit: "A", conditions: "Fitted typical DC range at 25 degC", placeholder: false },
        { quantity: "reverse_voltage", minimum: 0, maximum: 5, unit: "V", conditions: "Absolute maximum; breakdown behavior omitted", placeholder: false },
        { quantity: "ambient_temperature", minimum: 25, maximum: 25, unit: "degC", conditions: "Fit reference temperature", placeholder: false }
      ],
      omissions: [
        "Optical output is not a SPICE output; the UI maps brightness from simulated forward current.",
        "Wavelength, luminous intensity, viewing angle, bin spread, and optical ageing are metadata only.",
        "Junction capacitance and switching behavior are omitted because the datasheet does not specify them.",
        "Reverse breakdown is not modeled from the 5 V absolute maximum rating.",
        "Temperature scaling, self-heating, process spread, and degradation are omitted."
      ]
    }
  }
};

export function getPart(mpn) {
  const key = Object.keys(PARTS).find((candidate) => candidate.toLowerCase() === String(mpn).toLowerCase());
  if (!key) throw new Error(`Unsupported MPN: ${mpn}. Supported: ${Object.keys(PARTS).join(", ")}`);
  return PARTS[key];
}
