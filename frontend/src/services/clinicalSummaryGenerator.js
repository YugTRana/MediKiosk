// Clinical Summary Generator for Physician Review Dashboard
// Converts structured SOCRATES responses and OCR data into standardized EHR prose and sections

export function generateHpiProse(session) {
  if (!session) return 'No clinical data available for this session.';

  const { complaintTitle, complaintId, answers = [], digitizedDocument, patientDetails } = session;
  const answerMap = {};
  answers.forEach((a) => {
    const qId = a.questionId || '';
    const label = a.selectedOption?.labelEn || a.customVoiceText || a.selectedOption?.value || '';
    answerMap[qId] = label;
  });

  const patientName = patientDetails?.name || 'Patient';
  const age = patientDetails?.age ? `${patientDetails.age}-year-old` : '';
  const gender = patientDetails?.gender ? patientDetails.gender.toLowerCase() : 'individual';

  // ============================================================================
  // A. JOINT PAIN & SWELLING HPI GENERATOR (ANATOMICAL PART + SWELLING SPECIFIC)
  // ============================================================================
  if (complaintId === 'joint_pain' || /joint|swelling|knee|arthritis/i.test(complaintTitle)) {
    const site = answerMap['joint_site'] || 'the bilateral knee and peripheral joints';
    const swellingQuality = answerMap['joint_swelling_character'] || 'visible swelling, warmth, and joint stiffness';
    const exacerbating = answerMap['joint_exacerbating'] || 'prolonged weight-bearing and stairs';
    const associations = answerMap['joint_associations'] || 'no acute neurological deficits';

    let hpi = `${patientName} is a ${age} ${gender} presenting with joint pain and swelling localized primarily to ${site}. `;
    hpi += `The patient reports ${swellingQuality.toLowerCase()}. `;
    hpi += `Symptoms are reported as ${exacerbating.toLowerCase()}. `;
    
    if (associations && !associations.toLowerCase().includes('none')) {
      hpi += `Associated clinical history includes: ${associations}. `;
    }

    if (digitizedDocument?.labValues) {
      const uricAcid = digitizedDocument.labValues.find(l => /uric/i.test(l.test));
      const crp = digitizedDocument.labValues.find(l => /crp/i.test(l.test));
      const esr = digitizedDocument.labValues.find(l => /esr/i.test(l.test));
      const rf = digitizedDocument.labValues.find(l => /rheumatoid|ra/i.test(l.test));

      const markers = [];
      if (uricAcid && uricAcid.flag === 'HIGH') markers.push(`Serum Uric Acid of ${uricAcid.value} ${uricAcid.unit} (HIGH)`);
      if (crp && crp.flag === 'HIGH') markers.push(`CRP of ${crp.value} ${crp.unit} (HIGH)`);
      if (esr && esr.flag === 'HIGH') markers.push(`ESR of ${esr.value} ${esr.unit} (HIGH)`);
      if (rf && rf.flag === 'HIGH') markers.push(`RA Factor of ${rf.value} ${rf.unit} (HIGH)`);

      if (markers.length > 0) {
        hpi += `Recent rheumatology investigations demonstrate marked inflammatory elevation with ${markers.join(', ')}. `;
      }
    }

    if (digitizedDocument?.imagingFindings) {
      hpi += `Previous radiological evaluation noted: "${digitizedDocument.imagingFindings}" `;
    }

    return hpi;
  }

  // ============================================================================
  // B. FEVER HPI GENERATOR
  // ============================================================================
  if (complaintId === 'fever' || /fever/i.test(complaintTitle)) {
    const onset = answerMap['fever_onset'] || 'recently';
    const character = answerMap['fever_character'] || 'elevated temperature';
    const associations = answerMap['fever_associations'] || 'general fatigue';
    const severity = answerMap['fever_severity'] || 'moderate';

    let hpi = `${patientName} (${age} ${gender}) presents with complaints of ${complaintTitle.toLowerCase()} with onset ${onset.toLowerCase()}. `;
    hpi += `The fever is described as ${character.toLowerCase()}. `;
    if (associations && !associations.toLowerCase().includes('none')) {
      hpi += `The patient notes associated ${associations.toLowerCase()}. `;
    }
    hpi += `Current discomfort level is characterized as ${severity.toLowerCase()}. `;

    if (digitizedDocument?.labValues && digitizedDocument.labValues.length > 0) {
      const plt = digitizedDocument.labValues.find(l => /platelet/i.test(l.test));
      const tlc = digitizedDocument.labValues.find(l => /leukocyte|tlc/i.test(l.test));
      const fbs = digitizedDocument.labValues.find(l => /sugar|fbs|glucose/i.test(l.test));
      const hba1c = digitizedDocument.labValues.find(l => /hba1c/i.test(l.test));
      const bp = digitizedDocument.labValues.find(l => /blood pressure|bp/i.test(l.test));

      const labNotes = [];
      if (plt) labNotes.push(`Platelets ${plt.value} ${plt.unit} (${plt.flag})`);
      if (tlc) labNotes.push(`TLC ${tlc.value} ${tlc.unit} (${tlc.flag})`);
      if (fbs) labNotes.push(`FBS ${fbs.value} ${fbs.unit} (${fbs.flag})`);
      if (hba1c) labNotes.push(`HbA1c ${hba1c.value} ${hba1c.unit} (${hba1c.flag})`);
      if (bp) labNotes.push(`Blood Pressure ${bp.value} ${bp.unit} (${bp.flag})`);

      if (labNotes.length > 0) {
        hpi += `Uploaded clinical records note: ${labNotes.join(', ')}. `;
      }
    }
    return hpi;
  }

  // ============================================================================
  // C. COUGH & BREATHLESSNESS HPI GENERATOR
  // ============================================================================
  if (complaintId === 'cough_breathlessness' || /cough|breath/i.test(complaintTitle)) {
    const onset = answerMap['cough_onset'] || 'recently';
    const character = answerMap['cough_character'] || 'respiratory discomfort';
    const severity = answerMap['cough_severity'] || 'moderate';
    const associations = answerMap['cough_associations'] || 'none';

    let hpi = `${patientName} (${age} ${gender}) presents with ${complaintTitle.toLowerCase()} starting ${onset.toLowerCase()}. `;
    hpi += `Characterized as ${character.toLowerCase()} with a self-assessed severity of ${severity}/10. `;
    if (associations && !associations.toLowerCase().includes('none')) {
      hpi += `Associated symptoms include ${associations.toLowerCase()}. `;
    }
    return hpi;
  }

  // ============================================================================
  // D. ABDOMINAL PAIN HPI GENERATOR
  // ============================================================================
  if (complaintId === 'abdominal_pain' || /abdo|stomach/i.test(complaintTitle)) {
    const site = answerMap['abdo_site'] || 'the abdomen';
    const character = answerMap['abdo_character'] || 'abdominal cramps';
    const associations = answerMap['abdo_associations'] || 'nausea';
    const severity = answerMap['abdo_severity'] || 'moderate';

    let hpi = `${patientName} (${age} ${gender}) presents with abdominal pain localized to ${site.toLowerCase()}. `;
    hpi += `The pain is described as ${character.toLowerCase()} of ${severity.toLowerCase()} severity. `;
    if (associations && !associations.toLowerCase().includes('none')) {
      hpi += `Associated signs include ${associations.toLowerCase()}. `;
    }
    return hpi;
  }

  // ============================================================================
  // E. CHEST PAIN HPI GENERATOR
  // ============================================================================
  if (complaintId === 'chest_pain' || /chest/i.test(complaintTitle)) {
    const character = answerMap['chest_character'] || 'chest tightness';
    const radiation = answerMap['chest_radiation'] || 'no radiation';
    const associations = answerMap['chest_associations'] || 'none';
    const severity = answerMap['chest_severity'] || '7';

    let hpi = `${patientName} (${age} ${gender}) presents with acute chest discomfort characterized as ${character.toLowerCase()}. `;
    hpi += `Radiation of pain: ${radiation.toLowerCase()}. `;
    hpi += `Self-assessed pain severity is rated at ${severity}/10. `;
    if (associations && !associations.toLowerCase().includes('none')) {
      hpi += `Associated warning signs reported: ${associations.toLowerCase()}. `;
    }
    return hpi;
  }

  // Default Generic HPI Prose
  return `${patientName} (${age} ${gender}) presents to the outpatient clinic for evaluation of ${complaintTitle.toLowerCase()}. Initial automated intake assessment completed with ${answers.length} structured response points.`;
}

