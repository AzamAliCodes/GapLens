import { generateObject } from 'ai';
import { Facet } from '../types';
import { FacetPlanSchema } from '../schemas';
import { getLLMConfig } from '../llm';

export async function planFacets(goal: string): Promise<Facet[]> {
  const config = getLLMConfig();

  if (config.model) {
    try {
      const response = await generateObject({
        model: config.model,
        schema: FacetPlanSchema,
        temperature: 0.1,
        system: `You are an information architecture and gap-detection planner for research goals.
Given a user's research goal, produce an expected information map: a list of 6 to 10 essential information facets that a thorough, careful person MUST confirm before making a decision.
CRITICAL RULES:
1. Return generic inquiry categories and questions, NOT pre-conceived facts or answers.
2. Assign each facet a criticality score from 1 to 3:
   - 3: Decision-critical (e.g., eligibility, hard deadlines, costs, mandatory documents, legal/renewal terms)
   - 2: Operational (e.g., selection process, award disbursements, contact details, official application link)
   - 1: Contextual (e.g., background history, quotas, optional perks)
3. Return 3 to 6 search keywords per facet for passage retrieval.`,
        prompt: `Research Goal: "${goal}"

Generate the 6 to 10 expected information facets for this goal.`,
      });

      if (response.object && response.object.facets && response.object.facets.length > 0) {
        return response.object.facets.map((f, i) => ({
          id: f.id || `F${i + 1}`,
          name: f.name,
          question: f.question,
          criticality: (f.criticality || 2) as 1 | 2 | 3,
          keywords: f.keywords || [],
        }));
      }
    } catch (err) {
      console.warn('LLM facet planning failed, falling back to heuristic planner:', err);
    }
  }

  // Fallback heuristic planner based on research goal intent
  return getHeuristicFacets(goal);
}

