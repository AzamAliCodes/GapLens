import { Analysis, AuditReport } from './types';

/**
 * Generates an auditable, reproducible Markdown export of an AuditReport.
 */
export function exportAuditReportMarkdown(report: AuditReport): string {
  const lines: string[] = [
    `# GapLens Audit Report: Claim Verification & Gap Analysis`,
    `**Inquiry / Question:** ${report.question}`,
    `**Mode:** ${report.mode === 'answer_audit' ? 'Answer Audit (Claim-Level Verification)' : 'Research Gap Analysis'}`,
    `**Analysis ID:** ${report.id}`,
    `**Audit Date:** ${new Date(report.createdAt).toLocaleString('en-GB')}`,
    `**Domain:** ${report.questionContext.domain} | **Risk Level:** ${report.questionContext.riskLevel.toUpperCase()}`,
    `**Verification Notice:** ${report.verificationNotice}`,
    '',
    '> [!NOTE] Trust Boundary & Verification Notice',
    `> ${report.verificationNotice}. This report documents logical entailment and quote integrity against captured source snapshots. Model judgments are fallible; human confirmation is recommended for high-stakes decisions.`,
    '',
  ];

  if (report.candidateAnswer) {
    lines.push('## Candidate Answer Assessed');
    lines.push('```text');
    lines.push(report.candidateAnswer);
    lines.push('```');
    lines.push('');
  }

  // Summary Metrics
  lines.push('## 1. Verification Metrics');
  if (report.mode === 'answer_audit') {
    lines.push(`- **Total Atomic Claims Evaluated:** ${report.metrics.totalClaims ?? 0}`);
    lines.push(`- **Supported Share:** ${report.metrics.supportedShare !== null && report.metrics.supportedShare !== undefined ? (report.metrics.supportedShare * 100).toFixed(1) + '%' : 'N/A'}`);
    lines.push(`- **Contradicted Share:** ${report.metrics.contradictedShare !== null && report.metrics.contradictedShare !== undefined ? (report.metrics.contradictedShare * 100).toFixed(1) + '%' : 'N/A'}`);
    lines.push(`- **Unverified / Insufficient Evidence Share:** ${report.metrics.unverifiedShare !== null && report.metrics.unverifiedShare !== undefined ? (report.metrics.unverifiedShare * 100).toFixed(1) + '%' : 'N/A'}`);
    lines.push(`- **Decisively Evaluated Share:** ${report.metrics.decisivelyEvaluatedShare !== null && report.metrics.decisivelyEvaluatedShare !== undefined ? (report.metrics.decisivelyEvaluatedShare * 100).toFixed(1) + '%' : 'N/A'}`);
    lines.push(`- **Quote Integrity Rate:** ${report.metrics.citationIntegrityRate !== null && report.metrics.citationIntegrityRate !== undefined ? (report.metrics.citationIntegrityRate * 100).toFixed(1) + '%' : 'N/A'}`);
  }
  lines.push(`- **Criteria Coverage Completeness:** ${report.metrics.criterionCompleteness !== null && report.metrics.criterionCompleteness !== undefined ? (report.metrics.criterionCompleteness * 100).toFixed(1) + '%' : 'N/A'}`);
  lines.push('');

  // Claim Ledger
  if (report.claims && report.claims.length > 0 && report.findings) {
    lines.push('## 2. Itemized Claim Ledger');
    lines.push('');
    const findingMap = new Map(report.findings.map(f => [f.claimId, f]));

    for (const claim of report.claims) {
      const finding = findingMap.get(claim.id);
      const verdict = finding?.verdict || 'INSUFFICIENT_EVIDENCE';
      const conf = finding?.confidence !== undefined ? ` (Confidence: ${(finding.confidence * 100).toFixed(0)}%)` : '';

      lines.push(`### [${claim.id}] Verdict: ${verdict}${conf}`);
      lines.push(`- **Candidate Answer Span:** "${claim.exactAnswerSpan}"`);
      lines.push(`- **Normalized Proposition:** ${claim.normalizedProposition}`);
      if (claim.conditions.length > 0) {
        lines.push(`- **Stated Conditions:** ${claim.conditions.join('; ')}`);
      }
      lines.push(`- **Entailment Rationale:** ${finding?.entailmentRationale || 'No rationale recorded'}`);

      if (finding?.matchedEvidence && finding.matchedEvidence.length > 0) {
        lines.push('- **Supporting Evidence:**');
        for (const ev of finding.matchedEvidence) {
          const offsetStr = ev.quoteOffset ? ` [offset: ${ev.quoteOffset.start}-${ev.quoteOffset.end}]` : '';
          lines.push(`  - Source ${ev.sourceId} (${ev.origin})${offsetStr}: "${ev.exactQuote || ev.passage.slice(0, 100)}"`);
        }
      }

      if (finding?.contradictingEvidence && finding.contradictingEvidence.length > 0) {
        lines.push('- **Contradicting Evidence:**');
        for (const ev of finding.contradictingEvidence) {
          lines.push(`  - ⚠️ Source ${ev.sourceId}: "${ev.exactQuote || ev.passage.slice(0, 100)}"`);
        }
      }

      if (finding?.scopeDiscrepancies && finding.scopeDiscrepancies.length > 0) {
        lines.push(`- **Scope Discrepancies:** ${finding.scopeDiscrepancies.join('; ')}`);
      }

      lines.push('');
    }
  }

  // Criteria & Coverage
  if (report.criteria && report.criteria.length > 0) {
    lines.push('## 3. Dynamic Verification Rubric & Criteria Coverage');
    lines.push('');
    const assMap = new Map((report.criterionAssessments || []).map(a => [a.criterionId, a]));

    for (const crit of report.criteria) {
      const ass = assMap.get(crit.id);
      const statusLabel = ass?.status ? ass.status.toUpperCase() : 'NOT EVALUATED';
      lines.push(`### Criterion: ${crit.question} [${statusLabel}]`);
      lines.push(`- **Importance:** Level ${crit.importance}/3 | **Strategy:** ${crit.verificationStrategy}`);
      lines.push(`- **Description:** ${crit.description}`);
      lines.push(`- **Expected Evidence:** ${crit.expectedEvidenceType}`);
      if (ass?.summary) {
        lines.push(`- **Finding:** ${ass.summary}`);
      }
      lines.push('');
    }
  }

  // Prioritized Checklist
  if (report.checklist && report.checklist.length > 0) {
    lines.push('## 4. Prioritized Action Checklist');
    lines.push('');
    for (const item of report.checklist) {
      const check = item.done ? '[x]' : '[ ]';
      lines.push(`- ${check} **[${item.priority}]** ${item.action}`);
      lines.push(`  - *Reason:* ${item.reason}`);
      if (item.targetSource) lines.push(`  - *Target Source:* ${item.targetSource}`);
      if (item.suggestedQuery) lines.push(`  - *Suggested Query:* \`${item.suggestedQuery}\``);
    }
    lines.push('');
  }

  // Sourcing & Provenance Ledger
  lines.push('## 5. Source Records & Provenance Hashes');
  lines.push('');
  for (const src of report.sources) {
    lines.push(`- **Source ${src.id}:** ${src.title || src.url || 'Pasted Content'}`);
    if (src.url) lines.push(`  - URL: ${src.url}`);
    lines.push(`  - Origin: ${src.origin} | Content SHA-256 Hash: \`${src.contentHash}\``);
    if (src.provenanceGroupId) lines.push(`  - Provenance Group: \`${src.provenanceGroupId}\``);
    if (src.authorityReason) lines.push(`  - Authority Evaluation: ${src.authorityReason}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates structured JSON export of an AuditReport.
 */
export function exportAuditReportJSON(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generates clean, actionable Markdown for the prioritized checklist (legacy compatibility).
 */
export function exportChecklistMarkdown(analysis: Analysis): string {
  const lines: string[] = [
    `# GapLens Action Checklist`,
    `**Goal:** ${analysis.goal}`,
    `**Generated:** ${new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    `**Disclaimer:** Findings are potential signals to verify, not guaranteed facts. Always inspect official issuing authorities.`,
    '',
    '## Prioritized Verification Items',
    '',
  ];

  for (const item of analysis.checklist) {
    const check = item.done ? '[x]' : '[ ]';
    const prio = item.priority.toUpperCase();
    lines.push(`- ${check} **[${prio}]** ${item.action}`);
    lines.push(`  - **Where to verify:** ${item.whereToVerify}`);
    lines.push(`  - **Trust classification:** ${item.label.toUpperCase()}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates an end-to-end audit report in Markdown format (legacy compatibility).
 */
export function exportFullReportMarkdown(analysis: Analysis): string {
  if (analysis.auditReport) {
    return exportAuditReportMarkdown(analysis.auditReport);
  }

  const lines: string[] = [
    `# GapLens Audit Report: Information Gap & Contradiction Analysis`,
    `**Research Goal:** ${analysis.goal}`,
    `**Analysis ID:** ${analysis.id}`,
    `**Analyzed On:** ${new Date(analysis.createdAt).toLocaleString()}`,
    `**Trust Disclaimer:** This report highlights potential information dark spots, contradictory claims, and freshness warnings. It does not certify legal facts.`,
    '',
    '## 1. Audit Summary',
    `- Sources Reviewed: ${analysis.stats.sourcesOk} OK (${analysis.stats.sourcesFailed} failed)`,
    `- Verified Extracted Claims: ${analysis.stats.claimsVerified}`,
    `- Unverifiable Hallucinations Dropped: ${analysis.stats.claimsRemoved}`,
    `- Potential Information Gaps: ${analysis.gaps.length}`,
    `- Contradictions / Discrepancies: ${analysis.conflicts.length}`,
    `- Freshness / Cycle Warnings: ${analysis.freshness.length}`,
    '',
    '## 2. Information Coverage Matrix & Gaps',
    '',
  ];

  for (const facet of analysis.facets) {
    lines.push(`### Facet: ${facet.name} (Criticality: ${facet.criticality}/3)`);
    lines.push(`*Question:* ${facet.question}`);
    
    const matchingGaps = analysis.gaps.filter(g => g.facetId === facet.id);
    if (matchingGaps.length > 0) {
      for (const gap of matchingGaps) {
        lines.push(`> ⚠️ **POTENTIAL GAP [${gap.severity.toUpperCase()}]:** ${gap.note}`);
      }
    }

    const matchingFacts = analysis.facts.filter(f => f.facetId === facet.id);
    if (matchingFacts.length > 0) {
      lines.push('**Sourced Evidence:**');
      for (const fact of matchingFacts) {
        lines.push(`- [${fact.sourceId} / ${fact.passageId}]: "${fact.quote}" (Claim: ${fact.claim})`);
      }
    }
    lines.push('');
  }

  if (analysis.conflicts.length > 0) {
    lines.push('## 3. Discrepancies & Cross-Source Contradictions');
    lines.push('');
    for (const c of analysis.conflicts) {
      lines.push(`### Discrepancy on Facet: ${c.facetId} [${c.severity.toUpperCase()}]`);
      lines.push(`**Reason:** ${c.reason}`);
      lines.push(`- **Source ${c.a.sourceId} Quote (${c.a.passageId}):** "${c.a.quote}"`);
      lines.push(`- **Source ${c.b.sourceId} Quote (${c.b.passageId}):** "${c.b.quote}"`);
      lines.push('');
    }
  }

  if (analysis.freshness.length > 0) {
    lines.push('## 4. Freshness, Staleness & Cycle Warnings');
    lines.push('');
    for (const f of analysis.freshness) {
      lines.push(`- **Source ${f.sourceId} [${f.type.toUpperCase()}]:** ${f.reason}`);
    }
    lines.push('');
  }

  lines.push('## 5. Prioritized Verification Checklist');
  lines.push('');
  for (const item of analysis.checklist) {
    const check = item.done ? '[x]' : '[ ]';
    lines.push(`- ${check} **[${item.priority.toUpperCase()}]** ${item.action}`);
    lines.push(`  - *Target:* ${item.whereToVerify}`);
  }

  return lines.join('\n');
}

/**
 * Triggers a client-side file download of a string blob.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
