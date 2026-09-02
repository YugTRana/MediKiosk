# 🏥 MediKiosk — 5-7 Minute Live Demo Script
**A Judge / Evaluator Walkthrough for Outpatient Triage, Dual-Stream Intake & ABDM Integration**

---

## ⏱️ Demo Overview & Timeline (Total: 6 Minutes)

| Time | Module | Key Capabilities Demonstrated |
|---|---|---|
| **0:00 - 1:00** | **Intro & Setup** | Architecture, Admin 1-Click Environment Reset, Bhashini & ABDM Status |
| **1:00 - 3:00** | **Scenario 1: High-Risk Cardiac Emergency** | Voice/Touch, Red-Flag AI Detection, Prescription OCR, Drug Interaction Warning, Granular Consent |
| **3:00 - 4:15** | **Doctor Dashboard Verification & FHIR/HIS Sync** | Real-time queue escalation, 8-section synthesized dossier, Physician Edit & Save, NRCES FHIR Bundle EMR push |
| **4:15 - 5:15** | **Scenario 2: AYUSH Dashavidha Pariksha** | Classical Prakriti, Agni, Koshtha evaluation, AI clarifying dialogue, Distinct Vaidya summary |
| **5:15 - 6:00** | **DPDP Right-to-Erasure & Q&A Wrap** | ABDM Sandbox, Consent revocation raw data purge, Hallway offline resilient mode |

---

## 🎬 Step-by-Step Presenter Script

### PART 1: Presenter Setup & Diagnostics (0:00 - 1:00)
1. **Open the Browser** to `http://localhost:5173/admin`.
2. **What to Say:**
   > *"Good morning judges. In high-volume Indian government hospitals, OPD doctors face overwhelming 2-minute consultation constraints. MediKiosk is an intelligent, bilingual outpatient triage kiosk and clinical intake synthesizer designed for the Indian healthcare ecosystem.*
   > *Before we begin, notice our live Diagnostics Dashboard: our pluggable Speech Engine is active, ABDM National Health Authority Gateway is synced with sandbox fallback, and our automated DPDP Act data retention job is running."*
3. **What to Click:**
   - Tap **"🧹 Reset Demo Environment"** button at top.
   - Show the toast: *"Demo environment reset successfully! All queues and tokens are fresh."*

---

### PART 2: Scenario 1 — Emergency Cardiac Triage (1:00 - 3:00)
*(Demonstrating Module A: Adaptive Dialogue + Voice, Module B: OCR Digitization, Module D: Consent)*

1. **Navigate to the Kiosk**: Click **"MediKiosk Portal"** or navigate to `http://localhost:5173/kiosk`.
2. **Language Toggle**:
   - Tap **"हिंदी"** to demonstrate instant localization. The UI switches to Hindi and voice explains in Hindi.
   - Tap **"English"** to continue in English for the judges.
3. **Patient Authentication**:
   - Tap **"🔑 Log In as Ramesh (Demo)"** or enter mobile `9876543210` with password `Secret123`.
   - The verified patient profile appears: **Ramesh Chandra Sharma, 68M, Pune**.
4. **Audio-Guided DPDP Consent**:
   - Tap **"Proceed to Consent & Consultation"**.
   - Show the **Audio Narration Banner** (play audio read-aloud).
   - Point out the **3 Granular Toggles** (Data Capture, Hospital EMR Sharing, ABHA Health Locker Linking).
   - Tap **"Grant Consent & Proceed to Consultation"**.
5. **Chief Complaint Selection**:
   - Select **"Chest Pain / Heart Discomfort"**.
6. **Prescription Document OCR & Drug Interaction**:
   - On the document step, tap **"Load Demo"** under the Cardiology Prescription or upload `sample_prescription.pdf`.
   - Highlight the real OCR extraction: **Tab Ecosprin 75mg** and **Tab Diclofenac 50mg**.
   - Point out the **Yellow Warning Banner**:
     *⚠️ CRITICAL DRUG-DRUG INTERACTION: Aspirin + Diclofenac (High Risk of Gastrointestinal Hemorrhage).*
   - Tap **"Confirm & Continue to Questions"**.
7. **SOCRATES Symptom Intake & Red-Flag Detection**:
   - Answer:
     - Onset: *"1 - 2 hours ago"*
     - Radiation: *"Radiating to left arm and jaw"*
     - Association: *"Profuse cold sweat and dizziness"*
   - **Observe the Red Flag Banner trigger instantly**:
     *🚨 CRITICAL ALERT: Acute Coronary Syndrome Warning Signs (Radiation / Diaphoresis). Priority escalated to TRIAGE_URGENT.*
