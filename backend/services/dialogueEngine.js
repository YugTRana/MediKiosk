const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');
const path = require('path');

// Load fallback flows
const fallbackFlows = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../mockData/dialogueFlows.json'), 'utf8')
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Validates the LLM output to ensure it does not contain prescriptive or diagnostic language.
 * (Rudimentary check for safety).
 */
function isSafeOutput(text) {
  const unsafeKeywords = [
    'diagnose', 'prescription', 'prescribe', 'treatment', 'cure', 'medicine', 'take this',
    'you have', 'disease', 'condition is', 'I recommend', 'buy', 'dosage'
  ];
  const lowerText = text.toLowerCase();
  for (const keyword of unsafeKeywords) {
    if (lowerText.includes(keyword)) {
      return false;
    }
  }
  return true;
}

/**
 * Finds the static fallback question if Gemini fails.
 */
function getStaticFallbackQuestion(complaintId, historyLength) {
  const complaint = fallbackFlows.complaints.find(c => c.id === complaintId);
  if (!complaint || !complaint.questions) return null;
  // If the history length exceeds the available static questions, return null (meaning questioning is done)
  if (historyLength >= complaint.questions.length) return null;
  return complaint.questions[historyLength];
}

/**
 * Generates the next question dynamically.
 * @param {Object} params
 * @param {string} params.complaintId - The ID of the chief complaint (or 'general').
 * @param {string} params.complaintTitle - Free text or selected title of the complaint.
 * @param {Array} params.history - Array of previous Q&A objects: { question, answer }
 * @param {Object} params.patientMetadata - { age, gender, language }
 */
async function getNextQuestion({ complaintId, complaintTitle, history, patientMetadata }) {
  const historyLength = history ? history.length : 0;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not found in environment.");
    }

    const systemInstruction = `
      You are an AI Clinical Triage Assistant for an OPD Kiosk in India. 
      Your task is strictly limited to gathering a structured medical history using the SOCRATES pattern for pain or standard HPI/ROS structures.
      
      RULES:
      1. NEVER diagnose, prescribe, suggest treatments, or offer medical advice.
      2. Ask exactly ONE follow-up question based on the patient's chief complaint and previous answers.
      3. The question must be short, empathetic, and easily understood by someone with low health literacy.
      4. Provide exactly 3 to 5 tap-friendly, mutually-exclusive multiple-choice options for the answer.
      5. Do not include "Other" as an option (the UI provides a fallback).
      6. Provide the question and options in BOTH English and Hindi.
      7. Output ONLY valid JSON matching the exact schema requested.
    `;

    const prompt = `
      Patient Metadata: Age: ${patientMetadata.age || 'Unknown'}, Gender: ${patientMetadata.gender || 'Unknown'}
      Chief Complaint: ${complaintTitle} (ID: ${complaintId})
      
      Conversation History:
      ${history.length > 0 ? history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join('\n') : "No questions asked yet."}
      
      Based on the history, generate the next most clinically relevant history-taking question. 
      If the history is already comprehensive enough (4-5 questions answered) and you have enough information, return a JSON object with "isComplete": true instead of a question.
    `;

    // Setting a hard timeout using Promise.race (4000ms max)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM_TIMEOUT')), 4000)
    );

    const schema = {
      type: Type.OBJECT,
      properties: {
        isComplete: { 
          type: Type.BOOLEAN, 
          description: "Set to true if no further questions are needed." 
        },
        questionEn: { type: Type.STRING },
        questionHi: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              labelEn: { type: Type.STRING },
              labelHi: { type: Type.STRING },
              value: { type: Type.STRING }
            },
            required: ["labelEn", "labelHi", "value"]
          }
        }
      }
    };

    const llmPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2
      }
    });

    const response = await Promise.race([llmPromise, timeoutPromise]);
    const responseData = JSON.parse(response.text());

    if (responseData.isComplete) {
      return { source: 'LLM', isComplete: true };
    }

    // Safety validation
    if (!isSafeOutput(responseData.questionEn) || !isSafeOutput(responseData.questionHi)) {
      throw new Error('UNSAFE_LLM_OUTPUT');
    }

    return {
      source: 'LLM',
      isComplete: false,
      data: {
        id: `llm_q_${historyLength + 1}`,
        dimension: "Adaptive",
        questionEn: responseData.questionEn,
        questionHi: responseData.questionHi,
        options: responseData.options
      }
    };

  } catch (error) {
    console.warn(`[DialogueEngine] LLM failed or timed out: ${error.message}. Falling back to static flow.`);
    
    // Fallback to static flow
    const staticQuestion = getStaticFallbackQuestion(complaintId, historyLength);
    
    if (!staticQuestion) {
      // If we run out of static questions
      return { source: 'STATIC', isComplete: true };
    }

    return {
      source: 'STATIC',
      isComplete: false,
      data: staticQuestion
    };
  }
}

module.exports = {
  getNextQuestion
};