function getHeuristicFacets(goal: string): Facet[] {
  const g = goal.toLowerCase();

  if (g.includes('scholarship') || g.includes('grant') || g.includes('fellowship')) {
    return [
      { id: 'F1', name: 'Eligibility Criteria', question: 'What specific academic, domicile, or income qualifications are strictly required?', criticality: 3, keywords: ['eligibility', 'eligible', 'qualification', 'marks', 'percentage', 'criteria'] },
      { id: 'F2', name: 'Application Deadline', question: 'What is the exact closing date and time for the current cycle submission?', criticality: 3, keywords: ['deadline', 'last date', 'closing date', 'due date', 'schedule'] },
      { id: 'F3', name: 'Mandatory Documents', question: 'What exact certificates, income proofs, or affidavits must be uploaded?', criticality: 3, keywords: ['documents', 'certificate', 'income proof', 'marksheet', 'verification', 'affidavit'] },
      { id: 'F4', name: 'Renewal Policy', question: 'What ongoing GPA, attendance, or re-application conditions are required to retain the award in future years?', criticality: 3, keywords: ['renewal', 'renew', 'subsequent year', 'continuation', 'maintenance'] },
      { id: 'F5', name: 'Award Amount & Coverage', question: 'What exact financial sum, tuition waiver, or allowance is disbursed and on what schedule?', criticality: 2, keywords: ['amount', 'stipend', 'tuition', 'disbursement', 'benefit', 'sum'] },
      { id: 'F6', name: 'Official Application Portal', question: 'What is the genuine official URL or platform through which forms must be submitted?', criticality: 2, keywords: ['portal', 'apply', 'website', 'link', 'register', 'url'] },
      { id: 'F7', name: 'Selection & Merit Criteria', question: 'How are candidates ranked, evaluated, or interviewed?', criticality: 2, keywords: ['selection', 'merit', 'evaluation', 'interview', 'screening', 'quota'] },
      { id: 'F8', name: 'Helpdesk & Grievance Contact', question: 'What official helpline number, email, or physical authority handles queries and disputes?', criticality: 1, keywords: ['helpdesk', 'contact', 'helpline', 'email', 'grievance', 'support'] },
    ];
  }

  if (g.includes('admission') || g.includes('college') || g.includes('university') || g.includes('course')) {
    return [
      { id: 'F1', name: 'Eligibility & Entrance Exam', question: 'What minimum exam cutoffs, degrees, and prerequisites are required for entry?', criticality: 3, keywords: ['eligibility', 'cutoff', 'exam', 'entrance', 'prerequisites'] },
      { id: 'F2', name: 'Application Timeline & Deadlines', question: 'When does registration open and close, and when are merit lists published?', criticality: 3, keywords: ['deadline', 'timeline', 'dates', 'schedule', 'counseling'] },
      { id: 'F3', name: 'Fee Structure & Refund Policy', question: 'What is the total fee payable and what are the UGC/official refund cancellation rules?', criticality: 3, keywords: ['fee', 'tuition', 'refund', 'cancellation', 'cost'] },
      { id: 'F4', name: 'Required Documents for Verification', question: 'What original documents and transfer certificates must be presented at counseling?', criticality: 3, keywords: ['documents', 'verification', 'certificate', 'migration', 'caste'] },
      { id: 'F5', name: 'Accreditation & Degree Recognition', question: 'Is the institution recognized by UGC/AICTE/accreditation bodies for this course?', criticality: 2, keywords: ['accreditation', 'ugc', 'aicte', 'naac', 'recognition'] },
      { id: 'F6', name: 'Hostel & Campus Facilities', question: 'Are on-campus hostel accommodations guaranteed, and at what cost?', criticality: 1, keywords: ['hostel', 'accommodation', 'campus', 'facility', 'mess'] },
    ];
  }

  if (g.includes('scheme') || g.includes('policy') || g.includes('subsidy') || g.includes('loan')) {
    return [
      { id: 'F1', name: 'Target Beneficiaries & Eligibility', question: 'Who qualifies under age, income, caste, landholding or employment criteria?', criticality: 3, keywords: ['beneficiary', 'eligibility', 'income', 'criteria', 'qualify'] },
      { id: 'F2', name: 'Benefit Structure & Financial Aid', question: 'What is the exact financial subsidy, transfer amount, or credit guarantee provided?', criticality: 3, keywords: ['subsidy', 'benefit', 'amount', 'credit', 'interest rate'] },
      { id: 'F3', name: 'Required Proofs & KYC Documents', question: 'What identity, bank account, and category proofs must be furnished?', criticality: 3, keywords: ['documents', 'aadhaar', 'kyc', 'bank', 'certificate'] },
      { id: 'F4', name: 'Application Workflow & Portal', question: 'Where and how is the formal application submitted (online vs CSC/bank branch)?', criticality: 2, keywords: ['portal', 'csc', 'apply', 'procedure', 'bank'] },
      { id: 'F5', name: 'Validity & Scheme Expiry', question: 'Is the scheme currently active or has the financial allocation expired?', criticality: 2, keywords: ['validity', 'period', 'active', 'financial year', 'closing'] },
      { id: 'F6', name: 'Grievance Redressal Mechanism', question: 'Who is the nodal officer or escalation authority for complaints?', criticality: 1, keywords: ['grievance', 'officer', 'complaint', 'nodal', 'escalation'] },
    ];
  }

  if (g.includes('job') || g.includes('career') || g.includes('offer') || g.includes('employment') || g.includes('visa')) {
    return [
      { id: 'F1', name: 'Compensation & In-Hand Pay', question: 'What is the exact gross vs net salary, deductions, and fixed vs variable breakdown?', criticality: 3, keywords: ['salary', 'compensation', 'ctc', 'variable', 'pay', 'bonus'] },
      { id: 'F2', name: 'Notice Period & Bond Terms', question: 'What mandatory lock-in period, service agreement, or exit penalties exist?', criticality: 3, keywords: ['bond', 'notice period', 'exit', 'service agreement', 'lock-in', 'penalty'] },
      { id: 'F3', name: 'Probation & Confirmation Terms', question: 'What is the probation duration and criteria for full employment confirmation?', criticality: 2, keywords: ['probation', 'confirmation', 'performance', 'evaluation'] },
      { id: 'F4', name: 'Work Location & Remote Policy', question: 'Is the role strictly on-site, hybrid, or remote, and what are the relocation terms?', criticality: 2, keywords: ['location', 'remote', 'hybrid', 'on-site', 'relocation', 'travel'] },
      { id: 'F5', name: 'Benefits & Health Insurance', question: 'What medical insurance coverage, leave entitlement, and PF contributions are provided?', criticality: 2, keywords: ['insurance', 'leave', 'benefits', 'medical', 'pf'] },
      { id: 'F6', name: 'Visa & Work Authorization', question: 'Is valid work sponsorship provided and what are the immigration constraints?', criticality: 3, keywords: ['visa', 'sponsorship', 'work authorization', 'immigration'] },
    ];
  }

  if (g.includes('certif') || g.includes('exam') || g.includes('license') || g.includes('test')) {
    return [
      { id: 'F1', name: 'Eligibility & Prerequisites', question: 'What prior degrees, experience, or baseline coursework are mandatory?', criticality: 3, keywords: ['prerequisites', 'eligibility', 'experience', 'qualification'] },
      { id: 'F2', name: 'Passing Score & Retake Rules', question: 'What cutoff score is required to pass and what waiting period/fee applies to retakes?', criticality: 3, keywords: ['passing score', 'cutoff', 'retake', 'attempts', 'score'] },
      { id: 'F3', name: 'Validity & Renewal Requirements', question: 'How long is the credential valid, and what continuing education/CPE credits are needed to renew?', criticality: 3, keywords: ['validity', 'renewal', 'cpe', 'expiration', 'maintain'] },
      { id: 'F4', name: 'Registration Fee & Hidden Costs', question: 'What is the total fee including exam proctoring, membership, and rescheduling?', criticality: 2, keywords: ['fee', 'cost', 'exam fee', 'membership', 'rescheduling'] },
      { id: 'F5', name: 'Official Accrediting Body', question: 'Is the certification recognized by industry bodies, regulators, or government agencies?', criticality: 2, keywords: ['accreditation', 'recognition', 'issuing body', 'official'] },
    ];
  }

  // Default general research inquiry map
  return [
    { id: 'F1', name: 'Core Requirements & Eligibility', question: 'What prerequisites or baseline criteria must be satisfied?', criticality: 3, keywords: ['requirements', 'eligibility', 'criteria', 'qualification'] },
    { id: 'F2', name: 'Key Dates & Deadlines', question: 'What are the critical dates, milestones, or expiration timeframes?', criticality: 3, keywords: ['deadline', 'date', 'timeline', 'schedule', 'closing'] },
    { id: 'F3', name: 'Costs & Financial Commitments', question: 'What explicit and hidden costs, fees, or penalties are involved?', criticality: 3, keywords: ['cost', 'fee', 'price', 'penalty', 'payment'] },
    { id: 'F4', name: 'Required Documentation & Proofs', question: 'What formal evidence or paperwork is required to verify claims?', criticality: 2, keywords: ['documents', 'proof', 'verification', 'paperwork'] },
    { id: 'F5', name: 'Step-by-step Process', question: 'What is the verified official operational workflow to proceed?', criticality: 2, keywords: ['process', 'steps', 'procedure', 'how to', 'workflow'] },
    { id: 'F6', name: 'Disclaimers, Risks & Termination Terms', question: 'What limitations, fine print, or termination clauses exist?', criticality: 2, keywords: ['risk', 'disclaimer', 'terms', 'cancellation', 'conditions'] },
    { id: 'F7', name: 'Official Authority & Point of Contact', question: 'Who is the legally accountable sponsor or contact organization?', criticality: 1, keywords: ['authority', 'contact', 'support', 'sponsor', 'official'] },
  ];
}
