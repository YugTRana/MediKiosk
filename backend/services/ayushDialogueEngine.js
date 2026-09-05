// Ayurvedic Clinical History Elicitation Engine (Module A - AYUSH Mode)
// Grounded strictly in classical Ayurvedic diagnostic frameworks:
// Prakriti, Vikriti, Agni, Koshtha, Nidana, and Samprapti.
//
// Hard Safety Constraints:
// 1. ELICITATION ONLY: Elicits patient symptoms, aggravating factors, and habits.
// 2. NEVER DIAGNOSES any Ayurvedic or modern disease entity (e.g. Amavata, Sandhigata Vata, Amlapitta).
// 3. NEVER PRESCRIBES OR RECOMMENDS herbal medicines, formulations, decoctions, or home remedies.

const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Static Ayurvedic fallback clarifying questions if LLM fails or times out
const AYUSH_STATIC_FALLBACKS = [
  {
    dimension: 'Nidana & Kala (हेतु व समय प्रभाव)',
    questionEn: 'At what time of day or under what conditions do your symptoms feel most intense?',
    questionHi: 'दिन के किस समय या किस स्थिति में आपकी तकलीफ सबसे ज्यादा बढ़ जाती है?',
    options: [
      {
        value: 'early_morning_cold',
        labelEn: 'Early morning or in cold/cloudy weather (Vata-Kapha aggravation)',
        labelHi: 'सुबह सोकर उठने पर या ठंड/बादल वाले मौसम में (वात-कफ वृद्धि)',
        doshaInfluence: 'Vata-Kapha'
      },
      {
        value: 'afternoon_heat',
        labelEn: 'Midday, after spicy meals, or under hot sun (Pitta aggravation)',
        labelHi: 'दोपहर में, तीखा खाने के बाद या धूप व गर्मी में (पित्त वृद्धि)',
        doshaInfluence: 'Pitta'
      },
      {
        value: 'immediately_after_meals',
        labelEn: 'Immediately after heavy meals or in evening hours (Agni/Kapha delay)',
        labelHi: 'भोजन के तुरंत बाद या शाम के समय पेट भारी होने पर (अग्नि मन्दता)',
        doshaInfluence: 'Agni-Kapha'
      },
      {
        value: 'constant_unpredictable',
        labelEn: 'Variable throughout the day with fluctuating energy (Vishamagni/Vata)',
        labelHi: 'पूरे दिन अनिश्चित, कभी ज्यादा कभी कम (विषम वात प्रभाव)',
        doshaInfluence: 'Vata'
      }
    ]
  },
  {
    dimension: 'Agni & Koshta Anubandha (अग्नि व कोष्ठ सम्बंध)',
    questionEn: 'How do your digestive capacity and bowel habits correlate when your symptoms flare up?',
    questionHi: 'जब आपकी तकलीफ बढ़ती है, तब आपकी भूख और पेट साफ होने पर क्या असर दिखता है?',
    options: [
      {
        value: 'severe_bloating_constipation',
        labelEn: 'Severe gas, dry hard stools, and bloated abdomen (Krura Koshtha)',
        labelHi: 'गंभीर गैस, सूखा कड़ा मल और पेट में तनाव/अफारा (क्रूर कोष्ठ)',
        doshaInfluence: 'Vata'
      },
      {
        value: 'burning_acidity_loose',
        labelEn: 'Acid reflux, sour belching, and loose warm bowel movements (Mridu Koshtha)',
        labelHi: 'सीने में जलन, खट्टी डकारें और ढीला पेट (मृदु कोष्ठ / पित्त)',
        doshaInfluence: 'Pitta'
      },
      {
        value: 'loss_of_taste_heaviness',
        labelEn: 'Complete loss of appetite, coated tongue, and persistent sluggishness (Mandagni)',
        labelHi: 'भूख बिल्कुल न लगना, जीभ पर सफेद मैल और भारीपन (मन्दाग्नि / कफ)',
        doshaInfluence: 'Kapha'
      },
      {
        value: 'normal_digestion',
        labelEn: 'Digestion and bowels remain normal; distress is purely localized',
        labelHi: 'पाचन और पेट साफ होना सामान्य रहता है; केवल स्थानीय दर्द है',
        doshaInfluence: 'Localized'
      }
    ]
  }
];

/**
 * Strict post-generation safety check:
 * Ensures the output NEVER diagnoses a Vyadhi or suggests Chikitsa / Aushadha.
 */
