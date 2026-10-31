import { analyzeQuestionHeuristic } from '../lib/evaluation/analyzeQuestion';
import { planCriteriaHeuristic } from '../lib/evaluation/planCriteria';
import { extractClaimsHeuristic } from '../lib/evaluation/extractClaims';
import { verifyQuoteIntegrity } from '../lib/evaluation/verifyQuoteIntegrity';
import { checkNumericContradiction, checkPolarityContradiction, checkTemporalScopeMismatch } from '../lib/evaluation/deterministicChecks';
import { computeAuditMetrics } from '../lib/evaluation/computeMetrics';
import { isPrivateIp } from '../lib/security/ssrf';

console.log('====================================================');
console.log(' GAPLENS UNIT TEST SUITE: Core Algorithms');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------
// 1. QUESTION INTELLIGENCE TESTS
// ----------------------------------------------------
const qContext = analyzeQuestionHeuristic('What should I verify before applying for National Merit Scholarship 2026?');
assert(qContext.domain === 'scholarship_education', 'Infers domain "scholarship_education" correctly');
assert(qContext.timeSensitive === true, 'Detects time sensitivity for 2026 scholarship');
assert(qContext.targetDateOrPeriod === '2026', 'Extracts target period "2026"');
assert(qContext.riskLevel === 'high' || qContext.riskLevel === 'moderate', 'Assigns appropriate risk level');

const taxContext = analyzeQuestionHeuristic('What are the income tax slab limits and deduction thresholds for FY 2025-26 in India?');
assert(taxContext.domain === 'finance_tax', 'Infers domain "finance_tax" correctly');
assert(taxContext.jurisdiction === 'India', 'Extracts jurisdiction "India" without hallucinating');
assert(taxContext.riskLevel === 'high', 'Classifies tax inquiry as high risk');

// ----------------------------------------------------
// 2. QUESTION-ADAPTIVE RUBRIC TESTS
// ----------------------------------------------------
const criteria = planCriteriaHeuristic(qContext);
assert(criteria.length >= 4 && criteria.length <= 8, 'Plans adaptive rubric with 4-8 criteria');
assert(criteria.some(c => c.question.toLowerCase().includes('eligibility') || c.question.toLowerCase().includes('percentage')), 'Generates eligibility criterion');
assert(criteria.some(c => c.question.toLowerCase().includes('income')), 'Generates income criterion');
assert(criteria.some(c => c.question.toLowerCase().includes('renewal')), 'Generates continuing renewal criterion');

// ----------------------------------------------------
// 3. ATOMIC CLAIM EXTRACTION TESTS
// ----------------------------------------------------
const candidateAnswer = 'Candidates must score at least 75% aggregate marks in Class 12. Gross family income must not exceed INR 4,50,000 per annum. Applying early is a wonderful idea.';
const claims = extractClaimsHeuristic(candidateAnswer, criteria, qContext);
assert(claims.length >= 2, 'Extracts multiple atomic claims from candidate answer');
const markClaim = claims.find(c => c.exactAnswerSpan.includes('75%'));
assert(Boolean(markClaim), 'Extracts 75% marks claim');
assert(markClaim?.value === 75 && markClaim?.units === '%', 'Extracts numerical value 75 and unit %');
assert(markClaim?.spanOffset !== undefined, 'Computes exact answer span start and end offsets');
assert(
  candidateAnswer.slice(markClaim!.spanOffset!.start, markClaim!.spanOffset!.end) === markClaim!.exactAnswerSpan,
  'Span offsets match exact substring in answer text'
);

const opinionClaim = claims.find(c => c.exactAnswerSpan.includes('wonderful idea'));
if (opinionClaim) {
  assert(opinionClaim.factCheckable === false, 'Filters out subjective opinion as factCheckable = false');
} else {
  assert(true, 'Filtered subjective conversational boilerplate during tokenization');
}

