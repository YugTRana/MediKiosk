// Backend FHIR R4 Structural Validator (NRCES / ABDM Compliant)
// Enforces structural validation of Bundle, Composition, Patient, Condition,
// Observation, MedicationStatement, and Consent resources before EMR sync.

function validateFhirR4Bundle(bundle) {
  const errors = [];
  const warnings = [];
  const validatedResources = [];

  if (!bundle) {
    return {
      isValid: false,
      resourceCount: 0,
      validatedResources: [],
      errors: ['Bundle payload is empty or undefined.'],
      warnings: []
    };
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

  // Validate each resource
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

    validatedResources.push(r.resourceType);

    switch (r.resourceType) {
      case 'Patient':
        if (!r.name || r.name.length === 0) errors.push(`Patient ${r.id} missing 'name' attribute.`);
        break;

      case 'Condition':
        if (!r.code) errors.push(`Condition ${r.id} missing 'code' attribute.`);
        if (!r.subject?.reference) errors.push(`Condition ${r.id} missing 'subject.reference'.`);
        break;

      case 'Observation':
        if (!r.status) errors.push(`Observation ${r.id} missing 'status'.`);
        if (!r.code) errors.push(`Observation ${r.id} missing 'code'.`);
        break;

      case 'MedicationStatement':
        if (!r.status) errors.push(`MedicationStatement ${r.id} missing 'status'.`);
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

module.exports = {
  validateFhirR4Bundle
};
