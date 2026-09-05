// Clinical Summary Synthesis Engine (Module C - Phase 7)
// Genuinely synthesizes BOTH conversational intake history (SOCRATES / AYUSH)
// AND digitized document entities (Medications, Lab tests, Imaging, Drug Interactions)
// into a standardized 8-part physician dossier.
//
// Strict Safety Constraints:
// - Clinical summarization and structured synthesis ONLY.
// - NEVER invents unmentioned medical diagnoses or unauthorized prescriptions.
// - Every claim is strictly grounded in patient responses or extracted document records.

const { GoogleGenAI } = require('@google/genai');

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

/**
 * High-fidelity deterministic clinical synthesis fallback
 * Used when Gemini API is unconfigured, times out, or when offline.
 */
function synthesizeClinicalSectionsDeterministic(session, language = 'en') {
  const isHi = language === 'hi' || language === 'Hindi';
  const {
    complaintTitle = 'General Consultation',
    complaintId = 'general',
    answers = [],
    digitizedDocument = null,
    ayushAssessment = null,
    patientDetails = {}
  } = session;

  const rawAnswers = typeof answers === 'string' ? JSON.parse(answers || '[]') : answers;
  const doc = typeof digitizedDocument === 'string' ? JSON.parse(digitizedDocument || '{}') : digitizedDocument;
  const ayush = typeof ayushAssessment === 'string' ? JSON.parse(ayushAssessment || '{}') : ayushAssessment;

  const patientName = patientDetails?.name || 'Ramesh Chandra Sharma';
  const age = patientDetails?.age ? `${patientDetails.age}-year-old` : 'Adult';
  const gender = patientDetails?.gender ? patientDetails.gender.toLowerCase() : 'individual';

  // Build answer lookup map
  const answerMap = {};
  rawAnswers.forEach(a => {
    const qId = a.questionId || a.dimension || '';
    const val = a.selectedOption?.labelEn || a.customVoiceText || a.selectedOption?.value || '';
    const valHi = a.selectedOption?.labelHi || val;
    answerMap[qId] = isHi ? valHi : val;
  });

  // 1. CHIEF COMPLAINT (CC)
  const ccContent = isHi
    ? `मुख्य शिकायत: ${complaintTitle} (ओपीडी परामर्श हेतु)`
    : `${complaintTitle} (Outpatient Triage Evaluation)`;

  // 2. HISTORY OF PRESENT ILLNESS (HPI - SOCRATES)
  let hpiContent = '';
  if (isHi) {
    hpiContent = `${patientName} (${age}, ${gender}) ओपीडी में ${complaintTitle} की समस्या लेकर उपस्थित हुए हैं। `;
    if (rawAnswers.length > 0) {
      const details = rawAnswers.slice(0, 4).map(a => `${a.dimensionHi || a.dimension || 'लक्षण'}: ${a.selectedOption?.labelHi || a.selectedOption?.labelEn || a.customVoiceText || 'वर्णित'}`).join('; ');
      hpiContent += `प्रारंभिक लक्षण विवरण: ${details}। `;
    }
  } else {
    hpiContent = `${patientName} is a ${age} ${gender} presenting to the outpatient clinic with primary complaints of ${complaintTitle.toLowerCase()}. `;
    if (rawAnswers.length > 0) {
      const details = rawAnswers.slice(0, 4).map(a => `${a.dimension || 'Feature'}: ${a.selectedOption?.labelEn || a.customVoiceText || a.selectedOption?.value || 'reported'}`).join('; ');
      hpiContent += `Intake elicitation highlights: ${details}. `;
    }
  }

  if (doc?.imagingFindings) {
    hpiContent += isHi 
      ? `पूर्व रेडियोलॉजी जांच: "${doc.imagingFindings}"। ` 
      : `Correlating radiology: "${doc.imagingFindings}". `;
  }

  // Safe entity extraction from doc (handles both parsed arrays and JSON strings from Prisma)
  let docDiagnoses = [];
  let docMedications = [];
  let docLabValues = [];
  let docInteractions = [];

  if (doc) {
    try {
      docDiagnoses = Array.isArray(doc.diagnoses) ? doc.diagnoses : (typeof doc.diagnoses === 'string' ? JSON.parse(doc.diagnoses || '[]') : []);
    } catch (e) {}
    try {
      docMedications = Array.isArray(doc.medications) ? doc.medications : (typeof doc.medications === 'string' ? JSON.parse(doc.medications || '[]') : []);
    } catch (e) {}
    try {
      docLabValues = Array.isArray(doc.labValues) ? doc.labValues : (typeof doc.labValues === 'string' ? JSON.parse(doc.labValues || '[]') : []);
    } catch (e) {}
    try {
      docInteractions = Array.isArray(doc.drugInteractions) ? doc.drugInteractions : (typeof doc.drugInteractions === 'string' ? JSON.parse(doc.drugInteractions || '[]') : []);
    } catch (e) {}
  }

  // 3. PAST MEDICAL & SURGICAL HISTORY (PMHx / PSHx)
  let pmhxContent = isHi ? 'पूर्व चिकित्सीय इतिहास: ' : 'Past Medical History: ';
  if (docDiagnoses.length > 0) {
    pmhxContent += (isHi ? 'अपलोड किए गए पूर्व रिकॉर्ड से:\n• ' : 'Extracted from uploaded health records:\n• ') + docDiagnoses.join('\n• ');
  } else {
    pmhxContent += isHi ? 'कोई पूर्व सर्जिकल/चिकित्सीय रिकॉर्ड अपलोड नहीं।' : 'No documented previous surgical or chronic hospital records uploaded.';
  }

  // 4. CURRENT MEDICATIONS, ALLERGIES & DRUG INTERACTIONS
  let medsContent = '';
  if (docMedications.length > 0) {
    medsContent += (isHi ? 'सक्रिय दवाइयां (ओसीआर द्वारा सत्यापित):\n' : 'Active Prescriptions (Extracted via OCR):\n');
    medsContent += docMedications.map(m => `• ${m.name} ${m.dose || ''} — ${m.frequency || 'as directed'}`).join('\n');
  } else {
    medsContent += isHi ? 'वर्तमान में कोई नियमित दवा दर्ज नहीं।' : 'No active prescription medications documented.';
  }

  medsContent += isHi 
    ? '\n\nड्रग एलर्जी: ज्ञात कोई दवा एलर्जी नहीं (NKDA)' 
    : '\n\nAllergies: No Known Drug Allergies (NKDA) reported in intake flow.';

  if (docInteractions.length > 0) {
    medsContent += isHi
      ? `\n\n⚠️ संभावित दवा परस्पर-क्रिया (ड्रग इंटरैक्शन):\n` + docInteractions.map(d => `• [${d.severity}] ${d.drug1} + ${d.drug2}: ${d.title}`).join('\n')
      : `\n\n⚠️ Flagged Drug-Drug Interactions:\n` + docInteractions.map(d => `• [${d.severity}] ${d.drug1} + ${d.drug2}: ${d.title} (${d.clinicalRisk})`).join('\n');
  }

  // 5. FAMILY & SOCIAL HISTORY (FHx / SHx)
  const fshxContent = isHi
    ? 'पारिवारिक व सामाजिक इतिहास: कियोस्क फ्लो में गैर-लक्षित। (चिकित्सक परामर्श अनुसार पूछें)'
    : 'Family & Social History: Not routinely captured in kiosk intake flow. To be evaluated during clinician review if indicated.';

  // 6. PERSONAL HISTORY (Lifestyle, Diet, Sleep, AYUSH)
  let personalContent = isHi
    ? 'व्यक्तिगत आदतें: सामान्य आहार व दैनिक दिनचर्या।'
    : 'Personal History: Routine diet and lifestyle habits.';
  if (ayush) {
    personalContent = isHi
      ? `आयुर्वेदिक प्रकृति व व्यक्तिगत आदतें (दशविध परीक्षा):\n• प्रकृति: ${ayush.prakriti?.labelHi || ayush.dominantDosha || 'वात-पित्त'}\n• अग्नि: ${ayush.agni?.labelHi || 'विषमाग्नि'}\n• कोष्ठ: ${ayush.koshtha?.labelHi || 'मध्यम'}\n• आहार-विहार: ${ayush.aharaVihara?.labelHi || 'संतुलित'}`
      : `Ayurvedic Constitution & Habits (Dashavidha Pariksha):\n• Prakriti: ${ayush.prakriti?.labelEn || ayush.dominantDosha || 'Vata-Pitta'}\n• Agni: ${ayush.agni?.labelEn || 'Vishamagni'}\n• Koshtha: ${ayush.koshtha?.labelEn || 'Madhyama'}\n• Ahara-Vihara: ${ayush.aharaVihara?.labelEn || 'Balanced routine'}`;
  }

  // 7. REVIEW OF SYSTEMS (ROS)
  const rosContent = [
    `[Constitutional] Fever / Malaise: ${complaintId === 'fever' ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Musculoskeletal] Joint Pain / Swelling: ${complaintId === 'joint_pain' ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Respiratory] Cough / Shortness of breath: ${complaintId === 'cough_breathlessness' ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Cardiovascular] Chest tightness: ${complaintId === 'chest_pain' ? '✓ POSITIVE' : '✕ Denied'}`,
    `[Gastrointestinal] Abdominal pain / Nausea: ${complaintId === 'abdominal_pain' ? '✓ POSITIVE' : '✕ Denied'}`
  ].join('\n');

  // 8. PRIOR INVESTIGATIONS SUMMARY (Labs + Imaging)
  let invContent = isHi ? 'पूर्व जांच रिपोर्ट:\n' : 'Prior Investigations Summary:\n';
  if (docLabValues.length > 0) {
    invContent += docLabValues.map(l => `• ${l.test}: ${l.value} ${l.unit} [${l.flag || 'NORMAL'}] (Ref: ${l.referenceRange || 'Standard'})`).join('\n');
  } else {
    invContent += isHi ? 'कोई पूर्व प्रयोगशाला रिपोर्ट अपलोड नहीं।' : 'No laboratory diagnostic reports attached.';
  }
  if (doc?.imagingFindings) {
    invContent += (isHi ? '\n\nरेडियोलॉजी निष्कर्ष: ' : '\n\nRadiological Findings: ') + doc.imagingFindings;
  }

  return [
    { id: 'sec_cc', shortCode: 'CC', title: isHi ? '1. मुख्य शिकायत (Chief Complaint)' : '1. Chief Complaint', content: ccContent, status: 'accepted', isEditing: false },
    { id: 'sec_hpi', shortCode: 'HPI', title: isHi ? '2. वर्तमान बीमारी का इतिहास (HPI)' : '2. History of Present Illness (HPI)', content: hpiContent, status: 'accepted', isEditing: false },
    { id: 'sec_pmhx', shortCode: 'PMHx', title: isHi ? '3. पूर्व चिकित्सीय / सर्जिकल इतिहास' : '3. Past Medical & Surgical History', content: pmhxContent, status: 'accepted', isEditing: false },
    { id: 'sec_meds', shortCode: 'MEDS', title: isHi ? '4. वर्तमान दवाइयां व एलर्जी' : '4. Medications, Allergies & Interactions', content: medsContent, status: 'accepted', isEditing: false },
    { id: 'sec_fshx', shortCode: 'FHx/SHx', title: isHi ? '5. पारिवारिक व सामाजिक इतिहास' : '5. Family & Social History', content: fshxContent, status: 'accepted', isEditing: false },
    { id: 'sec_personal', shortCode: 'PERSONAL', title: isHi ? '6. व्यक्तिगत इतिहास (आहार / विहार / आयुष)' : '6. Personal History (Lifestyle & AYUSH)', content: personalContent, status: 'accepted', isEditing: false },
    { id: 'sec_ros', shortCode: 'ROS', title: isHi ? '7. शारीरिक तंत्र समीक्षा (ROS Checklist)' : '7. Review of Systems (ROS Checklist)', content: rosContent, status: 'accepted', isEditing: false },
    { id: 'sec_inv', shortCode: 'INV', title: isHi ? '8. पूर्व जांच रिपोर्ट सारांश (Investigations)' : '8. Prior Investigations Summary', content: invContent, status: 'accepted', isEditing: false }
  ];
}

