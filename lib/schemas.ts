import { z } from 'zod';

export const SourceInputSchema = z.object({
  url: z.string().url().optional().or(z.literal('')),
  text: z.string().optional(),
  label: z.string().optional(),
  date: z.string().optional(),
}).refine(data => Boolean(data.url?.trim() || data.text?.trim()), {
  message: 'Source must include either a valid URL or text content',
});

export const ModeSchema = z.enum(['answer_audit', 'research_gaps']);

export const EvidenceOriginSchema = z.enum(['user_url', 'user_text', 'independent_search', 'demo']);

export const VerdictSchema = z.enum([
  'SUPPORTED',
  'CONTRADICTED',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTING_EVIDENCE',
  'PARTIALLY_SUPPORTED',
  'NOT_FACT_CHECKABLE',
]);

export const RiskLevelSchema = z.enum(['low', 'moderate', 'high']);

export const VerificationStrategySchema = z.enum([
  'official_source',
  'primary_research',
  'code_test',
  'calculation',
  'historical_record',
  'cross_source',
  'other',
]);

export const QuestionContextSchema = z.object({
  originalQuestion: z.string(),
  intent: z.string(),
  domain: z.string(),
  answerType: z.string(),
  timeSensitive: z.boolean(),
  targetDateOrPeriod: z.string().optional(),
  jurisdiction: z.string().optional(),
  language: z.string().optional(),
  namedEntities: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
  riskLevel: RiskLevelSchema,
});

export const CriterionSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  expectedEvidenceType: z.string(),
  verificationStrategy: VerificationStrategySchema,
  requiredContext: z.record(z.string(), z.string()).optional(),
});

export const AtomicClaimSchema = z.object({
  id: z.string(),
  exactAnswerSpan: z.string(),
  spanOffset: z.object({ start: z.number(), end: z.number() }).optional(),
  normalizedProposition: z.string(),
  subject: z.string().optional(),
  predicate: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  units: z.string().optional(),
  effectiveDate: z.string().optional(),
  jurisdiction: z.string().optional(),
  population: z.string().optional(),
  conditions: z.array(z.string()).default([]),
  criterionIds: z.array(z.string()).default([]),
  factCheckable: z.boolean(),
});

export const SourceRecordSchema = z.object({
  id: z.string(),
  origin: EvidenceOriginSchema,
  url: z.string().url().optional(),
  canonicalUrl: z.string().url().optional(),
  title: z.string().optional(),
  publisher: z.string().optional(),
  domain: z.string().optional(),
  fetchedAt: z.string(),
  publishedAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  contentHash: z.string(),
  provenanceGroupId: z.string().optional(),
  authorityReason: z.string().optional(),
  extractedText: z.string(),
  fetchStatus: z.enum(['ok', 'blocked', 'error', 'empty']),
});

export const EvidenceSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  passageId: z.string().optional(),
  passage: z.string(),
  exactQuote: z.string().optional(),
  quoteOffset: z.object({ start: z.number(), end: z.number() }).optional(),
  quoteIntegrityVerified: z.boolean(),
  origin: EvidenceOriginSchema,
  publishedAt: z.string().optional(),
  url: z.string().optional(),
  provenanceGroupId: z.string().optional(),
  relevanceScore: z.number().optional(),
  scopeMatch: z.object({
    entity: z.boolean(),
    temporal: z.boolean(),
    jurisdiction: z.boolean(),
    condition: z.boolean(),
  }).optional(),
});

export const ClaimFindingSchema = z.object({
  claimId: z.string(),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  entailmentRationale: z.string(),
  matchedEvidence: z.array(EvidenceSchema).default([]),
  contradictingEvidence: z.array(EvidenceSchema).default([]),
  scopeDiscrepancies: z.array(z.string()).optional(),
  uncertaintyNotes: z.array(z.string()).optional(),
  deterministicChecksRun: z.array(z.string()).optional(),
  requiresHumanReview: z.boolean().optional(),
});