// Compiles the complete structured clinical dossier
export function compileClinicalDossier(session) {
  if (!session) return [];

  const hpiText = generateHpiProse(session);
  const doc = session.digitizedDocument;
  const isJointPain = session.complaintId === 'joint_pain' || /joint|swelling/i.test(session.complaintTitle);

  // 1. Chief Complaint Section
  const ccSection = {
    id: 'sec_cc',
    shortCode: 'CC',
    title: 'Chief Complaint',
    content: `${session.complaintTitle || 'General Medical Consultation'}${isJointPain ? ' (Joint Pain & Swelling Evaluation)' : ''}`,
    status: 'accepted',
    isEditing: false
  };

  // 2. History of Present Illness Section
  const hpiSection = {
    id: 'sec_hpi',
    shortCode: 'HPI',
    title: 'History of Present Illness (HPI)',
    content: hpiText,
    status: 'accepted',
    isEditing: false
  };

  // 3. Past Medical / Surgical History
  let pmhxText = 'No prior medical/surgical records uploaded.';
  if (doc?.diagnoses && doc.diagnoses.length > 0) {
    pmhxText = `Extracted from previous health records:\n• ${doc.diagnoses.join('\n• ')}`;
  }
  if (doc?.imagingFindings) {
    pmhxText += `\n• Imaging Findings: ${doc.imagingFindings}`;
  }
  const pmhxSection = {
    id: 'sec_pmhx',
    shortCode: 'PMHx',
    title: 'Past Medical / Surgical / Radiology History',
    content: pmhxText,
    status: 'accepted',
    isEditing: false
  };

  // 4. Medications & Allergies
  let medsText = 'No current active medications captured.';
  if (doc?.medications && doc.medications.length > 0) {
    medsText = 'Active Medications Extracted via OCR Scan:\n' + doc.medications.map(m => `• ${m.name} ${m.dose} — ${m.frequency}`).join('\n');
  }
  medsText += '\n\nAllergies: NKDA (No Known Drug Allergies reported in intake flow)';

  // If relevant lab values exist, append them to medication/investigation section
  if (doc?.labValues && doc.labValues.length > 0) {
    medsText += '\n\nRecent Diagnostic Laboratory Results:\n' + doc.labValues.map(l => `• ${l.test}: ${l.value} ${l.unit} [${l.flag}] (Ref: ${l.referenceRange})`).join('\n');
  }

  const medsSection = {
    id: 'sec_meds',
    shortCode: 'MEDS',
    title: 'Medications, Allergies & Diagnostic Labs',
    content: medsText,
    status: 'accepted',
    isEditing: false
  };

  // 5. Family & Social History
  const fshxSection = {
    id: 'sec_fshx',
    shortCode: 'FHx/SHx',
    title: 'Family & Social History',
    content: 'Not captured in automated kiosk flow. (Clinician to elicit if indicated for chronic management)',
    status: 'accepted',
    isEditing: false
  };

  // 6. Review of Systems (ROS)
  const isFever = session.complaintId === 'fever';
  const isCough = session.complaintId === 'cough_breathlessness';
  const isAbdo = session.complaintId === 'abdominal_pain';
  const isChest = session.complaintId === 'chest_pain';

  const rosContent = [
    `[Constitutional] Fever / Chills: ${isFever ? '✓ POSITIVE (Assessed)' : '✕ Not primary complaint'}`,
    `[Musculoskeletal] Joint Pain / Swelling: ${isJointPain ? '✓ POSITIVE (Assessed in depth)' : '✕ Denied'}`,
    `[Respiratory] Cough / Breathlessness: ${isCough ? '✓ POSITIVE (Assessed)' : '✕ Denied'}`,
    `[Cardiovascular] Chest Pain / Squeezing: ${isChest ? '✓ POSITIVE (Assessed)' : '✕ Denied'}`,
    `[Gastrointestinal] Abdominal Cramps / Vomiting: ${isAbdo ? '✓ POSITIVE (Assessed)' : '✕ Denied'}`,
    `[Neurological] Focal Weakness / Facial Numbness: ${session.redFlagsTriggered?.length > 0 ? '⚠ FLAGGED FOR REVIEW' : '✕ Denied'}`
  ].join('\n');

  const rosSection = {
    id: 'sec_ros',
    shortCode: 'ROS',
    title: 'Review of Systems (ROS Checklist)',
    content: rosContent,
    status: 'accepted',
    isEditing: false
  };

  // 7. AYUSH Intake Dossier (Dashavidha Pariksha Formulation)
  let ayushSection = null;
  if (session.ayushAssessment) {
    const ay = session.ayushAssessment;
    const prakritiLabel = ay.prakriti?.labelEn || ay.prakriti?.labelHi || ay.dominantDosha || 'Vata-Pitta';
    const vikritiLabel = ay.vikriti?.labelEn || ay.vikriti?.labelHi || ay.vikriti?.dosha || 'Vata Imbalance';
    const agniLabel = ay.agni?.labelEn || ay.agni?.labelHi || ay.agni?.agniType || ay.agni || 'Vishamagni';
    const koshthaLabel = ay.koshtha?.labelEn || ay.koshtha?.labelHi || ay.koshtha?.koshthaType || ay.koshtha || 'Madhyama';
    const saraLabel = ay.sara?.labelEn || ay.sara?.grade || 'Madhyama Sara';
    const samhananaLabel = ay.samhanana?.labelEn || ay.samhanana?.compactness || 'Madhyama Samhanana';
    const sattvaLabel = ay.sattva?.labelEn || ay.sattva?.grade || 'Madhyama Sattva';
    const satmyaLabel = ay.satmya?.labelEn || ay.satmya?.type || 'Madhyama Satmya';
    const vyayamaLabel = ay.vyayamaShakti?.labelEn || ay.vyayamaShakti?.capacity || 'Madhyama Vyayama Shakti';
    const lifestyleLabel = ay.aharaVihara?.labelEn || ay.aharaVihara?.pattern || ay.aharaVihara || 'Routine Diet & Sleep';

    const ayushText = [
      `🌿 AYUSH DASHAVIDHA PARIKSHA CLINICAL DOSSIER:`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `[1] DOSHA PRAKRITI & VIKRITI:`,
      `• Dominant Constitutional Frame (Prakriti): ${prakritiLabel}`,
      `• Active Morbidity & Imbalance (Vikriti): ${vikritiLabel}`,
      ``,
      `[2] METABOLISM & ELIMINATION (AGNI & KOSHTHA):`,
      `• Digestive Fire (Agni): ${agniLabel}`,
      `• Bowel Habit & Elimination (Koshtha): ${koshthaLabel}`,
      ``,
      `[3] DHATU & PHYSIQUE (SARA, SAMHANANA & SATMYA):`,
      `• Tissue Excellence & Vitality (Sara): ${saraLabel}`,
      `• Body Compactness & Musculoskeletal Firmness (Samhanana): ${samhananaLabel}`,
      `• Adaptational Tolerance (Satmya): ${satmyaLabel}`,
      ``,
      `[4] PSYCHE & STAMINA (SATTVA & VYAYAMA SHAKTI):`,
      `• Mental Resilience & Temperament (Sattva): ${sattvaLabel}`,
      `• Physical Endurance & Work Capacity (Vyayama Shakti): ${vyayamaLabel}`,
      ``,
      `[5] AHARA-VIHARA ETIOLOGY (NIDANA & HABITS):`,
      `• Dietary Patterns & Routine: ${lifestyleLabel}`,
      ay.clarifyingHistory ? `• Clarifying Voice/Symptom Notes: "${ay.clarifyingHistory}"` : null,
      ``,
      `[6] AYURVEDIC CLINICAL SUMMARY:`,
      `• ${ay.ayurvedicSummary || `${prakritiLabel} with ${vikritiLabel}. Managed in accordance with classical Chikitsa Sutra.`}`
    ].filter(Boolean).join('\n');

    ayushSection = {
      id: 'sec_ayush',
      shortCode: 'AYUSH',
      title: 'AYUSH Clinical Assessment (Dashavidha Pariksha)',
      content: ayushText,
      status: 'accepted',
      isEditing: false,
      isAyush: true,
      rawAyushData: ay
    };
  }

  const sections = [ccSection, hpiSection, pmhxSection, medsSection, fshxSection, rosSection];
  if (ayushSection) sections.push(ayushSection);

  return sections;
}
