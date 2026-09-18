// ============================================================================
// MediKiosk Client Authentication & Patient Management Service
// Clean Mobile Number, Name & Password Login, Sign Up & Admin Directory
// ============================================================================

const API_BASE = 'http://localhost:3000/api';

// Helper to get auth headers (uses staff token first for dashboard calls)
export function getAuthHeaders() {
  const token = localStorage.getItem('staffToken') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Helper to handle auth token storage
function handleAuthResponse(data, isStaff = false) {
  const token = data.token || data.staffProfile?.token || data.patientProfile?.token;
  if (token) {
    if (isStaff) {
      localStorage.setItem('staffToken', token);
      localStorage.setItem('token', token);
    } else {
      localStorage.setItem('patientToken', token);
    }
  }
}

// Wrapper for robust fetch error handling
async function apiFetch(url, options) {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to the server. Please check if the backend is running.');
    }
    throw err;
  }
}

/**
 * 1. Patient Sign Up (New Registration)
 */
export async function signupPatient({ name, mobile, email, password, age, gender, address }) {
  if (!name || !name.trim()) throw new Error('Please enter your full name.');
  if (!mobile || mobile.trim().length < 10) throw new Error('Please enter a valid 10-digit mobile number.');
  if (!password || password.trim().length < 4) throw new Error('Please choose a password with at least 4 characters.');

  const res = await apiFetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim() : null,
      password: password.trim(),
      age: parseInt(age, 10) || 28,
      gender: gender || 'Male',
      address: address && address.trim() ? address.trim() : 'Registered MediKiosk Citizen'
    })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    handleAuthResponse(data, false);
    localStorage.setItem('patientProfile', JSON.stringify(data.patientProfile));
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

  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile: mobile.trim(),
      password: password.trim()
    })
  });

  const data = await res.json();
  if (res.ok && data.patientProfile) {
    handleAuthResponse(data, false);
    localStorage.setItem('patientProfile', JSON.stringify(data.patientProfile));
    return data.patientProfile;
  }
  throw new Error(data.message || 'Login failed. Please check your credentials.');
}

export async function sendOtp(email) {
  if (!email) throw new Error('Email is required to send OTP.');
  const res = await apiFetch(`${API_BASE}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to send OTP. Please try again.');
}

export async function verifyOtp(email, otp) {
  if (!email || !otp) throw new Error('Email and OTP are required.');
  const res = await apiFetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), otp: otp.trim() })
  });
  const data = await res.json();
  if (res.ok && data.success) return data;
  throw new Error(data.message || 'Failed to verify OTP. Please try again.');
}

/**
 * 2b. Staff Log In (Username + Password)
 */
export async function staffLogin(username, password) {
  if (!username) throw new Error('Please enter your username.');
  if (!password) throw new Error('Please enter your password.');

  const res = await apiFetch(`${API_BASE}/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: username.trim(),
      password: password.trim()
    })
  });

  const data = await res.json();
  if (res.ok && (data.staffProfile || data.token)) {
    handleAuthResponse(data, true);
    const profile = data.staffProfile || {};
    if (profile.role) {
      localStorage.setItem('staffRole', profile.role);
    }
    localStorage.setItem('staffUser', JSON.stringify(profile));
    return data;
  }
  
  if (res.status === 401 && data.message === 'Invalid credentials') {
    throw new Error('Authentication failed: Invalid credentials provided.');
  }
  throw new Error(data.message || 'Login failed. Please check your credentials.');
}

/**
 * Staff Session Clearing Helper (for Kiosk entrance or Staff Logout)
 */
export function clearStaffSession() {
  localStorage.removeItem('staffToken');
  localStorage.removeItem('staffRole');
  localStorage.removeItem('staffUser');
  localStorage.removeItem('token');
}

/**
 * Full Logout Helper
 */
export function logout() {
  clearStaffSession();
  localStorage.removeItem('patientToken');
  localStorage.removeItem('patientProfile');
}

/**
 * Helper to retrieve stored staff user object
 */
export function getSavedStaffUser() {
  const str = localStorage.getItem('staffUser');
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Fetch fresh Staff Profile from DB using staff JWT
 */
export async function fetchStaffProfile() {
  try {
    const res = await apiFetch(`${API_BASE}/auth/staff-profile`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.staffProfile) {
        localStorage.setItem('staffUser', JSON.stringify(data.staffProfile));
        if (data.staffProfile.role) {
          localStorage.setItem('staffRole', data.staffProfile.role);
        }
        return data.staffProfile;
      }
    }
  } catch (err) {
    console.warn('Network error while fetching staff profile:', err);
  }
  return getSavedStaffUser();
}

/**
 * 3. Fetch All Patients for Admin Panel Directory
 */
export async function fetchAdminPatients() {
  const res = await apiFetch(`${API_BASE}/admin/patients`, {
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
  const res = await apiFetch(`${API_BASE}/admin/patients/${id}`, {
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
  const res = await apiFetch(`${API_BASE}/admin/patients/${id}`, {
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
  const res = await apiFetch(`${API_BASE}/his/push`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId, tokenNumber, fhirBundle })
  });

  if (res.ok) {
    return await res.json();
  }
  throw new Error(`HIS server returned ${res.status}`);
}
