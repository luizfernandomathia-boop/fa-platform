// Shared types for file analysis and AI classification results.
// Used by the API routes (server) and the resultados page (client).

// ─── File analysis ────────────────────────────────────────────────────────────

export type ColumnType = "numeric" | "text" | "empty";

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  /** Number of null / empty cells */
  nullCount: number;
  uniqueCount: number;
  /** Up to 3 sample raw values */
  sample: string[];
  // numeric columns only
  sum?: number;
  min?: number;
  max?: number;
  avg?: number;
  // text columns only
  topValues?: { value: string; count: number }[];
}

export interface GroupSummary {
  groupColumn: string;
  valueColumn: string;
  groups: { label: string; total: number; count: number }[];
}

export interface FileAnalysis {
  id: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnInfo[];
  /** First 5 rows as string key→value maps */
  preview: Record<string, string>[];
  groups: GroupSummary[];
  alerts: { type: "warning" | "info" | "ok"; message: string }[];
  uploadedAt: string;
  /** AI/heuristic classification — present when classification ran successfully */
  classification?: ClassificationResult;
  /** Document-level AI interpretation — present when analyzeDocument ran successfully */
  insight?: DocumentInsight;
  /** Set when analyzeDocument was attempted but failed */
  insightError?: string;
}

// ─── Classification ───────────────────────────────────────────────────────────

export const TAXONOMY = [
  "Fornecedor hospitalar",
  "Prestador de serviço",
  "Infraestrutura / Manutenção",
  "Infraestrutura / Equipamentos",
  "Infraestrutura / Tecnologia",
  "Fornecedor operacional",
  "Médico",
  "Trabalhista",
  "Trabalhista / Benefícios",
  "Trabalhista / Empréstimo",
  "Impostos",
  "Administrativo",
  "Administrativo / Taxas",
  "Financeiro",
  "Não classificado",
] as const;

export type TaxonomyCategory = (typeof TAXONOMY)[number];

/** Which columns were detected as carrying key classification signals */
export interface KeyColumns {
  description?: string;
  supplier?: string;
  value?: string;
  dueDate?: string;
}

export interface ClassifiedEntry {
  rowIndex: number;
  /** Text used for classification (description + supplier joined) */
  text: string;
  value: number | null;
  category: TaxonomyCategory;
  /** 0–1: 1.0 = fully confident */
  confidence: number;
  /** One or two sentences explaining the choice */
  justification: string;
  /** true when confidence < 0.75 or context was too ambiguous */
  needsReview: boolean;
}

export interface CategorySummary {
  category: TaxonomyCategory;
  count: number;
  totalValue: number;
}

export interface ClassificationResult {
  /** "heuristic" until ANTHROPIC_API_KEY is configured; "ai" when using the API */
  method: "heuristic" | "ai";
  /** Set when method === "ai" */
  model?: string;
  /** Detected source columns */
  keyColumns: KeyColumns;
  entries: ClassifiedEntry[];
  summary: CategorySummary[];
  needsReviewCount: number;
  classifiedAt: string;
}

// ─── Document-level AI insight ────────────────────────────────────────────────

export type DataQuality = "boa" | "regular" | "ruim";

/** A key metric with optional trend and status */
export interface InsightMetric {
  label: string;
  value: string;
  /** "alta" | "baixa" | "estável" — optional trend direction */
  trend?: string;
  /** "ok" | "atenção" | "crítico" — optional status color */
  status?: "ok" | "atenção" | "crítico";
}

/** Transparency: what was actually sent to the AI and what was pre-computed */
export interface InsightPayloadInfo {
  totalLinhas: number;
  linhasPreviewEnviadas: number;
  colunasDetectadas: string[];
  agingCalculado: boolean;
  concentracaoCalculada: boolean;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  timestamp: string;
}

// ─── Deep Document Insight — rich analysis output ─────────────────────────────

export interface DocumentInsight {
  /** Always "ai" */
  method: "ai";
  model: string;
  analyzedAt: string;

  // ── Identification ──────────────────────────────────────────────────────────
  /** E.g. "Títulos a Receber", "DRE", "Balanço Patrimonial", "Fluxo de Caixa" */
  documentType: string;
  /** More specific subtype, e.g. "Contas a Receber – Vencidas e a Vencer" */
  documentSubtype: string;
  /** 0–1 confidence in document type */
  documentTypeConfidence: number;

  // ── Risk ────────────────────────────────────────────────────────────────────
  riskLevel: "alto" | "médio" | "baixo";
  /** 0–100 composite risk score */
  riskScore: number;

  // ── Narrative sections ──────────────────────────────────────────────────────
  /** 4–6 sentence executive summary with concrete numbers from the data */
  executiveSummary: string;
  /** Detailed financial/accounting health assessment — 3 or more paragraphs */
  financialHealthNarrative: string;
  /** Detailed aging analysis narrative (null if no date column detected) */
  agingDetailedAnalysis: string | null;
  /** Detailed counterparty concentration narrative (null if no name column detected) */
  concentrationDetailedAnalysis: string | null;

  // ── Structured data ─────────────────────────────────────────────────────────
  /** 8–12 key numeric metrics with trend and status */
  keyMetrics: InsightMetric[];
  /** 8–12 specific, number-backed findings */
  mainFindings: string[];
  /** 5–8 deeper analytical insights beyond the obvious */
  deepDiveInsights: string[];
  /** Top 3 urgent actions to take immediately */
  immediateActions: string[];
  /** 6–10 prioritized actionable recommendations with deadlines/owners when possible */
  recommendations: string[];

  // ── Alerts ──────────────────────────────────────────────────────────────────
  /** Structural data issues: missing dates, duplicates, format errors, etc. */
  structuralAlerts: string[];
  /** Fields expected for this document type that are absent */
  missingFields: string[];
  /** CPC / IFRS / CFC / LGPD compliance flags */
  regulatoryFlags: string[];

  // ── Quality ─────────────────────────────────────────────────────────────────
  dataQuality: DataQuality;
  dataQualityReason: string;

  // ── Transparency ────────────────────────────────────────────────────────────
  payloadInfo: InsightPayloadInfo;
}
