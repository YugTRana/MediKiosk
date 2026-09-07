require('dotenv').config();
const { makePatientCall } = require('./services/twilioService');

async function testCall() {
  try {
    const { makePatientCall } = require('./services/twilioService');
    const res = await makePatientCall('+919898575254', 'Test Patient', 'Test Doctor', 'Room 101', 'English');
    console.log('Success:', res);
  } catch (error) {
    console.error('Test Failed:', error);
  }
}

testCall();
