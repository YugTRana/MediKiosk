// ============================================================================
// MediKiosk Client Authentication & Patient Management Service
// Clean Mobile Number, Name & Password Login, Sign Up & Admin Directory
// ============================================================================

const API_BASE = 'http://localhost:3000/api';

// Helper to get auth headers
export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Helper to handle auth token storage
function handleAuthResponse(data) {
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
}

/**
 * 1. Patient Sign Up (New Registration)
 */
export async function signupPatient({ name, mobile, password, age, gender, address }) {
  if (!name || !name.trim()) throw new Error('Please enter your full name.');
  if (!mobile || mobile.trim().length < 10) throw new Error('Please enter a valid 10-digit mobile number.');
  if (!password || password.trim().length < 4) throw new Error('Please choose a password with at least 4 characters.');

  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      mobile: mobile.trim(),
      password: password.trim(),
      age: parseInt(age, 10) || 28,
      gender: gender || 'Male',
      address: address && address.trim() ? address.trim() : 'Registered MediKiosk Citizen'
    })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    handleAuthResponse(data);
    return data.patientProfile;
  }
  throw new Error(data.message || 'Registration failed. Please try again.');
}

/**
 * 2. Patient Log In (Mobile + Password)
 */
export async function loginPatient({ mobile, password }) {
  if (!mobile || mobile.trim().length < 10) throw new Error('Please enter your 10-digit registered mobile number.');
  if (!password) throw new Error('Please enter your password.');

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile: mobile.trim(),
      password: password.trim()
    })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    handleAuthResponse(data);
    return data.patientProfile;
  }
  throw new Error(data.message || 'Login failed. Please check your credentials.');
}

/**
 * 2b. Staff Log In (Username + Password)
 */
export async function staffLogin(username, password) {
  if (!username) throw new Error('Please enter your username.');
  if (!password) throw new Error('Please enter your password.');

  const res = await fetch(`${API_BASE}/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username.trim(),
      password: password.trim()
    })
  });

  const data = await res.json();
  if (res.ok && data.staffProfile) {
    handleAuthResponse(data);
    // Also save role so we can do rudimentary frontend role checks
    localStorage.setItem('staffRole', data.staffProfile.role);
    return data;
  }
  throw new Error(data.message || 'Login failed. Please check your credentials.');
}

/**
 * Logout Helper
 */
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('staffRole');
}

/**
 * 3. Fetch All Patients for Admin Panel Directory
 */
export async function fetchAdminPatients() {
  const res = await fetch(`${API_BASE}/admin/patients`, {
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (res.ok && data.patients) {
    return data.patients;
  }
  throw new Error(data.message || 'Failed to fetch patient directory.');
}

/**
 * 4. Update Patient Profile (Admin or Edit Action)
 */
export async function updateAdminPatient(id, updateData) {
  const res = await fetch(`${API_BASE}/admin/patients/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updateData)
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    return data.patientProfile;
  }
  throw new Error(data.message || 'Failed to update patient profile.');
}

/**
 * 5. Delete Patient Profile (Admin Action)
 */
export async function deleteAdminPatient(id) {
  const res = await fetch(`${API_BASE}/admin/patients/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (res.ok && data.success) {
    return data;
  }
  throw new Error(data.message || 'Failed to delete patient record.');
}

/**
 * 6. Hospital EMR FHIR Bundle Push
 */
export async function pushFhirToHospitalEmr({ sessionId, tokenNumber, fhirBundle }) {
  const res = await fetch(`${API_BASE}/his/push`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId, tokenNumber, fhirBundle })
  });

  if (res.ok) {
    return await res.json();
  }
  throw new Error(`HIS server returned ${res.status}`);
}