// ----------------------------------------------------
// 4. QUOTE INTEGRITY & CHARACTER OFFSET TESTS
// ----------------------------------------------------
const canonicalSnapshot = 'Official Gazette Notification 2026: Eligible candidates must have achieved a minimum aggregate of 75% marks in Class 12.';
const quoteRes = verifyQuoteIntegrity('Eligible candidates must have achieved a minimum aggregate of 75% marks in Class 12.', canonicalSnapshot);
assert(quoteRes.verified === true && quoteRes.exactMatch === true, 'Verifies verbatim quote integrity');
assert(quoteRes.offset !== undefined && quoteRes.offset.start > 0, 'Computes accurate character offsets in canonical snapshot');
assert(
  canonicalSnapshot.slice(quoteRes.offset!.start, quoteRes.offset!.end) === 'Eligible candidates must have achieved a minimum aggregate of 75% marks in Class 12.',
  'Character slice matches quote exactly'
);

const fakeQuoteRes = verifyQuoteIntegrity('Eligible candidates must have achieved 60% marks', canonicalSnapshot);
assert(fakeQuoteRes.verified === false, 'Correctly rejects fabricated quote');

// ----------------------------------------------------
// 5. DETERMINISTIC CONTRADICTION CHECKS
// ----------------------------------------------------
const numConflict = checkNumericContradiction('Candidates must score at least 60% marks', 'Candidates must score at least 75% marks');
assert(numConflict.hasConflict === true && numConflict.type === 'numeric', 'Detects numeric threshold mismatch (60% vs 75%)');

const polConflict = checkPolarityContradiction('Parent ITR Form 16 is strictly mandatory', 'Income certificate issued by a competent Revenue Officer not below the rank of Tehsildar is accepted');
assert(polConflict.hasConflict === true && polConflict.type === 'polarity', 'Detects document mandate polarity conflict');

const tempMismatch = checkTemporalScopeMismatch('2026', '2024-05-10', 'AY 2024-25 closing date');
assert(tempMismatch.hasConflict === true && tempMismatch.type === 'temporal', 'Detects temporal cycle divergence (2026 vs 2024)');

// ----------------------------------------------------
// 6. METRIC COMPUTATION & ZERO-DIVISION SAFETY
// ----------------------------------------------------
const emptyMetrics = computeAuditMetrics([], [], []);
assert(emptyMetrics.totalClaims === 0, 'Handles zero claims gracefully');
assert(emptyMetrics.supportedShare === null, 'Returns null for supportedShare when zero claims (no NaN)');
assert(emptyMetrics.contradictedShare === null, 'Returns null for contradictedShare when zero claims (no NaN)');
assert(emptyMetrics.unverifiedShare === null, 'Returns null for unverifiedShare when zero claims (no NaN)');

// ----------------------------------------------------
// 7. SSRF SECURITY FOR IPv4 & IPv6
// ----------------------------------------------------
assert(isPrivateIp('127.0.0.1') === true, 'SSRF: Blocks IPv4 loopback 127.0.0.1');
assert(isPrivateIp('169.254.169.254') === true, 'SSRF: Blocks AWS/GCP metadata IP 169.254.169.254');
assert(isPrivateIp('10.255.0.1') === true, 'SSRF: Blocks private 10.x IP');
assert(isPrivateIp('192.168.1.254') === true, 'SSRF: Blocks private 192.168.x IP');
assert(isPrivateIp('::1') === true, 'SSRF: Blocks IPv6 loopback ::1');
assert(isPrivateIp('8.8.8.8') === false, 'SSRF: Permits public routable IP 8.8.8.8');

console.log(`\nResults: ${passedTests}/${totalTests} unit tests passed.`);
if (passedTests === totalTests) {
  console.log('ALL GAPLENS UNIT TESTS PASSED!\n');
} else {
  console.error('SOME UNIT TESTS FAILED!\n');
  process.exit(1);
}
