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
      pages: ["p. 15", "p. 16", "p. 21", "p. 23"]
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
        output_swing: quantity(10, "V", "RL >= 2 kohm, VS = +/-15 V", "p. 15 electrical characteristics", "minimum"),
        ilim: quantity(40e-3, "A", "Short-circuit current at 25 degC, digitized classic-device curve", "p. 23 fig. 5-34", "digitized_typical_curve"),
        cmrr_db: quantity(100, "dB", "VIC = VICR(min), VO = 0", "p. 15 electrical characteristics", "typical"),
        psrr_db: quantity(100, "dB", "VS = +/-9 V to +/-18 V, VO = 0", "p. 15 electrical characteristics", "typical"),
        iq: quantity(1.4e-3, "A", "Per amplifier, VO = 0, no load", "p. 15 electrical characteristics", "typical"),
        en: quantity(37e-9, "V/sqrt(Hz)", "f = 1 kHz, all other devices", "p. 16 electrical characteristics", "typical"),
        phase_margin: quantity(56, "deg", "G = +1, RL = 10 kohm, CL = 20 pF", "p. 16 electrical characteristics", "typical"),
        rout: quantity(125, "ohm", "f = 1 MHz, IO = 0", "p. 16 electrical characteristics", "typical"),
        supply_positive: quantity(15, "V", "Electrical characteristics test supply", "p. 15 section 5.8 heading"),
        supply_negative: quantity(-15, "V", "Electrical characteristics test supply", "p. 15 section 5.8 heading")
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
        "The frequency response is a two-pole approximation above the unity-gain frequency.",
        "Only broadband input voltage noise is modelled; flicker and current noise are omitted.",
        "No self-heating or temperature coefficients are modelled.",
        "Input offset uses the datasheet typical and does not represent production spread."
      ]
    }
  }
};

export function getPart(mpn) {
  const key = Object.keys(PARTS).find((candidate) => candidate.toLowerCase() === String(mpn).toLowerCase());
  if (!key) throw new Error(`Unsupported MPN: ${mpn}. Supported: ${Object.keys(PARTS).join(", ")}`);
  return PARTS[key];
}
