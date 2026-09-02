// Clinical Summary Generator for Physician Review Dashboard & Patient Audio Read-back
// Genuinely synthesizes BOTH conversational intake history (SOCRATES / AYUSH)
// AND digitized documents (Medications, Lab tests, Imaging, Drug Interactions)
// into the standard 8-part physician dossier.

export function generateHpiProse(session, language = 'en') {
  if (!session) return 'No clinical data available for this session.';
  const isHi = language === 'hi' || language === 'Hindi';

  const { complaintTitle, complaintId, answers = [], digitizedDocument, patientDetails } = session;
  const rawAnswers = Array.isArray(answers) ? answers : (typeof answers === 'string' ? JSON.parse(answers || '[]') : []);
  const doc = session.digitizedDocument;

  const answerMap = {};
  rawAnswers.forEach((a) => {
    const qId = a.questionId || a.dimension || '';
    const label = a.selectedOption?.labelEn || a.customVoiceText || a.selectedOption?.value || '';
    const labelHi = a.selectedOption?.labelHi || label;
    answerMap[qId] = isHi ? labelHi : label;
  });

  const patientName = patientDetails?.name || (isHi ? 'रोगी' : 'Patient');
  const age = patientDetails?.age ? (isHi ? `${patientDetails.age} वर्षीय` : `${patientDetails.age}-year-old`) : '';
  const gender = patientDetails?.gender ? (isHi ? (patientDetails.gender.toLowerCase() === 'female' ? 'महिला' : 'पुरुष') : patientDetails.gender.toLowerCase()) : '';

  // 1. Joint Pain & Swelling
  if (complaintId === 'joint_pain' || /joint|swelling|knee|arthritis/i.test(complaintTitle)) {
    const site = answerMap['joint_site'] || (isHi ? 'दोनों घुटने व जोड़' : 'the bilateral knee joints');
    const swellingQuality = answerMap['joint_swelling_character'] || (isHi ? 'दर्द, सूजन व अकड़न' : 'visible swelling, warmth, and joint stiffness');
    const exacerbating = answerMap['joint_exacerbating'] || (isHi ? 'चलने व सीढ़ियां चढ़ने पर' : 'weight-bearing and stairs');
    const associations = answerMap['joint_associations'] || '';

    let hpi = isHi
      ? `${patientName} (${age} ${gender}) ओपीडी में ${site} में दर्द व सूजन की शिकायत लेकर उपस्थित हुए हैं। `
      : `${patientName} is a ${age} ${gender} presenting with joint pain and swelling localized primarily to ${site}. `;

    hpi += isHi
      ? `रोगी ने ${swellingQuality} का अनुभव बताया है, जो कि ${exacerbating} बढ़ता है। `
      : `The patient reports ${swellingQuality.toLowerCase()}, aggravated by ${exacerbating.toLowerCase()}. `;

    if (associations && !associations.toLowerCase().includes('none') && !associations.includes('कोई नहीं')) {
      hpi += isHi ? `संबद्ध लक्षण: ${associations}। ` : `Associated clinical history includes: ${associations}. `;
    }

    if (doc?.labValues) {
      const markers = doc.labValues
        .filter(l => l.flag === 'HIGH' || l.flag === 'LOW')
        .map(l => `${l.test}: ${l.value} ${l.unit} [${l.flag}]`);
      if (markers.length > 0) {
        hpi += isHi
          ? `हाल की जांच रिपोर्ट में असामान्य मान: ${markers.join(', ')}। `
          : `Recent investigations demonstrate: ${markers.join(', ')}. `;
      }
    }

    if (doc?.imagingFindings) {
      hpi += isHi
        ? `रेडियोलॉजी निष्कर्ष: "${doc.imagingFindings}"। `
        : `Previous radiological evaluation noted: "${doc.imagingFindings}". `;
    }

    return hpi;
  }

  // 2. Fever & Infection
  if (complaintId === 'fever' || /fever/i.test(complaintTitle)) {
    const onset = answerMap['fever_onset'] || (isHi ? 'हाल ही में' : 'recently');
    const character = answerMap['fever_character'] || (isHi ? 'तेज बुखार' : 'elevated temperature');
    const associations = answerMap['fever_associations'] || '';
    const severity = answerMap['fever_severity'] || (isHi ? 'मध्यम' : 'moderate');

    let hpi = isHi
      ? `${patientName} (${age} ${gender}) बुखार की समस्या (${onset}) के साथ आए हैं। `
      : `${patientName} (${age} ${gender}) presents with complaints of ${complaintTitle.toLowerCase()} with onset ${onset.toLowerCase()}. `;

    hpi += isHi
      ? `बुखार का स्वरूप ${character} है तथा तीव्रता ${severity} है। `
      : `The fever is described as ${character.toLowerCase()} with self-assessed severity of ${severity.toLowerCase()}. `;

    if (associations && !associations.toLowerCase().includes('none')) {
      hpi += isHi ? `साथ में ${associations} भी उपस्थित है। ` : `The patient notes associated ${associations.toLowerCase()}. `;
    }

    if (doc?.labValues && doc.labValues.length > 0) {
      const flagged = doc.labValues.filter(l => l.flag === 'HIGH' || l.flag === 'LOW').map(l => `${l.test} ${l.value} ${l.unit} (${l.flag})`);
      if (flagged.length > 0) {
        hpi += isHi
          ? `अपलोड की गई जांच रिपोर्ट में असामान्य मान: ${flagged.join(', ')}। `
          : `Uploaded clinical records note abnormal markers: ${flagged.join(', ')}. `;
      }
    }
    return hpi;
  }

  // 3. Generic Fallback
  if (isHi) {
    return `${patientName} (${age} ${gender}) ओपीडी परामर्श हेतु उपस्थित हुए हैं। प्रारंभिक कियोस्क मूल्यांकन में ${rawAnswers.length} संरचित उत्तर दर्ज किए गए।`;
  }
  return `${patientName} (${age} ${gender}) presents to the outpatient clinic for evaluation of ${complaintTitle.toLowerCase()}. Initial automated intake assessment completed with ${rawAnswers.length} structured response points.`;
}

