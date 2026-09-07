const twilio = require('twilio');

/**
 * Make a real phone call to the patient using Twilio Programmable Voice
 * @param {string} toMobile - The patient's mobile number (e.g. 9876543210)
 * @param {string} patientName - The name of the patient
 * @param {string} doctorName - The name of the doctor calling
 * @param {string} roomLabel - The room number/label
 * @param {string} language - Preferred language (e.g. 'Hindi' or 'English')
 */
async function makePatientCall(toMobile, patientName, doctorName, roomLabel, language) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials missing in .env');
  }

  const client = twilio(accountSid, authToken);

  // Format the mobile number to E.164 standard (assume +91 if no country code provided for India)
  let formattedNumber = toMobile.trim();
  if (!formattedNumber.startsWith('+')) {
    formattedNumber = `+91${formattedNumber}`; // Defaulting to India code for this project
  }
  
  // HACKATHON BYPASS: Twilio Trial accounts can ONLY call verified personal phone numbers.
  // We will first try to call the ACTUAL patient number given. If Twilio rejects it 
  // (because it's not verified in the free trial), we AUTOMATICALLY fallback to your verified phone.
  const VERIFIED_FALLBACK_NUMBER = '+919898575254';

  // Create TwiML (Twilio Markup Language) for the text-to-speech announcement
  let announcementText = `Attention please. ${patientName}, Doctor ${doctorName} is ready to see you. Please proceed to ${roomLabel}.`;
  let voiceLang = 'en-IN'; // Indian English accent

  if (language === 'हिंदी' || language === 'Hindi') {
    announcementText = `कृपया ध्यान दें। ${patientName}, डॉक्टर ${doctorName} आपको बुला रहे हैं। कृपया ${roomLabel} में आएं।`;
    voiceLang = 'hi-IN';
  }

  const twiml = `<Response><Say voice="alice" language="${voiceLang}">${announcementText}</Say><Pause length="1"/><Say voice="alice" language="${voiceLang}">${announcementText}</Say></Response>`;
  const twimlUrl = 'http://twimlets.com/echo?Twiml=' + encodeURIComponent(twiml);

  try {
    // 1. Try to call the ACTUAL patient number first
    const call = await client.calls.create({
      url: twimlUrl,
      to: formattedNumber,
      from: fromNumber
    });
    
    console.log(`📞 [Twilio Voice] Call initiated to Patient Number ${formattedNumber}. Call SID: ${call.sid}`);
    return { success: true, callSid: call.sid };
  } catch (error) {
    console.warn(`⚠️ [Twilio Voice] Failed to call patient number ${formattedNumber}:`, error.message);
    
    // 2. If it failed (e.g. Unverified Number on Trial Account), fallback to the verified demo number
    console.log(`🔄 [Twilio Voice] Falling back to verified demo number ${VERIFIED_FALLBACK_NUMBER}...`);
    try {
      const fallbackCall = await client.calls.create({
        url: twimlUrl,
        to: VERIFIED_FALLBACK_NUMBER,
        from: fromNumber
      });
      console.log(`📞 [Twilio Voice] Fallback call initiated to ${VERIFIED_FALLBACK_NUMBER}. Call SID: ${fallbackCall.sid}`);
      return { success: true, callSid: fallbackCall.sid, fallbackUsed: true };
    } catch (fallbackError) {
      console.error(`🚨 [Twilio Voice] Fallback call also failed:`, fallbackError.message);
      throw new Error(`Failed to place call via Twilio: ${fallbackError.message}`);
    }
  }
}

module.exports = {
  makePatientCall
};