export const CriterionAssessmentSchema = z.object({
  criterionId: z.string(),
  status: z.enum(['covered', 'partially_covered', 'missing', 'conflicting']),
  summary: z.string(),
  evidenceCount: z.number(),
  contradictionNotes: z.array(z.string()).optional(),
});

export const AuditMetricsSchema = z.object({
  totalClaims: z.number().optional(),
  supportedShare: z.number().nullable().optional(),
  contradictedShare: z.number().nullable().optional(),
  unverifiedShare: z.number().nullable().optional(),
  decisivelyEvaluatedShare: z.number().nullable().optional(),
  citationIntegrityRate: z.number().nullable().optional(),
  criterionCompleteness: z.number().nullable().optional(),
});

export const AuditChecklistItemSchema = z.object({
  id: z.string(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  action: z.string(),
  reason: z.string(),
  targetSource: z.string().optional(),
  suggestedQuery: z.string().optional(),
  done: z.boolean().optional(),
});

export const AuditReportSchema = z.object({
  id: z.string(),
  mode: ModeSchema,
  createdAt: z.string(),
  question: z.string(),
  candidateAnswer: z.string().optional(),
  questionContext: QuestionContextSchema,
  criteria: z.array(CriterionSchema),
  claims: z.array(AtomicClaimSchema).optional(),
  findings: z.array(ClaimFindingSchema).optional(),
  criterionAssessments: z.array(CriterionAssessmentSchema).optional(),
  sources: z.array(SourceRecordSchema),
  metrics: AuditMetricsSchema,
  limitations: z.array(z.string()),
  checklist: z.array(AuditChecklistItemSchema),
  independentSearchUsed: z.boolean(),
  verificationNotice: z.string(),
  isDemo: z.boolean().optional(),
});

// AnalyzeRequestSchema accepting request payloads
export const AnalyzeRequestSchema = z.object({
  mode: ModeSchema.optional(),
  goal: z.string().optional(),
  question: z.string().optional(),
  answer: z.string().optional(),
  sources: z.array(SourceInputSchema).max(6, 'Maximum 6 sources allowed in single run').default([]),
}).refine(data => {
  const query = (data.question || data.goal || '').trim();
  return query.length >= 5;
}, {
  message: 'Question or research goal must be at least 5 characters',
}).refine(data => {
  // If answer is provided or mode is answer_audit, answer must be non-empty string
  const isAudit = data.mode === 'answer_audit' || Boolean(data.answer?.trim());
  if (isAudit) {
    return Boolean(data.answer && data.answer.trim().length >= 10);
  }
  return true;
}, {
  message: 'Answer Audit mode requires a candidate answer of at least 10 characters',
}).refine(data => {
  // If mode is research_gaps and no answer is supplied, ensure at least 2 sources if sources are provided
  const isAudit = data.mode === 'answer_audit' || Boolean(data.answer?.trim());
  if (!isAudit && data.sources && data.sources.length > 0) {
    return data.sources.length >= 2;
  }
  return true;
}, {
  message: 'At least 2 sources are required for comparative source gap analysis',
});

export const FacetPlanSchema = z.object({
  facets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    question: z.string(),
    criticality: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    keywords: z.array(z.string()).default([]),
  })).min(3).max(12),
});

export const FactExtractionSchema = z.object({
  facts: z.array(z.object({
    facetId: z.string(),
    claim: z.string(),
    quote: z.string(),
    passageId: z.string(),
    coverage: z.enum(['full', 'partial']),
  })),
});

export const FacetComparisonSchema = z.object({
  comparisons: z.array(z.object({
    facetId: z.string(),
    status: z.enum(['agree', 'conflict', 'unclear']),
    reason: z.string(),
  })),
});

export const ChecklistWordingSchema = z.object({
  items: z.array(z.object({
    findingId: z.string(),
    action: z.string(),
    whereToVerify: z.string(),
  })),
});

export const SearchRequestSchema = z.object({
  goal: z.string().min(2, 'Search query must be at least 2 characters').max(300),
});