8. **Summary Read-Back & Submission**:
   - Review synthesized read-back summary.
   - Tap **"Submit & Issue OPD Token"**.
   - Token **K-101 (TRIAGE URGENT)** is printed with room guidance (*"Report to Room 104 immediately"*).

---

### PART 3: Doctor Review & FHIR / HIS EMR Commit (3:00 - 4:15)
*(Demonstrating Module C: Clinical Summary Generator & HIS Integration)*

1. **Switch to Doctor Dashboard**: Open `http://localhost:5173/doctor`.
2. **What to Highlight to Judges:**
   - Token **K-101** appears at the top of the queue highlighted in **bold red with pulsating TRIAGE ALERT badge**.
   - Show the **Synthesized 8-Section Clinical Dossier**:
     - `CC`: Chest pain radiating to left arm
     - `HPI`: 2-hour duration, severe squeezing discomfort
     - `MEDS`: Active prescriptions extracted from OCR
     - `DRUG-INTERACTION`: GI bleeding risk flagged for physician review
     - `INV`: Lab markers & ECG impressions
3. **Bilingual Physician Toggle**:
   - Tap **"[ हिंदी ]"**: The entire clinical summary transforms into Hindi terminology.
   - Tap **"[ EN ]"**: Switches back to English.
4. **Physician Verification & Sign-Off**:
   - Add a quick note in the Past Medical History section: *"Patient has history of type 2 diabetes x 5 years."*
   - Tap **"💾 Save Edits & Verify Note"**.
   - Point out the **"✓ Physician Verified & Signed"** badge with timestamp.
5. **FHIR R4 Bundle Validation & EMR Commit**:
   - Tap **"View HL7 FHIR Bundle"**: Show the 5 structured NRCES-compliant FHIR resources (`Composition`, `Patient`, `Condition`, `Observation`, `Consent`). Show the green **"Valid FHIR R4 Bundle"** badge.
   - Tap **"🚀 Sync Record to Hospital EMR / HIS"**.
   - Show the receipt confirmation: **EMR-REC-2026-XXXXX synced to District Central Government Hospital EMR**.

---

### PART 4: Scenario 2 — AYUSH Dashavidha Pariksha Intake (4:15 - 5:15)
*(Demonstrating Module A, Part 2: AYUSH Integrative Medicine Mode)*

1. **Back to Kiosk**: Tap Kiosk or `/kiosk`.
2. **Select AYUSH OPD**:
   - On the complaint selection screen, select the emerald **"AYUSH Integrated Consultation"** card.
3. **Clinical Dashavidha Questions**:
   - Body Frame / Prakriti: *"Thin, light frame, quick movement (Vata-dominant)"*
   - Digestive Fire (Agni): *"Irregular, bloating after meals (Vishamagni)"*
   - Bowel Tendency (Koshtha): *"Dry, irregular (Krura Koshtha)"*
   - Daily Routine (Ahara-Vihara): *"Irregular meal timings, high screen time"*
4. **Submit AYUSH Intake**:
   - Submit and receive **Token K-102 (AYUSH OPD)**.
5. **Doctor Dashboard AYUSH Dossier**:
   - In Doctor Dashboard, select Token K-102.
   - Show the **Ayurvedic Vaidya Clinical Dossier**:
     - *Dominant Prakriti: Vata-Pitta*
     - *Agni Assessment: Vishamagni (Variable Digestive Fire)*
     - *Koshtha: Krura (Constipation-prone)*
     - *Targeted classical holistic recommendations generated for treating Vaidya.*

---

### PART 5: Privacy, Consent Revocation & Conclusion (5:15 - 6:00)
*(Demonstrating Module D: DPDP Act 2023 Compliance & Platform Resilience)*

1. **Demonstrate DPDP Right-to-Erasure**:
   - Open terminal or admin panel.
   - Show the revocable consent endpoint `POST /api/consent/revoke/:sessionId`.
   - Explain: *"Under India's Digital Personal Data Protection Act 2023, if a citizen revokes consent, MediKiosk instantly purges raw conversational transcripts and OCR file buffers while maintaining an encrypted audit trail."*
2. **Hallway Offline Safe Mode**:
   - In browser developer tools, toggle Network to **Offline**.
   - Show the **"Hallway Offline Safe Mode"** banner: the kiosk continues operating smoothly on local storage without crashing.
3. **Concluding Statement:**
   > *"MediKiosk transforms chaotic hospital lobbies into streamlined, intelligent entry points. It cuts OPD consultation intake time by 70%, catches life-threatening emergencies before the patient reaches the consultation chamber, bridges allopathic and AYUSH healthcare, and brings full ABDM/DPDP compliance to India's public health infrastructure. Thank you!"*
