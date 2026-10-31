import { QuestionContext, RiskLevel } from '../types';
import { generateLlmObject } from '../llm';
import { z } from 'zod';

export function analyzeQuestionHeuristic(question: string): QuestionContext {
  const cleanQ = question.trim();
  const lower = cleanQ.toLowerCase();

  // 1. Domain detection
  let domain = 'general';
  if (/scholarship|fellowship|stipend|tuition|bursary|merit/i.test(lower)) {
    domain = 'scholarship_education';
  } else if (/tax|itr|gst|refund|deduction|salary|401k|pf|finance|loan|banking|interest/i.test(lower)) {
    domain = 'finance_tax';
  } else if (/visa|passport|citizenship|permit|statute|law|legal|regulation|gazette|penalty|court/i.test(lower)) {
    domain = 'legal_government';
  } else if (/api|sdk|code|function|database|react|typescript|python|endpoint|deploy|server/i.test(lower)) {
    domain = 'software_engineering';
  } else if (/vaccine|dosage|symptom|clinical|treatment|drug|prescription|diagnosis/i.test(lower)) {
    domain = 'healthcare_medical';
  } else if (/job|interview|salary|hiring|remote|contract|probation/i.test(lower)) {
    domain = 'employment_career';
  }

  // 2. Risk level determination
  // Financial, legal, medical, safety, eligibility, or deadline are high-risk
  let riskLevel: RiskLevel = 'low';
  if (
    domain === 'finance_tax' ||
    domain === 'legal_government' ||
    domain === 'healthcare_medical' ||
    /eligib|income|penalty|fine|crime|visa|deadline|mandatory|disqualif|safety/i.test(lower)
  ) {
    riskLevel = 'high';
  } else if (domain === 'scholarship_education' || domain === 'employment_career' || domain === 'software_engineering') {
    riskLevel = 'moderate';
  }

  // 3. Time sensitivity and target date/period
  const yearMatch = cleanQ.match(/\b(202[0-9]|203[0-9])\b/);
  const cycleMatch = cleanQ.match(/\bAY\s*202[0-9][-–/][0-9]{2,4}\b/i);
  const timeSensitive = Boolean(
    yearMatch ||
    cycleMatch ||
    /latest|current|deadline|closing date|validity|recent|update|schedule|renewal|version|cycle/i.test(lower)
  );
  const targetDateOrPeriod = cycleMatch ? cycleMatch[0] : yearMatch ? yearMatch[0] : undefined;

  // 4. Jurisdiction detection (strictly no hallucination / no guessing)
  let jurisdiction: string | undefined = undefined;
  if (/\b(india|indian|inr|delhi|mumbai|bangalore|tehsildar|ration card|nsp)\b/i.test(lower)) {
    jurisdiction = 'India';
  } else if (/\b(us|usa|united states|irs|california|federal|ssn)\b/i.test(lower)) {
    jurisdiction = 'United States';
  } else if (/\b(uk|united kingdom|nhs|hmrc)\b/i.test(lower)) {
    jurisdiction = 'United Kingdom';
  } else if (/\b(eu|european union|gdpr)\b/i.test(lower)) {
    jurisdiction = 'European Union';
  }

  // 5. Intent and answer type
  let intent = 'General factual verification and inquiry';
  let answerType = 'descriptive';

  if (/what (should|do) i (verify|check|need)|before applying|checklist/i.test(lower)) {
    intent = 'Pre-application verification and criteria requirement audit';
    answerType = 'multi_condition';
  } else if (/is (it|there) (true|eligible|mandatory|allowed)|can i|do i qualify/i.test(lower)) {
    intent = 'Eligibility and compliance verification';
    answerType = 'boolean';
  } else if (/how much|what is the (amount|limit|rate|cutoff|percentage|deadline|date)/i.test(lower)) {
    intent = 'Quantitative threshold or deadline verification';
    answerType = 'numeric';
  } else if (/difference between|compare|vs|versus/i.test(lower)) {
    intent = 'Comparative facet and condition contrast';
    answerType = 'comparative';
  } else if (/how to|steps|procedure|process/i.test(lower)) {
    intent = 'Procedural workflow verification';
    answerType = 'procedural';
  }

  // 6. Named entities extraction
  const namedEntities: string[] = [];
  const words = cleanQ.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^\w-]/g, '');
    // Capitalized or known acronym
    if (w.length >= 2 && (/^[A-Z][A-Z0-9]+$/.test(w) || (i > 0 && /^[A-Z][a-z]+$/.test(w)))) {
      if (!['What', 'When', 'Where', 'Which', 'Who', 'How', 'Should', 'Does', 'Can', 'The', 'Are'].includes(w)) {
        if (!namedEntities.includes(w)) namedEntities.push(w);
      }
    }
  }

  // 7. Ambiguities
  const ambiguities: string[] = [];
  if (!jurisdiction && (domain === 'legal_government' || domain === 'finance_tax' || domain === 'scholarship_education')) {
    ambiguities.push('Jurisdiction or issuing authority region is not explicitly stated in the query.');
  }
  if (!targetDateOrPeriod && timeSensitive) {
    ambiguities.push('Specific cycle or effective calendar year is not specified.');
  }

  return {
    originalQuestion: cleanQ,
    intent,
    domain,
    answerType,
    timeSensitive,
    targetDateOrPeriod,
    jurisdiction,
    language: 'en',
    namedEntities,
    ambiguities,
    riskLevel,
  };
}

