import { describe, it, expect } from 'vitest';

describe('Clinical Red-Flag Detection Suite (Triage Safety)', () => {
  // Clinical rule engine for triage red-flags
  function evaluateRedFlags({ complaintId, answers = [] }) {
    const flags = [];
    const textJoined = answers.map(a => {
      const opt = a.selectedOption?.labelEn || a.selectedOption?.value || '';
      const voice = a.customVoiceText || '';
      return `${a.questionId || ''} ${opt} ${voice}`.toLowerCase();
    }).join(' ');

    // 1. Cardiac Red Flags
    if (complaintId === 'chest_pain' || /chest/i.test(complaintId)) {
      if (/radiat|jaw|left arm|cold sweat|diaphoresis|crushing|breathless/i.test(textJoined)) {
        flags.push('CRITICAL: Acute Coronary Syndrome warning signs (Radiation/Diaphoresis/Dyspnea)');
      }
    }

    // 2. Respiratory Red Flags
    if (complaintId === 'cough_breathlessness' || /breath/i.test(complaintId)) {
      if (/stridor|cyanosis|unable to speak|blue lips|gasping/i.test(textJoined)) {
        flags.push('CRITICAL: Impending respiratory failure (Cyanosis/Inability to speak in full sentences)');
      }
    }

    // 3. Neurological / Severe Headache Red Flags
    if (complaintId === 'headache' || /headache/i.test(complaintId)) {
      if (/thunderclap|worst headache|neck stiffness|photophobia|confusion/i.test(textJoined)) {
        flags.push('CRITICAL: Suspected Subarachnoid Hemorrhage / Acute Meningeal Signs');
      }
    }

    // 4. Infectious / Septic Red Flags
    if (complaintId === 'fever' || /fever/i.test(complaintId)) {
      if (/petechiae|purpura|unresponsive|delirium|hypotension/i.test(textJoined)) {
        flags.push('CRITICAL: Signs of severe systemic sepsis / hemodynamic collapse');
      }
    }

    return {
      hasRedFlag: flags.length > 0,
      flags,
      triagePriority: flags.length > 0 ? 'TRIAGE_URGENT' : 'WAITING_OPD'
    };
  }

  it('Detects critical cardiac red flag for chest pain radiating with cold sweat', () => {
    const result = evaluateRedFlags({
      complaintId: 'chest_pain',
      answers: [
        { questionId: 'chest_character', selectedOption: { labelEn: 'Crushing heavy pressure' } },
        { questionId: 'chest_associations', selectedOption: { labelEn: 'Profuse cold sweat and left arm radiation' } }
      ]
    });

    expect(result.hasRedFlag).toBe(true);
    expect(result.triagePriority).toBe('TRIAGE_URGENT');
    expect(result.flags[0]).toContain('Acute Coronary Syndrome');
  });

  it('Detects neurological red flag for thunderclap headache with neck stiffness', () => {
    const result = evaluateRedFlags({
      complaintId: 'headache',
      answers: [
        { questionId: 'onset', customVoiceText: 'Sudden thunderclap pain within seconds with severe neck stiffness' }
      ]
    });

    expect(result.hasRedFlag).toBe(true);
    expect(result.triagePriority).toBe('TRIAGE_URGENT');
    expect(result.flags[0]).toContain('Meningeal');
  });

  it('Evaluates benign non-urgent symptoms without triggering false red flags', () => {
    const result = evaluateRedFlags({
      complaintId: 'fever',
      answers: [
        { questionId: 'fever_onset', selectedOption: { labelEn: 'Yesterday afternoon' } },
        { questionId: 'fever_character', selectedOption: { labelEn: 'Mild warmth with slight headache' } },
        { questionId: 'fever_associations', selectedOption: { labelEn: 'None of the above' } }
      ]
    });

    expect(result.hasRedFlag).toBe(false);
    expect(result.triagePriority).toBe('WAITING_OPD');
    expect(result.flags.length).toBe(0);
  });
});
