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

const vdmosCitation = (pageReference, kind, label) => ({
  page_reference: pageReference,
  locator: { kind, label }
});

const vdmosQualifiers = ({ testMode, pulseWidthMaximum, dutyCycleMaximum, pageReference }) => ({
  test_mode: testMode,
  tokens: [
    testMode,
    ...(pulseWidthMaximum === undefined ? [] : [`pulse_width_maximum=${pulseWidthMaximum}s`]),
    ...(dutyCycleMaximum === undefined ? [] : [`duty_cycle_maximum=${dutyCycleMaximum}`])
  ],
  ...(pulseWidthMaximum === undefined ? {} : { pulse_width_maximum: quantity(pulseWidthMaximum, "s", "published pulse-width qualifier", pageReference, "condition_identity") }),
  ...(dutyCycleMaximum === undefined ? {} : { duty_cycle_maximum: quantity(dutyCycleMaximum, "1", "published duty-cycle qualifier", pageReference, "condition_identity") })
});

const vdmosIdentityCoordinate = (coordinate, name, citation) => Object.hasOwn(coordinate, "value") ? {
  ...coordinate,
  conditions: `${name} in canonical condition identity`,
  page_reference: citation.page_reference,
  source_kind: "condition_identity"
} : coordinate;

const vdmosIdentity = ({ temperatureKind = "junction", temperature = 25, vgs, current, vds, qualifiers, citation, evidenceRole }) => ({
  temperature: {
    kind: temperatureKind,
    ...quantity(temperature, "degC", "temperature in canonical condition identity", citation.page_reference, "condition_identity")
  },
  gate_source_voltage: vdmosIdentityCoordinate(vgs, "VGS", citation),
  drain_current: vdmosIdentityCoordinate(current, "ID", citation),
  drain_source_voltage: vdmosIdentityCoordinate(vds, "VDS", citation),
  qualifiers,
  citation,
  evidence_role: evidenceRole
});

const vdmosDatum = (value, unit, conditions, pageReference, sourceKind, identity) => ({
  ...quantity(value, unit, conditions, pageReference, sourceKind),
  identity
});

const vdmosThreshold = ({ minimum, maximum, pageReference = "p. 2 electrical characteristics" }) => {
  const citation = vdmosCitation(pageReference, "table_row", "VGS(th), gate threshold voltage");
  const base = {
    vgs: { kind: "swept" },
    current: { kind: "fixed", value: 250e-6, unit: "A" },
    vds: { kind: "equal_to_gate_source_voltage" },
    qualifiers: vdmosQualifiers({ testMode: "electrical_characteristic", pageReference }),
    citation
  };
  return {
    minimum: vdmosDatum(minimum, "V", "VDS = VGS, ID = 250 uA", pageReference, "minimum", vdmosIdentity({ ...base, evidenceRole: "inclusive_minimum" })),
    maximum: vdmosDatum(maximum, "V", "VDS = VGS, ID = 250 uA", pageReference, "maximum", vdmosIdentity({ ...base, evidenceRole: "inclusive_maximum" }))
  };
};

const vdmosRdsonPoint = ({ vgs, current, resistance, pulseWidthMaximum, dutyCycleMaximum, pageReference, resistancePageReference = pageReference }) => {
  const identity = vdmosIdentity({
    vgs: { kind: "fixed", value: vgs, unit: "V" },
    current: { kind: "fixed", value: current, unit: "A" },
    vds: { kind: "measured_result" },
    qualifiers: vdmosQualifiers({ testMode: "pulse", pulseWidthMaximum, dutyCycleMaximum, pageReference: resistancePageReference }),
    citation: vdmosCitation(resistancePageReference, "table_row", "RDS(on), static drain-source on-resistance"),
    evidenceRole: "inclusive_maximum"
  });
  return {
    vgs: vdmosDatum(vgs, "V", `ID = ${current} A`, pageReference, "typical", identity),
    current: vdmosDatum(current, "A", `VGS = ${vgs} V`, pageReference, "typical", identity),
    resistance: vdmosDatum(resistance, "ohm", `VGS = ${vgs} V, ID = ${current} A`, resistancePageReference, "maximum", identity)
  };
};

const vdmosTransferCurve = ({ curveId, points, vds, pulseWidthMaximum, pageReference, currentPageReference = pageReference }) => {
  const citationIdentity = vdmosCitation(pageReference, "figure", "Fig. 3, typical transfer characteristics");
  const conditionIdentity = vdmosIdentity({
    vgs: { kind: "range", minimum: Math.min(...points.map(([vgs]) => vgs)), maximum: Math.max(...points.map(([vgs]) => vgs)), unit: "V" },
    current: { kind: "range", minimum: Math.min(...points.map(([, current]) => current)), maximum: Math.max(...points.map(([, current]) => current)), unit: "A" },
    vds: { kind: "fixed", value: vds, unit: "V" },
    qualifiers: vdmosQualifiers({ testMode: "pulse", pulseWidthMaximum, pageReference }),
    citation: citationIdentity,
    evidenceRole: "curve_cohort"
  });
  return {
    curve_id: curveId,
    characteristic: "transfer",
    x_axis: { quantity: "vgs", unit: "V" },
    y_axis: { quantity: "id", unit: "A" },
    condition_identity: conditionIdentity,
    citation_identity: citationIdentity,
    points: points.map(([vgs, current], pointIndex) => ({
      x_si: vgs,
      y_si: current,
      point_index: pointIndex,
      evidence_identity: {
        curve_id: curveId,
        condition_identity: conditionIdentity,
        citation_identity: { ...citationIdentity, page_reference: currentPageReference },
        evidence_role: "curve_point",
        source_kind: "digitized_typical_curve"
      }
    }))
  };
};

