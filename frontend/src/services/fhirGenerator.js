// FHIR R4 Bundle Resource Generator
// Converts MediKiosk clinical sessions into official HL7 FHIR Release 4 Document Bundles

const SNOMED_CODES = {
  fever: { code: '386661006', display: 'Fever (finding)' },
  cough_breathlessness: { code: '267036007', display: 'Dyspnea (finding)' },
  abdominal_pain: { code: '21522000', display: 'Abdominal pain (finding)' },
  chest_pain: { code: '29857009', display: 'Chest pain (finding)' },
  joint_pain: { code: '57676002', display: 'Joint pain & swelling (finding)' },
  ayush_consultation: { code: '710007000', display: 'Ayurvedic traditional medicine assessment' },
  diabetes: { code: '44054006', display: 'Type 2 diabetes mellitus (disorder)' },
  hypertension: { code: '59621000', display: 'Essential hypertension (disorder)' },
  osteoarthritis: { code: '396275006', display: 'Osteoarthritis of knee (disorder)' },
  gout: { code: '90560007', display: 'Gout / Hyperuricemic arthropathy (disorder)' }
};

const LOINC_LAB_CODES = {
  'Serum Uric Acid': { code: '3084-1', display: 'Uric acid [Mass/volume] in Serum or Plasma' },
  'C-Reactive Protein (CRP)': { code: '1988-5', display: 'C reactive protein [Mass/volume] in Serum or Plasma' },
  'Erythrocyte Sedimentation Rate (ESR)': { code: '30341-2', display: 'Erythrocyte sedimentation rate by Westergren method' },
  'Rheumatoid Factor (RA Factor)': { code: '11572-5', display: 'Rheumatoid factor [Units/volume] in Serum or Plasma' },
  'Vitamin D3 (25-OH)': { code: '1989-1', display: '25-Hydroxyvitamin D3 [Mass/volume] in Serum or Plasma' },
  'Serum Calcium': { code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma' },
  'Platelet Count': { code: '777-3', display: 'Platelets [#/volume] in Blood' },
  'Total Leukocyte Count (TLC)': { code: '6690-2', display: 'Leukocytes [#/volume] in Blood' },
  'Absolute Eosinophil Count (AEC)': { code: '711-2', display: 'Eosinophils [#/volume] in Blood' },
  'Fasting Blood Sugar': { code: '1558-6', display: 'Fasting glucose [Mass/volume] in Blood' },
  'HbA1c': { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
  'Serum Creatinine': { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
  'Total Cholesterol': { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
  'Hemoglobin (Hb)': { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood' }
};

export function convertSessionToFhirR4Bundle(session) {
  if (!session) return null;

  const nowIso = session.submittedAt || new Date().toISOString();
  const token = session.tokenNumber || 'K-100';
  const patientName = session.patientDetails?.name || 'Ramesh Chandra Sharma';
  const abhaNumber = session.patientDetails?.abhaNumber || session.abhaDetails?.abhaNumber || '91-8472-1029-4821';
  const abhaAddress = session.patientDetails?.abhaAddress || session.abhaDetails?.abhaAddress || 'ramesh.sharma@abdm';
  const gender = (session.patientDetails?.gender || 'male').toLowerCase();
  const age = session.patientDetails?.age || 68;
  const birthYear = new Date().getFullYear() - age;

  // 1. Patient Resource
  const patientResource = {
    resourceType: 'Patient',
    id: `patient-${session.id || 'current'}`,
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient']
    },
    identifier: [
      {
        system: 'https://healthid.abdm.gov.in',
        value: abhaNumber,
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'ABHA Number' }]
        }
      },
      {
        system: 'https://abdm.gov.in/abha-address',
        value: abhaAddress
      }
    ],
    name: [{ use: 'official', text: patientName }],
    gender: gender === 'female' ? 'female' : 'male',
    birthDate: `${birthYear}-01-01`,
    address: [{ text: session.abhaDetails?.address || 'India' }]
  };

  // 2. Practitioner Resource
  const practitionerResource = {
    resourceType: 'Practitioner',
    id: 'practitioner-104',
    name: [{ text: 'Dr. Sunita Rao' }],
    qualification: [{ code: { text: 'MD (General & Integrated Medicine)' } }]
  };

  // 3. Condition Resources (Primary Chief Complaint + Past Diagnoses)
  const complaintKey = session.complaintId || 'fever';
  const mainCoding = SNOMED_CODES[complaintKey] || { code: '404684003', display: session.complaintTitle || 'Clinical Finding' };

  const primaryCondition = {
    resourceType: 'Condition',
    id: `condition-primary-${session.id || '1'}`,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }]
    },
    verificationStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }]
    },
    category: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis', display: 'Encounter Diagnosis' }]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: mainCoding.code,
          display: mainCoding.display
        }
      ],
      text: session.complaintTitle
    },
    subject: { reference: `Patient/${patientResource.id}`, display: patientName },
    recordedDate: nowIso
  };

  const conditionResources = [primaryCondition];

  // Secondary conditions from OCR
  if (session.digitizedDocument?.diagnoses) {
    session.digitizedDocument.diagnoses.forEach((diag, idx) => {
      conditionResources.push({
        resourceType: 'Condition',
        id: `condition-ocr-${idx + 1}`,
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }]
        },
        code: {
          text: diag
        },
        subject: { reference: `Patient/${patientResource.id}`, display: patientName },
        recordedDate: session.digitizedDocument.date || nowIso
      });
    });
  }

  // 4. Observation Resources (Labs + Vitals)
  const observationResources = [];

  // Vitals Observations
  const vitals = [
    { name: 'Blood Pressure', code: '85354-9', value: '138/86', unit: 'mmHg' },
    { name: 'Heart Rate', code: '8867-4', value: 74, unit: 'beats/min' },
    { name: 'Oxygen Saturation (SpO2)', code: '59408-5', value: 97, unit: '%' },
    { name: 'Body Temperature', code: '8310-5', value: 98.4, unit: 'degF' }
  ];

  vitals.forEach((vit, idx) => {
    observationResources.push({
      resourceType: 'Observation',
      id: `obs-vital-${idx + 1}`,
      status: 'final',
      category: [
        {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }]
        }
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: vit.code, display: vit.name }],
        text: vit.name
      },
      subject: { reference: `Patient/${patientResource.id}`, display: patientName },
      effectiveDateTime: nowIso,
      valueString: typeof vit.value === 'string' ? vit.value : undefined,
      valueQuantity: typeof vit.value === 'number' ? { value: vit.value, unit: vit.unit, system: 'http://unitsofmeasure.org' } : undefined
    });
  });

  // Lab Observations from OCR
  if (session.digitizedDocument?.labValues) {
    session.digitizedDocument.labValues.forEach((lab, idx) => {
      const loinc = LOINC_LAB_CODES[lab.test] || { code: '30954-2', display: lab.test };
      const interpretationCode = lab.flag === 'HIGH' ? 'H' : lab.flag === 'LOW' ? 'L' : 'N';

      observationResources.push({
        resourceType: 'Observation',
        id: `obs-lab-${idx + 1}`,
        status: 'final',
        category: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }]
          }
        ],
        code: {
          coding: [{ system: 'http://loinc.org', code: loinc.code, display: loinc.display }],
          text: lab.test
        },
        subject: { reference: `Patient/${patientResource.id}`, display: patientName },
        effectiveDateTime: session.digitizedDocument.date || nowIso,
        valueQuantity: typeof lab.value === 'number' ? {
          value: lab.value,
          unit: lab.unit,
          system: 'http://unitsofmeasure.org'
        } : undefined,
        valueString: typeof lab.value === 'string' ? lab.value : undefined,
        interpretation: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: interpretationCode,
                display: lab.flag
              }
            ]
          }
        ],
        referenceRange: [
          {
            text: `${lab.referenceRange} ${lab.unit}`
          }
        ]
      });
    });
  }

  // 5. MedicationStatement Resources
  const medicationResources = [];
  if (session.digitizedDocument?.medications) {
    session.digitizedDocument.medications.forEach((med, idx) => {
      medicationResources.push({
        resourceType: 'MedicationStatement',
        id: `med-stmt-${idx + 1}`,
        status: 'active',
        medicationCodeableConcept: {
          coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', display: med.name }],
          text: med.name
        },
        subject: { reference: `Patient/${patientResource.id}`, display: patientName },
        effectiveDateTime: nowIso,
        dosage: [
          {
            text: `${med.dose} ${med.frequency}`,
            doseAndRate: [{ doseQuantity: { value: parseFloat(med.dose) || undefined, unit: med.dose } }]
          }
        ]
      });
    });
  }

  // 6. Composition Resource (Clinical Document Header)
  const compositionResource = {
    resourceType: 'Composition',
    id: `comp-${session.id || 'current'}`,
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord']
    },
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '11488-4',
          display: 'Consultation note'
        }
      ],
      text: 'Outpatient Triage Consultation Note'
    },
    subject: {
      reference: `Patient/${patientResource.id}`,
      display: patientName
    },
    date: nowIso,
    author: [
      {
        reference: `Practitioner/${practitionerResource.id}`,
        display: 'Dr. Sunita Rao'
      }
    ],
    title: `MediKiosk OPD Record - Token ${token}`,
    section: [
      {
        title: 'Chief Complaint',
        code: {
          coding: [{ system: 'http://loinc.org', code: '10154-3', display: 'Chief complaint' }]
        },
        entry: conditionResources.map(c => ({ reference: `Condition/${c.id}` }))
      },
      {
        title: 'Vital Signs & Laboratory Observations',
        code: {
          coding: [{ system: 'http://loinc.org', code: '8716-3', display: 'Vital signs' }]
        },
        entry: observationResources.map(o => ({ reference: `Observation/${o.id}` }))
      },
      {
        title: 'Medications Extracted',
        code: {
          coding: [{ system: 'http://loinc.org', code: '10160-0', display: 'History of Medication use' }]
        },
        entry: medicationResources.map(m => ({ reference: `MedicationStatement/${m.id}` }))
      }
    ]
  };

  // 7. Consent Resource (DPDP Act & ABDM Data Sharing Authorization)
  const consentResource = {
    resourceType: 'Consent',
    id: `consent-${session.id || 'current'}`,
    status: 'active',
    scope: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy', display: 'Privacy Consent' }]
    },
    category: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes', code: 'opt-in', display: 'Opt-in' }]
      }
    ],
    patient: { reference: `Patient/${patientResource.id}`, display: patientName },
    dateTime: session.consentTimestamp || nowIso,
    policyRule: {
      coding: [{ system: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/Consent', code: 'DPDP-ACT-2023', display: 'Digital Personal Data Protection Act 2023 Consent' }]
    }
  };

  // 8. Full FHIR Release 4 Document Bundle
  const bundle = {
    resourceType: 'Bundle',
    id: `bundle-opd-${session.id || 'current'}`,
    meta: {
      versionId: '1',
      lastUpdated: nowIso,
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle']
    },
    identifier: {
      system: 'https://hospital.gov.in/fhir/bundles',
      value: `BUNDLE-OPD-${token}-${Date.now()}`
    },
    type: 'document',
    timestamp: nowIso,
    entry: [
      { fullUrl: `urn:uuid:${compositionResource.id}`, resource: compositionResource },
      { fullUrl: `urn:uuid:${patientResource.id}`, resource: patientResource },
      { fullUrl: `urn:uuid:${practitionerResource.id}`, resource: practitionerResource },
      { fullUrl: `urn:uuid:${consentResource.id}`, resource: consentResource },
      ...conditionResources.map(c => ({ fullUrl: `urn:uuid:${c.id}`, resource: c })),
      ...observationResources.map(o => ({ fullUrl: `urn:uuid:${o.id}`, resource: o })),
      ...medicationResources.map(m => ({ fullUrl: `urn:uuid:${m.id}`, resource: m }))
    ]
  };

  return bundle;
}

