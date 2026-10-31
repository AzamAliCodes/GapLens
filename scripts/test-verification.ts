import { verifyQuoteAgainstPassage } from '../lib/analyze/verifyQuotes';
import { isPrivateIp } from '../lib/security/ssrf';
import { Passage } from '../lib/types';

console.log('====================================================');
console.log(' GAPLENS UNIT TESTS: Quote Verification & SSRF Policy');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// 1. Passage definition for tests
const samplePassage: Passage = {
  id: 'S1-P1',
  text: 'Eligible candidates must have achieved a minimum aggregate of 75% marks in their Higher Secondary Examination (Class 12). Total gross family income from all sources must not exceed INR 4,50,000 per annum.',
  wordCount: 35,
};

// TEST 1: Exact verbatim quote
assert(
  verifyQuoteAgainstPassage(
    'Eligible candidates must have achieved a minimum aggregate of 75% marks in their Higher Secondary Examination (Class 12).',
    samplePassage
  ) === true,
  'Authentic exact quote is verified successfully'
);

// TEST 2: Normalized quote with whitespace / case differences
assert(
  verifyQuoteAgainstPassage(
    'TOTAL GROSS FAMILY INCOME FROM ALL SOURCES MUST NOT EXCEED INR 4,50,000 PER ANNUM.',
    samplePassage
  ) === true,
  'Case-insensitive and normalized quote is verified'
);

// TEST 3: Model Hallucination / Invented quote
assert(
  verifyQuoteAgainstPassage(
    'Students who fail in one subject can still qualify if recommended by their school principal.',
    samplePassage
  ) === false,
  'Fabricated hallucination quote is correctly REJECTED'
);

// TEST 4: Paraphrased quote with changed numbers (60% instead of 75%)
assert(
  verifyQuoteAgainstPassage(
    'Eligible candidates must have achieved a minimum aggregate of 60% marks in their Higher Secondary Examination',
    samplePassage
  ) === false,
  'Altered/paraphrased claim with wrong percentage is correctly REJECTED'
);

// TEST 5: SSRF - Loopback 127.0.0.1
assert(
  isPrivateIp('127.0.0.1') === true,
  'SSRF security blocks localhost/loopback 127.0.0.1'
);

// TEST 6: SSRF - Cloud metadata IP 169.254.169.254 (AWS/GCP instance metadata)
assert(
  isPrivateIp('169.254.169.254') === true,
  'SSRF security blocks cloud metadata address 169.254.169.254'
);

// TEST 7: SSRF - Private network 10.0.0.5 and 192.168.1.1
assert(
  isPrivateIp('10.0.0.5') === true && isPrivateIp('192.168.1.1') === true,
  'SSRF security blocks RFC-1918 private subnets (10.x, 192.168.x)'
);

// TEST 8: SSRF - Valid public IP 8.8.8.8
assert(
  isPrivateIp('8.8.8.8') === false,
  'SSRF permits public routable addresses like 8.8.8.8'
);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('ALL VERIFICATION & SSRF TESTS PASSED!\n');
} else {
  console.error('SOME TESTS FAILED!\n');
  process.exit(1);
}
