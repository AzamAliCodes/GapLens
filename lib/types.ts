export type SourceKind = 'official' | 'institutional' | 'news' | 'third_party' | 'pasted';

export type TrustLabel = 'sourced' | 'rule' | 'ai' | 'uncertain';

// ==========================================
// GAPLENS CORE TYPED CONTRACTS
// ==========================================

export type Mode = 'answer_audit' | 'research_gaps';

export type EvidenceOrigin = 'user_url' | 'user_text' | 'independent_search' | 'demo';

export type Verdict =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE'
  | 'PARTIALLY_SUPPORTED'
  | 'NOT_FACT_CHECKABLE';

export type RiskLevel = 'low' | 'moderate' | 'high';

export type VerificationStrategy =
  | 'official_source'
  | 'primary_research'
  | 'code_test'
  | 'calculation'
  | 'historical_record'
  | 'cross_source'
  | 'other';

export interface QuestionContext {
  originalQuestion: string;
  intent: string;
  domain: string;
  answerType: string;
  timeSensitive: boolean;
  targetDateOrPeriod?: string;
  jurisdiction?: string;
  language?: string;
  namedEntities: string[];
  ambiguities: string[];
  riskLevel: RiskLevel;
}

export interface Criterion {
  id: string;
  question: string;
  description: string;
  importance: 1 | 2 | 3;
  expectedEvidenceType: string;
  verificationStrategy: VerificationStrategy;
  requiredContext?: Record<string, string>;
}

export interface AtomicClaim {
  id: string;
  exactAnswerSpan: string;
  spanOffset?: { start: number; end: number };
  normalizedProposition: string;
  subject?: string;
  predicate?: string;
  value?: string | number;
  units?: string;
  effectiveDate?: string;
  jurisdiction?: string;
  population?: string;
  conditions: string[];
  criterionIds: string[];
  factCheckable: boolean;
}

export interface SourceRecord {
  id: string;
  origin: EvidenceOrigin;
  url?: string;
  canonicalUrl?: string;
  title?: string;
  publisher?: string;
  domain?: string;
  fetchedAt: string;
  publishedAt?: string;
  modifiedAt?: string;
  contentHash: string;
  provenanceGroupId?: string;
  authorityReason?: string;
  extractedText: string;
  fetchStatus: 'ok' | 'blocked' | 'error' | 'empty';
  passages?: Passage[];
}

export interface Evidence {
  id: string;
  sourceId: string;
  passageId?: string;
  passage: string;
  exactQuote?: string;
  quoteOffset?: { start: number; end: number };
  quoteIntegrityVerified: boolean;
  origin: EvidenceOrigin;
  publishedAt?: string;
  url?: string;
  provenanceGroupId?: string;
  relevanceScore?: number;
  scopeMatch?: {
    entity: boolean;
    temporal: boolean;
    jurisdiction: boolean;
    condition: boolean;
  };
}

export interface ClaimFinding {
  claimId: string;
  verdict: Verdict;
  confidence: number;
  entailmentRationale: string;
  matchedEvidence: Evidence[];
  contradictingEvidence: Evidence[];
  scopeDiscrepancies?: string[];
  uncertaintyNotes?: string[];
  deterministicChecksRun?: string[];
  requiresHumanReview?: boolean;
}

export interface CriterionAssessment {
  criterionId: string;
  status: 'covered' | 'partially_covered' | 'missing' | 'conflicting';
  summary: string;
  evidenceCount: number;
  contradictionNotes?: string[];
}

export interface AuditMetrics {
  totalClaims?: number;
  supportedShare?: number | null;
  contradictedShare?: number | null;
  unverifiedShare?: number | null;
  decisivelyEvaluatedShare?: number | null;
  citationIntegrityRate?: number | null;
  criterionCompleteness?: number | null;
}

export interface AuditChecklistItem {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  reason: string;
  targetSource?: string;
  suggestedQuery?: string;
  done?: boolean;
}

