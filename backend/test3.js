const fetch = require('node-fetch'); // If needed, or just use native fetch

async function run() {
  const loginRes = await fetch('http://localhost:3000/api/auth/staff-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dr_sunita_rao', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  console.log('Token:', token ? 'Got token' : 'No token');

  const patchRes = await fetch('http://localhost:3000/api/sessions/sess_1788802226606/status', {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'COMPLETED' })
  });

  console.log('Patch Status:', patchRes.status);
  const patchData = await patchRes.json();
  console.log('Patch Response:', patchData);
}
run();
