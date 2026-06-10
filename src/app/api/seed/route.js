// API: /api/seed — Seed initial compliance graph data
import { NextResponse } from 'next/server';
import { ensureIndices, searchDocuments } from '@/lib/elastic';
import { createEntity, createRelationship } from '@/lib/graph-logic';
import { ENTITY_INDEX } from '@/lib/constants';

const SEED_ENTITIES = [
  // Regulations
  { id: 'reg-rbi-dl', type: 'Regulation', name: 'RBI Digital Lending Guidelines', description: 'Reserve Bank of India guidelines on digital lending practices, covering disclosure requirements, data privacy, and fair practices.', status: 'active', owner: 'RBI', tags: ['rbi', 'digital-lending', 'fintech'], source: 'RBI Circular 2022' },
  { id: 'reg-rbi-kyc', type: 'Regulation', name: 'RBI KYC Master Direction', description: 'Master direction on Know Your Customer (KYC) norms, customer due diligence, and ongoing monitoring requirements.', status: 'active', owner: 'RBI', tags: ['rbi', 'kyc', 'aml'], source: 'RBI Master Direction 2016 (Updated 2023)' },

  // Obligations
  { id: 'obl-kyc-verify', type: 'Obligation', name: 'KYC Verification', description: 'Mandatory customer identity verification before account opening or loan disbursement.', status: 'active', owner: 'Compliance Team', tags: ['kyc', 'mandatory'] },
  { id: 'obl-audit-trail', type: 'Obligation', name: 'Audit Trail Maintenance', description: 'Maintain complete audit trails for all digital lending transactions and decisions.', status: 'active', owner: 'IT Security', tags: ['audit', 'logging'] },
  { id: 'obl-ai-explain', type: 'Obligation', name: 'AI Explainability', description: 'Provide clear explanations for AI/ML-driven credit decisions to customers.', status: 'active', owner: 'Risk Management', tags: ['ai', 'explainability', 'fairness'] },
  { id: 'obl-data-retention', type: 'Obligation', name: 'Data Retention Compliance', description: 'Retain customer data as per regulatory requirements and delete upon expiry.', status: 'active', owner: 'IT Security', tags: ['data', 'retention', 'privacy'] },

  // Controls
  { id: 'ctrl-audit-log', type: 'Control', name: 'Audit Logging System', description: 'Centralized audit logging capturing all system events, user actions, and decision trails.', status: 'active', owner: 'IT Security', tags: ['logging', 'monitoring'] },
  { id: 'ctrl-access', type: 'Control', name: 'Access Control Framework', description: 'Role-based access control (RBAC) with multi-factor authentication for sensitive operations.', status: 'active', owner: 'IT Security', tags: ['rbac', 'mfa', 'security'] },
  { id: 'ctrl-model-val', type: 'Control', name: 'Model Validation Framework', description: 'Periodic validation and bias testing of all ML models used in credit decisions.', status: 'active', owner: 'Risk Management', tags: ['ml', 'validation', 'bias'] },

  // Processes
  { id: 'proc-credit-score', type: 'Process', name: 'Credit Scoring Process', description: 'End-to-end credit scoring pipeline using ML models for risk assessment.', status: 'active', owner: 'Risk Management', tags: ['credit', 'scoring', 'ml'] },
  { id: 'proc-onboarding', type: 'Process', name: 'Customer Onboarding', description: 'Digital customer onboarding process including KYC, document verification, and account setup.', status: 'active', owner: 'Operations', tags: ['onboarding', 'kyc'] },
  { id: 'proc-loan-approval', type: 'Process', name: 'Loan Approval Process', description: 'Multi-stage loan approval workflow with automated and manual review gates.', status: 'active', owner: 'Credit Department', tags: ['loan', 'approval'] },
  { id: 'proc-vendor-mgmt', type: 'Process', name: 'Vendor Management Process', description: 'Third-party vendor risk assessment, onboarding, and ongoing monitoring.', status: 'active', owner: 'Procurement', tags: ['vendor', 'third-party'] },

  // Policies
  { id: 'pol-data-retention', type: 'Policy', name: 'Data Retention Policy', description: 'Enterprise-wide data retention and disposal policy defining retention periods by data classification.', status: 'active', owner: 'CISO', tags: ['data', 'retention', 'policy'] },
  { id: 'pol-cloud', type: 'Policy', name: 'Cloud & Outsourcing Policy', description: 'Governance framework for cloud adoption and outsourcing arrangements with third parties.', status: 'active', owner: 'CTO', tags: ['cloud', 'outsourcing'] },
  { id: 'pol-fair-lending', type: 'Policy', name: 'Fair Lending Policy', description: 'Policy ensuring non-discriminatory lending practices and equitable treatment of all applicants.', status: 'active', owner: 'Compliance Team', tags: ['fair-lending', 'discrimination'] },

  // Risks
  { id: 'risk-model-bias', type: 'Risk', name: 'Model Bias Risk', description: 'Risk of biased outcomes from ML credit scoring models leading to discriminatory lending.', status: 'active', owner: 'Risk Management', tags: ['ml', 'bias', 'fairness'], confidence: 0.85 },
  { id: 'risk-data-breach', type: 'Risk', name: 'Data Breach Risk', description: 'Risk of unauthorized access to customer PII and financial data.', status: 'active', owner: 'IT Security', tags: ['security', 'data-breach', 'pii'], confidence: 0.7 },
  { id: 'risk-vendor-lock', type: 'Risk', name: 'Vendor Lock-in Risk', description: 'Risk of excessive dependency on third-party technology vendors.', status: 'active', owner: 'CTO', tags: ['vendor', 'dependency'], confidence: 0.6 },

  // Teams
  { id: 'team-compliance', type: 'Team', name: 'Compliance Team', description: 'Central compliance function responsible for regulatory adherence and reporting.', status: 'active', owner: 'Chief Compliance Officer' },
  { id: 'team-risk', type: 'Team', name: 'Risk Management Team', description: 'Enterprise risk management team overseeing credit, operational, and technology risks.', status: 'active', owner: 'Chief Risk Officer' },
  { id: 'team-it-sec', type: 'Team', name: 'IT Security Team', description: 'Information security team managing cybersecurity, access control, and incident response.', status: 'active', owner: 'CISO' },

  // Systems
  { id: 'sys-core-bank', type: 'System', name: 'Core Banking System', description: 'Primary banking platform handling accounts, transactions, and customer records.', status: 'active', owner: 'IT', tags: ['core', 'banking'] },
  { id: 'sys-ml-engine', type: 'System', name: 'ML Scoring Engine', description: 'Machine learning platform running credit scoring and risk assessment models.', status: 'active', owner: 'Data Science', tags: ['ml', 'scoring', 'ai'] },

  // Evidence
  { id: 'evd-q1-audit', type: 'Evidence', name: 'Q1 2024 Audit Report', description: 'Internal audit report covering digital lending compliance for Q1 2024.', status: 'active', owner: 'Internal Audit', tags: ['audit', 'report', 'q1-2024'] },
  { id: 'evd-kyc-cert', type: 'Evidence', name: 'KYC Compliance Certificate', description: 'Annual KYC compliance certification from external auditors.', status: 'active', owner: 'External Audit', tags: ['kyc', 'certificate'] },

  // Organizations
  { id: 'org-rbi', type: 'Organization', name: 'Reserve Bank of India', description: 'Central banking institution and primary regulator for the Indian financial system.', status: 'active', tags: ['regulator', 'india'] },
  { id: 'org-internal-audit', type: 'Organization', name: 'Internal Audit Department', description: 'Independent internal audit function providing assurance on controls and compliance.', status: 'active', tags: ['audit', 'internal'] },

  // Gaps
  { id: 'gap-explain', type: 'Gap', name: 'AI Explainability Gap', description: 'Current ML models lack sufficient explainability for regulatory compliance. SHAP/LIME integration pending.', status: 'non_compliant', owner: 'Data Science', tags: ['ai', 'explainability', 'gap'] },
];

