// Clinical Drug-Drug Interaction & Lab Reference Range Intelligence Engine (Module B)
//
// STARTER / DEMO CLINICAL INTERACTION DATASET:
// Curated dataset of common high-risk drug interaction pairs encountered in Indian hospital OPDs.
// NOTE: This is a starter demonstration database and must be supplemented by a licensed clinical
// drug knowledge database (e.g., Lexicomp, First Databank, Medscape) prior to real hospital deployment.

const CURATED_DRUG_INTERACTIONS = [
  {
    drugA: ['aspirin', 'ecosprin', 'disprin'],
    drugB: ['diclofenac', 'ibuprofen', 'combiflam', 'naproxen', 'aceclofenac'],
    severity: 'HIGH',
    title: 'Severe Gastrointestinal Bleeding Risk',
    mechanism: 'Additive COX-1 inhibition and platelet aggregation blockade',
    clinicalRisk: 'Concurrent use markedly elevates the risk of severe gastrointestinal ulceration, upper GI hemorrhage, and renal impairment.',
    recommendation: 'Avoid simultaneous prescription. If anti-inflammatory analgesia is required, co-prescribe a proton pump inhibitor (Pantoprazole/Omeprazole) or switch to Paracetamol.'
  },
  {
    drugA: ['metformin', 'glycomet'],
    drugB: ['iohexol', 'iodixanol', 'radiographic contrast', 'contrast agent'],
    severity: 'HIGH',
    title: 'Risk of Contrast-Induced Nephropathy & Lactic Acidosis',
    mechanism: 'Renal clearance impairment leading to systemic metformin accumulation',
    clinicalRisk: 'Metformin can accumulate to toxic levels causing life-threatening lactic acidosis if renal function acutely declines following IV iodinated contrast.',
    recommendation: 'Withhold Metformin 48 hours prior to and 48 hours following radiographic contrast procedures.'
  },
  {
    drugA: ['clopidogrel', 'plavix', 'clopilet'],
    drugB: ['omeprazole', 'prilosec'],
    severity: 'MODERATE',
    title: 'Reduced Antiplatelet Efficacy via CYP2C19 Inhibition',
    mechanism: 'Competitive CYP2C19 inhibition prevents conversion of Clopidogrel to active metabolite',
    clinicalRisk: 'Diminished inhibition of ADP-induced platelet aggregation, increasing cardiovascular ischemic event risks.',
    recommendation: 'Substitute Omeprazole with Pantoprazole or Rabeprazole, which exhibit significantly less CYP2C19 inhibition.'
  },
  {
    drugA: ['warfarin', 'coumadin', 'acitrom'],
    drugB: ['fluconazole', 'diflucan', 'ciprofloxacin', 'metronidazole', 'diclofenac'],
    severity: 'CRITICAL',
    title: 'Marked Anticoagulant Potentiation & Severe Bleeding',
    mechanism: 'CYP2C9 clearance inhibition and competitive albumin displacement',
    clinicalRisk: 'Dramatic INR elevation exceeding therapeutic bounds with acute hemorrhage risk.',
    recommendation: 'Frequent INR monitoring required. Reduce Warfarin/Acitrom dosage by 30-50% during concurrent antibiotic/antifungal therapy.'
  },
  {
    drugA: ['enalapril', 'ramipril', 'telmisartan', 'losartan'],
    drugB: ['spironolactone', 'aldactone', 'potassium chloride', 'potassium supplement'],
    severity: 'HIGH',
    title: 'Severe Hyperkalemia Risk',
    mechanism: 'Synergistic potassium retention via renin-angiotensin-aldosterone axis inhibition',
    clinicalRisk: 'Serum potassium elevation > 5.5 mEq/L resulting in cardiac conduction abnormalities and fatal arrhythmias.',
    recommendation: 'Monitor serum electrolytes and creatinine within 1-2 weeks of initiating combined therapy.'
  },
  {
    drugA: ['atorvastatin', 'simvastatin', 'rosuvastatin'],
    drugB: ['clarithromycin', 'erythromycin', 'ketoconazole', 'itraconazole'],
    severity: 'HIGH',
    title: 'Severe Myopathy & Rhabdomyolysis Risk',
    mechanism: 'Potent CYP3A4 inhibition elevates systemic statin exposure by up to 10-fold',
    clinicalRisk: 'Extensive skeletal muscle breakdown leading to myoglobinuria, acute renal failure, and hyperkalemia.',
    recommendation: 'Temporarily suspend Statin therapy during the antibiotic/antifungal course.'
  },
  {
    drugA: ['sildenafil', 'tadalafil'],
    drugB: ['isosorbide dinitrate', 'sorbitrate', 'nitroglycerin', 'mononitrate'],
    severity: 'CRITICAL',
    title: 'Life-Threatening Refractory Hypotension',
    mechanism: 'Synergistic amplification of nitric oxide / cGMP signaling causing profound vasodilation',
    clinicalRisk: 'Catastrophic precipitous drop in systemic blood pressure, myocardial infarction, and syncope.',
    recommendation: 'Absolute contraindication: Do NOT co-administer PDE5 inhibitors within 24-48 hours of nitrate preparations.'
  },
  {
    drugA: ['ciprofloxacin', 'levofloxacin', 'norfloxacin'],
    drugB: ['antacid', 'calcium carbonate', 'sucralfate', 'iron supplement', 'ferrous sulphate'],
    severity: 'MODERATE',
    title: 'Chelation & Impaired Antibiotic Absorption',
    mechanism: 'Polyvalent metal cation chelation forming unabsorbable insoluble complexes',
    clinicalRisk: 'Reduces fluoroquinolone systemic bioavailability by 70-90%, resulting in antimicrobial therapeutic failure.',
    recommendation: 'Administer fluoroquinolones at least 2 hours before or 4 hours after cation-containing antacids or minerals.'
  },
  {
    drugA: ['methotrexate'],
    drugB: ['diclofenac', 'ibuprofen', 'naproxen', 'bactrim', 'trimethoprim'],
    severity: 'CRITICAL',
    title: 'Methotrexate Toxicity & Bone Marrow Suppression',
    mechanism: 'Reduced renal tubular secretion of methotrexate',
    clinicalRisk: 'Severe pancytopenia, mucositis, hepatotoxicity, and acute nephrotoxicity.',
    recommendation: 'Avoid concurrent NSAID/Bactrim therapy with high-dose methotrexate; monitor CBC and renal markers closely with low-dose rheumatologic regimens.'
  },
  {
    drugA: ['tramadol'],
    drugB: ['sertraline', 'fluoxetine', 'escitalopram', 'duloxetine'],
    severity: 'HIGH',
    title: 'Serotonin Syndrome & Lowered Seizure Threshold',
    mechanism: 'Dual serotonergic enhancement and inhibition of tramadol metabolism',
    clinicalRisk: 'Hyperthermia, autonomic instability, hyperreflexia, and heightened seizure susceptibility.',
    recommendation: 'Exercise vigilance for neuromuscular agitation; consider alternative non-serotonergic analgesics.'
  }
];

