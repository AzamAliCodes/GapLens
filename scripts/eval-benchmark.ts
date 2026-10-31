import fs from 'fs';
import path from 'path';
import { AtomicClaim, Evidence, QuestionContext } from '../lib/types';
import { classifyClaimVerdict } from '../lib/evaluation/scopedEntailment';
import { verifyQuoteIntegrity } from '../lib/evaluation/verifyQuoteIntegrity';

console.log('========================================================');
console.log(' GAPLENS BENCHMARK SUITE: Precision, Recall & F1');
console.log('========================================================\n');

const benchmarkFile = path.join(process.cwd(), 'evaluation', 'benchmarks', 'benchmark-cases.json');
if (!fs.existsSync(benchmarkFile)) {
  console.error(`Benchmark file not found at ${benchmarkFile}`);
  process.exit(1);
}

interface BenchmarkCase {
  id: string;
  claimText: string;
  exactSpan: string;
  expectedVerdict: string;
  category: string;
  sourceEvidence: string;
}

const cases: BenchmarkCase[] = JSON.parse(fs.readFileSync(benchmarkFile, 'utf-8'));

const context: QuestionContext = {
  originalQuestion: 'What should I verify before applying for National Merit Scholarship 2026?',
  intent: 'Pre-application verification',
  domain: 'scholarship_education',
  answerType: 'multi_condition',
  timeSensitive: true,
  targetDateOrPeriod: '2026',
  jurisdiction: 'India',
  language: 'en',
  namedEntities: ['National Merit Scholarship'],
  ambiguities: [],
  riskLevel: 'high',
};

let correctDecisions = 0;
let totalCases = cases.length;

let truePositives = 0; // correctly identified SUPPORTED or CONTRADICTED
let trueNegatives = 0; // correctly abstained (INSUFFICIENT_EVIDENCE or NOT_FACT_CHECKABLE)
let falsePositives = 0;
let falseNegatives = 0;
let abstentions = 0;

console.log(`Running ${totalCases} Benchmark Scenarios:\n`);

for (const c of cases) {
  const isOpinion = c.expectedVerdict === 'NOT_FACT_CHECKABLE';
  const claim: AtomicClaim = {
    id: c.id,
    exactAnswerSpan: c.exactSpan,
    normalizedProposition: c.claimText,
    conditions: [],
    criterionIds: ['crit-1'],
    factCheckable: !isOpinion,
  };

  const quoteCheck = verifyQuoteIntegrity(c.exactSpan, c.sourceEvidence);

  const candidateEvidence: Evidence[] = c.sourceEvidence
    ? [
        {
          id: `EV-${c.id}`,
          sourceId: 'S1',
          passage: c.sourceEvidence,
          exactQuote: quoteCheck.matchedSubstring,
          quoteOffset: quoteCheck.offset,
          quoteIntegrityVerified: quoteCheck.verified,
          origin: 'user_url',
          publishedAt: '2026-08-01',
        },
      ]
    : [];

  const classification = classifyClaimVerdict(claim, candidateEvidence, context);
  const actualVerdict = classification.verdict;
  const isMatch = actualVerdict === c.expectedVerdict;

  if (actualVerdict === 'INSUFFICIENT_EVIDENCE' || actualVerdict === 'NOT_FACT_CHECKABLE') {
    abstentions++;
  }

  if (isMatch) {
    correctDecisions++;
    if (actualVerdict === 'SUPPORTED' || actualVerdict === 'CONTRADICTED') {
      truePositives++;
    } else {
      trueNegatives++;
    }
  } else {
    if (actualVerdict === 'SUPPORTED' || actualVerdict === 'CONTRADICTED') {
      falsePositives++;
    } else {
      falseNegatives++;
    }
  }

  const mark = isMatch ? '✓ PASS' : '✗ FAIL';
  console.log(`[${mark}] ${c.id} (${c.category})`);
  console.log(`  Claim: "${c.claimText.slice(0, 70)}..."`);
  console.log(`  Expected: ${c.expectedVerdict} | Actual: ${actualVerdict} (Conf: ${(classification.confidence * 100).toFixed(0)}%)`);
  if (!isMatch) {
    console.log(`  Rationale: ${classification.entailmentRationale}`);
  }
  console.log('');
}

const accuracy = correctDecisions / totalCases;
const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 1;
const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 1;
const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1;
const abstentionRate = abstentions / totalCases;

console.log('--------------------------------------------------------');
console.log('BENCHMARK EVALUATION METRICS:');
console.log(`- Total Scenarios: ${totalCases}`);
console.log(`- Exact Classification Accuracy: ${(accuracy * 100).toFixed(1)}% (${correctDecisions}/${totalCases})`);
console.log(`- Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`- Recall: ${(recall * 100).toFixed(1)}%`);
console.log(`- F1 Score: ${(f1 * 100).toFixed(1)}%`);
console.log(`- Intentional Abstention Rate: ${(abstentionRate * 100).toFixed(1)}% (Refusal to hallucinate when evidence is absent)`);
console.log('--------------------------------------------------------');

if (accuracy >= 0.85 && precision >= 0.85) {
  console.log('BENCHMARK EVALUATION SUITE PASSED ALL ACCURACY & SAFETY TARGETS [OK]');
} else {
  console.error('BENCHMARK FAILED ACCURACY OR PRECISION THRESHOLDS');
  process.exit(1);
}