const vdmosOutputCurves = ({ curveIdPrefix, points, pulseWidthMaximum, pageReference, currentPageReference = pageReference }) => points.map(([vgs, vds, current]) => {
  const curveId = `${curveIdPrefix}.vgs-${String(vgs).replace(".", "p")}`;
  const citationIdentity = vdmosCitation(pageReference, "figure", "Fig. 1, typical output characteristics");
  const conditionIdentity = vdmosIdentity({
    vgs: { kind: "fixed", value: vgs, unit: "V" },
    current: { kind: "range", minimum: 0, maximum: current, unit: "A" },
    vds: { kind: "range", minimum: 0, maximum: vds, unit: "V" },
    qualifiers: vdmosQualifiers({ testMode: "pulse", pulseWidthMaximum, pageReference }),
    citation: citationIdentity,
    evidenceRole: "curve_cohort"
  });
  return {
    curve_id: curveId,
    characteristic: "output",
    x_axis: { quantity: "vds", unit: "V" },
    y_axis: { quantity: "id", unit: "A" },
    condition_identity: conditionIdentity,
    citation_identity: citationIdentity,
    points: [{
      x_si: vds,
      y_si: current,
      point_index: 0,
      evidence_identity: {
        curve_id: curveId,
        condition_identity: conditionIdentity,
        citation_identity: { ...citationIdentity, page_reference: currentPageReference },
        evidence_role: "curve_point",
        source_kind: "digitized_typical_curve"
      }
    }]
  };
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
      evidence_contract_version: "1.0.0",
      extraction_method: "pdftotext plus manual structuring and curve digitization",
      fit_conditions: { temperature: quantity(25, "degC", "Electrical characteristics unless stated", "p. 2 heading") },
      threshold: vdmosThreshold({ minimum: 1.0, maximum: 2.0 }),
      transfer_curves: [vdmosTransferCurve({
        curveId: "irlz44n.transfer.tj25-vds25",
        vds: 25,
        pulseWidthMaximum: 20e-6,
        pageReference: "p. 3 fig. 3",
        currentPageReference: "p. 3 fig. 3, digitized",
        points: [[2.5, 5], [3.0, 20], [3.5, 40], [4.0, 60], [5.0, 95], [6.0, 125]]
      })],
      rdson_points: [
        vdmosRdsonPoint({ vgs: 10, current: 25, resistance: 0.022, pulseWidthMaximum: 300e-6, dutyCycleMaximum: 0.02, pageReference: "p. 2 electrical characteristics" }),
        vdmosRdsonPoint({ vgs: 5, current: 25, resistance: 0.025, pulseWidthMaximum: 300e-6, dutyCycleMaximum: 0.02, pageReference: "p. 2 electrical characteristics" }),
        vdmosRdsonPoint({ vgs: 4, current: 21, resistance: 0.035, pulseWidthMaximum: 300e-6, dutyCycleMaximum: 0.02, pageReference: "p. 2 electrical characteristics" })
      ],
      output_curves: vdmosOutputCurves({
        curveIdPrefix: "irlz44n.output.tj25",
        pulseWidthMaximum: 20e-6,
        pageReference: "p. 3 fig. 1",
        currentPageReference: "p. 3 fig. 1, digitized",
        points: [[2.5, 10, 5], [3.0, 10, 20], [4.0, 10, 60]]
      }),
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
        { environment: quantity(25, "degC", "R25 reference, lower end of the cited B25/85 interval", "p. 10 NTCLE100E3103 resistance column", "typical_table"), electrical: quantity(10000, "ohm", "zero-power resistance at 25 degC", "p. 10 NTCLE100E3103 resistance column", "typical_table") },
        { environment: quantity(55, "degC", "mid-interval zero-power resistance table row", "p. 10 NTCLE100E3103 resistance column", "typical_table"), electrical: quantity(2989, "ohm", "zero-power resistance at 55 degC", "p. 10 NTCLE100E3103 resistance column", "typical_table") },
        { environment: quantity(85, "degC", "upper end of the cited B25/85 interval", "p. 10 NTCLE100E3103 resistance column", "typical_table"), electrical: quantity(1070, "ohm", "zero-power resistance at 85 degC", "p. 10 NTCLE100E3103 resistance column", "typical_table") }
      ],
      parameters: {
        nominal_resistance: quantity(10000, "ohm", "R25 at 25 degC, transcribed without adjustment", "p. 2 electrical data and ordering information, 10 000 ohm R25 row", "typical"),
        reference_temperature: quantity(25, "degC", "R25 reference temperature, transcribed without adjustment", "p. 2 electrical data and ordering information, R25 column heading", "typical"),
        beta: quantity(3977, "K", "B25/85, transcribed without adjustment", "p. 2 electrical data and ordering information, B25/85 column of the 10 000 ohm row", "typical"),
        beta_interval_minimum: quantity(25, "degC", "lower temperature defining the cited B25/85 value", "p. 2 electrical data and ordering information, B25/85 column heading", "typical"),
        beta_interval_maximum: quantity(85, "degC", "upper temperature defining the cited B25/85 value", "p. 2 electrical data and ordering information, B25/85 column heading", "typical"),
        resistance_tolerance: quantity(5, "%", "ordering-code J tolerance on R25", "p. 2 electrical data and ordering information, 10 000 ohm R25-TOL column with note (1) J = 5 percent", "maximum"),
        beta_tolerance: quantity(0.75, "%", "B25/85 tolerance of the 10 000 ohm row", "p. 2 electrical data and ordering information, B25/85-TOL column of the 10 000 ohm row", "maximum"),
        operating_temperature_minimum: quantity(-40, "degC", "device rating at zero power dissipation, continuous; wider than the modelled region", "p. 1 quick reference data operating temperature range", "minimum"),
        operating_temperature_maximum: quantity(125, "degC", "device rating at zero power dissipation, continuous; wider than the modelled region", "p. 1 quick reference data operating temperature range", "maximum")
      }
    },
    component: sensorComponent({ modelName: "OC_VISHAY_NTCLE100E3103JB0", fidelity: "F1", summary: "F1 single-Beta resistance model over the cited B25/85 interval, 25 degC to 85 degC, with R0, T0_C, and BETA transcribed directly from the datasheet and checked against the manufacturer resistance table. TEMP_C is an explicit caller-supplied subcircuit parameter.", bounds: [
      { quantity: "temperature", minimum: 25, maximum: 85, unit: "degC", conditions: "Cited B25/85 interval; the single-Beta law is not claimed outside it", placeholder: false },
      { quantity: "dissipated_power", minimum: 0, maximum: 0.001, unit: "W", conditions: "Validation benches use 1 uA to keep self-heating negligible", placeholder: false }
    ], omissions: [
      "TEMP_C is caller supplied. Heat flow, self-heating, and the surrounding thermal environment are not simulated.",
      "R0, T0_C, and BETA are transcribed directly from the cited datasheet rows and no parameter is fitted, so the model tracks the manufacturer resistance table only as closely as a single B25/85 law allows.",
      "A single B-parameter law does not reproduce the full Steinhart-Hart curvature of the manufacturer resistance table outside the cited B25/85 interval. The supported region is therefore 25 degC to 85 degC even though the part is rated -40 degC to +125 degC and the resistance table is published from -40 degC to 150 degC.",
      "R25 tolerance, B25/85 tolerance, dissipation factor, thermal time constant, response time, lead conduction, mounting stress, ageing, humidity, and manufacturing spread are metadata only; no corner models are provided.",
      "Behaviour outside the cited environmental and electrical bounds is unsupported even though the behavioural expression returns a finite value.",
      "P5 independent review rejected the previous revision of this package because its shipped R0 = 9.5 kohm and BETA = 3947.1725 were fitted values, while the sensor archetype requires direct transcription of the cited 10 kohm R25 and 3977 K B25/85 facts.",
      "Refit 2026-08-09 in response to that rejection: R0 = 10 kohm, T0_C = 25 degC, and BETA = 3977 K are now transcribed verbatim from p. 2, the claimed region is narrowed to the cited B25/85 interval, and the benches are re-derived from the p. 10 resistance table at 25 degC, 55 degC, and 85 degC."
    ] })
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

const p5DiodeComponent = ({ modelName, summary, currentMax, reverseVoltage, omissions, ac = "approx", transient = "none" }) => ({
  modelName,
  fidelity_tier: "F1",
  domain_coverage: { dc: "approx", ac, transient, noise: "none", thermal: "none", digital: "none" },
  supported_analyses: ["operating_point", "dc_sweep", ...(ac !== "none" ? ["ac_small_signal"] : []), ...(transient !== "none" ? ["transient"] : [])],
  operating_summary: summary,
  numeric_bounds: [
    { quantity: "forward_current", minimum: 0, maximum: currentMax, unit: "A", conditions: "Published characterization or continuous-current envelope at 25 degC", placeholder: false },
    { quantity: "reverse_voltage", minimum: 0, maximum: reverseVoltage, unit: "V", conditions: "Published reverse-voltage envelope; failure is not simulated", placeholder: false },
    { quantity: "ambient_temperature", minimum: 25, maximum: 25, unit: "degC", conditions: "Model calibration temperature", placeholder: false }
  ],
  omissions: [...omissions, "Self-heating, process spread, package parasitics, ageing, and failure outside ratings are not modelled.", "Independent review remains pending-review."]
});

