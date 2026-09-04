// ============================================================================
// ABDM National Health Authority Service
// Real ABDM Gateway, Live OTP Authentication & QR Code Card Verification
// ============================================================================

export const SAMPLE_ABHA_ACCOUNTS = [
  {
    id: 'nidhi_kharva',
    name: 'Nidhi Kharva',
    abhaNumber: '91-8472-1029-4821',
    abhaAddress: 'nidhi.kharva@abdm',
    gender: 'Female',
    age: 28,
    mobile: '+91 98765 43210',
    address: 'Plot 42, Civil Lines, Mumbai',
    badge: 'OPD Regular'
  },
  {
    id: 'vishal_kharva',
    name: 'Vishal Kharva',
    abhaNumber: '91-3829-1928-4019',
    abhaAddress: 'vishal.kharva@abdm',
    gender: 'Male',
    age: 32,
    mobile: '+91 98452 11928',
    address: 'Sector 5, Bandra West, Mumbai',
    badge: 'OPD General'
  },
  {
    id: 'pratham_kharva',
    name: 'Pratham Kharva',
    abhaNumber: '91-5555-1234-8890',
    abhaAddress: 'pratham.kharva@abdm',
    gender: 'Male',
    age: 22,
    mobile: '+91 97112 33455',
    address: 'Linking Road, Santa Cruz, Mumbai',
    badge: 'Kiosk Check-in'
  }
];

/**
 * 1. Verify Real ABHA ID or Mobile with ABDM / Prisma DB
 */
export async function verifyAbhaWithAbdm({ abhaId = '', mobile = '' }) {
  const inputStr = String(abhaId || mobile || '').trim();
  if (!inputStr) {
    throw new Error('Please enter your 14-digit ABHA ID or 10-digit mobile number.');
  }

  const res = await fetch('http://localhost:3000/api/abdm/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abhaId: inputStr, mobile: inputStr })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    return { ...data.patientProfile, verified: true };
  }
  throw new Error(data.message || 'No registered ABHA record found. You can verify via OTP or Create a new ABHA card.');
}

/**
 * 2. Initiate Live ABDM OTP Authentication (Mobile OTP or Aadhaar OTP)
 */
export async function initiateLiveAbhaOtp({ identifier, authMode = 'MOBILE_OTP' }) {
  const res = await fetch('http://localhost:3000/api/abdm/init-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, authMode })
  });

  const data = await res.json();
  if (res.ok && data.success) {
    return data;
  }
  throw new Error(data.message || 'Failed to initiate ABDM OTP request.');
}

/**
 * 3. Confirm Live ABDM OTP & Retrieve Real Patient Profile
 */
export async function confirmLiveAbhaOtp({ txnId, otp, patientData = {} }) {
  const res = await fetch('http://localhost:3000/api/abdm/confirm-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txnId, otp, patientData })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    return { ...data.patientProfile, verified: true };
  }
  throw new Error(data.message || 'Invalid or expired OTP. Please try again.');
}

/**
 * 4. Scan Real Physical ABHA / PMJAY QR Code Card
 */
export async function scanAbhaCardQr({ qrText }) {
  const res = await fetch('http://localhost:3000/api/abdm/qr-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrText })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    return { ...data.patientProfile, verified: true };
  }
  throw new Error(data.message || 'Failed to decode ABHA QR card.');
}

/**
 * 5. Instant Real ABHA Registration (Create & Persist in Database)
 */
export async function registerNewRealAbha({ name, age, gender, mobile, address, abhaAddress }) {
  const res = await fetch('http://localhost:3000/api/abdm/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, age, gender, mobile, address, abhaAddress })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    return { ...data.patientProfile, verified: true };
  }
  throw new Error(data.message || 'Failed to create real ABHA profile.');
}

/**
 * 6. Update Real Patient Profile Details
 */
export async function updateRealPatient({ id, name, age, gender, address, mobile }) {
  const res = await fetch('http://localhost:3000/api/abdm/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, age, gender, address, mobile })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    return { ...data.patientProfile, verified: true };
  }
  throw new Error(data.message || 'Failed to update patient profile.');
}

/**
 * 7. Hospital EMR FHIR Bundle Push
 */
export async function pushFhirToHospitalEmr({ sessionId, tokenNumber, fhirBundle }) {
  const res = await fetch('http://localhost:3000/api/his/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, tokenNumber, fhirBundle })
  });

  if (res.ok) {
    return await res.json();
  }
  throw new Error(`HIS server returned ${res.status}`);
}