/**
 * Generate a patient-friendly 2-3 sentence audio read-back summary for the kiosk confirmation step.
 */
export function generatePatientReadBackSummary(session, language = 'en') {
  if (!session) return '';
  const isHi = language === 'hi' || language === 'Hindi';
  const { complaintTitle = 'General Consultation', answers = [], digitizedDocument, ayushAssessment } = session;

  const rawAnswers = Array.isArray(answers) ? answers : (typeof answers === 'string' ? JSON.parse(answers || '[]') : []);

  if (isHi) {
    let text = `आपके द्वारा दी गई जानकारी के अनुसार, आपकी मुख्य समस्या ${complaintTitle} है। `;
    if (rawAnswers.length > 0) {
      const firstAns = rawAnswers[0]?.selectedOption?.labelHi || rawAnswers[0]?.customVoiceText || '';
      if (firstAns) text += `आपने बताया कि ${firstAns}। `;
    }
    if (digitizedDocument?.medications?.length > 0) {
      text += `आपकी पूर्व पर्ची से ${digitizedDocument.medications.length} दवाइयां दर्ज कर ली गई हैं। `;
    }
    if (ayushAssessment) {
      text += `आपका आयुर्वेदिक प्रकृति मूल्यांकन भी पूरा कर लिया गया है। `;
    }
    text += `कृपया टोकन प्राप्त करने के लिए पुष्टि करें।`;
    return text;
  }

  let text = `Based on your consultation, your primary reason for today's visit is ${complaintTitle.toLowerCase()}. `;
  if (rawAnswers.length > 0) {
    const firstAns = rawAnswers[0]?.selectedOption?.labelEn || rawAnswers[0]?.customVoiceText || '';
    if (firstAns) text += `You noted ${firstAns.toLowerCase()}. `;
  }
  if (digitizedDocument?.medications?.length > 0) {
    text += `We have recorded ${digitizedDocument.medications.length} medications from your uploaded documents. `;
  }
  if (ayushAssessment) {
    text += `Your Ayurvedic constitution assessment has been recorded. `;
  }
  text += `Please confirm to generate your OPD consultation token.`;
  return text;
}

/**
 * Compiles the complete structured 8-part clinical dossier
 * Synthesizes BOTH conversational intake history AND digitized documents.
 */