Object.assign(PARTS, {
  SS14: {
    slug: "SS14", manufacturerSlug: "onsemi",
    identity: { canonical_mpn: "SS14", manufacturer: "onsemi", description: "1 A, 40 V surface-mount Schottky rectifier", electrical_family: "diode", aliases: [], package: { name: "SMA", standard: "DO-214AC" } },
    source: { url: "https://components101.com/sites/default/files/component_datasheet/SS14%20Schottky%20Diode.PDF", revision: "SS12/D Rev. 3, July 2005; archived onsemi PDF mirror", pages: ["p. 1", "p. 2", "p. 3"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual MAX table transcription from an archived onsemi datasheet mirror",
      fit_conditions: { temperature: quantity(25, "degC", "TJ = 25 degC", "p. 2 electrical characteristics", "typical") },
      fit_points: [{ current: quantity(1, "A", "TJ = 25 degC, pulse width <= 250 us, duty cycle <= 2%", "p. 2 electrical characteristics", "typical"), voltage: quantity(0.47, "V", "IF = 1 A, TJ = 25 degC", "p. 2 maximum instantaneous forward voltage", "maximum") }],
      electrical_limits: { reverse_voltage: quantity(40, "V", "DC blocking voltage", "p. 2 maximum ratings", "maximum"), forward_current: quantity(1, "A", "TC = 120 degC", "p. 2 maximum ratings", "maximum"), reverse_current_40v: quantity(100e-6, "A", "VR = 40 V, TJ = 25 degC", "p. 2 electrical characteristics", "maximum") },
      derived_model_inputs: { N: quantity(1.1, "1", "Schottky single-bound numerical default", "model-factory F1 single-bound policy", "held_default"), RS: quantity(0.03, "ohm", "Schottky single-bound numerical default", "model-factory F1 single-bound policy", "held_default"), CJO: quantity(180e-12, "F", "VR = 0 V, TJ = 25 degC, digitized from capacitance curve", "p. 3 fig. 7", "digitized_typical_curve") }
    },
    component: p5DiodeComponent({ modelName: "OC_ONSEMI_SS14", summary: "F1 single-bound Schottky model at 25 degC. The guaranteed 1 A forward-voltage maximum is a hard bound, not a typical fit target.", currentMax: 1, reverseVoltage: 40, omissions: ["The source supplies one forward-voltage maximum and no complete numeric typical curve table, so N and RS are held physical defaults and fidelity is capped at F1.", "Reverse leakage and zero-bias capacitance are maximum or digitized values; reverse breakdown and temperature dependence are omitted."], ac: "approx" })
  },
  "1N5822": {
    slug: "1N5822", manufacturerSlug: "onsemi",
    identity: { canonical_mpn: "1N5822", manufacturer: "onsemi", description: "3 A, 40 V axial Schottky rectifier", electrical_family: "diode", aliases: ["1N5822G", "1N5822RL", "1N5822RLG"], package: { name: "axial lead", standard: "CASE 267-05" } },
    source: { url: "https://www.onsemi.com/download/data-sheet/pdf/1n5820-d.pdf", revision: "1N5820/D Rev. 11, November 2023", pages: ["p. 1", "p. 2", "p. 5", "p. 6"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual MAX table transcription",
      fit_conditions: { temperature: quantity(25, "degC", "TL = 25 degC unless stated", "p. 2 electrical characteristics heading", "typical") },
      fit_points: [[1, 0.390], [3, 0.525], [9.4, 0.950]].map(([current, voltage]) => ({ current: quantity(current, "A", "TL = 25 degC, 300 us pulse, 2% duty cycle", "p. 2 electrical characteristics", "typical"), voltage: quantity(voltage, "V", `IF = ${current} A, TL = 25 degC`, "p. 2 maximum instantaneous forward voltage, 1N5822 column", "maximum") })),
      electrical_limits: { reverse_voltage: quantity(40, "V", "DC blocking voltage", "p. 2 maximum ratings", "maximum"), forward_current: quantity(3, "A", "TL = 95 degC", "p. 2 maximum ratings", "maximum"), reverse_current_40v: quantity(2e-3, "A", "rated DC voltage, TL = 25 degC", "p. 2 electrical characteristics", "maximum") },
      derived_model_inputs: { CJO: quantity(700e-12, "F", "VR = 0 V, TJ = 25 degC, digitized", "p. 6 fig. 10, 1N5822 curve", "digitized_typical_curve") }
    },
    component: p5DiodeComponent({ modelName: "OC_ONSEMI_1N5822", summary: "F1 bound-constrained Schottky model over 1 A to 9.4 A at 25 degC.", currentMax: 9.4, reverseVoltage: 40, omissions: ["The fitted forward points are guaranteed maxima rather than a typical curve, so validation treats them as upper bounds and fidelity is capped at F1.", "Reverse breakdown, leakage temperature scaling, surge heating, and distributed junction capacitance are omitted."], ac: "approx" })
  },
  BAT85: {
    slug: "BAT85", manufacturerSlug: "vishay",
    identity: { canonical_mpn: "BAT85", manufacturer: "Vishay Semiconductors", description: "Small-signal Schottky diode", electrical_family: "diode", aliases: ["BAT85-TR", "BAT85-TAP"], package: { name: "DO-35", standard: "DO-204AH" } },
    source: { url: "https://datasheet.octopart.com/BAT85-Vishay-datasheet-28185.pdf", revision: "BAT85 Rev. 1.3, 31-Mar-2004; archived Vishay PDF mirror", pages: ["p. 1", "p. 2"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual MIN/TYP/MAX table transcription from an archived Vishay datasheet mirror",
      fit_conditions: { temperature: quantity(25, "degC", "Tamb = 25 degC", "p. 2 electrical characteristics heading", "typical") },
      fit_points: [[0.0001, 0.24, "maximum"], [0.001, 0.32, "maximum"], [0.01, 0.40, "maximum"], [0.03, 0.50, "typical"], [0.1, 0.80, "maximum"]].map(([current, voltage, kind]) => ({ current: quantity(current, "A", "Tamb = 25 degC, pulse test", "p. 2 electrical characteristics", "typical"), voltage: quantity(voltage, "V", `IF = ${current} A`, "p. 2 forward-voltage table", kind) })),
      electrical_limits: { reverse_voltage: quantity(30, "V", "IR = 10 uA pulsed", "p. 2 reverse breakdown voltage", "minimum"), forward_current: quantity(0.2, "A", "Tamb = 25 degC", "p. 1 absolute maximum ratings", "maximum"), reverse_current_25v: quantity(2e-6, "A", "VR = 25 V, Tamb = 25 degC", "p. 2 electrical characteristics", "maximum") },
      derived_model_inputs: { CJO: quantity(10e-12, "F", "VR = 1 V, f = 1 MHz", "p. 2 diode capacitance maximum", "maximum") },
      switching_metadata: { reverse_recovery_time: quantity(5e-9, "s", "IF = 10 mA, IR = 10 mA, Irr = 1 mA", "p. 2 reverse recovery maximum", "maximum") }
    },
    component: p5DiodeComponent({ modelName: "OC_VISHAY_BAT85", summary: "F1 mixed table model from 0.1 mA to 100 mA at 25 degC.", currentMax: 0.1, reverseVoltage: 30, omissions: ["Only the 30 mA forward-voltage row is typical; the other fitted rows are maxima and remain hard bounds, so fidelity is capped at F1.", "CJO uses a single maximum specification; C-V shape is not fitted. The 5 ns reverse-recovery maximum is retained as metadata but not mapped to TT because the generic charge-storage bench does not represent Schottky recovery.", "Reverse breakdown is not modelled from the 30 V minimum rating."], ac: "approx", transient: "none" })
  },
  BZX84C5V1: {
    slug: "BZX84C5V1", manufacturerSlug: "onsemi",
    identity: { canonical_mpn: "BZX84C5V1", manufacturer: "onsemi", description: "5.1 V, 250 mW surface-mount Zener diode", electrical_family: "diode", aliases: ["BZX84C5V1LT1G", "BZX84C5V1LT3G"], package: { name: "SOT-23", standard: "CASE 318", pin_count: 3 }, pins: [{ name: "A", number: "1", role: "anode", node: "anode" }, { name: "K", number: "3", role: "cathode", node: "cathode" }], spice_order: ["1", "3"] },
    source: { url: "https://www.onsemi.com/pdf/datasheet/bzx84c2v4lt1-d.pdf", revision: "BZX84C2V4LT1/D Rev. 23, August 2021", pages: ["p. 1", "p. 2", "p. 5"] },
    facts: {
      schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual MIN/MAX table transcription and forward family-curve digitization",
      fit_conditions: { temperature: quantity(25, "degC", "TA = 25 degC unless stated", "p. 2 electrical characteristics heading", "typical") },
      fit_points: [[0.001, 0.68], [0.01, 0.75], [0.1, 0.84], [0.5, 0.95]].map(([current, voltage]) => ({ current: quantity(current, "A", "TA = 25 degC", "p. 5 fig. 4, 25 degC family curve", "typical"), voltage: quantity(voltage, "V", `IF = ${current} A, TA = 25 degC`, "p. 5 fig. 4, manually digitized 25 degC family curve", "digitized_typical_curve") })),
      zener_points: [
        { current: quantity(1e-3, "A", "reverse Zener test current", "p. 2 BZX84C5V1 row", "typical"), voltage_minimum: quantity(4.2, "V", "IZT2 = 1 mA", "p. 2 BZX84C5V1 VZ2 MIN", "minimum"), voltage_maximum: quantity(5.3, "V", "IZT2 = 1 mA", "p. 2 BZX84C5V1 VZ2 MAX", "maximum") },
        { current: quantity(5e-3, "A", "reverse Zener test current", "p. 2 BZX84C5V1 row", "typical"), voltage_minimum: quantity(4.8, "V", "IZT1 = 5 mA", "p. 2 BZX84C5V1 VZ1 MIN", "minimum"), voltage_maximum: quantity(5.4, "V", "IZT1 = 5 mA", "p. 2 BZX84C5V1 VZ1 MAX", "maximum") },
        { current: quantity(20e-3, "A", "reverse Zener test current", "p. 2 BZX84C5V1 row", "typical"), voltage_minimum: quantity(5.0, "V", "IZT3 = 20 mA", "p. 2 BZX84C5V1 VZ3 MIN", "minimum"), voltage_maximum: quantity(5.9, "V", "IZT3 = 20 mA", "p. 2 BZX84C5V1 VZ3 MAX", "maximum") }
      ],
      electrical_limits: { reverse_current_2v: quantity(2e-6, "A", "VR = 2 V", "p. 2 BZX84C5V1 maximum reverse leakage", "maximum"), forward_voltage_10ma: quantity(0.9, "V", "IF = 10 mA", "p. 2 series heading", "maximum") },
      derived_model_inputs: { BV: quantity(5.1, "V", "nominal VZ at IZT = 5 mA", "p. 2 BZX84C5V1 VZ1 NOM", "typical"), IBV: quantity(5e-3, "A", "nominal Zener test current", "p. 2 BZX84C5V1 IZT1", "typical"), NBV: quantity(1, "1", "first-order avalanche-knee default; table bounds validated separately", "model-factory Zener F1 policy", "held_default"), CJO: quantity(225e-12, "F", "VR = 0 V, f = 1 MHz", "p. 2 BZX84C5V1 capacitance maximum", "maximum") }
    },
    component: p5DiodeComponent({ modelName: "OC_ONSEMI_BZX84C5V1", summary: "F1 Zener model with forward family-curve fit and reverse-voltage table bounds at 1 mA, 5 mA, and 20 mA.", currentMax: 0.5, reverseVoltage: 5.9, omissions: ["The forward curve is a family-level typical curve, not a device-specific BZX84C5V1 trace, and the reverse knee is constrained by MIN/MAX table windows, so fidelity is capped at F1.", "NBV is held at a first-order default. Dynamic impedance, temperature coefficient, surge behavior, noise, and statistical Zener-voltage tolerance are not continuously modelled.", "Package pin 2 is no-connect and is represented only by the three-pin package metadata; the electrical SPICE model has anode and cathode terminals."], ac: "approx" })
  }
});

const p5Opamp = ({ mpn, description, aliases, packageName, packageStandard, pins, spiceOrder, sourceUrl, revision, pages, aol, gbw, sr, vos, vosMax, ibias, ios, swing, ilim, cmrr, psrr, iq, en, phaseMargin, rout, supplyMin, supplyMax, channels }) => ({
  slug: mpn, manufacturerSlug: "ti", pipeline: "opamp",
  identity: { canonical_mpn: mpn, manufacturer: "Texas Instruments", description, electrical_family: "opamp", aliases, package: { name: packageName, standard: packageStandard }, pins, spice_order: spiceOrder },
  source: { url: sourceUrl, revision, pages },
  facts: {
    schema_version: "1.0.0", extraction_method: "pdftotext -layout plus manual MIN/TYP/MAX electrical-table transcription",
    fit_conditions: { temperature: quantity(25, "degC", "VS = +/-15 V unless stated", `${pages[0]} electrical characteristics heading`, "typical") },
    parameters: {
      aol: quantity(aol, "V/V", "VO in linear region, VS = +/-15 V", `${pages[0]} open-loop gain TYP`, "typical"), gbw: quantity(gbw, "Hz", "25 degC", `${pages[1]} AC characteristics`, "typical"), sr: quantity(sr, "V/s", "unity-gain large-signal test", `${pages[1]} slew-rate TYP`, "typical"),
      vos: quantity(vos, "V", "VO = 0, 25 degC", `${pages[0]} input offset TYP`, "typical"), vos_max: quantity(vosMax, "V", "VO = 0, 25 degC", `${pages[0]} input offset MAX`, "maximum"), ibias: quantity(ibias, "A", "VO = 0, 25 degC", `${pages[0]} input bias TYP`, "typical"), ios: quantity(ios, "A", "VO = 0, 25 degC", `${pages[0]} input offset current TYP`, "typical"),
      output_swing: { column_semantics: { minimum: { column: "MIN", published: true }, typical: { column: "TYP", published: true }, maximum: { column: "MAX", published: false, page_reference: `${pages[0]} output swing row`, source_kind: "not_published" } }, minimum_25c: quantity(Math.max(swing - 1.5, 0), "V", "RL as cited, VS = +/-15 V", `${pages[0]} output swing MIN`, "minimum"), typical_25c: quantity(swing, "V", "RL as cited, VS = +/-15 V", `${pages[0]} output swing TYP`, "typical") },
      ilim: quantity(ilim, "A", "output shorted to ground, 25 degC", `${pages[0]} short-circuit current`, "typical"), cmrr_db: quantity(cmrr, "dB", "25 degC", `${pages[0]} CMRR TYP`, "typical"), psrr_db: quantity(psrr, "dB", "25 degC", `${pages[0]} supply rejection TYP`, "typical"), iq: quantity(iq, "A", "per amplifier, VO = 0, no load", `${pages[0]} supply current TYP`, "typical"), en: quantity(en, "V/sqrt(Hz)", "f = 1 kHz", `${pages[1]} voltage-noise density`, "typical"), phase_margin: quantity(phaseMargin, "deg", "unity-gain or cited compensation", `${pages[1]} phase margin`, "typical"), rout: quantity(rout, "ohm", "published output impedance test frequency", `${pages[1]} output impedance`, "typical"),
      supply_positive: quantity(15, "V", "electrical-characteristics test supply", `${pages[0]} heading`, "typical"), supply_negative: quantity(-15, "V", "electrical-characteristics test supply", `${pages[0]} heading`, "typical"), supply_voltage_total: { minimum: quantity(supplyMin, "V", "recommended operating envelope", `${pages[2]} recommended conditions`, "minimum"), maximum: quantity(supplyMax, "V", "recommended operating envelope", `${pages[2]} recommended conditions`, "maximum") }
    }
  },
  component: {
    modelName: `OC_TI_${mpn}`, fidelity_tier: "F1", domain_coverage: { dc: "fitted", ac: "approx", transient: "approx", noise: "approx", thermal: "none", digital: "none" }, supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient", "noise"],
    operating_summary: `F1 table-constrained per-amplifier model at +/-15 V and 25 degC. The physical package contains ${channels} matched amplifier channel${channels === 1 ? "" : "s"}.`,
    numeric_bounds: [{ quantity: "supply_voltage_total", minimum: supplyMin, maximum: supplyMax, unit: "V", conditions: "Published operating envelope", placeholder: false }, { quantity: "input_offset_voltage", minimum: -vosMax, maximum: vosMax, unit: "V", conditions: "Published 25 degC maximum magnitude", placeholder: false }],
    omissions: ["The source values are principally TYP and guaranteed table rows rather than complete digitized transfer families, so fidelity is capped at F1.", "The package is represented as one reusable amplifier unit; inter-channel crosstalk, shared-supply interactions, unused channels, compensation/offset-null pins, and package parasitics are not modelled.", "PSRR and CMRR are frequency-independent; distortion, overload recovery, common-mode failure, protection behavior, current-noise density, flicker noise, self-heating, temperature coefficients, and production spread are omitted.", "The two-pole frequency response and slew limiter are compact approximations. Internal compensation capacitors and numerical resistors are held archetype defaults.", "Independent review remains pending-review."]
  }
});

Object.assign(PARTS, {
  TL084: p5Opamp({ mpn: "TL084", description: "Quad JFET-input operational amplifier", aliases: ["TL084C", "TL084CN", "TL084CD"], packageName: "PDIP-14", packageStandard: "TI N package", pins: [{ name: "IN+", number: "3", role: "noninverting_input", node: "inp" }, { name: "IN-", number: "2", role: "inverting_input", node: "inn" }, { name: "VCC", number: "4", role: "positive_supply", node: "vcc" }, { name: "VEE", number: "11", role: "negative_supply", node: "vee" }, { name: "OUT", number: "1", role: "output", node: "out" }], spiceOrder: ["3", "2", "4", "11", "1"], sourceUrl: "https://www.ti.com/lit/ds/symlink/tl084.pdf", revision: "SLOS081O, February 1977, revised September 2025", pages: ["p. 14", "p. 16", "p. 8"], aol: 200000, gbw: 5.25e6, sr: 20e6, vos: 3e-3, vosMax: 6e-3, ibias: 65e-12, ios: 5e-12, swing: 13.5, ilim: 40e-3, cmrr: 100, psrr: 100, iq: 1.4e-3, en: 37e-9, phaseMargin: 55, rout: 125, supplyMin: 7, supplyMax: 40, channels: 4 }),
  NE5534: p5Opamp({ mpn: "NE5534", description: "Low-noise high-speed single operational amplifier", aliases: ["NE5534A", "SA5534", "SA5534A"], packageName: "PDIP-8", packageStandard: "TI P package", pins: [{ name: "IN+", number: "3", role: "noninverting_input", node: "inp" }, { name: "IN-", number: "2", role: "inverting_input", node: "inn" }, { name: "VCC", number: "7", role: "positive_supply", node: "vcc" }, { name: "VEE", number: "4", role: "negative_supply", node: "vee" }, { name: "OUT", number: "6", role: "output", node: "out" }], spiceOrder: ["3", "2", "7", "4", "6"], sourceUrl: "https://www.ti.com/lit/ds/symlink/ne5534.pdf", revision: "SLOS070D, July 1979, revised November 2014", pages: ["p. 5", "p. 6", "p. 4"], aol: 100000, gbw: 10e6, sr: 13e6, vos: 0.5e-3, vosMax: 4e-3, ibias: 500e-9, ios: 20e-9, swing: 13, ilim: 38e-3, cmrr: 100, psrr: 100, iq: 4e-3, en: 4e-9, phaseMargin: 60, rout: 0.3, supplyMin: 6, supplyMax: 40, channels: 1 }),
  LM833: p5Opamp({ mpn: "LM833", description: "Dual low-noise audio operational amplifier", aliases: ["LM833N", "LM833D"], packageName: "PDIP-8", packageStandard: "TI P package", pins: [{ name: "IN+", number: "3", role: "noninverting_input", node: "inp" }, { name: "IN-", number: "2", role: "inverting_input", node: "inn" }, { name: "VCC", number: "8", role: "positive_supply", node: "vcc" }, { name: "VEE", number: "4", role: "negative_supply", node: "vee" }, { name: "OUT", number: "1", role: "output", node: "out" }], spiceOrder: ["3", "2", "8", "4", "1"], sourceUrl: "https://www.ti.com/lit/ds/symlink/lm833.pdf", revision: "SLOS481B, July 2010, revised October 2014", pages: ["p. 5", "p. 6", "p. 4"], aol: 316227.766, gbw: 16e6, sr: 7e6, vos: 0.15e-3, vosMax: 2e-3, ibias: 300e-9, ios: 25e-9, swing: 14.1, ilim: 33e-3, cmrr: 100, psrr: 105, iq: 2.05e-3, en: 4.5e-9, phaseMargin: 55, rout: 37, supplyMin: 10, supplyMax: 36, channels: 2 })
});

Object.assign(PARTS, {
  LM386: {
    slug: "LM386", manufacturerSlug: "ti", pipeline: "specialty_analog",
    identity: {
      canonical_mpn: "LM386", manufacturer: "Texas Instruments", description: "Low-voltage audio power amplifier", electrical_family: "other", aliases: ["LM386N-1", "LM386N-3", "LM386M-1", "LM386MMX-1"], package: { name: "PDIP-8", standard: "TI P package", pin_count: 8 },
      pins: [
        { name: "GAIN", number: "1", role: "gain_control", node: "gain1" }, { name: "IN-", number: "2", role: "inverting_input", node: "inn" }, { name: "IN+", number: "3", role: "noninverting_input", node: "inp" }, { name: "GND", number: "4", role: "ground", node: "gnd" },
        { name: "OUT", number: "5", role: "output", node: "out" }, { name: "VS", number: "6", role: "positive_supply", node: "vs" }, { name: "BYPASS", number: "7", role: "bypass", node: "bypass" }, { name: "GAIN", number: "8", role: "gain_control", node: "gain8" }
      ],
      spice_order: ["1", "2", "3", "4", "5", "6", "7", "8"]
    },
    source: { url: "https://www.ti.com/lit/ds/symlink/lm386.pdf", revision: "SNAS545D, May 2004, revised August 2023", pages: ["p. 1", "p. 3", "p. 4", "p. 5", "p. 6", "p. 10"] },
    facts: {
      schema_version: "1.0.0", specialty_variant: "lm386_audio_power_amp", extraction_method: "pdftotext -layout plus manual MIN/TYP/MAX transcription and manual typical-curve digitization",
      fit_conditions: { temperature: quantity(25, "degC", "typical-characteristics condition unless stated", "p. 6 typical characteristics", "typical") },
      parameters: {
        supply_voltage: { minimum: quantity(4, "V", "LM386N-1/-3, LM386M-1, LM386MM-1 recommended operation", "p. 4 recommended operating conditions", "minimum"), maximum: quantity(12, "V", "LM386N-1/-3, LM386M-1, LM386MM-1 recommended operation", "p. 4 recommended operating conditions", "maximum") },
        quiescent_current: { typical: quantity(4e-3, "A", "VS = 6 V, VIN = 0", "p. 5 electrical characteristics IQ TYP", "typical"), maximum: quantity(8e-3, "A", "VS = 6 V, VIN = 0", "p. 5 electrical characteristics IQ MAX", "maximum") },
        gain_open: quantity(20, "V/V", "VS = 6 V, f = 1 kHz, pins 1 and 8 open; 26 dB", "p. 5 electrical characteristics AV", "typical"),
        gain_bypassed: quantity(200, "V/V", "10 uF from pin 1 to pin 8; 46 dB", "p. 5 electrical characteristics AV", "typical"),
        bandwidth: quantity(300e3, "Hz", "VS = 6 V, pins 1 and 8 open", "p. 5 electrical characteristics BW TYP", "typical"),
        input_resistance: quantity(50e3, "ohm", "VS = 6 V", "p. 5 electrical characteristics RIN TYP", "typical"),
        input_bias_current: quantity(250e-9, "A", "VS = 6 V, pins 2 and 3 open", "p. 5 electrical characteristics IBIAS TYP", "typical"),
        output_power_6v_8ohm: { minimum: quantity(250e-3, "W", "VS = 6 V, RL = 8 ohm, THD = 10%", "p. 5 electrical characteristics POUT MIN", "minimum"), typical: quantity(325e-3, "W", "VS = 6 V, RL = 8 ohm, THD = 10%", "p. 5 electrical characteristics POUT TYP", "typical") },
        distortion: quantity(0.002, "1", "AV = 20, VS = 6 V, RL = 8 ohm, POUT = 125 mW, f = 1 kHz", "p. 5 electrical characteristics THD TYP", "typical")
      },
      gain_frequency_points: [[1e3, 20.0], [10e3, 20.0], [100e3, 18.5], [300e3, 14.2], [1e6, 5.7]].map(([frequency, gain]) => ({ frequency: quantity(frequency, "Hz", "VS = 6 V, pins 1 and 8 open", "p. 6 fig. 6-4", "typical"), gain: quantity(gain, "V/V", `f = ${frequency} Hz, manually digitized pins-open curve`, "p. 6 fig. 6-4", "digitized_typical_curve") })),
      output_swing_curve: [[4, 2.0], [6, 4.1], [8, 5.8], [10, 7.2], [12, 8.3]].map(([supply, swing]) => ({ supply_voltage: quantity(supply, "V", "RL = 8 ohm, TA = 25 degC", "p. 6 fig. 6-3", "typical"), load_resistance: quantity(8, "ohm", "selected 8-ohm family curve", "p. 6 fig. 6-3", "typical"), output_voltage_pp: quantity(swing, "Vpp", `VS = ${supply} V, RL = 8 ohm, manually digitized`, "p. 6 fig. 6-3", "digitized_typical_curve") }))
    },
    component: {
      modelName: "OC_TI_LM386", fidelity_tier: "F2", domain_coverage: { dc: "fitted", ac: "fitted", transient: "approx", noise: "none", thermal: "none", digital: "none" }, supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "F2 native-ngspice fit at 25 degC to cited pins-open gain-frequency and 8-ohm output-swing curves for 4 V to 12 V operation.",
      numeric_bounds: [{ quantity: "supply_voltage", minimum: 4, maximum: 12, unit: "V", conditions: "Published recommended LM386N-1/-3 operating range", placeholder: false }, { quantity: "input_voltage", minimum: -0.4, maximum: 0.4, unit: "V", conditions: "Published absolute input-voltage limit; damage is not simulated", placeholder: false }],
      omissions: ["GAIN_CL is an explicit subcircuit parameter. Pins 1 and 8 retain the published 1.5-kohm internal path, but the model does not infer gain from an externally connected capacitor or resistor; callers select gain explicitly from 20 to 200.", "The manually digitized Figure 6-3 and Figure 6-4 typical curves establish F2 only for closed-loop gain, bandwidth, output swing, and current limiting at 25 degC. Guaranteed output-power rows remain separately typed and are not treated as typical fit targets.", "The bypass pin is a first-order divider node. PSRR versus bypass capacitance, distortion, crossover behavior, clipping harmonics, speaker back-EMF, thermal limiting, short-circuit heating, package parasitics, noise, temperature behavior, and production spread are omitted.", "The output stage is a smooth compact current limiter with one dominant pole; it is not a transistor-level reproduction. Independent review remains pending-review."]
    }
  },
  LM13700: {
    slug: "LM13700", manufacturerSlug: "ti", pipeline: "specialty_analog",
    identity: {
      canonical_mpn: "LM13700", manufacturer: "Texas Instruments", description: "Dual operational transconductance amplifier with linearizing diodes and buffers", electrical_family: "other", aliases: ["LM13700N", "LM13700D", "LM13700M"], package: { name: "PDIP-16", standard: "TI NFG package", pin_count: 16 },
      pins: [
        { name: "IABC1", number: "1", role: "control_input", node: "iabc1" }, { name: "DIODE1", number: "2", role: "linearizing_diode_bias", node: "diode1" }, { name: "IN1+", number: "3", role: "noninverting_input", node: "inp1" }, { name: "IN1-", number: "4", role: "inverting_input", node: "inn1" },
        { name: "OUT1", number: "5", role: "output", node: "out1" }, { name: "V-", number: "6", role: "negative_supply", node: "vee" }, { name: "BUFFER1 IN", number: "7", role: "buffer_input", node: "bufin1" }, { name: "BUFFER1 OUT", number: "8", role: "buffer_output", node: "bufout1" },
        { name: "BUFFER2 OUT", number: "9", role: "buffer_output", node: "bufout2" }, { name: "BUFFER2 IN", number: "10", role: "buffer_input", node: "bufin2" }, { name: "V+", number: "11", role: "positive_supply", node: "vcc" }, { name: "OUT2", number: "12", role: "output", node: "out2" },
        { name: "IN2-", number: "13", role: "inverting_input", node: "inn2" }, { name: "IN2+", number: "14", role: "noninverting_input", node: "inp2" }, { name: "DIODE2", number: "15", role: "linearizing_diode_bias", node: "diode2" }, { name: "IABC2", number: "16", role: "control_input", node: "iabc2" }
      ],
      spice_order: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]
    },
    source: { url: "https://www.ti.com/lit/ds/symlink/lm13700.pdf", revision: "SNOSBW2F, November 1999, revised November 2015", pages: ["p. 1", "p. 3", "p. 4", "p. 5", "p. 6", "p. 7", "p. 9", "p. 10"] },
    facts: {
      schema_version: "1.0.0", specialty_variant: "lm13700_dual_ota", extraction_method: "pdftotext -layout plus manual MIN/TYP/MAX transcription, equation transcription, and manual typical-curve digitization",
      fit_conditions: { temperature: quantity(25, "degC", "VS = +/-15 V, IABC = 500 uA unless stated", "p. 5 electrical characteristics heading", "typical") },
      parameters: {
        supply_voltage_total: { minimum: quantity(9.5, "V", "dual-supply recommended range is +/-4.75 V", "p. 4 recommended operating conditions", "minimum"), maximum: quantity(32, "V", "dual-supply recommended range is +/-16 V", "p. 4 recommended operating conditions", "maximum") },
        forward_transconductance: { minimum: quantity(6.7e-3, "S", "VS = +/-15 V, IABC = 500 uA, temperature range", "p. 5 electrical characteristics gm MIN", "minimum"), typical: quantity(9.6e-3, "S", "VS = +/-15 V, IABC = 500 uA", "p. 5 electrical characteristics gm TYP", "typical"), maximum: quantity(13e-3, "S", "VS = +/-15 V, IABC = 500 uA", "p. 5 electrical characteristics gm MAX", "maximum") },
        peak_output_current: { minimum: quantity(350e-6, "A", "RL = 0, IABC = 500 uA", "p. 5 electrical characteristics peak output current MIN", "minimum"), typical: quantity(500e-6, "A", "RL = 0, IABC = 500 uA", "p. 5 electrical characteristics peak output current TYP", "typical"), maximum: quantity(650e-6, "A", "RL = 0, IABC = 500 uA", "p. 5 electrical characteristics peak output current MAX", "maximum") },
        input_resistance: { minimum: quantity(10e3, "ohm", "VS = +/-15 V, IABC = 500 uA", "p. 5 electrical characteristics input resistance MIN", "minimum"), typical: quantity(26e3, "ohm", "VS = +/-15 V, IABC = 500 uA", "p. 5 electrical characteristics input resistance TYP", "typical") },
        open_loop_bandwidth: quantity(2e6, "Hz", "VS = +/-15 V, IABC = 500 uA", "p. 5 electrical characteristics open-loop bandwidth TYP", "typical"),
        slew_rate: quantity(50e6, "V/s", "unity-gain compensated", "p. 5 electrical characteristics slew rate TYP", "typical"),
        supply_current: quantity(2.6e-3, "A", "IABC = 500 uA, both channels", "p. 5 electrical characteristics supply current TYP", "typical"),
        buffer_input_current: { typical: quantity(0.5e-6, "A", "buffer test configuration in footnote 1", "p. 5 electrical characteristics buffer input current TYP", "typical"), maximum: quantity(2e-6, "A", "buffer test configuration in footnote 1", "p. 5 electrical characteristics buffer input current MAX", "maximum") },
        peak_buffer_output_voltage_minimum: quantity(10, "V", "ROUT = 5 kohm to -VS, buffer input connected to OTA output", "p. 5 electrical characteristics peak buffer output voltage MIN", "minimum"),
        buffer_output_current_maximum: quantity(20e-3, "A", "absolute maximum; package dissipation must not be exceeded", "p. 4 absolute maximum ratings", "maximum")
      },
      transconductance_curve: [[1e-6, 19e-6, 1.22], [10e-6, 190e-6, 1.28], [100e-6, 1.9e-3, 1.38], [500e-6, 9.6e-3, 1.47], [1e-3, 19e-3, 1.52]].map(([iabc, gm, biasVoltage]) => ({ amplifier_bias_current: quantity(iabc, "A", "VS = +/-15 V, TA = 25 degC", "p. 7 fig. 8 and fig. 10", "typical"), transconductance: quantity(gm, "S", `IABC = ${iabc} A, manually digitized +25 degC curve`, "p. 7 fig. 8", "digitized_typical_curve"), bias_pin_voltage: quantity(biasVoltage, "V", `relative to V-, IABC = ${iabc} A, manually digitized +25 degC curve`, "p. 7 fig. 10", "digitized_typical_curve") })),
      transfer_equation: { thermal_voltage: quantity(26e-3, "V", "kT/q at 25 degC", "p. 9 section 7.3.1 equation discussion", "derived"), output_current_relation: quantity(1, "1", "IOUT = IABC*tanh(VIN/(2*kT/q)); compact behavioral implementation of equations 1 through 5", "p. 9 section 7.3.1 equations 1-5", "derived") }
    },
    component: {
      modelName: "OC_TI_LM13700", fidelity_tier: "F2", domain_coverage: { dc: "fitted", ac: "fitted", transient: "approx", noise: "none", thermal: "none", digital: "none" }, supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
      operating_summary: "F2 dual-channel behavioral OTA model at 25 degC, fitted with native ngspice to cited transconductance and amplifier-bias voltage curves over 1 uA to 1 mA IABC.",
      numeric_bounds: [{ quantity: "supply_voltage_total", minimum: 9.5, maximum: 32, unit: "V", conditions: "Published dual-supply recommended operating range", placeholder: false }, { quantity: "amplifier_bias_current", minimum: 0, maximum: 2e-3, unit: "A", conditions: "Published absolute maximum per IABC pin; failure is not simulated", placeholder: false }],
      omissions: ["Both OTA channels, linearizing-diode pins, bias-current pins, and Darlington buffers are present. Channel matching, crosstalk, shared-supply modulation, package parasitics, and process spread are omitted.", "The OTA uses the cited differential-pair equation with a fitted scale factor. Linearizing diodes are represented as junctions, but externally biased diode linearization, distortion reduction, and the full large-signal transistor transfer are not curve-fitted.", "The amplifier-bias input uses a fitted compact voltage-plus-resistance law rather than an internal current mirror. Output resistance and buffer output resistance are held compact defaults; the buffer has a first-order Darlington drop and smooth 20 mA limit.", "Slew rate, output noise, input capacitance, output capacitance, leakage, temperature curves, overload recovery, supply failure, self-heating, and production spread are omitted or metadata-only. Independent review remains pending-review."]
    }
  }
});

const p5Vdmos = ({ mpn, sourceUrl, revision, rdson, ratedCurrent, transfer, ciss, coss, crss, crssCurve, qg, qg5, qgs, qgd, trr, rthjc }) => ({
  slug: mpn, manufacturerSlug: "infineon", pipeline: "vdmos",
  identity: {
    canonical_mpn: mpn, manufacturer: "Infineon Technologies (International Rectifier legacy)", description: `55 V N-channel HEXFET power MOSFET`, electrical_family: "nmos", aliases: [`${mpn}PbF`],
    package: { name: "TO-220AB", standard: "JEDEC TO-220AB" },
    pins: [{ name: "G", number: "1", role: "gate", node: "gate" }, { name: "D", number: "2", role: "drain", node: "drain" }, { name: "S", number: "3", role: "source", node: "source" }], spice_order: ["2", "1", "3"]
  },
  source: { url: sourceUrl, revision, pages: ["p. 1", "p. 2", "p. 3", "p. 4"] },
  facts: {
    schema_version: "1.0.0", evidence_contract_version: "1.0.0", extraction_method: "pdftotext -layout plus manual typical-curve digitization and MIN/TYP/MAX table transcription",
    fit_conditions: { temperature: quantity(25, "degC", "Electrical characteristics unless stated", "p. 2 heading", "typical") },
    threshold: vdmosThreshold({ minimum: 2, maximum: 4 }),
    transfer_curves: [vdmosTransferCurve({
      curveId: `${mpn.toLowerCase()}.transfer.tj25-vds25`,
      vds: 25,
      pulseWidthMaximum: 20e-6,
      pageReference: "p. 3 fig. 3",
      currentPageReference: "p. 3 fig. 3, manually digitized 25 degC curve",
      points: transfer
    })],
    rdson_points: [vdmosRdsonPoint({
      vgs: 10,
      current: ratedCurrent,
      resistance: rdson,
      pulseWidthMaximum: 400e-6,
      dutyCycleMaximum: 0.02,
      pageReference: "p. 2 electrical characteristics",
      resistancePageReference: "p. 2 RDS(on) MAX"
    })],
    output_curves: vdmosOutputCurves({
      curveIdPrefix: `${mpn.toLowerCase()}.output.tj25`,
      pulseWidthMaximum: 20e-6,
      pageReference: "p. 3 fig. 1",
      currentPageReference: "p. 3 fig. 1, manually digitized 25 degC curve",
      points: transfer.slice(0, 5).map(([vgs, current]) => [vgs, 10, current])
    }),
    capacitances: {
      ciss: quantity(ciss, "F", "VDS = 25 V, VGS = 0, f = 1 MHz", "p. 2 electrical characteristics", "typical"), coss: quantity(coss, "F", "VDS = 25 V, VGS = 0, f = 1 MHz", "p. 2 electrical characteristics", "typical"), crss: quantity(crss, "F", "VDS = 25 V, VGS = 0, f = 1 MHz", "p. 2 electrical characteristics", "typical"), vds_test: quantity(25, "V", "capacitance test bias", "p. 2 electrical characteristics", "typical"),
      crss_curve: crssCurve.map(([vds, value]) => ({ vds: quantity(vds, "V", "VGS = 0, f = 1 MHz", "p. 4 fig. 5", "typical"), crss: quantity(value, "F", `VDS = ${vds} V`, "p. 4 fig. 5, manually digitized", "digitized_typical_curve") }))
    },
    gate_charge: { qg: quantity(qg, "C", `ID = ${ratedCurrent} A, VDS = 44 V, VGS = 10 V`, "p. 2 total gate charge MAX", "maximum"), qg_at_5v: quantity(qg5, "C", `ID = ${ratedCurrent} A, VDS = 44 V, VGS = 5 V`, "p. 4 fig. 6, manually digitized", "digitized_typical_curve"), qgs: quantity(qgs, "C", "same gate-charge test", "p. 2 gate-source charge MAX", "maximum"), qgd: quantity(qgd, "C", "same gate-charge test", "p. 2 gate-drain charge MAX", "maximum") },
    body_diode: { vsd: quantity(1.3, "V", `IS = ${ratedCurrent} A, VGS = 0`, "p. 2 source-drain characteristics", "maximum"), current: quantity(ratedCurrent, "A", "VSD test current", "p. 2 source-drain characteristics", "typical"), trr: quantity(trr, "s", `IF = ${ratedCurrent} A, di/dt = 100 A/us`, "p. 2 reverse recovery TYP", "typical") },
    breakdown: { voltage: quantity(55, "V", "VGS = 0, ID = 250 uA", "p. 2 breakdown voltage MIN", "minimum"), current: quantity(250e-6, "A", "VBR definition", "p. 2 electrical characteristics", "typical") },
    thermal: { rthjc: quantity(rthjc, "K/W", "junction to case", "p. 1 thermal resistance MAX", "maximum"), rthja: quantity(62, "K/W", "junction to ambient", "p. 1 thermal resistance MAX", "maximum") }
  },
  component: {
    modelName: `OC_INFINEON_${mpn}`, fidelity_tier: "F2", domain_coverage: { dc: "fitted", ac: "fitted", transient: "approx", noise: "none", thermal: "approx", digital: "none" }, supported_analyses: ["operating_point", "dc_sweep", "ac_small_signal", "transient"],
    operating_summary: "F2 native-ngspice fit at 25 degC from cited transfer, output, and capacitance curves plus tabulated electrical constraints. Gate charge is an approximate independent check.",
    numeric_bounds: [{ quantity: "drain_source_voltage", minimum: 0, maximum: 55, unit: "V", conditions: "Rated VDSS", placeholder: false }, { quantity: "gate_source_voltage", minimum: -20, maximum: 20, unit: "V", conditions: "Absolute maximum; gate failure not simulated", placeholder: false }],
    omissions: ["The RDS(on), body-diode voltage, and total gate-charge rows are guaranteed maxima; they are retained with source semantics and are not described as typical device values.", "Gate charge is not an optimizer residual. It is checked independently with a broad 75 percent tolerance because the compact VDMOS capacitance law does not reproduce the cited Miller plateau closely; transient coverage is approximate.", "Avalanche, UIS, safe-operating-area failure, temperature-dependent transfer, self-heating in the default three-terminal instance, package inductance, gate-oxide failure, process spread, and noise are not modelled.", "RG is held at the factory numerical floor because the datasheet does not publish intrinsic gate resistance.", "Independent review remains pending-review."]
  }
});

Object.assign(PARTS, {
  IRFZ44N: p5Vdmos({ mpn: "IRFZ44N", sourceUrl: "https://www.infineon.com/assets/row/public/documents/24/49/infineon-irfz44n-datasheet-en.pdf", revision: "IRFZ44NPbF, 21-Sep-2010", rdson: 0.0175, ratedCurrent: 25, transfer: [[4.5, 7], [5, 20], [6, 55], [7, 85], [8, 110]], ciss: 1470e-12, coss: 360e-12, crss: 88e-12, crssCurve: [[1, 750e-12], [2, 580e-12], [5, 340e-12], [10, 200e-12], [20, 120e-12], [50, 65e-12]], qg: 63e-9, qg5: 24e-9, qgs: 14e-9, qgd: 23e-9, trr: 63e-9, rthjc: 1.5 }),
  IRF3205: p5Vdmos({ mpn: "IRF3205", sourceUrl: "https://www.infineon.com/assets/row/public/documents/24/49/infineon-irf3205-datasheet-en.pdf", revision: "IRF3205PbF, 23-Jul-2010", rdson: 0.008, ratedCurrent: 62, transfer: [[4.5, 25], [5, 55], [6, 110], [7, 175], [8, 240]], ciss: 3247e-12, coss: 781e-12, crss: 211e-12, crssCurve: [[1, 1600e-12], [2, 1300e-12], [5, 850e-12], [10, 520e-12], [20, 300e-12], [50, 150e-12]], qg: 146e-9, qg5: 52e-9, qgs: 35e-9, qgd: 54e-9, trr: 69e-9, rthjc: 0.75 })
});

export function getPart(mpn) {
  const key = Object.keys(PARTS).find((candidate) => candidate.toLowerCase() === String(mpn).toLowerCase());
  if (!key) throw new Error(`Unsupported MPN: ${mpn}. Supported: ${Object.keys(PARTS).join(", ")}`);
  return PARTS[key];
}