/**
 * Standard Clinical Reference Ranges for Automated Laboratory Flagging
 */
const STANDARD_LAB_REFERENCE_RANGES = {
  // CBC
  'hemoglobin': { min: 12.0, max: 17.0, unit: 'g/dL', profile: 'Complete Blood Count (CBC)' },
  'haemoglobin': { min: 12.0, max: 17.0, unit: 'g/dL', profile: 'Complete Blood Count (CBC)' },
  'hb': { min: 12.0, max: 17.0, unit: 'g/dL', profile: 'Complete Blood Count (CBC)' },
  'tlc': { min: 4000, max: 11000, unit: '/uL', profile: 'Complete Blood Count (CBC)' },
  'wbc': { min: 4000, max: 11000, unit: '/uL', profile: 'Complete Blood Count (CBC)' },
  'total leukocyte count': { min: 4000, max: 11000, unit: '/uL', profile: 'Complete Blood Count (CBC)' },
  'platelet count': { min: 150000, max: 450000, unit: '/uL', profile: 'Complete Blood Count (CBC)' },
  'platelets': { min: 1.5, max: 4.5, unit: 'lakhs/cumm', profile: 'Complete Blood Count (CBC)' },
  'esr': { min: 0, max: 20, unit: 'mm/hr', profile: 'Complete Blood Count (CBC)' },
  'pcv': { min: 36, max: 50, unit: '%', profile: 'Complete Blood Count (CBC)' },
  'mcv': { min: 80, max: 100, unit: 'fL', profile: 'Complete Blood Count (CBC)' },

  // Glycemic / Diabetes
  'fasting blood sugar': { min: 70, max: 99, unit: 'mg/dL', profile: 'Glycemic Profile' },
  'fbs': { min: 70, max: 99, unit: 'mg/dL', profile: 'Glycemic Profile' },
  'glucose fasting': { min: 70, max: 99, unit: 'mg/dL', profile: 'Glycemic Profile' },
  'post prandial blood sugar': { min: 70, max: 140, unit: 'mg/dL', profile: 'Glycemic Profile' },
  'ppbs': { min: 70, max: 140, unit: 'mg/dL', profile: 'Glycemic Profile' },
  'hba1c': { min: 4.0, max: 5.6, unit: '%', profile: 'Glycemic Profile' },
  'glycosylated hemoglobin': { min: 4.0, max: 5.6, unit: '%', profile: 'Glycemic Profile' },

  // Kidney Function Test (KFT)
  'serum creatinine': { min: 0.6, max: 1.2, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'creatinine': { min: 0.6, max: 1.2, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'blood urea': { min: 15, max: 45, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'urea': { min: 15, max: 45, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'bun': { min: 7, max: 20, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'uric acid': { min: 3.5, max: 7.2, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'serum uric acid': { min: 3.5, max: 7.2, unit: 'mg/dL', profile: 'Kidney Function Test (KFT)' },
  'sodium': { min: 135, max: 145, unit: 'mEq/L', profile: 'Electrolytes' },
  'potassium': { min: 3.5, max: 5.0, unit: 'mEq/L', profile: 'Electrolytes' },
  'chloride': { min: 96, max: 106, unit: 'mEq/L', profile: 'Electrolytes' },

  // Liver Function Test (LFT)
  'total bilirubin': { min: 0.2, max: 1.2, unit: 'mg/dL', profile: 'Liver Function Test (LFT)' },
  'bilirubin total': { min: 0.2, max: 1.2, unit: 'mg/dL', profile: 'Liver Function Test (LFT)' },
  'direct bilirubin': { min: 0.0, max: 0.3, unit: 'mg/dL', profile: 'Liver Function Test (LFT)' },
  'sgpt': { min: 7, max: 56, unit: 'U/L', profile: 'Liver Function Test (LFT)' },
  'alt': { min: 7, max: 56, unit: 'U/L', profile: 'Liver Function Test (LFT)' },
  'sgot': { min: 10, max: 40, unit: 'U/L', profile: 'Liver Function Test (LFT)' },
  'ast': { min: 10, max: 40, unit: 'U/L', profile: 'Liver Function Test (LFT)' },
  'alkaline phosphatase': { min: 44, max: 147, unit: 'U/L', profile: 'Liver Function Test (LFT)' },
  'alp': { min: 44, max: 147, unit: 'U/L', profile: 'Liver Function Test (LFT)' },
  'total protein': { min: 6.0, max: 8.3, unit: 'g/dL', profile: 'Liver Function Test (LFT)' },
  'serum albumin': { min: 3.5, max: 5.5, unit: 'g/dL', profile: 'Liver Function Test (LFT)' },

  // Lipid Profile
  'total cholesterol': { min: 120, max: 200, unit: 'mg/dL', profile: 'Lipid Profile' },
  'cholesterol': { min: 120, max: 200, unit: 'mg/dL', profile: 'Lipid Profile' },
  'triglycerides': { min: 50, max: 150, unit: 'mg/dL', profile: 'Lipid Profile' },
  'hdl cholesterol': { min: 40, max: 80, unit: 'mg/dL', profile: 'Lipid Profile' },
  'ldl cholesterol': { min: 50, max: 100, unit: 'mg/dL', profile: 'Lipid Profile' },
  'vldl': { min: 5, max: 30, unit: 'mg/dL', profile: 'Lipid Profile' },

  // Thyroid Profile
  'tsh': { min: 0.4, max: 4.5, unit: 'uIU/mL', profile: 'Thyroid Panel' },
  't3': { min: 80, max: 200, unit: 'ng/dL', profile: 'Thyroid Panel' },
  't4': { min: 4.5, max: 12.0, unit: 'ug/dL', profile: 'Thyroid Panel' },

  // Cardiac & Inflammatory
  'troponin i': { min: 0.0, max: 0.04, unit: 'ng/mL', profile: 'Cardiac Markers' },
  'crp': { min: 0.0, max: 5.0, unit: 'mg/L', profile: 'Inflammatory Markers' },
  'c-reactive protein': { min: 0.0, max: 5.0, unit: 'mg/L', profile: 'Inflammatory Markers' },
  'ra factor': { min: 0.0, max: 14.0, unit: 'IU/mL', profile: 'Rheumatology' }
};

/**
 * Given a medication name, clean and check if it matches a drug in a target list.
 */
function drugMatches(medName, targetList) {
  if (!medName) return false;
  const clean = medName.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  return targetList.some(target => {
    const tClean = target.toLowerCase();
    return clean.includes(tClean) || tClean.includes(clean.trim());
  });
}

/**
 * Scan all medications across ALL of a patient's digitized documents and return detected interaction warnings.
 * 
 * @param {Array<Object>} medications - Array of { name, dose, frequency, sourceDocId }
 * @returns {Array<Object>} Detected interaction alerts
 */
function checkDrugInteractions(medications = []) {
  if (!medications || medications.length < 2) return [];

  const detected = [];
  const checkedPairs = new Set();

  for (let i = 0; i < medications.length; i++) {
    const medA = medications[i];
    const nameA = typeof medA === 'string' ? medA : medA.name || '';

    for (let j = i + 1; j < medications.length; j++) {
      const medB = medications[j];
      const nameB = typeof medB === 'string' ? medB : medB.name || '';

      const pairKey = [nameA.toLowerCase().trim(), nameB.toLowerCase().trim()].sort().join(':::');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Check against interaction rules
      for (const rule of CURATED_DRUG_INTERACTIONS) {
        const matchesAtoB = drugMatches(nameA, rule.drugA) && drugMatches(nameB, rule.drugB);
        const matchesBtoA = drugMatches(nameB, rule.drugA) && drugMatches(nameA, rule.drugB);

        if (matchesAtoB || matchesBtoA) {
          detected.push({
            id: `int_${detected.length + 1}`,
            drug1: nameA,
            drug2: nameB,
            severity: rule.severity,
            title: rule.title,
            mechanism: rule.mechanism,
            clinicalRisk: rule.clinicalRisk,
            recommendation: rule.recommendation,
            isStarterDataset: true
          });
          break;
        }
      }
    }
  }

  return detected;
}

/**
 * Evaluate and flag an individual lab test value against standard reference ranges.
 */
function evaluateLabValue(testName, testValue, unitStr = '') {
  if (!testName || testValue === undefined || testValue === null) {
    return { flag: 'NORMAL', referenceRange: '' };
  }

  const cleanName = testName.toLowerCase().trim();
  const numVal = parseFloat(String(testValue).replace(/[^0-9.]/g, ''));
  if (isNaN(numVal)) {
    return { flag: 'NORMAL', referenceRange: '' };
  }

  // Look up in reference table
  for (const [key, ref] of Object.entries(STANDARD_LAB_REFERENCE_RANGES)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      const refRangeStr = `${ref.min} - ${ref.max} ${ref.unit}`;
      let flag = 'NORMAL';
      if (numVal < ref.min) flag = 'LOW';
      else if (numVal > ref.max) flag = 'HIGH';

      return {
        flag,
        referenceRange: refRangeStr,
        profile: ref.profile,
        standardUnit: ref.unit
      };
    }
  }

  return { flag: 'NORMAL', referenceRange: '' };
}

module.exports = {
  checkDrugInteractions,
  evaluateLabValue,
  CURATED_DRUG_INTERACTIONS,
  STANDARD_LAB_REFERENCE_RANGES
};