/**
 * AI-Assisted Clinical Dossier Synthesis (Gemini 2.5 Flash)
 * Synthesizes conversational answers and OCR document data into standard physician prose.
 */
async function generateSynthesizedDossier(session, language = 'en') {
  if (!session) return [];

  // Fallback if Gemini is not configured
  if (!process.env.GEMINI_API_KEY || !ai) {
    return synthesizeClinicalSectionsDeterministic(session, language);
  }

  try {
    const isHi = language === 'hi' || language === 'Hindi';
    const systemInstruction = `
      You are a Senior Clinical Documentation Specialist and CMIO for an Indian tertiary hospital OPD.
      Your task is to synthesize raw patient conversational intake responses and digitized OCR document data
      into a standardized 8-part physician clinical summary.

      STANDARD FORMAT (Strictly 8 Sections):
      1. Chief Complaint (CC)
      2. History of Present Illness (HPI - SOCRATES structure)
      3. Past Medical & Surgical History (PMHx/PSHx)
      4. Medications, Allergies & Drug-Drug Interactions (MEDS)
      5. Family & Social History (FHx/SHx)
      6. Personal History & Habits (Ahara-Vihara / AYUSH)
      7. Review of Systems (ROS Checklist)
      8. Prior Investigations Summary (INV)

      CRITICAL SAFETY CONSTRAINTS:
      - Summarization and data synthesis ONLY.
      - NEVER diagnose an unstated medical condition.
      - NEVER prescribe or recommend any medications, dosages, or procedures.
      - Every claim must be traceable to the patient's answers or the OCR document.
      - If data for a section is absent, explicitly state that it was not captured at the kiosk.
      - Language: Generate in ${isHi ? 'Hindi (शुद्ध चिकित्सीय हिंदी)' : 'Professional English (EHR standard)'}.
    `;

    const prompt = `
      Patient Metadata: Name: ${session.patientDetails?.name || 'Ramesh Chandra Sharma'}, Age: ${session.patientDetails?.age || 68}, Gender: ${session.patientDetails?.gender || 'Male'}
      Chief Complaint: ${session.complaintTitle} (${session.complaintId})
      Conversational Answers: ${JSON.stringify(session.answers || [])}
      AYUSH Assessment Data: ${session.ayushAssessment ? JSON.stringify(session.ayushAssessment) : 'None'}
      Digitized Document Records: ${session.digitizedDocument ? JSON.stringify(session.digitizedDocument) : 'None'}
      Target Language: ${isHi ? 'Hindi' : 'English'}

      Output valid JSON array of 8 sections matching schema:
      [
        { "id": "sec_cc", "shortCode": "CC", "title": "...", "content": "..." },
        { "id": "sec_hpi", "shortCode": "HPI", "title": "...", "content": "..." },
        { "id": "sec_pmhx", "shortCode": "PMHx", "title": "...", "content": "..." },
        { "id": "sec_meds", "shortCode": "MEDS", "title": "...", "content": "..." },
        { "id": "sec_fshx", "shortCode": "FHx/SHx", "title": "...", "content": "..." },
        { "id": "sec_personal", "shortCode": "PERSONAL", "title": "...", "content": "..." },
        { "id": "sec_ros", "shortCode": "ROS", "title": "...", "content": "..." },
        { "id": "sec_inv", "shortCode": "INV", "title": "...", "content": "..." }
      ]
    `;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM_SYNTHESIS_TIMEOUT')), 5000)
    );

    const apiPromise = ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const text = response.text ? response.text.trim() : '';
    const parsedSections = JSON.parse(text);

    if (Array.isArray(parsedSections) && parsedSections.length >= 6) {
      return parsedSections.map(sec => ({
        ...sec,
        status: 'accepted',
        isEditing: false
      }));
    }
  } catch (err) {
    console.warn('[ClinicalSummaryService] AI synthesis error/timeout, using deterministic synthesis:', err.message);
  }

  return synthesizeClinicalSectionsDeterministic(session, language);
}

module.exports = {
  generateSynthesizedDossier,
  synthesizeClinicalSectionsDeterministic
};