function isSafeAyushOutput(text) {
  if (!text) return true;
  const unsafeKeywords = [
    'diagnose', 'prescription', 'prescribe', 'treatment', 'cure', 'medicine',
    'take this', 'you have', 'disease', 'condition is', 'I recommend', 'buy',
    'dosage', 'churna', 'vati', 'bhasma', 'kwath', 'kadha', 'oil', 'taila',
    'vyadhi', 'aushadh', 'amavata', 'sandhigata', 'amlapitta', 'prameha'
  ];
  const lower = text.toLowerCase();
  for (const kw of unsafeKeywords) {
    if (lower.includes(kw)) {
      console.warn(`[AyushDialogueEngine] Unsafe keyword "${kw}" detected in output.`);
      return false;
    }
  }
  return true;
}

/**
 * Generate ONE clarifying Ayurvedic follow-up question based on free-text patient voice/touch input.
 * 
 * @param {Object} params
 * @param {string} params.freeText - Voice or text transcription of symptoms
 * @param {string} [params.complaintTitle] - Chief complaint title
 * @param {Array} [params.currentAnswers] - Previous Dashavidha answers
 * @param {Object} [params.patientMetadata] - { age, gender, language }
 */
async function getAyushClarifyingQuestion({ freeText, complaintTitle = 'Ayurvedic Intake', currentAnswers = [], patientMetadata = {} }) {
  if (!freeText || !freeText.trim()) {
    return {
      success: true,
      hasClarifyingQuestion: false,
      question: null
    };
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[AyushDialogueEngine] GEMINI_API_KEY missing. Using static Ayurvedic clarifying fallback.');
      const fallback = AYUSH_STATIC_FALLBACKS[0];
      return {
        success: true,
        source: 'static_fallback',
        question: fallback
      };
    }

    const systemInstruction = `
      You are an expert Ayurvedic Triage Assistant (Vaidya Assistant) for an OPD hospital kiosk in India.
      The patient has entered or spoken free-text symptoms in an Ayurvedic consultation mode.
      
      Your goal is strictly to ask ONE clarifying history-taking question grounded in the classical Ayurvedic diagnostic framework:
      - Prakriti (Constitutional tendency)
      - Vikriti (Active doshic vitiation: Vata / Pitta / Kapha)
      - Agni (Digestive power: Mandagni / Vishamagni / Tikshnagni / Samagni)
      - Koshtha (Bowel habit: Krura / Mridu / Madhyama)
      - Nidana (Dietary / climatic / lifestyle causative triggers)
      - Samprapti (Timing of aggravation: early morning, post-meal, seasonal)

      HARD SAFETY CONSTRAINTS:
      1. NEVER diagnose any disease (Vyadhi) such as Amavata, Sandhigata Vata, Amlapitta, etc.
      2. NEVER prescribe, suggest, or recommend any Ayurvedic medicines, herbs, churans, or treatments.
      3. Ask exactly ONE concise, clarifying question in BOTH English and Hindi.
      4. Provide exactly 3 or 4 tap-friendly multiple-choice options with labels in BOTH English and Hindi.
      5. Output valid JSON matching the exact schema.
    `;

    const prompt = `
      Patient Metadata: Age: ${patientMetadata.age || 35}, Gender: ${patientMetadata.gender || 'Unknown'}
      Complaint: ${complaintTitle}
      Patient Free-Text Statement: "${freeText.trim()}"
      
      Generate ONE clarifying question to help the Ayurvedic physician determine which Dosha, Agni state, or Nidana (causative habit) is most involved.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        dimension: { type: Type.STRING, description: 'Ayurvedic dimension e.g. Nidana & Kala / Agni Anubandha' },
        questionEn: { type: Type.STRING },
        questionHi: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING },
              labelEn: { type: Type.STRING },
              labelHi: { type: Type.STRING },
              doshaInfluence: { type: Type.STRING }
            },
            required: ['value', 'labelEn', 'labelHi']
          }
        }
      },
      required: ['dimension', 'questionEn', 'questionHi', 'options']
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM_TIMEOUT')), 4000)
    );

    const apiPromise = ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = response.text ? response.text.trim() : '';

    if (!isSafeAyushOutput(responseText)) {
      console.warn('[AyushDialogueEngine] LLM response violated safety constraints. Falling back to static question.');
      return {
        success: true,
        source: 'static_fallback_safety',
        question: AYUSH_STATIC_FALLBACKS[0]
      };
    }

    const parsedQuestion = JSON.parse(responseText);

    return {
      success: true,
      source: 'llm_ayush_engine',
      question: parsedQuestion
    };
  } catch (err) {
    console.warn(`[AyushDialogueEngine] Error generating clarifying question (${err.message}). Using static fallback.`);
    const fallback = AYUSH_STATIC_FALLBACKS[1];
    return {
      success: true,
      source: 'static_fallback',
      question: fallback
    };
  }
}

module.exports = {
  getAyushClarifyingQuestion,
  AYUSH_STATIC_FALLBACKS
};
