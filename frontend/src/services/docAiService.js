// Document Digitization & OCR Service (Mock Google DocAI / Healthcare OCR)

export const SAMPLE_DOCUMENTS = [
  {
    id: 'joint_rheumatology_panel',
    title: '🦴 Joint Pain, X-Ray & Rheumatology Panel',
    type: 'orthopedic_rheumatology_report',
    fileName: 'knee_xray_rheumatology_report.pdf',
    description: 'Bilateral Knee X-Ray, Serum Uric Acid 8.6 (HIGH), CRP 24.5 (HIGH), ESR 48 (HIGH), RA Factor 45 (HIGH), Etoricoxib & Febuxostat',
    relevantComplaint: 'joint_pain'
  },
  {
    id: 'fever_infection_panel',
    title: '🌡️ Fever & Acute Infection Blood Panel',
    type: 'lab_report',
    fileName: 'cbc_dengue_widal_panel.pdf',
    description: 'Platelets 85,000 (LOW), TLC 14,200 (HIGH), Dengue NS1 Positive, Paracetamol 650mg, Doxycycline 100mg',
    relevantComplaint: 'fever'
  },
  {
    id: 'respiratory_chest_panel',
    title: '🫁 Pulmonology & Allergy Panel',
    type: 'pulmonology_report',
    fileName: 'chest_xray_eosinophil_panel.pdf',
    description: 'Chest X-Ray Bronchitis, Absolute Eosinophils 680 (HIGH), SpO2 94% (LOW), Inhaler & Montelukast',
    relevantComplaint: 'cough_breathlessness'
  },
  {
    id: 'diabetes_metabolic_rx',
    title: '📄 Diabetes & Metabolic Prescription',
    type: 'prescription',
    fileName: 'diabetes_hypertension_prescription.jpg',
    description: 'Fasting Sugar 142 (HIGH), HbA1c 7.4% (HIGH), Metformin 500mg, Amlodipine 5mg',
    relevantComplaint: 'general'
  }
];

