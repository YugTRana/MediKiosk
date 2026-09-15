import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KioskPage from '../pages/KioskPage';
import { BrowserRouter } from 'react-router-dom';

// Mock speech synthesis and speech recognition
vi.mock('../services/speechService.js', () => ({
  speakText: vi.fn(),
  cancelSpeech: vi.fn(),
  stopSpeech: vi.fn(),
  startListening: vi.fn(),
  startSpeechRecognition: vi.fn(),
  stopSpeechRecognition: vi.fn(),
  isSTTSupported: vi.fn(() => true),
  getSpeechProvider: vi.fn(() => 'browser'),
  getRecoveryPrompt: vi.fn(() => 'Please speak clearly')
}));

// Mock authService
vi.mock('../services/authService.js', () => ({
  loginPatient: vi.fn(async () => ({
    id: 'pat-101',
    name: 'Ramesh Chandra Sharma',
    mobile: '9876543210',
    age: 68,
    gender: 'Male',
    address: 'Pune, Maharashtra',
    token: 'jwt-mock-token-123'
  })),
  signupPatient: vi.fn(async (data) => ({
    id: 'pat-new',
    name: data.name,
    mobile: data.mobile,
    token: 'jwt-mock-token-new'
  })),
  updateAdminPatient: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
  clearStaffSession: vi.fn()
}));

// Mock docAiService
vi.mock('../services/docAiService.js', () => ({
  extractDocumentWithDocAI: vi.fn(async () => ({
    fileName: 'prescription.pdf',
    documentType: 'prescription',
    documentTitle: 'Cardiology Prescription',
    confidenceScore: 0.94,
    medications: [{ name: 'Tab Sorbitrate', dose: '5mg' }],
    labValues: []
  })),
  SAMPLE_DOCUMENTS: [],
  getLabFlagBadgeClass: vi.fn(() => '')
}));

import fallbackFlows from '../../../backend/mockData/dialogueFlows.json';

describe('KioskPage Component & Flow Suite (RTL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => fallbackFlows
    }));
  });

  it('Step 1: Renders Language Selection header and toggles English / Hindi', () => {
    render(
      <BrowserRouter>
        <KioskPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/MediKiosk/i)).toBeInTheDocument();
    expect(screen.getByText(/English/i)).toBeInTheDocument();
    expect(screen.getByText(/हिंदी/i)).toBeInTheDocument();

    // Toggle to Hindi
    const hindiBtn = screen.getByText(/हिंदी/i);
    fireEvent.click(hindiBtn);

    // Verify UI reflects Hindi guidance
    expect(screen.getByText(/रोगी लॉगिन और पंजीकरण/i)).toBeInTheDocument();
  });

  it('Step 2: Authenticates via Login form and displays patient profile card', async () => {
    render(
      <BrowserRouter>
        <KioskPage />
      </BrowserRouter>
    );

    // Fill in mobile and password
    const mobileInput = screen.getByPlaceholderText(/9876543210/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);

    fireEvent.change(mobileInput, { target: { value: '9876543210' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123' } });

    // Submit form
    const loginSubmitBtn = screen.getByRole('button', { name: /Sign In to Patient Portal/i });
    fireEvent.click(loginSubmitBtn);

    // Verify authenticated state card is displayed
    await waitFor(() => {
      expect(screen.getByText(/Patient Authenticated/i)).toBeInTheDocument();
      expect(screen.getByText(/Ramesh Chandra Sharma/i)).toBeInTheDocument();
    });
  });

  it('Step 3: Navigates to Audio-Guided DPDP Consent Screen with Granular Toggles', async () => {
    render(
      <BrowserRouter>
        <KioskPage />
      </BrowserRouter>
    );

    // Authenticate
    fireEvent.change(screen.getByPlaceholderText(/9876543210/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'Secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Patient Portal/i }));

    // Click Proceed to Consent
    const proceedBtn = await screen.findByText(/Proceed to Consent & Consultation/i);
    fireEvent.click(proceedBtn);

    // Verify DPDP Consent Screen
    await waitFor(() => {
      expect(screen.getByText(/Patient Consent & Data Protection Authorization/i)).toBeInTheDocument();
      expect(screen.getByText(/Audio-guided consent narration available/i)).toBeInTheDocument();
      expect(screen.getByText(/1\. Symptom & Clinical Data Intake/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Secure Transmission to Hospital EMR/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. National Ayushman Bharat/i)).toBeInTheDocument();
    });
  });

  it('Step 4: Advances past Consent to Chief Complaint Selection Screen', async () => {
    render(
      <BrowserRouter>
        <KioskPage />
      </BrowserRouter>
    );

    // Authenticate and advance to consent
    fireEvent.change(screen.getByPlaceholderText(/9876543210/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'Secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Patient Portal/i }));

    const proceedBtn = await screen.findByText(/Proceed to Consent & Consultation/i);
    fireEvent.click(proceedBtn);

    // Accept consent
    const acceptConsentBtn = await screen.findByText(/Grant Consent & Proceed to Consultation/i);
    fireEvent.click(acceptConsentBtn);

    // Verify Chief Complaints are displayed
    await waitFor(() => {
      expect(screen.getByText(/Fever \/ Body Temperature/i)).toBeInTheDocument();
      expect(screen.getByText(/Cough \/ Breathlessness/i)).toBeInTheDocument();
      expect(screen.getByText(/Ayurvedic Consultation/i)).toBeInTheDocument();
    });
  });

  it('Step 5: Enters Document Digitization & Upload Flow', async () => {
    render(
      <BrowserRouter>
        <KioskPage />
      </BrowserRouter>
    );

    // Complete Auth -> Consent
    fireEvent.change(screen.getByPlaceholderText(/9876543210/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'Secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Patient Portal/i }));

    const proceedBtn = await screen.findByText(/Proceed to Consent & Consultation/i);
    fireEvent.click(proceedBtn);

    const acceptConsentBtn = await screen.findByText(/Grant Consent & Proceed to Consultation/i);
    fireEvent.click(acceptConsentBtn);

    // Select Fever
    const feverCard = await screen.findByText(/Fever \/ Body Temperature/i);
    fireEvent.click(feverCard);

    // Verify Document Scan / Upload screen appears
    await waitFor(() => {
      expect(screen.getByText(/Upload Previous Prescription, X-Ray or Lab Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Skip Document Upload/i)).toBeInTheDocument();
    });
  });
});
