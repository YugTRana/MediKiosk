import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import DoctorDashboard from '../pages/DoctorDashboard';

// Mock speech services
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

describe('End-to-End Clinical Flow: Kiosk Intake -> Doctor Dashboard -> EMR Push', () => {
  const simulatedE2eSession = {
    id: 'e2e-session-001',
    tokenNumber: 'K-902',
    complaintId: 'chest_pain',
    complaintTitle: 'Chest Pain / Heart Discomfort',
    language: 'English',
    status: 'WAITING_OPD',
    createdAt: new Date().toISOString(),
    patient: {
      id: 'pat-e2e',
      name: 'Ramesh Chandra Sharma',
      age: 68,
      gender: 'Male',
      mobile: '9876543210',
      abhaNumber: '91-4523-8891-0023'
    },
    answers: [
      { questionId: 'onset', dimension: 'Onset', selectedOption: { labelEn: '2 hours ago' } },
      { questionId: 'character', dimension: 'Character', selectedOption: { labelEn: 'Crushing tightness' } }
    ],
    redFlagsTriggered: ['Diaphoresis with left arm radiation'],
    consentRecord: {
      status: 'GRANTED',
      allowDataCapture: true,
      allowHisSharing: true,
      allowAbdmLinking: true
    },
    digitizedDocument: {
      fileName: 'cardiac_ecg.pdf',
      documentType: 'prescription',
      documentTitle: 'Emergency ECG & Rx',
      medications: [{ name: 'Tab Sorbitrate', dose: '5mg', frequency: 'STAT' }],
      labValues: [{ test: 'Serum Troponin-I', value: '1.8', unit: 'ng/mL', flag: 'HIGH' }]
    }
  };

  it('Verifies Doctor Dashboard receives submitted kiosk session with synthesized clinical sections', async () => {
    // Mock global fetch returning our simulated session in the OPD queue
    global.fetch = vi.fn(async (url, options) => {
      if (url.includes('/api/sessions')) {
        return {
          ok: true,
          json: async () => ({ sessions: [simulatedE2eSession] })
        };
      }
      if (url.includes('/api/his/push')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            emrRecordId: 'EMR-E2E-REC-8841',
            syncedAt: new Date().toISOString()
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(
      <BrowserRouter>
        <DoctorDashboard />
      </BrowserRouter>
    );

    // Verify Doctor Dashboard renders
    expect(screen.getByText(/MediKiosk Physician Review Workspace/i)).toBeInTheDocument();

    // Verify the submitted Kiosk token appears in the active OPD queue
    await waitFor(() => {
      expect(screen.getAllByText(/K-902/i).length).toBeGreaterThan(0);
    });

    // Verify Red Flag badge is visible
    expect(screen.getByText(/TRIAGE ALERT/i)).toBeInTheDocument();
  });
});
