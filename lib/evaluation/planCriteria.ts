import { Criterion, QuestionContext, VerificationStrategy } from '../types';
import { generateLlmObject } from '../llm';
import { z } from 'zod';
import { validateAndDeduplicateCriteria } from './validateCriteria';

export function planCriteriaHeuristic(context: QuestionContext): Criterion[] {
  const { domain, targetDateOrPeriod, jurisdiction } = context;
  const criteria: Criterion[] = [];

  const timeSuffix = targetDateOrPeriod ? ` for ${targetDateOrPeriod}` : '';
  const jurSuffix = jurisdiction ? ` in ${jurisdiction}` : '';

  if (domain === 'scholarship_education') {
    criteria.push(
      {
        id: 'crit-eligibility-marks',
        question: `What are the minimum academic qualifying percentage or grade requirements${timeSuffix}?`,
        description: 'Exact qualifying examination benchmark, board recognition, and minimum score percentage required for consideration.',
        importance: 1,
        expectedEvidenceType: 'Official notification or Gazette clause',
        verificationStrategy: 'official_source',
        requiredContext: targetDateOrPeriod ? { cycle: targetDateOrPeriod } : undefined,
      },
      {
        id: 'crit-income-ceiling',
        question: `What is the maximum annual family income limit and accepted proof documentation?`,
        description: 'Gross annual household income cap, permissible issuing authorities (e.g. Tehsildar, Revenue Officer, or ITR), and exclusions.',
        importance: 1,
        expectedEvidenceType: 'Official income guideline or gazette certificate schedule',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-renewal-conditions',
        question: `What are the continuing renewal criteria, minimum CGPA, and attendance requirements?`,
        description: 'Conditions required to retain scholarship across subsequent academic years without forfeiture.',
        importance: 1,
        expectedEvidenceType: 'Official renewal policy or scheme rules',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-application-deadline',
        question: `What is the official application closing date, portal cutoff time, and submission schedule${timeSuffix}?`,
        description: 'Active cycle application deadlines, student verification windows, and institute verification cutoffs.',
        importance: 2,
        expectedEvidenceType: 'Portal notification or timeline schedule',
        verificationStrategy: 'official_source',
        requiredContext: targetDateOrPeriod ? { cycle: targetDateOrPeriod } : undefined,
      },
      {
        id: 'crit-disqualification-duality',
        question: `Can the recipient hold other central, state, or private scholarships concurrently?`,
        description: 'Exclusivity clauses, dual benefit restrictions, and refund penalties upon breach.',
        importance: 2,
        expectedEvidenceType: 'Terms and conditions clause',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-selection-quota',
        question: `How are candidates ranked, selected, and tie-broken if applicant scores are identical?`,
        description: 'Merit list preparation rules, state quotas, reservation categories, and tie-breaking criteria.',
        importance: 3,
        expectedEvidenceType: 'Official selection methodology document',
        verificationStrategy: 'official_source',
      }
    );
  } else if (domain === 'finance_tax') {
    criteria.push(
      {
        id: 'crit-tax-rates-slabs',
        question: `What are the exact statutory rates, thresholds, and slab limits applicable${timeSuffix}${jurSuffix}?`,
        description: 'Statutory percentage rates, basic exemption limits, and applicable tax brackets.',
        importance: 1,
        expectedEvidenceType: 'Statutory tax code or official revenue gazette',
        verificationStrategy: 'calculation',
      },
      {
        id: 'crit-deduction-eligibility',
        question: `What specific deductions, exemptions, and investment proofs are eligible?`,
        description: 'Permissible deductions under current statutes, documentation needed, and maximum monetary caps.',
        importance: 1,
        expectedEvidenceType: 'Official revenue department guidance',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-filing-deadlines',
        question: `What is the statutory filing deadline and late fee or interest penalty schedule?`,
        description: 'Due dates for submission, penal interest rates under relevant sections, and condonation conditions.',
        importance: 2,
        expectedEvidenceType: 'Departmental notification or gazette calendar',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-required-documentation',
        question: `What mandatory supporting documents, forms, or certificates must be retained or attached?`,
        description: 'Mandatory certificates, audit reports, or third-party confirmations required by law.',
        importance: 2,
        expectedEvidenceType: 'Official filing instructions',
        verificationStrategy: 'cross_source',
      }
    );
  } else if (domain === 'software_engineering') {
    criteria.push(
      {
        id: 'crit-api-contracts',
        question: 'What are the exact API signatures, request parameters, types, and return specifications?',
        description: 'Input parameters, mandatory fields, output payloads, and status codes.',
        importance: 1,
        expectedEvidenceType: 'Official API documentation or schema definition',
        verificationStrategy: 'code_test',
      },
      {
        id: 'crit-auth-permissions',
        question: 'What authentication mechanisms, API tokens, scopes, and headers are required?',
        description: 'Authentication protocol (Bearer token, OAuth2, HMAC) and requisite IAM permissions.',
        importance: 1,
        expectedEvidenceType: 'Official security and authentication guide',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-rate-limits',
        question: 'What are the throughput constraints, rate limits, and concurrency quotas?',
        description: 'Requests per second, burst allowance, quota resets, and throttling behavior.',
        importance: 2,
        expectedEvidenceType: 'API limits specification',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-deprecations-compatibility',
        question: `What versions, runtime environments, or legacy endpoints are deprecated${timeSuffix}?`,
        description: 'Minimum supported language/runtime versions, breaking changes, and migration paths.',
        importance: 2,
        expectedEvidenceType: 'Release notes or changelog',
        verificationStrategy: 'cross_source',
      }
    );
  } else {
    // General / adaptive default criteria
    criteria.push(
      {
        id: 'crit-core-substantive-rule',
        question: 'What are the core substantive requirements or primary rules governing this subject?',
        description: 'Primary factual conditions, definitions, and direct operational requirements.',
        importance: 1,
        expectedEvidenceType: 'Authoritative specification or official notice',
        verificationStrategy: 'official_source',
      },
      {
        id: 'crit-temporal-scope',
        question: `What is the effective temporal validity, effective date, or renewal period${timeSuffix}?`,
        description: 'Date of effect, expiry, periodic revisions, and transition clauses.',
        importance: 1,
        expectedEvidenceType: 'Official date stamp or legislative timeline',
        verificationStrategy: 'historical_record',
      },
      {
        id: 'crit-exceptions-conditions',
        question: 'What specific exemptions, special conditions, or qualifying restrictions apply?',
        description: 'Exceptions to the general rule, carve-outs, or conditional waivers.',
        importance: 2,
        expectedEvidenceType: 'Official terms and conditions',
        verificationStrategy: 'cross_source',
      },
      {
        id: 'crit-procedural-evidence',
        question: 'What mandatory evidence, documentation, or verifiable proof is required for compliance?',
        description: 'Accepted proofs, certification bodies, and documentation standards.',
        importance: 2,
        expectedEvidenceType: 'Checklist of acceptable documents',
        verificationStrategy: 'cross_source',
      },
      {
        id: 'crit-authoritative-contact',
        question: 'Who is the official designated authority, regulatory body, or grievance contact?',
        description: 'Statutory department, appellate body, or official contact channel.',
        importance: 3,
        expectedEvidenceType: 'Directory or gazette contact details',
        verificationStrategy: 'official_source',
      }
    );
  }

  return validateAndDeduplicateCriteria(criteria);
}