/**
 * Structural FHIR Release 4 Document Bundle Validator (NRCES / ABDM Compliant)
 * Enforces structural integrity of Bundle, Composition, Patient, Condition,
 * Observation, MedicationStatement, and Consent resources before EMR transmission.
 * 
 * @param {Object} bundle - FHIR Document Bundle
 * @returns {Object} Validation report { isValid, resourceCount, validatedResources, errors, warnings }
 */
export function validateFhirR4Bundle(bundle) {
  const errors = [];
  const warnings = [];
  const validatedResources = [];

  if (!bundle) {
    return { isValid: false, resourceCount: 0, validatedResources: [], errors: ['Bundle payload is empty or null.'], warnings: [] };
  }

  if (bundle.resourceType !== 'Bundle') {
    errors.push(`Root resourceType must be 'Bundle', received '${bundle.resourceType}'.`);
  }

  if (bundle.type !== 'document') {
    errors.push(`Document bundle type must be 'document', received '${bundle.type}'.`);
  }

  if (!bundle.entry || !Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    errors.push('Bundle must contain a non-empty array of entries.');
    return { isValid: false, resourceCount: 0, validatedResources: [], errors, warnings };
  }

  // 1. First entry must be Composition per HL7 FHIR Document Bundle specification
  const firstEntry = bundle.entry[0]?.resource;
  if (!firstEntry || firstEntry.resourceType !== 'Composition') {
    errors.push(`First entry in document bundle MUST be a 'Composition' resource, found '${firstEntry?.resourceType}'.`);
  } else {
    validatedResources.push('Composition');
    if (!firstEntry.status) errors.push('Composition missing required field: status');
    if (!firstEntry.type) errors.push('Composition missing required field: type');
    if (!firstEntry.subject?.reference) errors.push('Composition missing required field: subject.reference');
    if (!firstEntry.author || firstEntry.author.length === 0) errors.push('Composition missing required field: author');
    if (!firstEntry.section || !Array.isArray(firstEntry.section)) errors.push('Composition missing required field: section array');
  }

  // Validate each entry in the bundle
  bundle.entry.forEach((ent, idx) => {
    const r = ent.resource;
    if (!r) {
      errors.push(`Entry #${idx} is missing a resource object.`);
      return;
    }

    if (!r.resourceType) {
      errors.push(`Entry #${idx} missing 'resourceType'.`);
      return;
    }

    if (!r.id) {
      warnings.push(`Resource ${r.resourceType} at entry #${idx} is missing an explicit 'id'.`);
    }

    validatedResources.push(r.resourceType);

    switch (r.resourceType) {
      case 'Patient':
        if (!r.name || r.name.length === 0) errors.push(`Patient ${r.id} missing 'name' attribute.`);
        if (!r.gender) warnings.push(`Patient ${r.id} missing 'gender' attribute.`);
        break;

      case 'Condition':
        if (!r.clinicalStatus?.coding) warnings.push(`Condition ${r.id} missing 'clinicalStatus.coding'.`);
        if (!r.code) errors.push(`Condition ${r.id} missing 'code' (clinical condition finding).`);
        if (!r.subject?.reference) errors.push(`Condition ${r.id} missing 'subject.reference'.`);
        break;

      case 'Observation':
        if (!r.status) errors.push(`Observation ${r.id} missing 'status'.`);
        if (!r.code) errors.push(`Observation ${r.id} missing 'code'.`);
        break;

      case 'MedicationStatement':
        if (!r.status) errors.push(`MedicationStatement ${r.id} missing 'status'.`);
        if (!r.medicationCodeableConcept && !r.medicationReference) errors.push(`MedicationStatement ${r.id} missing medication identifier.`);
        if (!r.subject?.reference) errors.push(`MedicationStatement ${r.id} missing 'subject.reference'.`);
        break;

      case 'Consent':
        if (!r.status) errors.push(`Consent ${r.id} missing 'status'.`);
        if (!r.patient?.reference) errors.push(`Consent ${r.id} missing 'patient.reference'.`);
        break;
    }
  });

  return {
    isValid: errors.length === 0,
    resourceCount: bundle.entry.length,
    validatedResources: [...new Set(validatedResources)],
    errors,
    warnings
  };
}
