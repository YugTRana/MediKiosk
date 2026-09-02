/**
 * Evaluates patient answers for emergency red-flag conditions.
 * Returns { isRedFlag: boolean, reason: string | null }
 */
export function checkRedFlagCondition(complaintId, currentQuestionId, selectedOption, allAnswersText = '') {
  const combinedText = (
    (selectedOption?.labelEn || '') + ' ' +
    (selectedOption?.value || '') + ' ' +
    (allAnswersText || '')
  ).toLowerCase();

  // Rule 1: Chest pain + sweating / diaphoresis mentioned (or severity >= 8 on chest pain)
  if (complaintId === 'chest_pain') {
    if (
      selectedOption?.isRedFlag ||
      selectedOption?.value === 'sweating_diaphoresis' ||
      selectedOption?.value === 'left_arm_jaw' ||
      combinedText.includes('sweat') ||
      combinedText.includes('diaphoresis') ||
      combinedText.includes('cold clammy') ||
      (currentQuestionId === 'chest_severity' && parseInt(selectedOption?.value || '0', 10) >= 8)
    ) {
      return {
        isRedFlag: true,
        reason: 'CRITICAL TRIAGE: Chest Pain associated with Cold Sweating / Radiation / High Severity (Suspected Acute Coronary Syndrome)'
      };
    }
  }

  // Rule 2: Any mention of one-sided weakness, numbness, or facial droop
  if (
    selectedOption?.isRedFlag ||
    selectedOption?.value === 'weakness_numbness' ||
    selectedOption?.value === 'paralysis_numbness' ||
    combinedText.includes('weakness') ||
    combinedText.includes('numbness') ||
    combinedText.includes('numb') ||
    combinedText.includes('paralysis') ||
    combinedText.includes('droop') ||
    combinedText.includes('one-sided') ||
    combinedText.includes('one side')
  ) {
    return {
      isRedFlag: true,
      reason: 'CRITICAL TRIAGE: Neurological Warning Sign (One-Sided Weakness / Numbness reported - Suspected Stroke)'
    };
  }

  // Rule 3: Severe breathlessness (severity 8+/10 on breathing-related complaints)
  if (complaintId === 'cough_breathlessness') {
    if (
      selectedOption?.isRedFlag ||
      selectedOption?.value === 'gasping' ||
      (currentQuestionId === 'cough_severity' && parseInt(selectedOption?.value || '0', 10) >= 8) ||
      combinedText.includes('cannot breath') ||
      combinedText.includes('unable to breath') ||
      combinedText.includes('gasping')
    ) {
      return {
        isRedFlag: true,
        reason: 'CRITICAL TRIAGE: Severe Respiratory Distress (Breathlessness Severity 8+/10)'
      };
    }
  }

  // Generic option flag fallback
  if (selectedOption?.isRedFlag) {
    return {
      isRedFlag: true,
      reason: `CRITICAL TRIAGE: Emergency Indicator Selected (${selectedOption.labelEn})`
    };
  }

  return { isRedFlag: false, reason: null };
}