export interface AuditReport {
  id: string;
  mode: Mode;
  createdAt: string;
  question: string;
  candidateAnswer?: string;
  questionContext: QuestionContext;
  criteria: Criterion[];
  claims?: AtomicClaim[];
  findings?: ClaimFinding[];
  criterionAssessments?: CriterionAssessment[];
  sources: SourceRecord[];
  metrics: AuditMetrics;
  limitations: string[];
  checklist: AuditChecklistItem[];
  independentSearchUsed: boolean;
  verificationNotice: string;
  isDemo?: boolean;

  // Backward compatibility with legacy Analysis components
  facets: Facet[];
  facts: Fact[];
  gaps: Gap[];
  conflicts: Conflict[];
  freshness: FreshnessFlag[];
  stats: AnalysisStats;
  legacyChecklist?: ChecklistItem[];
}

// ==========================================
// LEGACY COMPATIBILITY CONTRACTS
// ==========================================

export interface Passage {
  id: string; // e.g. S1-P1
  text: string;
  wordCount?: number;
}

export interface Source {
  id: string;            // S1, S2...
  url?: string;
  title: string;
  domain: string;
  kind: SourceKind;
  publishedAt?: string;  // ISO
  updatedAt?: string;    // ISO
  fetchStatus: 'ok' | 'failed' | 'pasted';
  error?: string;
  passages: Passage[];   // S1-P1...
  rawText?: string;
  contentHash?: string;
  provenanceGroupId?: string;
}

export interface Facet {
  id: string;
  name: string;
  question: string;
  criticality: 1 | 2 | 3;
  keywords?: string[];
}

export interface Fact {
  id: string;
  facetId: string;
  sourceId: string;
  passageId: string;
  claim: string;
  quote: string;
  coverage: 'full' | 'partial';
  verified: boolean;
}

export interface Gap {
  id: string;
  facetId: string;
  type: 'missing' | 'partial' | 'single_source';
  severity: 'critical' | 'high' | 'medium' | 'low';
  note: string;
}

export interface ConflictParty {
  factId: string;
  sourceId: string;
  passageId: string;
  claim: string;
  quote: string;
}

export interface Conflict {
  id: string;
  facetId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  a: ConflictParty;
  b: ConflictParty;
  reason: string;
  method: 'rule' | 'llm';
}

export interface FreshnessFlag {
  id: string;
  sourceId: string;
  type: 'stale' | 'undated' | 'earlier_cycle';
  reason: string;
}

export interface ChecklistItem {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  whereToVerify: string;
  evidence: string[]; // gap, conflict or flag ids
  label: TrustLabel;
  done: boolean;
}

export interface AnalysisStats {
  claimsVerified: number;
  claimsRemoved: number;
  sourcesOk: number;
  sourcesFailed: number;
}

export interface Analysis {
  id: string;
  goal: string;
  createdAt: string;
  sources: Source[];
  facets: Facet[];
  facts: Fact[];
  gaps: Gap[];
  conflicts: Conflict[];
  freshness: FreshnessFlag[];
  checklist: ChecklistItem[];
  stats: AnalysisStats;
  isDemo?: boolean;

  // Mode interoperability fields
  mode?: Mode;
  questionContext?: QuestionContext;
  criteria?: Criterion[];
  claims?: AtomicClaim[];
  findings?: ClaimFinding[];
  criterionAssessments?: CriterionAssessment[];
  metrics?: AuditMetrics;
  auditReport?: AuditReport;
}

export interface SourceInput {
  url?: string;
  text?: string;
  label?: string;
  date?: string;
}

export interface AnalyzeRequest {
  mode?: Mode;
  goal?: string;
  question?: string;
  answer?: string;
  sources?: SourceInput[];
}

export type PipelineStage = 
  | 'context'
  | 'rubric'
  | 'claims'
  | 'fetch'
  | 'facets'
  | 'extract'
  | 'verify'
  | 'conflicts'
  | 'freshness'
  | 'metrics'
  | 'checklist'
  | 'done'
  | 'error';

export interface StreamEvent {
  stage: PipelineStage;
  status: string;
  progress: number;
  details?: Record<string, unknown>;
  result?: Analysis;
  auditReport?: AuditReport;
  error?: string;
}