export async function analyzeQuestion(question: string): Promise<QuestionContext> {
  const heuristic = analyzeQuestionHeuristic(question);

  // Optional LLM refinement if API key is active
  try {
    const QuestionRefineSchema = z.object({
      intent: z.string(),
      domain: z.string(),
      answerType: z.string(),
      timeSensitive: z.boolean(),
      targetDateOrPeriod: z.string().optional(),
      jurisdiction: z.string().optional(),
      namedEntities: z.array(z.string()),
      ambiguities: z.array(z.string()),
      riskLevel: z.enum(['low', 'moderate', 'high']),
    });

    const prompt = `Analyze this user inquiry for evidence-based verification:
Query: "${question}"

Infer:
- intent: concise purpose of user's question
- domain: specific subject domain
- answerType: numeric, boolean, multi_condition, procedural, comparative, or descriptive
- timeSensitive: whether factual validity changes over time/cycles
- targetDateOrPeriod: exact year/cycle if mentioned, else omit
- jurisdiction: exact country/state if explicitly specified or implied by named program, else omit. NEVER guess.
- namedEntities: list of programs, organizations, or laws mentioned
- ambiguities: any missing scope variables (e.g. degree level, jurisdiction)
- riskLevel: low, moderate, or high (high for financial, legal, medical, safety, or mandatory eligibility criteria)`;

    const refined = await generateLlmObject(prompt, QuestionRefineSchema);
    if (refined) {
      return {
        originalQuestion: question.trim(),
        intent: refined.intent || heuristic.intent,
        domain: refined.domain || heuristic.domain,
        answerType: refined.answerType || heuristic.answerType,
        timeSensitive: refined.timeSensitive ?? heuristic.timeSensitive,
        targetDateOrPeriod: refined.targetDateOrPeriod || heuristic.targetDateOrPeriod,
        jurisdiction: refined.jurisdiction || heuristic.jurisdiction,
        language: 'en',
        namedEntities: refined.namedEntities?.length ? refined.namedEntities : heuristic.namedEntities,
        ambiguities: refined.ambiguities?.length ? refined.ambiguities : heuristic.ambiguities,
        riskLevel: refined.riskLevel || heuristic.riskLevel,
      };
    }
  } catch {
    // Fall back smoothly to robust heuristic
  }

  return heuristic;
}