const SEED_RELATIONSHIPS = [
  // Regulation → Obligation (mandates)
  { source: 'reg-rbi-dl', target: 'obl-audit-trail', relation: 'mandates', rationale: 'Digital lending guidelines require maintaining audit trails for all transactions.' },
  { source: 'reg-rbi-dl', target: 'obl-ai-explain', relation: 'mandates', rationale: 'Guidelines require explainability for AI-driven credit decisions.' },
  { source: 'reg-rbi-dl', target: 'obl-data-retention', relation: 'mandates', rationale: 'Guidelines specify data retention requirements for lending records.' },
  { source: 'reg-rbi-kyc', target: 'obl-kyc-verify', relation: 'mandates', rationale: 'KYC Master Direction mandates customer identity verification.' },

  // Obligation → Control (implemented_by)
  { source: 'obl-audit-trail', target: 'ctrl-audit-log', relation: 'implemented_by', rationale: 'Audit trail obligation is implemented through the centralized audit logging system.' },
  { source: 'obl-kyc-verify', target: 'ctrl-access', relation: 'implemented_by', rationale: 'KYC verification uses access control framework for identity validation.' },
  { source: 'obl-ai-explain', target: 'ctrl-model-val', relation: 'implemented_by', rationale: 'AI explainability is partially addressed through model validation framework.' },

  // Control → Process (governs)
  { source: 'ctrl-audit-log', target: 'proc-loan-approval', relation: 'governs', rationale: 'Audit logging governs the loan approval process to ensure traceability.' },
  { source: 'ctrl-model-val', target: 'proc-credit-score', relation: 'governs', rationale: 'Model validation framework governs the credit scoring process.' },
  { source: 'ctrl-access', target: 'proc-onboarding', relation: 'governs', rationale: 'Access control framework governs customer onboarding security.' },

  // Process → System (uses)
  { source: 'proc-credit-score', target: 'sys-ml-engine', relation: 'uses', rationale: 'Credit scoring process uses the ML scoring engine for risk assessment.' },
  { source: 'proc-onboarding', target: 'sys-core-bank', relation: 'uses', rationale: 'Customer onboarding uses the core banking system for account creation.' },
  { source: 'proc-loan-approval', target: 'sys-core-bank', relation: 'uses', rationale: 'Loan approval process uses core banking for disbursement.' },
  { source: 'proc-loan-approval', target: 'sys-ml-engine', relation: 'uses', rationale: 'Loan approval uses ML engine for automated credit decisions.' },

  // Team → Process (owned_by)
  { source: 'proc-credit-score', target: 'team-risk', relation: 'owned_by', rationale: 'Credit scoring process is owned by the Risk Management team.' },
  { source: 'proc-onboarding', target: 'team-compliance', relation: 'owned_by', rationale: 'Customer onboarding is overseen by the Compliance team.' },
  { source: 'ctrl-audit-log', target: 'team-it-sec', relation: 'owned_by', rationale: 'Audit logging system is owned by IT Security.' },

  // Risk connections
  { source: 'proc-credit-score', target: 'risk-model-bias', relation: 'creates_risk', rationale: 'ML-based credit scoring creates risk of model bias.' },
  { source: 'sys-core-bank', target: 'risk-data-breach', relation: 'creates_risk', rationale: 'Core banking system is a target for data breach attacks.' },
  { source: 'proc-vendor-mgmt', target: 'risk-vendor-lock', relation: 'creates_risk', rationale: 'Vendor management may lead to lock-in with key technology providers.' },
  { source: 'ctrl-model-val', target: 'risk-model-bias', relation: 'mitigates', rationale: 'Model validation framework helps mitigate model bias risk.' },
  { source: 'ctrl-access', target: 'risk-data-breach', relation: 'mitigates', rationale: 'Access control framework mitigates data breach risk.' },

  // Policy connections
  { source: 'pol-data-retention', target: 'obl-data-retention', relation: 'supports', rationale: 'Data retention policy supports the data retention compliance obligation.' },
  { source: 'pol-fair-lending', target: 'obl-ai-explain', relation: 'supports', rationale: 'Fair lending policy supports AI explainability requirements.' },
  { source: 'pol-cloud', target: 'proc-vendor-mgmt', relation: 'governs', rationale: 'Cloud and outsourcing policy governs vendor management process.' },

  // Evidence connections
  { source: 'evd-q1-audit', target: 'ctrl-audit-log', relation: 'supported_by', rationale: 'Q1 audit report provides evidence for audit logging effectiveness.' },
  { source: 'evd-kyc-cert', target: 'obl-kyc-verify', relation: 'supported_by', rationale: 'KYC compliance certificate provides evidence for KYC verification.' },

  // Organization connections
  { source: 'org-rbi', target: 'reg-rbi-dl', relation: 'applies_to', rationale: 'RBI issues and enforces digital lending guidelines.' },
  { source: 'org-rbi', target: 'reg-rbi-kyc', relation: 'applies_to', rationale: 'RBI issues and enforces KYC master direction.' },
  { source: 'org-internal-audit', target: 'evd-q1-audit', relation: 'supported_by', rationale: 'Internal Audit Department produces the quarterly audit reports.' },

  // Gap connections
  { source: 'gap-explain', target: 'obl-ai-explain', relation: 'requires_fix', rationale: 'AI explainability gap indicates non-compliance with the explainability obligation.' },
  { source: 'gap-explain', target: 'sys-ml-engine', relation: 'affects', rationale: 'Explainability gap affects the ML scoring engine capabilities.' },

  // Cross-cutting dependencies
  { source: 'reg-rbi-dl', target: 'pol-fair-lending', relation: 'references', rationale: 'Digital lending guidelines reference fair lending requirements.' },
  { source: 'sys-ml-engine', target: 'sys-core-bank', relation: 'depends_on', rationale: 'ML scoring engine depends on core banking for customer data.' },
];

export async function POST() {
  try {
    await ensureIndices();

    // Check if data already exists
    const existing = await searchDocuments(ENTITY_INDEX, {}, 1);
    if (existing.length > 0) {
      return NextResponse.json({
        message: 'Seed data already exists. Delete existing data first to re-seed.',
        existing_count: existing.length,
      });
    }

    // Create entities
    const entities = [];
    for (const data of SEED_ENTITIES) {
      const entity = await createEntity({ ...data, created_by: 'seed' });
      entities.push(entity);
    }

    // Create relationships
    const relationships = [];
    for (const data of SEED_RELATIONSHIPS) {
      const rel = await createRelationship({
        ...data,
        created_by: 'seed',
        confidence: data.confidence ?? 0.95,
        editable: true,
      });
      relationships.push(rel);
    }

    return NextResponse.json({
      message: 'Seed data loaded successfully',
      entities_created: entities.length,
      relationships_created: relationships.length,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/seed error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