export async function planCriteria(context: QuestionContext): Promise<Criterion[]> {
  const heuristic = planCriteriaHeuristic(context);

  try {
    const CriteriaGenerationSchema = z.object({
      criteria: z.array(
        z.object({
          id: z.string(),
          question: z.string(),
          description: z.string(),
          importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          expectedEvidenceType: z.string(),
          verificationStrategy: z.enum([
            'official_source',
            'primary_research',
            'code_test',
            'calculation',
            'historical_record',
            'cross_source',
            'other',
          ]),
          requiredContext: z.record(z.string(), z.string()).optional(),
        })
      ).min(4).max(8),
    });

    const prompt = `Generate an adaptive, high-precision verification rubric for the following question:
Question: "${context.originalQuestion}"
Domain: ${context.domain}
Intent: ${context.intent}
Target Period: ${context.targetDateOrPeriod || 'Unspecified'}
Jurisdiction: ${context.jurisdiction || 'Unspecified'}
Risk Level: ${context.riskLevel}

Formulate 4 to 7 essential factual criteria that a rigorous audit or gap analysis must check.
Prioritize importance 1 (critical gatekeeper requirements) and 2 (procedural/timelines).
Specify verificationStrategy: official_source, primary_research, code_test, calculation, historical_record, cross_source, or other.`;

    const generated = await generateLlmObject(prompt, CriteriaGenerationSchema);
    if (generated?.criteria && generated.criteria.length >= 3) {
      return validateAndDeduplicateCriteria(generated.criteria);
    }
  } catch {
    // Graceful fallback to heuristic criteria
  }

  return heuristic;
}