export async function extractDocumentWithDocAI({ fileName, documentType = 'auto', complaintId = 'auto', file = null }) {
  try {
    const res = await fetch('http://localhost:3000/api/docai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileName || (file ? file.name : 'scanned_document.jpg'),
        documentType,
        complaintId
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data.extractedData;
    }
    throw new Error(`Server responded with ${res.status}`);
  } catch (err) {
    console.warn('[DocAIService] Backend unreachable, using fallback simulated extraction:', err);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fnLower = (fileName || '').toLowerCase();
    const docTypeLower = (documentType || '').toLowerCase();

    // 1. Direct match by documentType or fileName keywords FIRST
    const isExplicitDiabetesBP = 
      docTypeLower === 'prescription' || 
      docTypeLower === 'diabetes_metabolic_rx' || 
      docTypeLower === 'hypertension_prescription' ||
      /diabetes|hypertension|sugar|glucose|hba1c|blood_pressure|bp|pressure|metformin|amlodipine|telmisartan|metabolic|endocrine|prescription|rx/i.test(fnLower);

    const isExplicitJoint = 
      docTypeLower === 'orthopedic_rheumatology_report' || 
      /joint|knee|ortho|rheumat|uric|xray|arthritis|swelling|esr|crp|gout/i.test(fnLower);

    const isExplicitCough = 
      docTypeLower === 'pulmonology_report' || 
      /cough|breath|chest|pulmo|asthma|eosinophil|spo2|inhaler/i.test(fnLower);

    const isExplicitFever = 
      docTypeLower === 'lab_report' || 
      docTypeLower === 'cbc_infection_panel' || 
      /dengue|malaria|cbc|platelet|widal|infection|typhoid|hematology/i.test(fnLower);

    const isDiabetesBP = isExplicitDiabetesBP;
    const isJointPain = !isDiabetesBP && (isExplicitJoint || (!isExplicitFever && !isExplicitCough && (complaintId === 'joint_pain' || complaintId === 'ayush_consultation')));
    const isFever = !isDiabetesBP && !isJointPain && (isExplicitFever || (!isExplicitCough && complaintId === 'fever'));
    const isCough = !isDiabetesBP && !isJointPain && !isFever && (isExplicitCough || complaintId === 'cough_breathlessness');

    if (isDiabetesBP) {
      return {
        documentType: 'prescription',
        documentTitle: 'Endocrine & Metabolic Outpatient Record (Diabetes & BP)',
        facility: 'District Government Hospital OPD',
        date: '2026-06-15',
        prescriber: 'Dr. S. K. Mehta (MD, Gen Med)',
        medications: [
          { name: 'Metformin', dose: '500mg', frequency: 'twice daily (after meals)', duration: '30 days', instructions: 'Oral anti-diabetic' },
          { name: 'Amlodipine', dose: '5mg', frequency: 'once daily (morning)', duration: '30 days', instructions: 'Oral anti-hypertensive' },
          { name: 'Telmisartan', dose: '40mg', frequency: 'once daily (morning)', duration: '30 days', instructions: 'Blood pressure control' }
        ],
        labValues: [
          { test: 'Fasting Blood Sugar (FBS)', value: 142, unit: 'mg/dL', referenceRange: '70 - 100', flag: 'HIGH' },
          { test: 'Post-Prandial Blood Sugar (PPBS)', value: 198, unit: 'mg/dL', referenceRange: '< 140', flag: 'HIGH' },
          { test: 'HbA1c (Glycated Hemoglobin)', value: 7.4, unit: '%', referenceRange: '4.0 - 5.6', flag: 'HIGH' },
          { test: 'Blood Pressure (Systolic/Diastolic)', value: '140/90', unit: 'mmHg', referenceRange: '120/80', flag: 'HIGH' },
          { test: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.2', flag: 'NORMAL' }
        ],
        diagnoses: ['Type 2 Diabetes Mellitus (Uncontrolled)', 'Stage 1 Essential Hypertension'],
        confidenceScore: 0.98
      };
    } else if (isJointPain) {
      return {
        documentType: 'orthopedic_rheumatology_report',
        documentTitle: 'Orthopedic Joint Radiology & Rheumatology Panel',
        facility: 'City Orthopedic & Joint Imaging Center',
        date: '2026-06-15',
        affectedAnatomicalPart: 'Bilateral Knee Joints & 1st Metatarsophalangeal Joint',
        imagingFindings: 'X-Ray Bilateral Knees (AP/Lateral): Medial joint space narrowing (Grade 3 Osteoarthritis), marginal osteophytes & suprapatellar joint effusion.',
        medications: [
          { name: 'Etoricoxib', dose: '90mg', frequency: 'once daily after food', duration: '10 days' },
          { name: 'Febuxostat', dose: '40mg', frequency: 'once daily morning', duration: '30 days' },
          { name: 'Calcium Carbonate + Vitamin D3', dose: '500mg/1000IU', frequency: 'once daily', duration: '30 days' },
          { name: 'Tramadol + Paracetamol', dose: '37.5/325mg', frequency: 'SOS for severe pain', duration: 'SOS' }
        ],
        labValues: [
          { test: 'Serum Uric Acid', value: 8.6, unit: 'mg/dL', referenceRange: '3.5 - 7.2', flag: 'HIGH' },
          { test: 'C-Reactive Protein (CRP)', value: 24.5, unit: 'mg/L', referenceRange: '< 5.0', flag: 'HIGH' },
          { test: 'Erythrocyte Sedimentation Rate (ESR)', value: 48, unit: 'mm/hr', referenceRange: '0 - 20', flag: 'HIGH' },
          { test: 'Rheumatoid Factor (RA Factor)', value: 45, unit: 'IU/mL', referenceRange: '< 14', flag: 'HIGH' },
          { test: 'Serum Calcium', value: 9.2, unit: 'mg/dL', referenceRange: '8.5 - 10.5', flag: 'NORMAL' },
          { test: 'Vitamin D3 (25-OH)', value: 16.4, unit: 'ng/mL', referenceRange: '30.0 - 100.0', flag: 'LOW' }
        ],
        diagnoses: [
          'Bilateral Knee Osteoarthritis with Active Joint Effusion',
          'Hyperuricemic Gouty Arthropathy',
          'Vitamin D Deficiency'
        ],
        confidenceScore: 0.97
      };
    } else if (isFever) {
      return {
        documentType: 'lab_report',
        documentTitle: 'Hematology & Acute Infection Diagnostic Panel',
        facility: 'District Hospital Pathology Lab',
        date: '2026-06-15',
        medications: [
          { name: 'Paracetamol', dose: '650mg', frequency: 'thrice daily for fever', duration: '5 days' },
          { name: 'Doxycycline', dose: '100mg', frequency: 'twice daily (after food)', duration: '7 days' }
        ],
        labValues: [
          { test: 'Platelet Count', value: 85000, unit: '/uL', referenceRange: '150,000 - 450,000', flag: 'LOW' },
          { test: 'Total Leukocyte Count (TLC)', value: 14200, unit: '/uL', referenceRange: '4,000 - 11,000', flag: 'HIGH' },
          { test: 'Dengue NS1 Antigen', value: 'Positive', unit: 'Index', referenceRange: 'Negative', flag: 'HIGH' }
        ],
        diagnoses: ['Acute Viral Syndrome / Suspected Dengue Fever', 'Thrombocytopenia'],
        confidenceScore: 0.95
      };
    } else if (isCough) {
      return {
        documentType: 'pulmonology_report',
        documentTitle: 'Pulmonary Diagnostic & Allergy Evaluation Report',
        facility: 'Chest & Respiratory Clinic',
        date: '2026-06-15',
        imagingFindings: 'Chest X-Ray: Mild bilateral peribronchial thickening.',
        medications: [
          { name: 'Montelukast + Levocetirizine', dose: '10mg/5mg', frequency: 'once daily (bedtime)', duration: '14 days' },
          { name: 'Budesonide + Formoterol Inhaler', dose: '200mcg/6mcg', frequency: '2 puffs twice daily', duration: '30 days' }
        ],
        labValues: [
          { test: 'Absolute Eosinophil Count (AEC)', value: 680, unit: '/uL', referenceRange: '20 - 500', flag: 'HIGH' },
          { test: 'Oxygen Saturation (SpO2 Resting)', value: 94, unit: '%', referenceRange: '95 - 100', flag: 'LOW' }
        ],
        diagnoses: ['Hyper-reactive Airway Disease / Allergic Bronchitis'],
        confidenceScore: 0.94
      };
    } else {
      return {
        documentType: 'prescription',
        documentTitle: 'General Outpatient Prescription Record',
        facility: 'District Government Hospital OPD',
        date: '2026-06-15',
        medications: [
          { name: 'Metformin', dose: '500mg', frequency: 'twice daily (after meals)', duration: '30 days' },
          { name: 'Amlodipine', dose: '5mg', frequency: 'once daily (morning)', duration: '30 days' }
        ],
        labValues: [
          { test: 'Fasting Blood Sugar', value: 142, unit: 'mg/dL', referenceRange: '70 - 100', flag: 'HIGH' },
          { test: 'HbA1c (Glycated Hemoglobin)', value: 7.4, unit: '%', referenceRange: '4.0 - 5.6', flag: 'HIGH' },
          { test: 'Blood Pressure (Systolic/Diastolic)', value: '140/90', unit: 'mmHg', referenceRange: '120/80', flag: 'HIGH' }
        ],
        diagnoses: ['Type 2 Diabetes Mellitus', 'Stage 1 Essential Hypertension'],
        confidenceScore: 0.96
      };
    }
  }
}

export function getLabFlagBadgeClass(flag) {
  if (flag === 'HIGH') {
    return 'bg-red-100 text-red-800 border border-red-300 font-black px-2 py-0.5 rounded text-[11px]';
  }
  if (flag === 'LOW') {
    return 'bg-amber-100 text-amber-900 border border-amber-300 font-black px-2 py-0.5 rounded text-[11px]';
  }
  return 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold px-2 py-0.5 rounded text-[11px]';
}
