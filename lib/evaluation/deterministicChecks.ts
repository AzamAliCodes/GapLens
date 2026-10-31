export interface DeterministicCheckResult {
  hasConflict: boolean;
  type?: 'numeric' | 'polarity' | 'temporal';
  reason?: string;
  claimValue?: string | number;
  evidenceValue?: string | number;
}

export function checkNumericContradiction(
  claimText: string,
  evidenceText: string
): DeterministicCheckResult {
  // Check percentages
  const claimPct = claimText.match(/(\d+(?:\.\d+)?)\s*%/);
  const evPct = evidenceText.match(/(\d+(?:\.\d+)?)\s*%/);

  if (claimPct && evPct) {
    const v1 = parseFloat(claimPct[1]);
    const v2 = parseFloat(evPct[1]);
    if (v1 !== v2) {
      return {
        hasConflict: true,
        type: 'numeric',
        reason: `Percentage threshold mismatch: claim asserts ${v1}%, but evidence specifies ${v2}%.`,
        claimValue: `${v1}%`,
        evidenceValue: `${v2}%`,
      };
    }
  }

  // Check currency / numbers (e.g. 4,50,000 vs 6,00,000 or $5,000 vs $8,000)
  const claimNums = claimText.match(/\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b/g);
  const evNums = evidenceText.match(/\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b/g);

  if (claimNums && evNums) {
    const n1 = claimNums[0].replace(/,/g, '');
    const n2 = evNums[0].replace(/,/g, '');
    if (n1 !== n2 && Math.abs(Number(n1) - Number(n2)) > 1) {
      return {
        hasConflict: true,
        type: 'numeric',
        reason: `Quantitative value mismatch: claim asserts ${claimNums[0]}, whereas evidence states ${evNums[0]}.`,
        claimValue: claimNums[0],
        evidenceValue: evNums[0],
      };
    }
  }

  return { hasConflict: false };
}

export function checkPolarityContradiction(
  claimText: string,
  evidenceText: string
): DeterministicCheckResult {
  const claimLower = claimText.toLowerCase();
  const evLower = evidenceText.toLowerCase();

  const mandatorySignals = ['mandatory', 'compulsory', 'must provide', 'strictly required', 'non-negotiable', 'penalty'];
  const optionalSignals = ['optional', 'not mandatory', 'waived', 'no penalty', 'not required', 'exempted', 'discretionary'];

  const claimIsMandatory = mandatorySignals.some(s => claimLower.includes(s));
  const claimIsOptional = optionalSignals.some(s => claimLower.includes(s));

  const evIsMandatory = mandatorySignals.some(s => evLower.includes(s));
  const evIsOptional = optionalSignals.some(s => evLower.includes(s));

  if (claimIsMandatory && evIsOptional) {
    return {
      hasConflict: true,
      type: 'polarity',
      reason: 'Requirement polarity conflict: claim asserts condition is mandatory/penalized, but evidence states it is optional, waived, or not required.',
      claimValue: 'mandatory',
      evidenceValue: 'optional/waived',
    };
  }

  if (claimIsOptional && evIsMandatory) {
    return {
      hasConflict: true,
      type: 'polarity',
      reason: 'Requirement polarity conflict: claim asserts condition is optional or waived, but evidence states it is strictly mandatory.',
      claimValue: 'optional',
      evidenceValue: 'mandatory',
    };
  }

  // Specific income certificate polarity: Tehsildar vs ITR
  if (
    claimLower.includes('itr') &&
    claimLower.includes('mandatory') &&
    (evLower.includes('tehsildar') || evLower.includes('revenue officer') || evLower.includes('ration card'))
  ) {
    return {
      hasConflict: true,
      type: 'polarity',
      reason: 'Document authority contradiction: claim asserts Income Tax Return (ITR) is mandatory, but evidence accepts or requires Revenue Officer / Tehsildar certificates.',
      claimValue: 'ITR mandatory',
      evidenceValue: 'Tehsildar / Ration Card accepted',
    };
  }

  return { hasConflict: false };
}

export function checkTemporalScopeMismatch(
  claimDate?: string,
  evidenceDate?: string,
  evidenceText?: string
): DeterministicCheckResult {
  const evText = (evidenceDate || '') + ' ' + (evidenceText || '');
  const claimYearMatch = claimDate?.match(/\b(202[0-9]|203[0-9])\b/);
  const evYearMatch = evText.match(/\b(202[0-9]|203[0-9])\b/);

  if (claimYearMatch && evYearMatch) {
    const claimYear = parseInt(claimYearMatch[1], 10);
    const evYear = parseInt(evYearMatch[1], 10);
    if (claimYear !== evYear) {
      return {
        hasConflict: true,
        type: 'temporal',
        reason: `Temporal scope divergence: claim targets ${claimYear}, but evidence pertains to cycle ${evYear}. Rules from earlier/later cycles are not direct contradictions.`,
        claimValue: String(claimYear),
        evidenceValue: String(evYear),
      };
    }
  }

  return { hasConflict: false };
}
