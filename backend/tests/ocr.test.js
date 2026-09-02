import { describe, it, expect } from 'vitest';
const { parseClinicalEntitiesFromText } = require('../services/ocrEngine');
const { evaluateLabValue } = require('../services/clinicalDrugInteractionService');

describe('OCR Clinical Entity & Lab Extraction Suite', () => {
  it('Sample 1: Extracts abnormal metabolic & renal lab markers from pathology report', () => {
    const pathologyReportText = `
      METROPOLIS CLINICAL PATHOLOGY LABORATORIES
      Patient: Ramesh Chandra Sharma | Age: 68 | Gender: Male
      Date: 14/08/2024 | Ref By: Dr. V. K. Gupta
      
      TEST NAME                 RESULT    UNIT       REFERENCE
      Fasting Blood Sugar       186       mg/dL      70 - 100
      Post Prandial Glucose     265       mg/dL      < 140
      HbA1c                     8.9       %          < 5.7
      Serum Creatinine          2.3       mg/dL      0.7 - 1.2
      Serum Uric Acid           8.8       mg/dL      3.5 - 7.2
    `;

    const parsed = parseClinicalEntitiesFromText(pathologyReportText, 'pathology_report.pdf', 'fever', 0.94);

    expect(parsed.documentType).toBe('lab_report');
    expect(parsed.labValues.length).toBeGreaterThanOrEqual(3);

    // Verify abnormal lab flagging against standard reference ranges
    const fbs = parsed.labValues.find(l => /fasting/i.test(l.test));
    expect(fbs).toBeDefined();
    expect(fbs.flag).toBe('HIGH');

    const creatinine = parsed.labValues.find(l => /creatinine/i.test(l.test));
    expect(creatinine).toBeDefined();
    expect(creatinine.flag).toBe('HIGH');
  });

  it('Sample 2: Extracts prescription medications and detects high-risk drug-drug interactions', () => {
    const prescriptionText = `
      DISTRICT CENTRAL HOSPITAL - OPD PRESCRIPTION
      Date: 20/05/2024 | Doctor: Dr. Sunita Rao, MD
      Rx:
      1. Tab Ecosprin 75mg OD (once daily morning)
      2. Tab Diclofenac 50mg BD (twice daily after meals)
      3. Tab Metformin 500mg BD
    `;

    const parsed = parseClinicalEntitiesFromText(prescriptionText, 'opd_prescription.pdf', 'joint_pain', 0.91);

    expect(parsed.documentType).toBe('prescription');
    expect(parsed.medications.length).toBeGreaterThanOrEqual(2);

    // Verify detection of dangerous Aspirin + NSAID interaction
    expect(parsed.drugInteractions).toBeDefined();
    expect(parsed.drugInteractions.length).toBeGreaterThan(0);
    const giBleedRisk = parsed.drugInteractions.find(i => i.severity === 'HIGH' || i.severity === 'CRITICAL');
    expect(giBleedRisk).toBeDefined();
    expect(giBleedRisk.title).toContain('Gastrointestinal Bleeding');
  });

  it('Evaluates individual lab test reference boundaries correctly', () => {
    const normalHb = evaluateLabValue('Hemoglobin (Hb)', '14.2', 'g/dL');
    expect(normalHb.flag).toBe('NORMAL');

    const highUricAcid = evaluateLabValue('Serum Uric Acid', '9.4', 'mg/dL');
    expect(highUricAcid.flag).toBe('HIGH');

    const lowPlatelets = evaluateLabValue('Platelet Count', '45000', '/cumm');
    expect(lowPlatelets.flag).toBe('LOW');
  });
});