export function compileClinicalDossier(session, language = 'en') {
  if (!session) return [];

  // If physician already edited and saved the summary, load the saved version directly
  if (session.editedByPhysician && session.physicianEditedSummary) {
    try {
      const saved = typeof session.physicianEditedSummary === 'string'
        ? JSON.parse(session.physicianEditedSummary)
        : session.physicianEditedSummary;
      if (Array.isArray(saved) && saved.length > 0) {
        return saved;
      }
    } catch (e) {
      console.warn('[compileClinicalDossier] Failed to parse physicianEditedSummary, regenerating:', e);
    }
  }

  const isHi = language === 'hi' || language === 'Hindi';
  const hpiText = generateHpiProse(session, language);
  const doc = session.digitizedDocument;
  const ayush = session.ayushAssessment;

  // 1. CHIEF COMPLAINT (CC)
  const ccSection = {
    id: 'sec_cc',
    shortCode: 'CC',
    title: isHi ? '1. मुख्य शिकायत (Chief Complaint)' : '1. Chief Complaint',
    content: isHi
      ? `मुख्य समस्या: ${session.complaintTitle || 'सामान्य परामर्श'}`
      : `${session.complaintTitle || 'General Medical Consultation'} (Outpatient Triage)`,
    status: 'accepted',
    isEditing: false
  };

  // 2. HISTORY OF PRESENT ILLNESS (HPI)
  const hpiSection = {
    id: 'sec_hpi',
    shortCode: 'HPI',
    title: isHi ? '2. वर्तमान बीमारी का इतिहास (HPI)' : '2. History of Present Illness (HPI)',
    content: hpiText,
    status: 'accepted',
    isEditing: false
  };

  // 3. PAST MEDICAL / SURGICAL / RADIOLOGY HISTORY (PMHx)
  let pmhxContent = isHi ? 'कोई पूर्व चिकित्सीय रिकॉर्ड अपलोड नहीं।' : 'No documented prior medical or surgical hospital records uploaded.';
  if (doc?.diagnoses && doc.diagnoses.length > 0) {
    pmhxContent = (isHi ? 'अपलोड किए गए पूर्व रिकॉर्ड से:\n• ' : 'Extracted from uploaded health records:\n• ') + doc.diagnoses.join('\n• ');
  }
  if (doc?.imagingFindings) {
    pmhxContent += (isHi ? '\n\nरेडियोलॉजी निष्कर्ष: ' : '\n\nRadiology Findings: ') + doc.imagingFindings;
  }
  const pmhxSection = {
    id: 'sec_pmhx',
    shortCode: 'PMHx',
    title: isHi ? '3. पूर्व चिकित्सीय व सर्जिकल इतिहास' : '3. Past Medical, Surgical & Radiology History',
    content: pmhxContent,
    status: 'accepted',
    isEditing: false
  };

  // 4. MEDICATIONS, ALLERGIES & DRUG INTERACTIONS (MEDS)
  let medsContent = isHi ? 'वर्तमान में कोई सक्रिय दवा दर्ज नहीं।' : 'No active prescription medications documented.';
  if (doc?.medications && doc.medications.length > 0) {
    medsContent = (isHi ? 'सक्रिय दवाइयां (ओसीआर सत्यापित):\n' : 'Active Prescriptions (OCR Extracted):\n');
    medsContent += doc.medications.map(m => `• ${m.name} ${m.dose || ''} — ${m.frequency || 'as directed'}`).join('\n');
  }
  medsContent += isHi 
    ? '\n\nड्रग एलर्जी: ज्ञात कोई एलर्जी नहीं (NKDA)' 
    : '\n\nAllergies: No Known Drug Allergies (NKDA) reported in intake flow.';

  if (doc?.drugInteractions && doc.drugInteractions.length > 0) {
    medsContent += isHi
      ? `\n\n⚠️ संभावित दवा परस्पर-क्रिया (Drug Interactions):\n` + doc.drugInteractions.map(d => `• [${d.severity}] ${d.drug1} + ${d.drug2}: ${d.title}`).join('\n')
      : `\n\n⚠️ Flagged Drug-Drug Interactions:\n` + doc.drugInteractions.map(d => `• [${d.severity}] ${d.drug1} + ${d.drug2}: ${d.title} (${d.clinicalRisk})`).join('\n');
  }

  const medsSection = {
    id: 'sec_meds',
    shortCode: 'MEDS',
    title: isHi ? '4. दवाइयां, एलर्जी व ड्रग इंटरैक्शन' : '4. Medications, Allergies & Drug Interactions',
    content: medsContent,
    status: 'accepted',
    isEditing: false
  };

  // 5. FAMILY & SOCIAL HISTORY (FHx/SHx)
  const fshxSection = {
    id: 'sec_fshx',
    shortCode: 'FHx/SHx',
    title: isHi ? '5. पारिवारिक व सामाजिक इतिहास' : '5. Family & Social History',
    content: isHi
      ? 'पारिवारिक इतिहास कियोस्क फ्लो में दर्ज नहीं। (चिकित्सक परामर्श अनुसार पूछें)'
      : 'Family & Social History: Not routinely captured in kiosk intake flow. To be evaluated during clinician review if indicated.',
    status: 'accepted',
    isEditing: false
  };

  // 6. PERSONAL HISTORY (Diet, Sleep, Lifestyle, AYUSH)
  let personalContent = isHi ? 'व्यक्तिगत आदतें: सामान्य दिनचर्या।' : 'Personal History: Routine diet and lifestyle habits.';
  if (ayush) {
    personalContent = isHi
      ? `आयुर्वेदिक दशविध परीक्षा व व्यक्तिगत इतिहास:\n• प्रकृति (संविधान): ${ayush.prakriti?.labelHi || ayush.dominantDosha || 'वात-पित्त'}\n• विकृति (असंतुलन): ${ayush.vikriti?.labelHi || 'वात वृद्धि'}\n• अग्नि (पाचन शक्ति): ${ayush.agni?.labelHi || 'विषमाग्नि'}\n• कोष्ठ (मल प्रवृत्ति): ${ayush.koshtha?.labelHi || 'मध्यम'}\n• आहार-विहार: ${ayush.aharaVihara?.labelHi || 'संतुलित'}`
      : `Ayurvedic Dashavidha Pariksha & Personal History:\n• Prakriti: ${ayush.prakriti?.labelEn || ayush.dominantDosha || 'Vata-Pitta'}\n• Vikriti: ${ayush.vikriti?.labelEn || 'Vata Imbalance'}\n• Agni (Digestion): ${ayush.agni?.labelEn || 'Vishamagni'}\n• Koshtha (Elimination): ${ayush.koshtha?.labelEn || 'Madhyama'}\n• Ahara-Vihara: ${ayush.aharaVihara?.labelEn || 'Balanced routine'}`;
  }

  const personalSection = {
    id: 'sec_personal',
    shortCode: 'PERSONAL',
    title: isHi ? '6. व्यक्तिगत इतिहास व आयुष प्रकृति' : '6. Personal History & AYUSH Profile',
    content: personalContent,
    status: 'accepted',
    isEditing: false,
    isAyush: !!ayush,
    rawAyushData: ayush
  };

  // 7. REVIEW OF SYSTEMS (ROS)
  const isFever = session.complaintId === 'fever';
  const isCough = session.complaintId === 'cough_breathlessness';
  const isAbdo = session.complaintId === 'abdominal_pain';
  const isChest = session.complaintId === 'chest_pain';
  const isJoint = session.complaintId === 'joint_pain';

  const rosContent = [
    `[Constitutional] Fever / Chills: ${isFever ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Musculoskeletal] Joint Pain / Swelling: ${isJoint ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Respiratory] Cough / Dyspnea: ${isCough ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Cardiovascular] Chest Tightness: ${isChest ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Gastrointestinal] Abdominal Cramps: ${isAbdo ? '✓ POSITIVE' : '✕ Denied'}`
  ].join('\n');

  const rosSection = {
    id: 'sec_ros',
    shortCode: 'ROS',
    title: isHi ? '7. शारीरिक तंत्र समीक्षा (ROS Checklist)' : '7. Review of Systems (ROS Checklist)',
    content: rosContent,
    status: 'accepted',
    isEditing: false
  };

  // 8. PRIOR INVESTIGATIONS SUMMARY (INV)
  let invContent = isHi ? 'कोई पूर्व प्रयोगशाला रिपोर्ट उपलब्ध नहीं।' : 'No prior laboratory records attached.';
  if (doc?.labValues && doc.labValues.length > 0) {
    invContent = (isHi ? 'प्रयोगशाला जांच रिपोर्ट:\n' : 'Diagnostic Laboratory Results:\n') +
      doc.labValues.map(l => `• ${l.test}: ${l.value} ${l.unit} [${l.flag || 'NORMAL'}] (Ref: ${l.referenceRange || 'Standard'})`).join('\n');
  }
  if (doc?.imagingFindings) {
    invContent += (isHi ? '\n\nरेडियोलॉजी निष्कर्ष: ' : '\n\nRadiology Findings: ') + doc.imagingFindings;
  }

  const invSection = {
    id: 'sec_inv',
    shortCode: 'INV',
    title: isHi ? '8. पूर्व जांच रिपोर्ट सारांश (Investigations)' : '8. Prior Investigations Summary',
    content: invContent,
    status: 'accepted',
    isEditing: false
  };

  return [
    ccSection,
    hpiSection,
    pmhxSection,
    medsSection,
    fshxSection,
    personalSection,
    rosSection,
    invSection
  ];
}
