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
  },
  "2N3904": {
    slug: "2N3904",
    manufacturerSlug: "onsemi",
    pipeline: "bjt",
    identity: {
      canonical_mpn: "2N3904",
      manufacturer: "onsemi",
      description: "General-purpose NPN silicon transistor",
      electrical_family: "bjt_npn",
      aliases: [],
      package: { name: "TO-92", standard: "CASE 29 STYLE 1" },
      pins: [
        { name: "E", number: "1", role: "emitter", node: "emitter" },
        { name: "B", number: "2", role: "base", node: "base" },
        { name: "C", number: "3", role: "collector", node: "collector" }
      ],
      spice_order: ["3", "2", "1"]
    },
    source: {
      url: "https://www.onsemi.com/pdf/datasheet/2n3903-d.pdf",
      revision: "Rev. 9, August 2021",
      pages: ["p. 1", "p. 2", "p. 4", "p. 5", "p. 7"]
    },
    facts: {
      schema_version: "1.0.0",
      extraction_method: "pdftotext plus manual structuring and curve digitization",
      fit_conditions: { temperature: quantity(25, "degC", "Electrical characteristics unless stated", "p. 2 heading") },
      gain_points: [
        { collector_current: quantity(1e-4, "A", "VCE = 1 V, TA = 25 degC", "p. 7 fig. 15, 25 degC curve"), vce: quantity(1, "V", "IC = 0.1 mA, TA = 25 degC", "p. 7 fig. 15"), hfe: quantity(90, "1", "IC = 0.1 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 15, digitized", "digitized_typical_curve") },
        { collector_current: quantity(1e-3, "A", "VCE = 1 V, TA = 25 degC", "p. 7 fig. 15"), vce: quantity(1, "V", "IC = 1 mA, TA = 25 degC", "p. 7 fig. 15"), hfe: quantity(140, "1", "IC = 1 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 15, digitized", "digitized_typical_curve"), vbe: quantity(0.66, "V", "IC = 1 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve") },
        { collector_current: quantity(1e-2, "A", "VCE = 1 V, TA = 25 degC", "p. 7 fig. 15"), vce: quantity(1, "V", "IC = 10 mA, TA = 25 degC", "p. 7 fig. 15"), hfe: quantity(200, "1", "IC = 10 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 15, digitized", "digitized_typical_curve"), vbe: quantity(0.70, "V", "IC = 10 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve") },
        { collector_current: quantity(5e-2, "A", "VCE = 1 V, TA = 25 degC", "p. 7 fig. 15"), vce: quantity(1, "V", "IC = 50 mA, TA = 25 degC", "p. 7 fig. 15"), hfe: quantity(110, "1", "IC = 50 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 15, digitized", "digitized_typical_curve"), vbe: quantity(0.76, "V", "IC = 50 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve") },
        { collector_current: quantity(0.1, "A", "VCE = 1 V, TA = 25 degC", "p. 7 fig. 15"), vce: quantity(1, "V", "IC = 100 mA, TA = 25 degC", "p. 7 fig. 15"), hfe: quantity(54, "1", "IC = 100 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 15, digitized", "digitized_typical_curve"), vbe: quantity(0.82, "V", "IC = 100 mA, VCE = 1 V, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve") }
      ],
      saturation_points: [
        { collector_current: quantity(0.01, "A", "IB = 1 mA, TA = 25 degC", "p. 7 fig. 17"), base_current: quantity(0.001, "A", "IC = 10 mA, TA = 25 degC", "p. 7 fig. 17"), vce_sat: quantity(0.09, "V", "IC = 10 mA, IB = 1 mA, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve"), vbe_sat: quantity(0.76, "V", "IC = 10 mA, IB = 1 mA, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve") },
        { collector_current: quantity(0.05, "A", "IB = 5 mA, TA = 25 degC", "p. 7 fig. 17"), base_current: quantity(0.005, "A", "IC = 50 mA, TA = 25 degC", "p. 7 fig. 17"), vce_sat: quantity(0.20, "V", "IC = 50 mA, IB = 5 mA, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve"), vbe_sat: quantity(0.85, "V", "IC = 50 mA, IB = 5 mA, TA = 25 degC", "p. 7 fig. 17, digitized", "digitized_typical_curve") }
      ],
      capacitances: {
        cobo: quantity(4e-12, "F", "VCB = 5 V, IE = 0, f = 1 MHz", "p. 2 electrical characteristics", "maximum"),
        cobo_vcb: quantity(5, "V", "Cobo test bias", "p. 2 electrical characteristics"),
        cibo: quantity(8e-12, "F", "VEB = 0.5 V, IC = 0, f = 1 MHz", "p. 2 electrical characteristics", "maximum"),
        cibo_veb: quantity(0.5, "V", "Cibo test bias", "p. 2 electrical characteristics")
      },
      frequency_response: {
        ft: quantity(300e6, "Hz", "IC = 10 mA, VCE = 20 V, f = 100 MHz", "p. 2 electrical characteristics", "minimum"),
        ic: quantity(0.01, "A", "fT test collector current", "p. 2 electrical characteristics"),
        vce: quantity(20, "V", "fT test collector-emitter voltage", "p. 2 electrical characteristics"),
        storage_time: quantity(200e-9, "s", "IC = 10 mA, IB1 = IB2 = 1 mA", "p. 2 switching characteristics", "maximum")
      },
      electrical_limits: {
        vceo: quantity(40, "V", "IC = 1 mA, IB = 0", "p. 2 electrical characteristics", "minimum"),
        vcbo: quantity(60, "V", "IC = 10 uA, IE = 0", "p. 2 electrical characteristics", "minimum"),
        vebo: quantity(6, "V", "IE = 10 uA, IC = 0", "p. 2 electrical characteristics", "minimum"),
        collector_current: quantity(0.2, "A", "Continuous", "p. 1 maximum ratings", "maximum")
      }
    },
    component: {
      modelName: "OC_ONSEMI_2N3904",
      domain_coverage: { dc: "fitted", ac: "fitted", transient: "fitted", noise: "none", thermal: "none", digital: "none" },
      supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "Fitted at 25 degC from 0.1 mA to 100 mA collector current. Absolute maximum ratings remain metadata only.",
      numeric_bounds: [
        { quantity: "collector_current", minimum: 0.0001, maximum: 0.1, unit: "A", conditions: "Fitted DC range at 25 degC", placeholder: false },
        { quantity: "collector_emitter_voltage", minimum: 0, maximum: 40, unit: "V", conditions: "Rated VCEO", placeholder: false }
      ],
      omissions: [
        "VAF held at a family-typical default: no usable output characteristics family was available, so the Early effect is not fitted.",
        "CJE and CJC are derived from single tabulated points with VJ and MJ held at physical defaults.",
        "Reverse operation, base-resistance modulation, transit-time bias dependence, self-heating, package parasitics, and noise are not fitted.",
        "Absolute maximum ratings are metadata only and are not enforced by the model.",
        "hFE production spread and temperature coefficients are not modelled."
      ]
    }
  },
  "IRLZ44N": {
    slug: "IRLZ44N",
    manufacturerSlug: "infineon",
    pipeline: "vdmos",
    identity: {
      canonical_mpn: "IRLZ44N",
      manufacturer: "Infineon Technologies",
      description: "55 V logic-level N-channel power MOSFET",
      electrical_family: "nmos",
      aliases: ["IRLZ44NPbF"],
      package: { name: "TO-220AB", standard: "JEDEC TO-220AB" },
      pins: [
        { name: "G", number: "1", role: "gate", node: "gate" },
        { name: "D", number: "2", role: "drain", node: "drain" },
        { name: "S", number: "3", role: "source", node: "source" }
      ],
      spice_order: ["2", "1", "3"]
    },
    source: {
      url: "https://www.infineon.com/assets/row/public/documents/24/49/infineon-irlz44n-datasheet-en.pdf",
      revision: "PD-94831, 11-Nov-2003; public asset modified 29-Apr-2021",
      pages: ["p. 1", "p. 2", "p. 3", "p. 4"]
    },
    facts: {
      schema_version: "1.0.0",
      extraction_method: "pdftotext plus manual structuring and curve digitization",
      fit_conditions: { temperature: quantity(25, "degC", "Electrical characteristics unless stated", "p. 2 heading") },
      threshold: {
        minimum: quantity(1.0, "V", "VDS = VGS, ID = 250 uA", "p. 2 electrical characteristics", "minimum"),
        maximum: quantity(2.0, "V", "VDS = VGS, ID = 250 uA", "p. 2 electrical characteristics", "maximum")
      },
      transfer_points: [
        { vgs: quantity(2.5, "V", "VDS = 25 V, TJ = 25 degC", "p. 3 fig. 3"), current: quantity(5, "A", "VGS = 2.5 V, VDS = 25 V", "p. 3 fig. 3, digitized", "digitized_typical_curve") },
        { vgs: quantity(3.0, "V", "VDS = 25 V, TJ = 25 degC", "p. 3 fig. 3"), current: quantity(20, "A", "VGS = 3.0 V, VDS = 25 V", "p. 3 fig. 3, digitized", "digitized_typical_curve") },
        { vgs: quantity(3.5, "V", "VDS = 25 V, TJ = 25 degC", "p. 3 fig. 3"), current: quantity(40, "A", "VGS = 3.5 V, VDS = 25 V", "p. 3 fig. 3, digitized", "digitized_typical_curve") },
        { vgs: quantity(4.0, "V", "VDS = 25 V, TJ = 25 degC", "p. 3 fig. 3"), current: quantity(60, "A", "VGS = 4.0 V, VDS = 25 V", "p. 3 fig. 3, digitized", "digitized_typical_curve") },
        { vgs: quantity(5.0, "V", "VDS = 25 V, TJ = 25 degC", "p. 3 fig. 3"), current: quantity(95, "A", "VGS = 5.0 V, VDS = 25 V", "p. 3 fig. 3, digitized", "digitized_typical_curve") },
        { vgs: quantity(6.0, "V", "VDS = 25 V, TJ = 25 degC", "p. 3 fig. 3"), current: quantity(125, "A", "VGS = 6.0 V, VDS = 25 V", "p. 3 fig. 3, digitized", "digitized_typical_curve") }
      ],
      rdson_points: [
        { vgs: quantity(10, "V", "ID = 25 A", "p. 2 electrical characteristics"), current: quantity(25, "A", "VGS = 10 V", "p. 2 electrical characteristics"), resistance: quantity(0.022, "ohm", "VGS = 10 V, ID = 25 A", "p. 2 electrical characteristics", "maximum") },
        { vgs: quantity(5, "V", "ID = 25 A", "p. 2 electrical characteristics"), current: quantity(25, "A", "VGS = 5 V", "p. 2 electrical characteristics"), resistance: quantity(0.025, "ohm", "VGS = 5 V, ID = 25 A", "p. 2 electrical characteristics", "maximum") },
        { vgs: quantity(4, "V", "ID = 21 A", "p. 2 electrical characteristics"), current: quantity(21, "A", "VGS = 4 V", "p. 2 electrical characteristics"), resistance: quantity(0.035, "ohm", "VGS = 4 V, ID = 21 A", "p. 2 electrical characteristics", "maximum") }
      ],
      output_points: [
        { vgs: quantity(2.5, "V", "TJ = 25 degC", "p. 3 fig. 1"), vds: quantity(10, "V", "VGS = 2.5 V", "p. 3 fig. 1"), current: quantity(5, "A", "VGS = 2.5 V, VDS = 10 V", "p. 3 fig. 1, digitized", "digitized_typical_curve") },
        { vgs: quantity(3.0, "V", "TJ = 25 degC", "p. 3 fig. 1"), vds: quantity(10, "V", "VGS = 3 V", "p. 3 fig. 1"), current: quantity(20, "A", "VGS = 3 V, VDS = 10 V", "p. 3 fig. 1, digitized", "digitized_typical_curve") },
        { vgs: quantity(4.0, "V", "TJ = 25 degC", "p. 3 fig. 1"), vds: quantity(10, "V", "VGS = 4 V", "p. 3 fig. 1"), current: quantity(60, "A", "VGS = 4 V, VDS = 10 V", "p. 3 fig. 1, digitized", "digitized_typical_curve") }
      ],
      capacitances: {
        ciss: quantity(1700e-12, "F", "VDS = 25 V, VGS = 0, f = 1 MHz", "p. 2 electrical characteristics", "typical"),
        coss: quantity(400e-12, "F", "VDS = 25 V, VGS = 0, f = 1 MHz", "p. 2 electrical characteristics", "typical"),
        crss: quantity(150e-12, "F", "VDS = 25 V, VGS = 0, f = 1 MHz", "p. 2 electrical characteristics", "typical"),
        vds_test: quantity(25, "V", "Capacitance test bias", "p. 2 electrical characteristics"),
        crss_curve: [
          { vds: quantity(1, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5"), crss: quantity(700e-12, "F", "VDS = 1 V", "p. 4 fig. 5, digitized", "digitized_typical_curve") },
          { vds: quantity(2, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5"), crss: quantity(450e-12, "F", "VDS = 2 V", "p. 4 fig. 5, digitized", "digitized_typical_curve") },
          { vds: quantity(5, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5"), crss: quantity(300e-12, "F", "VDS = 5 V", "p. 4 fig. 5, digitized", "digitized_typical_curve") },
          { vds: quantity(10, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5"), crss: quantity(220e-12, "F", "VDS = 10 V", "p. 4 fig. 5, digitized", "digitized_typical_curve") },
          { vds: quantity(20, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5"), crss: quantity(160e-12, "F", "VDS = 20 V", "p. 4 fig. 5, digitized", "digitized_typical_curve") },
          { vds: quantity(50, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5"), crss: quantity(100e-12, "F", "VDS = 50 V", "p. 4 fig. 5, digitized", "digitized_typical_curve") }
        ]
      },
      gate_charge: { qg: quantity(48e-9, "C", "ID = 25 A, VDS = 44 V, tabulated total gate charge", "p. 2 electrical characteristics", "maximum"), qg_at_5v: quantity(28e-9, "C", "ID = 25 A, VDS = 44 V, VGS = 5 V", "p. 4 fig. 6, digitized", "digitized_typical_curve"), qgs: quantity(8.6e-9, "C", "same gate-charge test", "p. 2 electrical characteristics", "maximum"), qgd: quantity(25e-9, "C", "same gate-charge test", "p. 2 electrical characteristics", "maximum") },
      body_diode: { vsd: quantity(1.3, "V", "IS = 25 A, VGS = 0", "p. 2 source-drain characteristics", "maximum"), current: quantity(25, "A", "VSD test", "p. 2 source-drain characteristics"), trr: quantity(80e-9, "s", "IF = 25 A, di/dt = 100 A/us", "p. 2 source-drain characteristics", "typical") },
      breakdown: { voltage: quantity(55, "V", "VGS = 0, ID = 250 uA", "p. 2 electrical characteristics", "minimum"), current: quantity(250e-6, "A", "VBR definition", "p. 2 electrical characteristics") },
      thermal: { rthjc: quantity(1.4, "K/W", "Junction to case", "p. 1 thermal resistance", "maximum"), rthja: quantity(62, "K/W", "Junction to ambient", "p. 1 thermal resistance", "maximum") }
    },
    component: {
      modelName: "OC_INFINEON_IRLZ44N",
      domain_coverage: { dc: "fitted", ac: "fitted", transient: "fitted", noise: "none", thermal: "approx", digital: "none" },
      supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "Fitted at 25 degC across logic-level transfer, output, RDS(on), and capacitance data. Default use is the three-terminal non-self-heating instance.",
      numeric_bounds: [
        { quantity: "drain_source_voltage", minimum: 0, maximum: 55, unit: "V", conditions: "Rated VDSS", placeholder: false },
        { quantity: "gate_source_voltage", minimum: -16, maximum: 16, unit: "V", conditions: "Absolute maximum", placeholder: false }
      ],
      omissions: [
        "Avalanche, UIS, safe operating area, and device failure are not modelled.",
        "No self-heating in the default three-terminal instance. Thermal resistances are transcribed but not validated.",
        "Package and lead inductance, gate oxide breakdown, threshold spread, and flicker noise are not modelled.",
        "RG is set to 1e-4 ohm because the datasheet does not publish gate resistance.",
        "Temperature coefficients are at defaults; only 25 degC data was fitted.",
        "The tabulated 48 nC total gate charge is inconsistent with the typical gate-charge curve at VGS = 5 V; the independent check uses the cited 28 nC curve read."
      ]
    }
  },
  "TL072": {
    slug: "TL072",
    manufacturerSlug: "ti",
    pipeline: "opamp",
    identity: {
      canonical_mpn: "TL072",
      manufacturer: "Texas Instruments",
      description: "Dual low-noise JFET-input operational amplifier",
      electrical_family: "opamp",
      aliases: ["TL072C", "TL072CP", "TL072CD"],
      package: { name: "PDIP-8", standard: "TI P package" },
      pins: [
        { name: "IN+", number: "3", role: "noninverting_input", node: "inp" },
        { name: "IN-", number: "2", role: "inverting_input", node: "inn" },
        { name: "VCC", number: "8", role: "positive_supply", node: "vcc" },
        { name: "VEE", number: "4", role: "negative_supply", node: "vee" },
        { name: "OUT", number: "1", role: "output", node: "out" }
      ],
      spice_order: ["3", "2", "8", "4", "1"]
    },
    source: {
      url: "https://www.ti.com/lit/ds/symlink/tl072.pdf",
      revision: "SLOS080W, September 1978, revised July 2025",
      pages: ["p. 11", "p. 15", "p. 16", "p. 21", "p. 23"]
    },
    facts: {
      schema_version: "1.0.0",
      extraction_method: "pdftotext plus manual structuring",
      fit_conditions: { temperature: quantity(25, "degC", "VS = +/-15 V unless stated", "p. 15 section 5.8 heading") },
      parameters: {
        aol: quantity(200000, "V/V", "VO = 0, VS = +/-15 V", "p. 15 electrical characteristics", "typical"),
        gbw: quantity(5.25e6, "Hz", "All packages except NS, PS, and TL07xM", "p. 15 electrical characteristics", "typical"),
        sr: quantity(20e6, "V/s", "VI = 10 V, CL = 100 pF, RL = 2 kohm", "p. 16 electrical characteristics", "typical"),
        vos: quantity(3e-3, "V", "VO = 0, RS = 50 ohm", "p. 15 electrical characteristics", "typical"),
        vos_max: quantity(10e-3, "V", "TL07xC, TA = 25 degC", "p. 15 electrical characteristics", "maximum"),
        ibias: quantity(65e-12, "A", "VO = 0, TA = 25 degC", "p. 15 electrical characteristics", "typical"),
        ios: quantity(5e-12, "A", "VO = 0, TA = 25 degC", "p. 15 electrical characteristics", "typical"),
        output_swing: {
          column_semantics: {
            minimum: { column: "MIN", published: true, applies_to: "minimum_25c" },
            typical: { column: "TYP", published: true, applies_to: "typical_25c" },
            maximum: { column: "MAX", published: false, conditions: "No maximum output-swing value is published", page_reference: "p. 15 electrical characteristics", source_kind: "not_published" }
          },
          minimum_25c: quantity(12, "V", "RL = 10 kohm, VS = +/-15 V, TA = 25 degC", "p. 15 electrical characteristics, MIN column", "minimum"),
          typical_25c: quantity(13.5, "V", "RL = 10 kohm, VS = +/-15 V, TA = 25 degC", "p. 15 electrical characteristics, TYP column", "typical"),
          minimum_full_temperature_rl10k: quantity(12, "V", "RL >= 10 kohm, VS = +/-15 V, TA = full range", "p. 15 electrical characteristics, MIN column", "minimum"),
          minimum_full_temperature_rl2k: quantity(10, "V", "RL >= 2 kohm, VS = +/-15 V, TA = full range", "p. 15 electrical characteristics, MIN column", "minimum")
        },
        ilim: quantity(40e-3, "A", "Short-circuit current at 25 degC, digitized classic-device curve", "p. 23 fig. 5-34", "digitized_typical_curve"),
        cmrr_db: quantity(100, "dB", "VIC = VICR(min), VO = 0", "p. 15 electrical characteristics", "typical"),
        psrr_db: quantity(100, "dB", "VS = +/-9 V to +/-18 V, VO = 0", "p. 15 electrical characteristics", "typical"),
        iq: quantity(1.4e-3, "A", "Per amplifier, VO = 0, no load", "p. 15 electrical characteristics", "typical"),
        en: quantity(37e-9, "V/sqrt(Hz)", "f = 1 kHz, all other devices", "p. 16 electrical characteristics", "typical"),
        phase_margin: quantity(56, "deg", "G = +1, RL = 10 kohm, CL = 20 pF", "p. 16 electrical characteristics", "typical"),
        rout: quantity(125, "ohm", "f = 1 MHz, IO = 0", "p. 16 electrical characteristics", "typical"),
        supply_positive: quantity(15, "V", "Electrical characteristics test supply", "p. 15 section 5.8 heading"),
        supply_negative: quantity(-15, "V", "Electrical characteristics test supply", "p. 15 section 5.8 heading"),
        supply_voltage_total: {
          minimum: quantity(4.5, "V", "All packages except NS and PS and all devices except TL07xM", "p. 11 recommended operating conditions, MIN column", "minimum"),
          maximum: quantity(40, "V", "All packages except NS and PS and all devices except TL07xM", "p. 11 recommended operating conditions, MAX column", "maximum")
        }
      }
    },
    component: {
      modelName: "OC_TI_TL072",
      domain_coverage: { dc: "fitted", ac: "fitted", transient: "fitted", noise: "fitted", thermal: "none", digital: "none" },
      supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient", "noise"],
      operating_summary: "Fitted for the classic TL07xC electrical table at +/-15 V and 25 degC. The package contains two identical amplifier channels.",
      numeric_bounds: [
        { quantity: "supply_voltage_total", minimum: 4.5, maximum: 40, unit: "V", conditions: "Recommended supply envelope", placeholder: false },
        { quantity: "input_offset_voltage", minimum: -0.01, maximum: 0.01, unit: "V", conditions: "Published production maximum magnitude", placeholder: false },
        { quantity: "common_mode_input", minimum: -11, maximum: 11, unit: "V", conditions: "Typical at +/-15 V", placeholder: false }
      ],
      omissions: [
        "Output distortion, crossover distortion, input common-mode failure, input protection, and overload recovery are not fitted.",
        "PSRR and CMRR are frequency-independent constants.",
        "The frequency response is a two-pole approximation above the unity-gain frequency. FP2 is derived from the 56 degree typical phase margin but closed-loop overshoot is not independently fitted.",
        "Only broadband input voltage noise is modelled; flicker and current noise are omitted.",
        "No self-heating or temperature coefficients are modelled.",
        "Input offset uses the datasheet typical and does not represent production spread.",
        "Output rail drop is fitted to the 25 degC typical swing at RL = 10 kohm. The datasheet publishes only minimum swing, not a typical value, at RL >= 2 kohm.",
        "CC = 30 pF, CDIF = 1 pF, RE = 1 Mohm, CP2 = 1 pF, RQ = 1 Mohm, and the 300.15 K noise normalization are held at default internal archetype values."
      ]
    }
  },
  "2N5551": {
  "slug": "2N5551",
  "manufacturerSlug": "onsemi",
  "pipeline": "bjt",
  "identity": {
    "canonical_mpn": "2N5551",
    "manufacturer": "onsemi",
    "description": "High-voltage NPN epitaxial silicon transistor",
    "electrical_family": "bjt_npn",
    "aliases": [],
    "package": {
      "name": "TO-92",
      "standard": "TO-92"
    },
    "pins": [
      {
        "name": "E",
        "number": "1",
        "role": "emitter",
        "node": "emitter"
      },
      {
        "name": "B",
        "number": "2",
        "role": "base",
        "node": "base"
      },
      {
        "name": "C",
        "number": "3",
        "role": "collector",
        "node": "collector"
      }
    ],
    "spice_order": [
      "3",
      "2",
      "1"
    ]
  },
  "source": {
    "url": "https://www.onsemi.com/products/discrete-power-modules/bipolar-transistors/2N5551",
    "revision": "Manufacturer HTML specification page; accessed 2026-08-07",
    "pages": [
      "spec page"
    ]
  },
  "facts": {
    "schema_version": "1.0.0",
    "extraction_method": "official manufacturer HTML specification table; PDF unreachable",
    "fit_conditions": {
      "temperature": {
        "value": 25,
        "unit": "degC",
        "conditions": "Electrical characteristics unless otherwise noted",
        "page_reference": "spec page",
        "source_kind": "typical"
      }
    },
    "gain_points": [
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "VCE = 5 V, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "minimum"
        },
        "vce": {
          "value": 5,
          "unit": "V",
          "conditions": "IC = 10 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 80,
          "unit": "1",
          "conditions": "IC = 10 mA, VCE = 5 V, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.05,
          "unit": "A",
          "conditions": "VCE = 5 V, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "minimum"
        },
        "vce": {
          "value": 5,
          "unit": "V",
          "conditions": "IC = 50 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 30,
          "unit": "1",
          "conditions": "IC = 50 mA, VCE = 5 V, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "minimum"
        }
      }
    ],
    "saturation_points": [
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "IB = 1 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.001,
          "unit": "A",
          "conditions": "IC = 10 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.15,
          "unit": "V",
          "conditions": "IC = 10 mA, IB = 1 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "maximum"
        },
        "vbe_sat": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = 10 mA, IB = 1 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "maximum"
        }
      },
      {
        "collector_current": {
          "value": 0.05,
          "unit": "A",
          "conditions": "IB = 5 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "held_duplicate"
        },
        "base_current": {
          "value": 0.005,
          "unit": "A",
          "conditions": "IC = 50 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "held_duplicate"
        },
        "vce_sat": {
          "value": 0.25,
          "unit": "V",
          "conditions": "IC = 50 mA, IB = 5 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "maximum"
        },
        "vbe_sat": {
          "value": 1.2,
          "unit": "V",
          "conditions": "IC = 50 mA, IB = 5 mA, TA = 25 degC",
          "page_reference": "spec page",
          "source_kind": "maximum"
        }
      }
    ],
    "capacitances": {
      "cobo": {
        "value": 6e-12,
        "unit": "F",
        "conditions": "VCB = 10 V, IE = 0, f = 1 MHz",
        "page_reference": "spec page",
        "source_kind": "maximum"
      },
      "cobo_vcb": {
        "value": 10,
        "unit": "V",
        "conditions": "Cobo test bias",
        "page_reference": "spec page",
        "source_kind": "typical"
      },
      "cibo": {
        "value": 1e-15,
        "unit": "F",
        "conditions": "Not published; held at numerical floor",
        "page_reference": "spec page",
        "source_kind": "not_published"
      },
      "cibo_veb": {
        "value": 0.5,
        "unit": "V",
        "conditions": "Held because Cibo is not published",
        "page_reference": "spec page",
        "source_kind": "held_default"
      }
    },
    "frequency_response": {
      "ft": {
        "value": 100000000,
        "unit": "Hz",
        "conditions": "IC = 10 mA, VCE = 10 V, f = 100 MHz",
        "page_reference": "spec page",
        "source_kind": "minimum"
      },
      "ic": {
        "value": 0.01,
        "unit": "A",
        "conditions": "fT test collector current",
        "page_reference": "spec page",
        "source_kind": "typical"
      },
      "vce": {
        "value": 10,
        "unit": "V",
        "conditions": "fT test collector-emitter voltage",
        "page_reference": "spec page",
        "source_kind": "typical"
      }
    },
    "electrical_limits": {
      "vceo": {
        "value": 160,
        "unit": "V",
        "conditions": "IC = 1 mA, IB = 0",
        "page_reference": "spec page",
        "source_kind": "minimum"
      },
      "vcbo": {
        "value": 180,
        "unit": "V",
        "conditions": "IC = 100 uA, IE = 0",
        "page_reference": "spec page",
        "source_kind": "minimum"
      },
      "vebo": {
        "value": 6,
        "unit": "V",
        "conditions": "IE = 10 uA, IC = 0",
        "page_reference": "spec page",
        "source_kind": "minimum"
      },
      "collector_current": {
        "value": 0.6,
        "unit": "A",
        "conditions": "Continuous",
        "page_reference": "spec page",
        "source_kind": "maximum"
      }
    },
    "source": {
      "kind": "spec_page",
      "url": "https://www.onsemi.com/products/discrete-power-modules/bipolar-transistors/2N5551",
      "revision": "Manufacturer HTML specification page; accessed 2026-08-07",
      "sha256": "e0fe0839debfc936a993def8b18c0a728dea449026aaae0cdba33f40ef22a377",
      "accessed_date": "2026-08-07",
      "pages_referenced": [
        "spec page"
      ],
      "placeholder": false,
      "note": "Official manufacturer PDF was unreachable; manufacturer HTML specification page used, capped at F1."
    }
  },
  "component": {
    "modelName": "OC_ONSEMI_2N5551",
    "fidelity_tier": "F1",
    "domain_coverage": {
      "dc": "fitted",
      "ac": "approx",
      "transient": "approx",
      "noise": "none",
      "thermal": "none",
      "digital": "none"
    },
    "supported_analyses": [
      "operating_point",
      "dc_sweep",
      "ac_small_signal",
      "transient"
    ],
    "operating_summary": "F1 table-constrained model at 25 degC from official manufacturer HTML specifications; PDF was unreachable.",
    "numeric_bounds": [
      {
        "quantity": "collector_current",
        "minimum": 0.01,
        "maximum": 0.05,
        "unit": "A",
        "conditions": "Datasheet table range at 25 degC",
        "placeholder": false
      },
      {
        "quantity": "collector_emitter_voltage",
        "minimum": 0,
        "maximum": 160,
        "unit": "V",
        "conditions": "Rated VCEO",
        "placeholder": false
      }
    ],
    "omissions": [
      "Official manufacturer PDF was unreachable; facts are limited to the manufacturer HTML specification table and fidelity is capped at F1.",
      "No self-heating, breakdown, package parasitics, reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, or hFE spread are modelled.",
      "Guaranteed MIN/MAX rows are retained as source semantics; they are not typical targets.",
      "Only one independent saturation characterization is available; high-current saturation is an anchored table point rather than a fitted curve.",
      "CJE is held at the numerical floor because Cibo is not published.",
      "Reviewer remains pending-review",
      "Source sha256 is a locator sentinel because the official HTML page was unreachable and no content was acquired; do not treat it as a downloaded datasheet hash."
    ]
  }
},
  "MPSA42": {
  "slug": "MPSA42",
  "manufacturerSlug": "onsemi",
  "pipeline": "bjt",
  "identity": {
    "canonical_mpn": "MPSA42",
    "manufacturer": "onsemi",
    "description": "300 V high-voltage NPN transistor",
    "electrical_family": "bjt_npn",
    "aliases": [],
    "package": {
      "name": "TO-92",
      "standard": "TO-92"
    },
    "pins": [
      {
        "name": "E",
        "number": "1",
        "role": "emitter",
        "node": "emitter"
      },
      {
        "name": "B",
        "number": "2",
        "role": "base",
        "node": "base"
      },
      {
        "name": "C",
        "number": "3",
        "role": "collector",
        "node": "collector"
      }
    ],
    "spice_order": [
      "3",
      "2",
      "1"
    ]
  },
  "source": {
    "url": "https://www.onsemi.com/pdf/datasheet/mpsa42-d.pdf",
    "revision": "February 2013 Rev. 8",
    "pages": [
      "p. 1",
      "p. 2",
      "p. 3"
    ]
  },
  "facts": {
    "schema_version": "1.0.0",
    "extraction_method": "pdftotext plus manual structuring; table values retain MIN/TYP/MAX source semantics",
    "fit_conditions": {
      "temperature": {
        "value": 25,
        "unit": "degC",
        "conditions": "Electrical characteristics unless otherwise noted",
        "page_reference": "p. 1",
        "source_kind": "typical"
      }
    },
    "gain_points": [
      {
        "collector_current": {
          "value": 0.001,
          "unit": "A",
          "conditions": "VCE = 10 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        },
        "vce": {
          "value": 10,
          "unit": "V",
          "conditions": "IC = 0.001 A, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 25,
          "unit": "1",
          "conditions": "IC = 0.001 A, VCE = 10 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "VCE = 10 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        },
        "vce": {
          "value": 10,
          "unit": "V",
          "conditions": "IC = 0.01 A, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 40,
          "unit": "1",
          "conditions": "IC = 0.01 A, VCE = 10 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.03,
          "unit": "A",
          "conditions": "VCE = 10 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        },
        "vce": {
          "value": 10,
          "unit": "V",
          "conditions": "IC = 0.03 A, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 40,
          "unit": "1",
          "conditions": "IC = 0.03 A, VCE = 10 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      }
    ],
    "saturation_points": [
      {
        "collector_current": {
          "value": 0.02,
          "unit": "A",
          "conditions": "IB = 2 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.002,
          "unit": "A",
          "conditions": "IC = 20 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.5,
          "unit": "V",
          "conditions": "IC = 20 mA, IB = 2 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "maximum"
        },
        "vbe_sat": {
          "value": 0.9,
          "unit": "V",
          "conditions": "IC = 20 mA, IB = 2 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        }
      },
      {
        "collector_current": {
          "value": 0.02,
          "unit": "A",
          "conditions": "IB = 2 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "held_duplicate"
        },
        "base_current": {
          "value": 0.002,
          "unit": "A",
          "conditions": "IC = 20 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "held_duplicate"
        },
        "vce_sat": {
          "value": 0.5,
          "unit": "V",
          "conditions": "IC = 20 mA, IB = 2 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "maximum"
        },
        "vbe_sat": {
          "value": 0.9,
          "unit": "V",
          "conditions": "IC = 20 mA, IB = 2 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        }
      }
    ],
    "capacitances": {
      "cobo": {
        "value": 3e-12,
        "unit": "F",
        "conditions": "VCB = 20 V, IE = 0, f = 1 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "maximum"
      },
      "cobo_vcb": {
        "value": 20,
        "unit": "V",
        "conditions": "Ccb test bias",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      },
      "cibo": {
        "value": 1e-15,
        "unit": "F",
        "conditions": "Not published; held at numerical floor",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "not_published"
      },
      "cibo_veb": {
        "value": 0.5,
        "unit": "V",
        "conditions": "Held because Ceb is not published",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "held_default"
      }
    },
    "frequency_response": {
      "ft": {
        "value": 50000000,
        "unit": "Hz",
        "conditions": "IC = 10 mA, VCE = 20 V, f = 100 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "ic": {
        "value": 0.01,
        "unit": "A",
        "conditions": "fT test collector current",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      },
      "vce": {
        "value": 20,
        "unit": "V",
        "conditions": "fT test collector-emitter voltage",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      }
    },
    "electrical_limits": {
      "vceo": {
        "value": 300,
        "unit": "V",
        "conditions": "IC = 1 mA, IB = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "vcbo": {
        "value": 300,
        "unit": "V",
        "conditions": "IC = 100 uA, IE = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "vebo": {
        "value": 6,
        "unit": "V",
        "conditions": "IE = 100 uA, IC = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "collector_current": {
        "value": 0.5,
        "unit": "A",
        "conditions": "Continuous",
        "page_reference": "p. 1 maximum ratings",
        "source_kind": "maximum"
      }
    },
    "identity": {
      "canonical_mpn": "MPSA42",
      "manufacturer": "onsemi",
      "aliases": []
    },
    "source": {
      "kind": "datasheet",
      "url": "https://www.onsemi.com/pdf/datasheet/mpsa42-d.pdf",
      "revision": "February 2013 Rev. 8",
      "sha256": "83c386f606d306060d0fd7399a83de1416961cebb17881d6d9efddfd94e35df2",
      "accessed_date": "2026-08-06",
      "pages_referenced": [
        "p. 1",
        "p. 2",
        "p. 3"
      ],
      "placeholder": false
    }
  },
  "component": {
    "modelName": "OC_ONSEMI_MPSA42",
    "fidelity_tier": "F1",
    "domain_coverage": {
      "dc": "fitted",
      "ac": "fitted",
      "transient": "approx",
      "noise": "none",
      "thermal": "none",
      "digital": "none"
    },
    "supported_analyses": [
      "operating_point",
      "dc_sweep",
      "ac_small_signal",
      "transient"
    ],
    "operating_summary": "F1 table-constrained model at 25 degC; hFE targets are guaranteed minima, not typical values.",
    "numeric_bounds": [
      {
        "quantity": "collector_current",
        "minimum": 0.001,
        "maximum": 0.03,
        "unit": "A",
        "conditions": "Datasheet hFE table range at 25 degC",
        "placeholder": false
      },
      {
        "quantity": "collector_emitter_voltage",
        "minimum": 0,
        "maximum": 300,
        "unit": "V",
        "conditions": "Rated VCEO",
        "placeholder": false
      }
    ],
    "omissions": [
      "No self-heating: junction temperature is fixed at TNOM.",
      "Absolute maximum ratings are metadata only; breakdown is not modelled.",
      "Package parasitics are not modelled.",
      "Guaranteed MIN/MAX rows are retained as source semantics; no typical hFE curve was published, so F1 targets use the stated minima as conservative table anchors.",
      "Only one VCE(sat) condition is published; the duplicated bench point is not an independent characterization.",
      "CJE is held at the numerical floor because Ceb is not published.",
      "Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.",
      "Reviewer remains pending-review.",
      "Fidelity is capped at F1 because the source provides incomplete typical multi-point characterization for the required BJT inputs."
    ]
  }
},
  "MMBT3904": {
  "slug": "MMBT3904",
  "manufacturerSlug": "onsemi",
  "pipeline": "bjt",
  "identity": {
    "canonical_mpn": "MMBT3904",
    "manufacturer": "onsemi",
    "description": "General-purpose NPN silicon transistor",
    "electrical_family": "bjt_npn",
    "aliases": [],
    "package": {
      "name": "SOT-23",
      "standard": "TO-236AB"
    },
    "pins": [
      {
        "name": "E",
        "number": "1",
        "role": "emitter",
        "node": "emitter"
      },
      {
        "name": "B",
        "number": "2",
        "role": "base",
        "node": "base"
      },
      {
        "name": "C",
        "number": "3",
        "role": "collector",
        "node": "collector"
      }
    ],
    "spice_order": [
      "3",
      "2",
      "1"
    ]
  },
  "source": {
    "url": "https://www.onsemi.com/pdf/datasheet/mmbt3904lt1-d.pdf",
    "revision": "August 2021 Rev. 14",
    "pages": [
      "p. 1",
      "p. 2",
      "p. 5",
      "p. 6",
      "p. 8"
    ]
  },
  "facts": {
    "schema_version": "1.0.0",
    "extraction_method": "pdftotext plus manual structuring; table values retain MIN/TYP/MAX source semantics",
    "fit_conditions": {
      "temperature": {
        "value": 25,
        "unit": "degC",
        "conditions": "Electrical characteristics unless otherwise noted",
        "page_reference": "p. 1",
        "source_kind": "typical"
      }
    },
    "gain_points": [
      {
        "collector_current": {
          "value": 0.0001,
          "unit": "A",
          "conditions": "VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15, 25 degC curve",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = 0.1 mA, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 90,
          "unit": "1",
          "conditions": "IC = 0.1 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15, digitized",
          "source_kind": "digitized_typical_curve"
        }
      },
      {
        "collector_current": {
          "value": 0.001,
          "unit": "A",
          "conditions": "VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = 1 mA, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 140,
          "unit": "1",
          "conditions": "IC = 1 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15, digitized",
          "source_kind": "digitized_typical_curve"
        },
        "vbe": {
          "value": 0.66,
          "unit": "V",
          "conditions": "IC = 1 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        }
      },
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = 10 mA, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 200,
          "unit": "1",
          "conditions": "IC = 10 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15, digitized",
          "source_kind": "digitized_typical_curve"
        },
        "vbe": {
          "value": 0.7,
          "unit": "V",
          "conditions": "IC = 10 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        }
      },
      {
        "collector_current": {
          "value": 0.05,
          "unit": "A",
          "conditions": "VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = 50 mA, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 110,
          "unit": "1",
          "conditions": "IC = 50 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15, digitized",
          "source_kind": "digitized_typical_curve"
        },
        "vbe": {
          "value": 0.76,
          "unit": "V",
          "conditions": "IC = 50 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        }
      },
      {
        "collector_current": {
          "value": 0.1,
          "unit": "A",
          "conditions": "VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = 100 mA, TA = 25 degC",
          "page_reference": "p. 5 fig. 15",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 54,
          "unit": "1",
          "conditions": "IC = 100 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 5 fig. 15, digitized",
          "source_kind": "digitized_typical_curve"
        },
        "vbe": {
          "value": 0.82,
          "unit": "V",
          "conditions": "IC = 100 mA, VCE = 1 V, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        }
      }
    ],
    "saturation_points": [
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "IB = 1 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.001,
          "unit": "A",
          "conditions": "IC = 10 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.09,
          "unit": "V",
          "conditions": "IC = 10 mA, IB = 1 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        },
        "vbe_sat": {
          "value": 0.76,
          "unit": "V",
          "conditions": "IC = 10 mA, IB = 1 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        }
      },
      {
        "collector_current": {
          "value": 0.05,
          "unit": "A",
          "conditions": "IB = 5 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.005,
          "unit": "A",
          "conditions": "IC = 50 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.2,
          "unit": "V",
          "conditions": "IC = 50 mA, IB = 5 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        },
        "vbe_sat": {
          "value": 0.85,
          "unit": "V",
          "conditions": "IC = 50 mA, IB = 5 mA, TA = 25 degC",
          "page_reference": "p. 6 fig. 17, digitized",
          "source_kind": "digitized_typical_curve"
        }
      }
    ],
    "capacitances": {
      "cobo": {
        "value": 4e-12,
        "unit": "F",
        "conditions": "VCB = 5 V, IE = 0, f = 1 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "maximum"
      },
      "cobo_vcb": {
        "value": 5,
        "unit": "V",
        "conditions": "Cobo test bias",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      },
      "cibo": {
        "value": 8e-12,
        "unit": "F",
        "conditions": "VEB = 0.5 V, IC = 0, f = 1 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "maximum"
      },
      "cibo_veb": {
        "value": 0.5,
        "unit": "V",
        "conditions": "Cibo test bias",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      }
    },
    "frequency_response": {
      "ft": {
        "value": 300000000,
        "unit": "Hz",
        "conditions": "IC = 10 mA, VCE = 20 V, f = 100 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "ic": {
        "value": 0.01,
        "unit": "A",
        "conditions": "fT test collector current",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      },
      "vce": {
        "value": 20,
        "unit": "V",
        "conditions": "fT test collector-emitter voltage",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      }
    },
    "electrical_limits": {
      "vceo": {
        "value": 40,
        "unit": "V",
        "conditions": "IC = 1 mA, IB = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "vcbo": {
        "value": 60,
        "unit": "V",
        "conditions": "IC = 10 uA, IE = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "vebo": {
        "value": 6,
        "unit": "V",
        "conditions": "IE = 10 uA, IC = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "collector_current": {
        "value": 0.2,
        "unit": "A",
        "conditions": "Continuous",
        "page_reference": "p. 1 maximum ratings",
        "source_kind": "maximum"
      }
    },
    "identity": {
      "canonical_mpn": "MMBT3904",
      "manufacturer": "onsemi",
      "aliases": []
    },
    "source": {
      "kind": "datasheet",
      "url": "https://www.onsemi.com/pdf/datasheet/mmbt3904lt1-d.pdf",
      "revision": "August 2021 Rev. 14",
      "sha256": "8c3a7966cfbd09066d906c4e0e3dfedb7e13abb9dc2cb34c600d1f05736bbdb4",
      "accessed_date": "2026-08-06",
      "pages_referenced": [
        "p. 1",
        "p. 2",
        "p. 5",
        "p. 6",
        "p. 8"
      ],
      "placeholder": false
    },
    "gain_curve_interpretation": "Figure 15 is normalized DC current gain. Absolute hFE targets use the datasheet table value at IC = 10 mA as the scale anchor, with the curve shape digitized from Figure 15."
  },
  "component": {
    "modelName": "OC_ONSEMI_MMBT3904",
    "domain_coverage": {
      "dc": "fitted",
      "ac": "fitted",
      "transient": "approx",
      "noise": "none",
      "thermal": "none",
      "digital": "none"
    },
    "supported_analyses": [
      "operating_point",
      "dc_sweep",
      "ac_small_signal",
      "transient"
    ],
    "operating_summary": "F2 datasheet-fitted model using typical 25 degC curve digitization and tabulated parasitics.",
    "numeric_bounds": [
      {
        "quantity": "collector_current",
        "minimum": 0.0001,
        "maximum": 0.1,
        "unit": "A",
        "conditions": "Fitted typical DC range at 25 degC",
        "placeholder": false
      },
      {
        "quantity": "collector_emitter_voltage",
        "minimum": 0,
        "maximum": 40,
        "unit": "V",
        "conditions": "Rated VCEO",
        "placeholder": false
      }
    ],
    "omissions": [
      "No self-heating: junction temperature is fixed at TNOM.",
      "Absolute maximum ratings are metadata only; breakdown is not modelled.",
      "Package parasitics are not modelled.",
      "Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.",
      "CJE and CJC are derived from single tabulated points with physical defaults.",
      "Reviewer remains pending-review."
    ]
  }
},
  "MMBT3906": {
  "slug": "MMBT3906",
  "manufacturerSlug": "onsemi",
  "pipeline": "bjt",
  "identity": {
    "canonical_mpn": "MMBT3906",
    "manufacturer": "onsemi",
    "description": "General-purpose PNP silicon transistor",
    "electrical_family": "bjt_pnp",
    "aliases": [],
    "package": {
      "name": "SOT-23",
      "standard": "TO-236AB"
    },
    "pins": [
      {
        "name": "C",
        "number": "1",
        "role": "collector",
        "node": "collector"
      },
      {
        "name": "B",
        "number": "2",
        "role": "base",
        "node": "base"
      },
      {
        "name": "E",
        "number": "3",
        "role": "emitter",
        "node": "emitter"
      }
    ],
    "spice_order": [
      "1",
      "2",
      "3"
    ]
  },
  "source": {
    "url": "https://www.onsemi.com/pdf/datasheet/mmbt3906lt1-d.pdf",
    "revision": "October 2024 Rev. 14",
    "pages": [
      "p. 1",
      "p. 2",
      "p. 7",
      "p. 8"
    ]
  },
  "facts": {
    "schema_version": "1.0.0",
    "extraction_method": "pdftotext plus manual structuring; table values retain MIN/TYP/MAX source semantics",
    "fit_conditions": {
      "temperature": {
        "value": 25,
        "unit": "degC",
        "conditions": "Electrical characteristics unless otherwise noted",
        "page_reference": "p. 1",
        "source_kind": "typical"
      }
    },
    "gain_points": [
      {
        "collector_current": {
          "value": 0.0001,
          "unit": "A",
          "conditions": "VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = -0.1 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 60,
          "unit": "1",
          "conditions": "IC = -0.1 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.001,
          "unit": "A",
          "conditions": "VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = -1 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 80,
          "unit": "1",
          "conditions": "IC = -1 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = -10 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 100,
          "unit": "1",
          "conditions": "IC = -10 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.05,
          "unit": "A",
          "conditions": "VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = -50 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 60,
          "unit": "1",
          "conditions": "IC = -50 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.1,
          "unit": "A",
          "conditions": "VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce": {
          "value": 1,
          "unit": "V",
          "conditions": "IC = -100 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 30,
          "unit": "1",
          "conditions": "IC = -100 mA, VCE = -1 V, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      }
    ],
    "saturation_points": [
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "IB = -1 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.001,
          "unit": "A",
          "conditions": "IC = -10 mA, IB = -1 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.25,
          "unit": "V",
          "conditions": "IC = -10 mA, IB = -1 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "maximum"
        },
        "vbe_sat": {
          "value": 0.65,
          "unit": "V",
          "conditions": "IC = -10 mA, IB = -1 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "minimum"
        }
      },
      {
        "collector_current": {
          "value": 0.05,
          "unit": "A",
          "conditions": "IB = -5 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.005,
          "unit": "A",
          "conditions": "IC = -50 mA, IB = -5 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.4,
          "unit": "V",
          "conditions": "IC = -50 mA, IB = -5 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "maximum"
        },
        "vbe_sat": {
          "value": 0.95,
          "unit": "V",
          "conditions": "IC = -50 mA, IB = -5 mA, TA = 25 degC",
          "page_reference": "p. 2 electrical characteristics",
          "source_kind": "maximum"
        }
      }
    ],
    "capacitances": {
      "cobo": {
        "value": 4.5e-12,
        "unit": "F",
        "conditions": "VCB = -5 V, IE = 0, f = 1 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "maximum"
      },
      "cobo_vcb": {
        "value": 5,
        "unit": "V",
        "conditions": "Cobo test bias magnitude",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      },
      "cibo": {
        "value": 1e-11,
        "unit": "F",
        "conditions": "VEB = -0.5 V, IC = 0, f = 1 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "maximum"
      },
      "cibo_veb": {
        "value": 0.5,
        "unit": "V",
        "conditions": "Cibo test bias magnitude",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      }
    },
    "frequency_response": {
      "ft": {
        "value": 250000000,
        "unit": "Hz",
        "conditions": "IC = -10 mA, VCE = -20 V, f = 100 MHz",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "ic": {
        "value": 0.01,
        "unit": "A",
        "conditions": "fT test collector current magnitude",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      },
      "vce": {
        "value": 20,
        "unit": "V",
        "conditions": "fT test collector-emitter voltage magnitude",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "typical"
      }
    },
    "electrical_limits": {
      "vceo": {
        "value": 40,
        "unit": "V",
        "conditions": "IC = -1 mA, IB = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "vcbo": {
        "value": 40,
        "unit": "V",
        "conditions": "IC = -10 mA, IE = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "vebo": {
        "value": 5,
        "unit": "V",
        "conditions": "IE = -10 mA, IC = 0",
        "page_reference": "p. 2 electrical characteristics",
        "source_kind": "minimum"
      },
      "collector_current": {
        "value": 0.2,
        "unit": "A",
        "conditions": "Continuous",
        "page_reference": "p. 1 maximum ratings",
        "source_kind": "maximum"
      }
    },
    "identity": {
      "canonical_mpn": "MMBT3906",
      "manufacturer": "onsemi",
      "aliases": []
    },
    "source": {
      "kind": "datasheet",
      "url": "https://www.onsemi.com/pdf/datasheet/mmbt3906lt1-d.pdf",
      "revision": "October 2024 Rev. 14",
      "sha256": "6882fc82278c99b62b9d4af1cd263a5f49431aa371f3a250737f6ba7cb038951",
      "accessed_date": "2026-08-06",
      "pages_referenced": [
        "p. 1",
        "p. 2",
        "p. 7",
        "p. 8"
      ],
      "placeholder": false
    }
  },
  "component": {
    "modelName": "OC_ONSEMI_MMBT3906",
    "fidelity_tier": "F1",
    "domain_coverage": {
      "dc": "fitted",
      "ac": "fitted",
      "transient": "approx",
      "noise": "none",
      "thermal": "none",
      "digital": "none"
    },
    "supported_analyses": [
      "operating_point",
      "dc_sweep",
      "ac_small_signal",
      "transient"
    ],
    "operating_summary": "F1 magnitude model based on onsemi guaranteed PNP table anchors at 25 degC; signs are preserved in the final card.",
    "numeric_bounds": [
      {
        "quantity": "collector_current_magnitude",
        "minimum": 0.0001,
        "maximum": 0.1,
        "unit": "A",
        "conditions": "Datasheet hFE table range at 25 degC",
        "placeholder": false
      },
      {
        "quantity": "collector_emitter_voltage_magnitude",
        "minimum": 0,
        "maximum": 40,
        "unit": "V",
        "conditions": "Rated VCEO magnitude",
        "placeholder": false
      }
    ],
    "omissions": [
      "No self-heating: junction temperature is fixed at TNOM.",
      "Absolute maximum ratings are metadata only; PNP signs are preserved but breakdown is not modelled.",
      "Package parasitics are not modelled.",
      "Guaranteed MIN/MAX rows are retained as source semantics; no complete typical multi-point curve was used.",
      "Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.",
      "Reviewer remains pending-review.",
      "Fidelity is capped at F1: the source provides guaranteed bounds rather than a complete typical multi-point PNP characterization."
    ]
  }
},
  "BC846B": {
  "slug": "BC846B",
  "manufacturerSlug": "nexperia",
  "pipeline": "bjt",
  "identity": {
    "canonical_mpn": "BC846B",
    "manufacturer": "nexperia",
    "description": "65 V, 100 mA NPN general-purpose transistor",
    "electrical_family": "bjt_npn",
    "aliases": [],
    "package": {
      "name": "SOT-23",
      "standard": "TO-236AB"
    },
    "pins": [
      {
        "name": "E",
        "number": "1",
        "role": "emitter",
        "node": "emitter"
      },
      {
        "name": "B",
        "number": "2",
        "role": "base",
        "node": "base"
      },
      {
        "name": "C",
        "number": "3",
        "role": "collector",
        "node": "collector"
      }
    ],
    "spice_order": [
      "3",
      "2",
      "1"
    ]
  },
  "source": {
    "url": "https://assets.nexperia.com/documents/data-sheet/BC846_SER.pdf",
    "revision": "Rev. 9, 25 September 2012",
    "pages": [
      "p. 1",
      "p. 3",
      "p. 4",
      "p. 5"
    ]
  },
  "facts": {
    "schema_version": "1.0.0",
    "extraction_method": "pdftotext plus manual structuring; table values retain MIN/TYP/MAX source semantics",
    "fit_conditions": {
      "temperature": {
        "value": 25,
        "unit": "degC",
        "conditions": "Electrical characteristics unless otherwise noted",
        "page_reference": "p. 1",
        "source_kind": "typical"
      }
    },
    "gain_points": [
      {
        "collector_current": {
          "value": 1e-05,
          "unit": "A",
          "conditions": "VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vce": {
          "value": 5,
          "unit": "V",
          "conditions": "IC = 10 uA, VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 290,
          "unit": "1",
          "conditions": "hFE group B, IC = 10 uA, VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        }
      },
      {
        "collector_current": {
          "value": 0.002,
          "unit": "A",
          "conditions": "VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vce": {
          "value": 5,
          "unit": "V",
          "conditions": "IC = 2 mA, VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "hfe": {
          "value": 290,
          "unit": "1",
          "conditions": "hFE group B, IC = 2 mA, VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vbe": {
          "value": 0.66,
          "unit": "V",
          "conditions": "IC = 2 mA, VCE = 5 V, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        }
      }
    ],
    "saturation_points": [
      {
        "collector_current": {
          "value": 0.01,
          "unit": "A",
          "conditions": "IB = 0.5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.0005,
          "unit": "A",
          "conditions": "IC = 10 mA, IB = 0.5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.09,
          "unit": "V",
          "conditions": "IC = 10 mA, IB = 0.5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vbe_sat": {
          "value": 0.76,
          "unit": "V",
          "conditions": "IC = 10 mA, IB = 0.5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        }
      },
      {
        "collector_current": {
          "value": 0.1,
          "unit": "A",
          "conditions": "IB = 5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "base_current": {
          "value": 0.005,
          "unit": "A",
          "conditions": "IC = 100 mA, IB = 5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vce_sat": {
          "value": 0.2,
          "unit": "V",
          "conditions": "IC = 100 mA, IB = 5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        },
        "vbe_sat": {
          "value": 0.9,
          "unit": "V",
          "conditions": "IC = 100 mA, IB = 5 mA, Tamb = 25 degC",
          "page_reference": "p. 4 table 8",
          "source_kind": "typical"
        }
      }
    ],
    "capacitances": {
      "cobo": {
        "value": 3e-12,
        "unit": "F",
        "conditions": "VCB = 10 V, IE = 0, f = 1 MHz",
        "page_reference": "p. 4 table 8",
        "source_kind": "maximum"
      },
      "cobo_vcb": {
        "value": 10,
        "unit": "V",
        "conditions": "Cc test bias",
        "page_reference": "p. 4 table 8",
        "source_kind": "typical"
      },
      "cibo": {
        "value": 1.1e-11,
        "unit": "F",
        "conditions": "VEB = 0.5 V, IC = 0, f = 1 MHz",
        "page_reference": "p. 4 table 8",
        "source_kind": "typical"
      },
      "cibo_veb": {
        "value": 0.5,
        "unit": "V",
        "conditions": "Ce test bias",
        "page_reference": "p. 4 table 8",
        "source_kind": "typical"
      }
    },
    "frequency_response": {
      "ft": {
        "value": 100000000,
        "unit": "Hz",
        "conditions": "VCE = 5 V, IC = 10 mA, f = 100 MHz",
        "page_reference": "p. 4 table 8",
        "source_kind": "minimum"
      },
      "ic": {
        "value": 0.01,
        "unit": "A",
        "conditions": "fT test collector current",
        "page_reference": "p. 4 table 8",
        "source_kind": "typical"
      },
      "vce": {
        "value": 5,
        "unit": "V",
        "conditions": "fT test collector-emitter voltage",
        "page_reference": "p. 4 table 8",
        "source_kind": "typical"
      }
    },
    "electrical_limits": {
      "vceo": {
        "value": 65,
        "unit": "V",
        "conditions": "open base",
        "page_reference": "p. 3 quick reference data",
        "source_kind": "maximum"
      },
      "vcbo": {
        "value": 80,
        "unit": "V",
        "conditions": "open emitter",
        "page_reference": "p. 3 table 5",
        "source_kind": "maximum"
      },
      "vebo": {
        "value": 6,
        "unit": "V",
        "conditions": "IE = 100 uA, IC = 0",
        "page_reference": "p. 3 table 5",
        "source_kind": "maximum"
      },
      "collector_current": {
        "value": 0.1,
        "unit": "A",
        "conditions": "Continuous",
        "page_reference": "p. 3 quick reference data",
        "source_kind": "maximum"
      }
    },
    "identity": {
      "canonical_mpn": "BC846B",
      "manufacturer": "nexperia",
      "aliases": []
    },
    "source": {
      "kind": "datasheet",
      "url": "https://assets.nexperia.com/documents/data-sheet/BC846_SER.pdf",
      "revision": "Rev. 9, 25 September 2012",
      "sha256": "045a6cc21de93ac634aad910567e882926bd6ef154cbd8c59d13201134642a97",
      "accessed_date": "2026-08-06",
      "pages_referenced": [
        "p. 1",
        "p. 3",
        "p. 4",
        "p. 5"
      ],
      "placeholder": false
    }
  },
  "component": {
    "modelName": "OC_NEXPERIA_BC846B",
    "fidelity_tier": "F1",
    "domain_coverage": {
      "dc": "fitted",
      "ac": "fitted",
      "transient": "approx",
      "noise": "none",
      "thermal": "none",
      "digital": "none"
    },
    "supported_analyses": [
      "operating_point",
      "dc_sweep",
      "ac_small_signal",
      "transient"
    ],
    "operating_summary": "F1 model using group-B typical table anchors at 25 degC; no complete typical multi-point characterization is available.",
    "numeric_bounds": [
      {
        "quantity": "collector_current",
        "minimum": 1e-05,
        "maximum": 0.1,
        "unit": "A",
        "conditions": "Datasheet characterization range at 25 degC",
        "placeholder": false
      },
      {
        "quantity": "collector_emitter_voltage",
        "minimum": 0,
        "maximum": 65,
        "unit": "V",
        "conditions": "Rated VCEO",
        "placeholder": false
      }
    ],
    "omissions": [
      "No self-heating: junction temperature is fixed at TNOM.",
      "Absolute maximum ratings are metadata only; breakdown is not modelled.",
      "Package parasitics are not modelled.",
      "Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.",
      "CJE and CJC are derived from single tabulated points with physical defaults.",
      "Fidelity is capped at F1 because the source revision lacks a complete typical multi-point characterization.",
      "Reviewer remains pending-review."
    ]
  }
}
};

const transistorPins = [
  { name: "B", number: "1", role: "base", node: "base" },
  { name: "C", number: "2", role: "collector", node: "collector" },
  { name: "E", number: "3", role: "emitter", node: "emitter" }
];
const stHtmlSource = (mpn, revision, pages) => ({
  url: `https://www.st.com/en/power-transistors/${mpn.toLowerCase()}.html`,
  revision: `${revision}; official ST product/specification page fallback accessed 2026-08-07`,
  pages
});
const powerBjt = ({ mpn, pnp = false, darlington = false, revision, gain, sat, vbeOn, voltage, r1, r2, packageName = "TO-220", packageStandard = "ST TO-220", currentMax = darlington ? 5 : 3, manufacturerSlug = "st", manufacturer = "STMicroelectronics", sourceUrl, sourcePages }) => ({
  slug: mpn,
  manufacturerSlug,
  pipeline: darlington ? "darlington" : "bjt",
  identity: {
    canonical_mpn: mpn,
    manufacturer,
    description: `${pnp ? "PNP" : "NPN"} ${darlington ? "Darlington " : ""}power transistor`,
    electrical_family: pnp ? "bjt_pnp" : "bjt_npn",
    aliases: [],
    package: { name: packageName, standard: packageStandard },
    pins: transistorPins,
    spice_order: ["2", "1", "3"]
  },
  source: sourceUrl ? { url: sourceUrl, revision, pages: sourcePages ?? ["p. 1", "p. 2"] } : stHtmlSource(mpn, revision, darlington ? ["official spec table", "internal schematic"] : ["official spec table"]),
  facts: {
    schema_version: "1.0.0",
    extraction_method: sourceUrl ? "manufacturer PDF table transcription with MIN/MAX semantics preserved" : "official ST product/specification page fallback; PDF fetch timed out after browser-header retries; MIN/MAX semantics preserved",
    model_polarity: pnp ? "PNP" : "NPN",
    device_class: "power",
    fit_conditions: { temperature: quantity(25, "degC", "TC = 25 degC unless otherwise specified", "official spec table", "typical") },
    gain_points: gain.map(([ic, hfe]) => ({
      collector_current: quantity(ic, "A", `VCE = ${darlington ? 3 : 4} V, TC = 25 degC`, "official spec table", "typical"),
      vce: quantity(darlington ? 3 : 4, "V", `IC = ${ic} A, TC = 25 degC`, "official spec table", "typical"),
      hfe: quantity(hfe, "1", `IC = ${ic} A, VCE = ${darlington ? 3 : 4} V`, "official spec table MIN column", "minimum"),
      ...(vbeOn && ic === vbeOn[0] ? { vbe: quantity(vbeOn[1], "V", `IC = ${ic} A, VCE = ${darlington ? 3 : 4} V`, "official spec table MAX column", "maximum") } : {})
    })),
    saturation_points: sat.map(([ic, ib, vce]) => ({
      collector_current: quantity(ic, "A", `IB = ${ib} A, TC = 25 degC`, "official spec table", "typical"),
      base_current: quantity(ib, "A", `IC = ${ic} A, TC = 25 degC`, "official spec table", "typical"),
      vce_sat: quantity(vce, "V", `IC = ${ic} A, IB = ${ib} A`, "official spec table MAX column", "maximum"),
      vbe_sat: quantity(vbeOn?.[1] ?? (darlington ? 2.5 : 1.8), "V", "conservative bound from published VBE(on) maximum", "official spec table MAX column", "maximum")
    })),
    electrical_limits: {
      vceo: quantity(voltage, "V", "IB = 0", "official spec table", "minimum"),
      collector_current: quantity(currentMax, "A", "continuous", "official spec table", "maximum")
    },
    ...(darlington ? { internal_network: { r1: quantity(r1, "ohm", "internal schematic", "internal schematic", "typical"), r2: quantity(r2, "ohm", "internal schematic", "internal schematic", "typical") } } : {}),
    ...(darlington ? { composite_seed: {
      DRV_IS: 2e-13, DRV_BF: 35, DRV_IKF: 0.35, DRV_ISE: 1e-11, DRV_NE: 1.5, DRV_VAF: 60, DRV_RB: 5, DRV_RE: 0.08, DRV_RC: 0.12, DRV_CJE: 2e-10, DRV_CJC: 8e-11, DRV_TF: 2e-7, DRV_TR: 5e-7,
      OUT_IS: 2e-12, OUT_BF: 45, OUT_IKF: 3.5, OUT_ISE: 1e-10, OUT_NE: 1.5, OUT_VAF: 60, OUT_RB: 0.5, OUT_RE: 0.008, OUT_RC: 0.012, OUT_CJE: 2e-9, OUT_CJC: 8e-10, OUT_TF: 2e-7, OUT_TR: 5e-7,
      R1: r1, R2: r2, DIODE_IS: 1e-12, DIODE_N: 1.5, DIODE_RS: 0.05
    } } : {})
  },
  component: {
    modelName: `OC_${manufacturerSlug.toUpperCase()}_${mpn}`,
    fidelity_tier: "F1",
    domain_coverage: { dc: "approx", ac: "none", transient: darlington ? "approx" : "none", noise: "none", thermal: "none", digital: "none" },
    supported_analyses: ["operating_point", "dc_sweep", "transient"],
    operating_summary: sourceUrl ? "F1 table-constrained terminal model at 25 degC from a manufacturer PDF." : "F1 table-constrained terminal model at 25 degC; official HTML specification fallback used because ST PDF fetches timed out.",
    numeric_bounds: [
      { quantity: "collector_current", minimum: 0, maximum: currentMax, unit: "A", conditions: "Continuous current rating; SOA and thermal limits not enforced", placeholder: false },
      { quantity: "collector_emitter_voltage", minimum: 0, maximum: voltage, unit: "V", conditions: "Rated VCEO; breakdown omitted", placeholder: false },
      { quantity: "ambient_temperature", minimum: 25, maximum: 25, unit: "degC", conditions: "Characterization temperature", placeholder: false }
    ],
    omissions: [
      sourceUrl ? "The manufacturer source provides guaranteed MIN/MAX rows but not enough independent typical curves for F2; fidelity is capped at F1." : "Official ST PDF fetch timed out after browser-header retries; the official ST HTML product/specification page is the source and fidelity is capped at F1.",
      ...(darlington ? ["Darlington modelled as two Gummel-Poon devices plus the datasheet internal bias resistors and freewheel diode. The two dies are not independently characterised; only composite terminal behaviour is constrained. Internal-node behaviour is F1."] : []),
      "Guaranteed MIN/MAX rows remain hard bounds and are not presented as typical targets.",
      "No self-heating, safe-operating-area failure, thermal runaway, breakdown, package parasitics, temperature spread, or noise is modelled.",
      "Reviewer remains pending-review."
    ]
  }
});

Object.assign(PARTS, {
  TIP31C: powerBjt({ mpn: "TIP31C", revision: "Rev. 1, April 2006", gain: [[1, 25], [3, 10]], sat: [[3, 0.375, 1.2]], vbeOn: [3, 1.8], voltage: 100 }),
  TIP32C: powerBjt({ mpn: "TIP32C", pnp: true, revision: "Rev. 2, November 2006", gain: [[1, 25], [3, 10]], sat: [[3, 0.375, 1.2]], vbeOn: [3, 1.8], voltage: 100 }),
  TIP120: powerBjt({ mpn: "TIP120", darlington: true, revision: "DS0854 Rev. 5, May 2021", gain: [[0.5, 1000], [3, 1000]], sat: [[3, 0.012, 2], [5, 0.020, 4]], vbeOn: [3, 2.5], voltage: 60, r1: 7000, r2: 70 }),
  TIP125: powerBjt({ mpn: "TIP125", pnp: true, darlington: true, revision: "DS0854 Rev. 5, May 2021", gain: [[0.5, 1000], [3, 1000]], sat: [[3, 0.012, 2], [5, 0.020, 4]], vbeOn: [3, 2.5], voltage: 60, r1: 16000, r2: 60 }),
  BD139: powerBjt({ mpn: "BD139", revision: "BD139/D Rev. 3, April 2026", gain: [[0.005, 25], [0.15, 40], [0.5, 25]], sat: [[0.5, 0.05, 0.5]], vbeOn: [0.5, 1.0], voltage: 80, currentMax: 1.5, packageName: "TO-126", packageStandard: "onsemi TO-126-3LD", manufacturerSlug: "onsemi", manufacturer: "onsemi", sourceUrl: "https://www.onsemi.com/pdf/datasheet/bd139-d.pdf", sourcePages: ["p. 1", "p. 2"] }),
  BD140: powerBjt({ mpn: "BD140", pnp: true, revision: "BD139/D Rev. 3, April 2026", gain: [[0.005, 25], [0.15, 40], [0.5, 25]], sat: [[0.5, 0.05, 0.5]], vbeOn: [0.5, 1.0], voltage: 80, currentMax: 1.5, packageName: "TO-126", packageStandard: "onsemi TO-126-3LD", manufacturerSlug: "onsemi", manufacturer: "onsemi", sourceUrl: "https://www.onsemi.com/pdf/datasheet/bd139-d.pdf", sourcePages: ["p. 1", "p. 2"] }),
  TIP41C: powerBjt({ mpn: "TIP41C", revision: "TIP41A/D Rev. 12, June 2024", gain: [[0.3, 30], [3, 15]], sat: [[6, 0.6, 1.5]], vbeOn: [6, 2.0], voltage: 100, currentMax: 6, manufacturerSlug: "onsemi", manufacturer: "onsemi", sourceUrl: "https://www.onsemi.com/pdf/datasheet/tip41a-d.pdf", sourcePages: ["p. 1", "p. 2", "p. 3"] }),
  TIP42C: powerBjt({ mpn: "TIP42C", pnp: true, revision: "TIP41A/D Rev. 12, June 2024", gain: [[0.3, 30], [3, 15]], sat: [[6, 0.6, 1.5]], vbeOn: [6, 2.0], voltage: 100, currentMax: 6, manufacturerSlug: "onsemi", manufacturer: "onsemi", sourceUrl: "https://www.onsemi.com/pdf/datasheet/tip41a-d.pdf", sourcePages: ["p. 1", "p. 2", "p. 3"] }),
  BF256B: {
    slug: "BF256B", manufacturerSlug: "nxp", pipeline: "njf",
    identity: {
      canonical_mpn: "BF256B", manufacturer: "Nexperia", description: "N-channel low-noise JFET", electrical_family: "jfet_n", aliases: [],
      package: { name: "TO-92", standard: "SOT54" },
      pins: [{ name: "D", number: "1", role: "drain", node: "drain" }, { name: "S", number: "2", role: "source", node: "source" }, { name: "G", number: "3", role: "gate", node: "gate" }], spice_order: ["1", "3", "2"]
    },
    source: { url: "https://www.nexperia.com/product/BF256B", revision: "Official Nexperia HTML product/specification table; accessed 2026-08-07", pages: ["spec table"] },
    facts: { schema_version: "1.0.0", extraction_method: "official Nexperia HTML specification table fallback; PDF challenge-gated" },
    component: {
      modelName: "OC_NEXPERIA_BF256B", fidelity_tier: "F1",
      domain_coverage: { dc: "approx", ac: "approx", transient: "approx", noise: "none", thermal: "none", digital: "none" },
      supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "F1 datasheet-window model at 25 degC from the official Nexperia HTML specification table.",
      numeric_bounds: [{ quantity: "drain_source_voltage", minimum: 0, maximum: 15, unit: "V", conditions: "F1 characterized bench envelope", placeholder: false }, { quantity: "gate_source_voltage", minimum: -8, maximum: 0, unit: "V", conditions: "Published cutoff window; never forward-bias gate", placeholder: false }],
      omissions: ["Nexperia PDF is challenge-gated; the official HTML specification table is used and fidelity is capped at F1.", "IDSS and VGS(off) production spread are represented by bounds, not a typical device.", "Noise is not fitted from a single-frequency figure.", "Reviewer remains pending-review."]
    }
  }
});

const sensorComponent = ({ modelName, fidelity, summary, bounds, omissions, dc = "fitted" }) => ({
  modelName,
  fidelity_tier: fidelity,
  domain_coverage: { dc, ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" },
  supported_analyses: ["operating_point", "dc_sweep"],
  operating_summary: summary,
  numeric_bounds: bounds,
  omissions: [...omissions, "Independent review remains pending-review."]
});

const pn2222SiblingFacts = {
  schema_version: "1.0.0", extraction_method: "MMBT2222A manufacturer PDF table transcription; electrical parameters inherit the documented PN2222A die fit under the sibling/package policy", model_polarity: "NPN", device_class: "small_signal",
  fit_conditions: { temperature: quantity(25, "degC", "TA = 25 degC unless stated", "p. 2 electrical characteristics heading", "typical") },
  gain_points: [[0.0001, 35], [0.001, 50], [0.01, 75], [0.15, 100], [0.5, 40]].map(([ic, hfe]) => ({ collector_current: quantity(ic, "A", "VCE = 10 V, TA = 25 degC", "p. 2 DC current gain table", "typical"), vce: quantity(10, "V", `IC = ${ic} A`, "p. 2 DC current gain table", "typical"), hfe: quantity(hfe, "1", `IC = ${ic} A, VCE = 10 V`, "p. 2 hFE MIN column", "minimum") })),
  saturation_points: [
    { collector_current: quantity(0.15, "A", "IB = 15 mA", "p. 2 saturation table", "typical"), base_current: quantity(0.015, "A", "IC = 150 mA", "p. 2 saturation table", "typical"), vce_sat: quantity(0.3, "V", "IC = 150 mA, IB = 15 mA", "p. 2 VCE(sat) MAX column", "maximum"), vbe_sat: quantity(1.2, "V", "IC = 150 mA, IB = 15 mA", "p. 2 VBE(sat) MAX column", "maximum") },
    { collector_current: quantity(0.5, "A", "IB = 50 mA", "p. 2 saturation table", "typical"), base_current: quantity(0.05, "A", "IC = 500 mA", "p. 2 saturation table", "typical"), vce_sat: quantity(1.0, "V", "IC = 500 mA, IB = 50 mA", "p. 2 VCE(sat) MAX column", "maximum"), vbe_sat: quantity(2.0, "V", "IC = 500 mA, IB = 50 mA", "p. 2 VBE(sat) MAX column", "maximum") }
  ],
  capacitances: { cobo: quantity(8e-12, "F", "VCB = 10 V, IE = 0, f = 1 MHz", "p. 2 Cobo MAX column", "maximum"), cobo_vcb: quantity(10, "V", "Cobo test bias", "p. 2 Cobo row", "typical"), cibo: quantity(25e-12, "F", "VEB = 0.5 V, IC = 0, f = 1 MHz", "p. 2 Cibo MAX column", "maximum"), cibo_veb: quantity(0.5, "V", "Cibo test bias", "p. 2 Cibo row", "typical") },
  frequency_response: { ft: quantity(300e6, "Hz", "IC = 20 mA, VCE = 20 V, f = 100 MHz", "p. 2 fT MIN column", "minimum"), ic: quantity(0.02, "A", "fT test current", "p. 2 fT row", "typical"), vce: quantity(20, "V", "fT test voltage", "p. 2 fT row", "typical"), storage_time: quantity(225e-9, "s", "VCC = 30 V, IC = 150 mA, IB1 = 15 mA", "p. 3 storage time MAX column", "maximum") },
  electrical_limits: { vceo: quantity(40, "V", "IC = 10 mA, IB = 0", "p. 2 OFF characteristics", "minimum"), collector_current: quantity(0.6, "A", "continuous rating", "p. 1 maximum ratings", "maximum") }
};

Object.assign(PARTS, {
  MMBT2222A: {
    slug: "MMBT2222A", manufacturerSlug: "onsemi", pipeline: "sibling_alias", sibling: { manufacturerSlug: "onsemi", slug: "PN2222A" },
    identity: {
      canonical_mpn: "MMBT2222A", manufacturer: "onsemi", description: "SOT-23 general-purpose NPN transistor, documented PN2222A die sibling", electrical_family: "bjt_npn", aliases: ["MMBT2222ALT1G"],
      package: { name: "SOT-23", standard: "onsemi CASE 318" },
      pins: [{ name: "B", number: "1", role: "base", node: "base" }, { name: "E", number: "2", role: "emitter", node: "emitter" }, { name: "C", number: "3", role: "collector", node: "collector" }], spice_order: ["3", "1", "2"]
    },
    source: { url: "https://www.onsemi.com/pdf/datasheet/mmbt2222lt1-d.pdf", revision: "MMBT2222LT1/D Rev. 12, August 2021", pages: ["p. 1", "p. 2", "p. 3"] },
    facts: pn2222SiblingFacts,
    component: {
      modelName: "OC_ONSEMI_MMBT2222A", fidelity_tier: "F1", domain_coverage: { dc: "fitted", ac: "fitted", transient: "fitted", noise: "none", thermal: "none", digital: "none" }, supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "F1 SOT-23 sibling package using the fitted PN2222A die parameters, checked against the MMBT2222A manufacturer specification bounds at 25 degC.",
      numeric_bounds: [{ quantity: "collector_current", minimum: 0.0001, maximum: 0.5, unit: "A", conditions: "MMBT2222A published characterization range at 25 degC", placeholder: false }, { quantity: "collector_emitter_voltage", minimum: 0, maximum: 40, unit: "V", conditions: "MMBT2222A VCEO rating; breakdown omitted", placeholder: false }],
      omissions: ["The electrical parameter vector is intentionally inherited from the existing fitted PN2222A die model. The MMBT2222A retains separate manufacturer datasheet provenance, SOT-23 package metadata, aliases, pin mapping, tests, and validation artifacts.", "The source publishes guaranteed MIN/MAX rows rather than a complete independent typical curve family, so this sibling package remains F1.", "SOT-23 package parasitics and thermal impedance are metadata only; the shared die card does not model package-specific inductance, capacitance, or self-heating.", "Breakdown, failure, statistical spread, temperature coefficients, reverse operation, and noise are not fitted.", "Independent review remains pending-review."]
    }
  },
  "2N5088": {
    slug: "2N5088", manufacturerSlug: "onsemi", pipeline: "bjt",
    identity: {
      canonical_mpn: "2N5088", manufacturer: "onsemi (Fairchild legacy)", description: "Low-noise high-gain NPN general-purpose amplifier transistor", electrical_family: "bjt_npn", aliases: [],
      package: { name: "TO-92", standard: "Fairchild TO-92" },
      pins: [{ name: "E", number: "1", role: "emitter", node: "emitter" }, { name: "B", number: "2", role: "base", node: "base" }, { name: "C", number: "3", role: "collector", node: "collector" }], spice_order: ["3", "2", "1"]
    },
    source: { url: "https://www.onsemi.com/pdf/datasheet/2n5088-d.pdf", revision: "2N5088/2N5089/MMBT5088/MMBT5089 Rev. A, 2001", pages: ["p. 1", "p. 2", "p. 3"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual MIN/MAX table transcription", model_polarity: "NPN", device_class: "small_signal",
      fit_conditions: { temperature: quantity(25, "degC", "TA = 25 degC unless stated", "p. 1 absolute ratings heading", "typical") },
      gain_points: [
        { collector_current: quantity(100e-6, "A", "VCE = 5 V", "p. 2 ON characteristics", "typical"), vce: quantity(5, "V", "IC = 100 uA", "p. 2 ON characteristics", "typical"), hfe: quantity(300, "1", "IC = 100 uA, VCE = 5 V", "p. 2 hFE MIN column", "minimum") },
        { collector_current: quantity(1e-3, "A", "VCE = 5 V", "p. 2 ON characteristics", "typical"), vce: quantity(5, "V", "IC = 1 mA", "p. 2 ON characteristics", "typical"), hfe: quantity(350, "1", "IC = 1 mA, VCE = 5 V", "p. 2 hFE MIN column", "minimum") },
        { collector_current: quantity(10e-3, "A", "VCE = 5 V, pulse test", "p. 2 ON characteristics", "typical"), vce: quantity(5, "V", "IC = 10 mA", "p. 2 ON characteristics", "typical"), hfe: quantity(300, "1", "IC = 10 mA, VCE = 5 V", "p. 2 hFE MIN column", "minimum"), vbe: quantity(0.8, "V", "IC = 10 mA, VCE = 5 V", "p. 2 VBE(on) MAX column", "maximum") }
      ],
      saturation_points: [{ collector_current: quantity(0.01, "A", "IB = 1 mA", "p. 2 ON characteristics", "typical"), base_current: quantity(0.001, "A", "IC = 10 mA", "p. 2 ON characteristics", "typical"), vce_sat: quantity(0.5, "V", "IC = 10 mA, IB = 1 mA", "p. 2 VCE(sat) MAX column", "maximum"), vbe_sat: quantity(0.8, "V", "conservative bound from VBE(on) at IC = 10 mA", "p. 2 VBE(on) MAX column", "maximum") }],
      capacitances: { cobo: quantity(4e-12, "F", "VCB = 5 V, IE = 0, f = 100 kHz", "p. 2 Ccb MAX column", "maximum"), cobo_vcb: quantity(5, "V", "Ccb test bias", "p. 2 Ccb row", "typical"), cibo: quantity(10e-12, "F", "VBE = 0.5 V, IC = 0, f = 100 kHz", "p. 2 Ceb MAX column", "maximum"), cibo_veb: quantity(0.5, "V", "Ceb test bias", "p. 2 Ceb row", "typical") },
      frequency_response: { ft: quantity(50e6, "Hz", "IC = 500 uA, VCE = 5 V, ftest = 20 MHz", "p. 2 fT MIN column", "minimum"), ic: quantity(500e-6, "A", "fT test current", "p. 2 fT row", "typical"), vce: quantity(5, "V", "fT test voltage", "p. 2 fT row", "typical") },
      electrical_limits: { vceo: quantity(30, "V", "IB = 0", "p. 1 absolute maximum ratings", "maximum"), collector_current: quantity(0.1, "A", "continuous", "p. 1 absolute maximum ratings", "maximum") }
    },
    component: {
      modelName: "OC_ONSEMI_2N5088", fidelity_tier: "F1", domain_coverage: { dc: "approx", ac: "approx", transient: "approx", noise: "none", thermal: "none", digital: "none" }, supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "F1 guaranteed-bound model at 25 degC from 100 uA to 10 mA. Published hFE minima and voltage maxima are enforced as bounds.",
      numeric_bounds: [{ quantity: "collector_current", minimum: 100e-6, maximum: 0.01, unit: "A", conditions: "Table-constrained fitted region", placeholder: false }, { quantity: "collector_emitter_voltage", minimum: 0, maximum: 30, unit: "V", conditions: "Rated VCEO; breakdown omitted", placeholder: false }],
      omissions: ["The source provides guaranteed hFE minima and voltage maxima rather than a complete typical DC curve, so fidelity is capped at F1.", "The published noise figure is metadata only; flicker and broadband noise are not modelled.", "VAF, junction grading, reverse operation, temperature coefficients, process spread, self-heating, breakdown, and package parasitics are not fitted.", "VBE(on) is reused only as a conservative VBE(sat) upper bound at the same collector current; no typical saturation base voltage is claimed.", "Independent review remains pending-review."]
    }
  },
  LM35: {
    slug: "LM35", manufacturerSlug: "ti", pipeline: "sensor_behavioral",
    identity: {
      canonical_mpn: "LM35", manufacturer: "Texas Instruments", description: "Precision centigrade temperature sensor with 10 mV/degC analog output", electrical_family: "other", aliases: ["LM35A", "LM35C", "LM35CA", "LM35D"],
      package: { name: "TO-92", standard: "TI LP package" },
      pins: [{ name: "+VS", number: "1", role: "positive_supply", node: "supply" }, { name: "VOUT", number: "2", role: "output", node: "output" }, { name: "GND", number: "3", role: "ground", node: "ground" }], spice_order: ["1", "2", "3"]
    },
    source: { url: "https://www.ti.com/lit/ds/symlink/lm35.pdf", revision: "SNIS159H, August 1999, revised December 2017", pages: ["p. 1", "p. 4", "p. 5"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual table transcription with MIN/TYP/MAX semantics", sensor_variant: "linear_voltage",
      fit_conditions: { temperature: quantity(25, "degC", "VS = 5 V, ILOAD = 50 uA unless stated", "p. 5 section 6.5 heading", "typical") },
      transfer_points: [2, 25, 150].map((temperature) => ({
        environment: quantity(temperature, "degC", "caller-supplied case temperature", "p. 1 features and description", "datasheet_equation"),
        electrical: quantity(0.010 * temperature, "V", `10 mV/degC ideal transfer at ${temperature} degC`, "p. 1 linear 10-mV/degC scale factor; p. 5 sensor gain", "derived_from_datasheet_equation")
      })),
      parameters: {
        scale: quantity(0.010, "V/degC", "average slope over rated range", "p. 5 sensor gain TYP column", "typical"),
        offset: quantity(0, "V", "ideal centigrade intercept", "p. 1 output directly proportional to centigrade temperature", "datasheet_equation"),
        output_resistance: quantity(0.5, "ohm", "derived from 0.5 mV/mA typical load regulation", "p. 5 load regulation TYP column", "derived_model_input"),
        quiescent_current: quantity(56e-6, "A", "VS = 5 V, TA = 25 degC", "p. 5 quiescent current TYP column", "typical"),
        supply_headroom: quantity(2.5, "V", "conservative 4 V minimum supply minus 1.5 V output at 150 degC", "p. 4 recommended supply; p. 1 temperature range and transfer scale", "derived_model_input"),
        supply_minimum: quantity(4, "V", "recommended operating condition", "p. 4 section 6.3 MIN column", "minimum"),
        supply_maximum: quantity(30, "V", "recommended operating condition", "p. 4 section 6.3 MAX column", "maximum"),
        accuracy_25c: quantity(0.2, "degC", "TA = 25 degC", "p. 5 accuracy TYP column", "typical")
      }
    },
    component: sensorComponent({ modelName: "OC_TI_LM35", fidelity: "F1", summary: "F1 transfer-equation model from 2 degC to 150 degC at 4 V to 30 V. TEMP_C is an explicit caller-supplied subcircuit parameter.", bounds: [
      { quantity: "temperature", minimum: 2, maximum: 150, unit: "degC", conditions: "Basic positive-supply circuit; below 2 degC requires the datasheet full-range bias circuit", placeholder: false },
      { quantity: "supply_voltage", minimum: 4, maximum: 30, unit: "V", conditions: "Recommended operating range", placeholder: false }
    ], omissions: ["TEMP_C is caller supplied; package heat flow and thermal gradients are not simulated.", "The 10 mV/degC nominal transfer is modelled, but the accuracy, nonlinearity, manufacturing spread, long-term drift, and temperature-dependent quiescent current are metadata only.", "Response time and output capacitance stability are not modelled.", "The basic positive-supply model is limited to 2 degC and above; the external resistor and negative supply required below 2 degC are not internalised."], dc: "approx" })
  },
  NTCLE100E3103JB0: {
    slug: "NTCLE100E3103JB0", manufacturerSlug: "vishay", pipeline: "sensor_behavioral",
    identity: {
      canonical_mpn: "NTCLE100E3103JB0", manufacturer: "Vishay BCcomponents", description: "10 kohm radial-leaded NTC thermistor, 5 percent R25 tolerance", electrical_family: "other", aliases: [],
      package: { name: "radial leaded bead", standard: "Vishay NTCLE100E3" },
      pins: [{ name: "1", number: "1", role: "terminal", node: "positive" }, { name: "2", number: "2", role: "terminal", node: "negative" }], spice_order: ["1", "2"]
    },
    source: { url: "https://www.vishay.com/docs/29049/ntcle100.pdf", revision: "Document 29049, revision 07-May-2025", pages: ["p. 2", "p. 10"], identifiers: ["NTCLE100E3103***", "NTCLE100E3"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual table transcription", sensor_variant: "beta_ntc",
      fit_conditions: { temperature: quantity(25, "degC", "R25 reference condition", "p. 2 electrical data table", "typical") },
      transfer_points: [
        { environment: quantity(-40, "degC", "zero-power resistance table", "p. 10 NTCLE100E3103 resistance column", "typical_table"), electrical: quantity(332094, "ohm", "zero-power resistance at -40 degC", "p. 10 NTCLE100E3103 resistance column", "typical_table") },
        { environment: quantity(25, "degC", "R25 reference", "p. 10 NTCLE100E3103 resistance column", "typical_table"), electrical: quantity(10000, "ohm", "zero-power resistance at 25 degC", "p. 10 NTCLE100E3103 resistance column", "typical_table") },
        { environment: quantity(85, "degC", "zero-power resistance table", "p. 10 NTCLE100E3103 resistance column", "typical_table"), electrical: quantity(1070, "ohm", "zero-power resistance at 85 degC", "p. 10 NTCLE100E3103 resistance column", "typical_table") }
      ],
      parameters: {
        nominal_resistance: quantity(10000, "ohm", "at 25 degC", "p. 2 R25 table, 103 row", "typical"),
        reference_temperature: quantity(25, "degC", "R25 reference", "p. 2 R25 table heading", "typical"),
        beta: quantity(3977, "K", "B25/85", "p. 2 B25/85 table, 103 row", "typical"),
        resistance_tolerance: quantity(5, "%", "ordering-code J tolerance", "p. 1 tolerance range and part-number structure", "maximum"),
        beta_tolerance: quantity(0.75, "%", "B25/85", "p. 2 B25/85 tolerance, 103 row", "maximum")
      }
    },
    component: sensorComponent({ modelName: "OC_VISHAY_NTCLE100E3103JB0", fidelity: "F1", summary: "F1 native-fitted single-Beta resistance model from -40 degC to 85 degC, checked against the manufacturer resistance table.", bounds: [
      { quantity: "temperature", minimum: -40, maximum: 85, unit: "degC", conditions: "B25/85 model validation interval", placeholder: false },
      { quantity: "dissipated_power", minimum: 0, maximum: 0.001, unit: "W", conditions: "Validation benches use 1 uA to keep self-heating negligible", placeholder: false }
    ], omissions: ["TEMP_C is caller supplied and self-heating is not simulated.", "A single B-parameter law does not reproduce the full manufacturer polynomial even within the -40 degC to 85 degC interval; the worst table residual is about 15 percent, so the package is capped at F1 and the resistance checks use a documented 16 percent tolerance.", "R25 and B tolerance, dissipation factor, thermal time constant, lead conduction, ageing, and humidity effects are metadata only."] })
  },
  GL5528: {
    slug: "GL5528", manufacturerSlug: "senba", pipeline: "sensor_behavioral",
    identity: {
      canonical_mpn: "GL5528", manufacturer: "Nanyang Senba Optical & Electronic Co., Ltd.", description: "GL55-series cadmium-sulfide light-dependent resistor", electrical_family: "other", aliases: [],
      package: { name: "5 mm epoxy photoresistor", standard: "GL55 series radial" },
      pins: [{ name: "1", number: "1", role: "terminal", node: "positive" }, { name: "2", number: "2", role: "terminal", node: "negative" }], spice_order: ["1", "2"]
    },
    source: { url: "https://cdn.sparkfun.com/datasheets/Sensors/LightImaging/SEN-09088.pdf", revision: "GL5528.xls source sheet, created 25-Apr-2007; reputable SparkFun mirror", pages: ["p. 1"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "OCR of image-only manufacturer source sheet mirrored by SparkFun; bounds and gamma semantics preserved", sensor_variant: "power_ldr",
      fit_conditions: { temperature: quantity(25, "degC", "10 lux standard light A after specified pre-illumination", "p. 1 measuring conditions", "typical") },
      transfer_points: [
        { environment: quantity(10, "lux", "standard light A, 2854 K, after 2 h pre-illumination", "p. 1 measuring conditions", "typical"), electrical: quantity(20000, "ohm", "published 8 kohm to 20 kohm light-resistance range; maximum selected conservatively", "p. 1 light resistance at 10 lux", "maximum") },
        { environment: quantity(100, "lux", "derived from published 10-to-100 lux gamma definition", "p. 1 gamma characteristic", "derived_model_input"), electrical: quantity(3990.52462993776, "ohm", "derived from 20 kohm at 10 lux and gamma 0.7", "p. 1 gamma definition and 10 lux maximum", "derived_model_input") }
      ],
      parameters: {
        resistance_10lux_minimum: quantity(8000, "ohm", "10 lux at 25 degC", "p. 1 light resistance", "minimum"),
        resistance_10lux_maximum: quantity(20000, "ohm", "10 lux at 25 degC", "p. 1 light resistance", "maximum"),
        dark_resistance_minimum: quantity(1e6, "ohm", "0 lux, measured 10 seconds after pulsed 10 lux", "p. 1 dark resistance and measuring conditions", "minimum"),
        gamma: quantity(0.7, "1", "100 lux to 10 lux", "p. 1 gamma value and definition", "typical"),
        lux_floor: quantity(0.001, "lux", "numerical floor below supported region", "archetype-sensor-behavioral.md section 2.3", "held_default"),
        maximum_voltage: quantity(150, "V", "darkness at 25 degC", "p. 1 maximum voltage", "maximum"),
        maximum_power: quantity(0.1, "W", "TA = 25 degC", "p. 1 power dissipation", "maximum")
      }
    },
    component: sensorComponent({ modelName: "OC_SENBA_GL5528", fidelity: "F1", summary: "F1 conservative power-law LDR model over 10 lux to 100 lux. LUX is an explicit caller-supplied subcircuit parameter.", bounds: [
      { quantity: "illuminance", minimum: 10, maximum: 100, unit: "lux", conditions: "Published gamma interval", placeholder: false },
      { quantity: "terminal_voltage", minimum: 0, maximum: 150, unit: "V", conditions: "Published maximum in darkness; failure not modelled", placeholder: false },
      { quantity: "dissipated_power", minimum: 0, maximum: 0.1, unit: "W", conditions: "Published maximum at 25 degC; self-heating not modelled", placeholder: false }
    ], omissions: ["The source sheet is image-only and is accessed through a reputable SparkFun mirror; manufacturer provenance is retained but fidelity is capped at F1.", "The published 8 kohm to 20 kohm range at 10 lux is a production bound, not a typical value. The model selects the 20 kohm maximum conservatively and claims no typical unit.", "LUX is caller supplied. Optical geometry, source spectrum, spectral response, hysteresis, memory, rise/fall dynamics, temperature coefficient, and ageing are not modelled.", "Dark resistance is a minimum bound and is not used as a continuous-curve target outside the published 10-to-100 lux gamma interval."] , dc: "approx" })
  }
});

export function getPart(mpn) {
  const key = Object.keys(PARTS).find((candidate) => candidate.toLowerCase() === String(mpn).toLowerCase());
  if (!key) throw new Error(`Unsupported MPN: ${mpn}. Supported: ${Object.keys(PARTS).join(", ")}`);
  return PARTS[key];
}
