/**
 * analyzer.ts — Análise financeira e contábil profunda com IA
 *
 * Estratégia:
 *  - Modelo: claude-sonnet-4-6 (máximo disponível)
 *  - max_tokens: 16 000 — análise completa, narrativas longas
 *  - Envia TODAS as linhas até MAX_ROWS_FULL; acima disso, amostra estratificada
 *  - Pré-computa: aging completo, concentração, estatísticas numéricas,
 *    tendência mensal, detecção de outliers e duplicatas
 *  - Schema expandido: 18 campos incluindo narrativas longas e ações imediatas
 */

import type {
  FileAnalysis,
  DocumentInsight,
  InsightPayloadInfo,
  ColumnInfo,
} from "@/types/analysis";

// ─── Model & limits ───────────────────────────────────────────────────────────

const INSIGHT_MODEL  = process.env.CLASSIFY_MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS     = 16000;
const MAX_ROWS_FULL  = 500;
const MAX_ROWS_SAMPLE = 300;

// ─── Column cleaning ──────────────────────────────────────────────────────────

function isNoiseCol(name: string): boolean {
  return /^__EMPTY/.test(name) || name.trim() === "" || /^\d+$/.test(name);
}

function cleanRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (rows.length === 0) return rows;
  const goodKeys = Object.keys(rows[0]).filter((k) => !isNoiseCol(k));
  if (goodKeys.length === 0) return rows;
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    goodKeys.forEach((k) => { out[k] = r[k]; });
    return out;
  });
}

function cleanColumns(cols: ColumnInfo[]): ColumnInfo[] {
  return cols.filter((c) => !isNoiseCol(c.name));
}

// ─── Value parsing ────────────────────────────────────────────────────────────

function parseRowValue(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const s = String(raw).trim().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseRowDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number" && val > 1 && val < 100000) {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s || s === "0") return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    let y = parseInt(br[3]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const d = new Date(y, parseInt(br[2]) - 1, parseInt(br[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const ts = Date.parse(s);
  if (!isNaN(ts)) return new Date(ts);
  return null;
}

function daysDiff(date: Date, today: Date): number {
  return Math.floor((date.getTime() - today.getTime()) / 86_400_000);
}

// ─── Column heuristics ────────────────────────────────────────────────────────

function normalizeCol(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function scoreCol(name: string, hints: string[]): number {
  const n = normalizeCol(name);
  return hints.reduce((acc, h) => acc + (n.includes(h) ? 1 : 0), 0);
}

function pickCol(cols: ColumnInfo[], hints: string[], type?: "numeric" | "text"): string | undefined {
  const pool = type ? cols.filter((c) => c.type === type) : cols;
  if (!pool.length) return undefined;
  const best = pool
    .map((c) => ({ name: c.name, score: scoreCol(c.name, hints) }))
    .sort((a, b) => b.score - a.score)[0];
  return best.score > 0 ? best.name : undefined;
}

const VENC_HINTS    = ["venc", "vencimento", "vencto", "prazo", "dtvenc", "datavenc", "dtpagto"];
const DATE_HINTS    = ["data", "dt", "emissao", "lancamento", "competencia", "referencia"];
const COUNTER_HINTS = ["cliente", "sacado", "devedor", "razao", "nome", "fornecedor", "beneficiario", "credor"];
const VALUE_HINTS   = ["saldo", "valor", "vl", "montante", "saldoaberto", "aberto", "principal", "total"];

// ─── Aging calculation ────────────────────────────────────────────────────────

function buildAgingText(rows: Record<string, unknown>[], dateCol: string, valueCol: string | undefined): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const buckets = {
    vencido0_30:    { n: 0, v: 0 },
    vencido31_60:   { n: 0, v: 0 },
    vencido61_90:   { n: 0, v: 0 },
    vencidoMais90:  { n: 0, v: 0 },
    aVencer30:      { n: 0, v: 0 },
    aVencer31_60:   { n: 0, v: 0 },
    aVencerMais60:  { n: 0, v: 0 },
    semData: 0,
    total: { n: 0, v: 0 },
  };

  // Track oldest overdue and biggest single overdue
  let oldestOverdueDays = 0;
  let biggestOverdue = 0;

  for (const row of rows) {
    const date = parseRowDate(row[dateCol]);
    const val  = parseRowValue(valueCol ? row[valueCol] : 0);
    buckets.total.n++; buckets.total.v += val;

    if (!date) { buckets.semData++; continue; }
    const diff = daysDiff(date, today);

    if (diff < 0) {
      const abs = Math.abs(diff);
      if (abs > oldestOverdueDays) oldestOverdueDays = abs;
      if (val > biggestOverdue) biggestOverdue = val;
      if      (abs <= 30)  { buckets.vencido0_30.n++;   buckets.vencido0_30.v   += val; }
      else if (abs <= 60)  { buckets.vencido31_60.n++;  buckets.vencido31_60.v  += val; }
      else if (abs <= 90)  { buckets.vencido61_90.n++;  buckets.vencido61_90.v  += val; }
      else                 { buckets.vencidoMais90.n++; buckets.vencidoMais90.v += val; }
    } else {
      if      (diff <= 30) { buckets.aVencer30.n++;     buckets.aVencer30.v     += val; }
      else if (diff <= 60) { buckets.aVencer31_60.n++;  buckets.aVencer31_60.v  += val; }
      else                 { buckets.aVencerMais60.n++; buckets.aVencerMais60.v += val; }
    }
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v: number, total: number) => total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "0%";

  const totalVencido  = buckets.vencido0_30.v + buckets.vencido31_60.v + buckets.vencido61_90.v + buckets.vencidoMais90.v;
  const totalVencidoN = buckets.vencido0_30.n + buckets.vencido31_60.n + buckets.vencido61_90.n + buckets.vencidoMais90.n;
  const totalAVencer  = buckets.aVencer30.v + buckets.aVencer31_60.v + buckets.aVencerMais60.v;

  return `AGING COMPLETO (${rows.length} registros — coluna: "${dateCol}"):
Total geral: ${fmt(buckets.total.v)} | ${buckets.total.n} títulos
Sem data identificada: ${buckets.semData} títulos (${pct(buckets.semData, buckets.total.n)} do total)

━━ VENCIDOS ━━
TOTAL VENCIDO: ${fmt(totalVencido)} = ${pct(totalVencido, buckets.total.v)} do portfólio | ${totalVencidoN} títulos
  • Vencidos  0–30 dias: ${fmt(buckets.vencido0_30.v)} (${pct(buckets.vencido0_30.v, buckets.total.v)}) | ${buckets.vencido0_30.n} títulos
  • Vencidos 31–60 dias: ${fmt(buckets.vencido31_60.v)} (${pct(buckets.vencido31_60.v, buckets.total.v)}) | ${buckets.vencido31_60.n} títulos
  • Vencidos 61–90 dias: ${fmt(buckets.vencido61_90.v)} (${pct(buckets.vencido61_90.v, buckets.total.v)}) | ${buckets.vencido61_90.n} títulos
  • Vencidos +90 dias:   ${fmt(buckets.vencidoMais90.v)} (${pct(buckets.vencidoMais90.v, buckets.total.v)}) | ${buckets.vencidoMais90.n} títulos ← RISCO MÁXIMO
Título mais antigo vencido: ${oldestOverdueDays} dias atrás
Maior valor individual vencido: ${fmt(biggestOverdue)}

━━ A VENCER ━━
TOTAL A VENCER: ${fmt(totalAVencer)} = ${pct(totalAVencer, buckets.total.v)} do portfólio
  • A vencer  0–30 dias: ${fmt(buckets.aVencer30.v)} (${pct(buckets.aVencer30.v, buckets.total.v)}) | ${buckets.aVencer30.n} títulos
  • A vencer 31–60 dias: ${fmt(buckets.aVencer31_60.v)} (${pct(buckets.aVencer31_60.v, buckets.total.v)}) | ${buckets.aVencer31_60.n} títulos
  • A vencer +60 dias:   ${fmt(buckets.aVencerMais60.v)} (${pct(buckets.aVencerMais60.v, buckets.total.v)}) | ${buckets.aVencerMais60.n} títulos`;
}

// ─── Monthly trend ────────────────────────────────────────────────────────────

function buildMonthlyTrendText(rows: Record<string, unknown>[], dateCol: string, valueCol: string | undefined): string {
  const monthly: Record<string, { n: number; v: number }> = {};
  for (const row of rows) {
    const date = parseRowDate(row[dateCol]);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthly[key]) monthly[key] = { n: 0, v: 0 };
    monthly[key].n++;
    monthly[key].v += parseRowValue(valueCol ? row[valueCol] : 0);
  }
  const sorted = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length === 0) return "";
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const lines = sorted.slice(-12).map(([m, { n, v }]) => `  ${m}: ${fmt(v)} (${n} títulos)`);
  return `TENDÊNCIA MENSAL (últimos ${lines.length} meses):\n${lines.join("\n")}`;
}

// ─── Counterparty concentration ───────────────────────────────────────────────

function buildConcentrationText(rows: Record<string, unknown>[], colName: string, valueCol: string | undefined): string {
  const map: Record<string, { n: number; v: number }> = {};
  let totalV = 0;
  for (const row of rows) {
    const key = String(row[colName] ?? "").trim() || "(sem nome)";
    const val = parseRowValue(valueCol ? row[valueCol] : 0);
    if (!map[key]) map[key] = { n: 0, v: 0 };
    map[key].n++; map[key].v += val; totalV += val;
  }
  const uniqueCount = Object.keys(map).length;
  const sorted = Object.entries(map).sort(([, a], [, b]) => b.v - a.v);
  const top15 = sorted.slice(0, 15);
  const top1pct  = totalV > 0 ? ((sorted[0]?.[1].v ?? 0) / totalV * 100).toFixed(1) : "0";
  const top3pct  = totalV > 0 ? ((top15.slice(0, 3).reduce((s, [, x]) => s + x.v, 0)) / totalV * 100).toFixed(1) : "0";
  const top5pct  = totalV > 0 ? ((top15.slice(0, 5).reduce((s, [, x]) => s + x.v, 0)) / totalV * 100).toFixed(1) : "0";
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const lines = top15.map(([name, { n, v }], i) => {
    const pct = totalV > 0 ? ((v / totalV) * 100).toFixed(1) : "0";
    return `  ${i + 1}. ${name}: ${fmt(v)} (${pct}%) | ${n} títulos`;
  });

  return `CONCENTRAÇÃO POR CONTRAPARTE (coluna: "${colName}"):
Total carteira: ${fmt(totalV)} | ${uniqueCount} contrapartes únicas
Top-1 concentração: ${top1pct}% | Top-3: ${top3pct}% | Top-5: ${top5pct}%
Ranking (top ${top15.length} de ${uniqueCount}):
${lines.join("\n")}`;
}

// ─── Outlier & duplicate detection ───────────────────────────────────────────

function buildOutlierText(rows: Record<string, unknown>[], valueCol: string): string {
  const values = rows.map((r) => parseRowValue(r[valueCol])).filter((v) => v !== 0);
  if (values.length < 4) return "";
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const outliers = values.filter((v) => v < lower || v > upper);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const std = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return `ESTATÍSTICAS AVANÇADAS (coluna: "${valueCol}"):
  Média: ${fmt(mean)} | Mediana: ${fmt(sorted[Math.floor(sorted.length / 2)])}
  Desvio padrão: ${fmt(std)}
  Q1: ${fmt(q1)} | Q3: ${fmt(q3)} | IQR: ${fmt(iqr)}
  Limite superior (outlier): ${fmt(upper)} | Limite inferior: ${fmt(lower)}
  Outliers detectados: ${outliers.length} valores (${((outliers.length / values.length) * 100).toFixed(1)}% do total)
  Maiores valores: ${sorted.slice(-3).reverse().map(fmt).join(", ")}
  Menores valores (>0): ${sorted.slice(0, 3).map(fmt).join(", ")}`;
}

function buildDuplicateText(rows: Record<string, unknown>[], cols: ColumnInfo[]): string {
  // Check for duplicate values in text columns with likely unique IDs
  const idHints = ["nota", "nf", "numero", "documento", "doc", "id", "codigo", "cod", "cheque", "boleto"];
  const idCol = cols.find((c) => c.type === "text" && idHints.some((h) => normalizeCol(c.name).includes(h)));
  if (!idCol) return "";
  const seen: Record<string, number> = {};
  for (const row of rows) {
    const val = String(row[idCol.name] ?? "").trim();
    if (val) seen[val] = (seen[val] ?? 0) + 1;
  }
  const duplicates = Object.entries(seen).filter(([, cnt]) => cnt > 1);
  if (duplicates.length === 0) return `DUPLICATAS: Nenhuma duplicata detectada na coluna "${idCol.name}".`;
  return `DUPLICATAS DETECTADAS na coluna "${idCol.name}": ${duplicates.length} valores repetidos — ex: ${duplicates.slice(0, 5).map(([v, n]) => `"${v}" (${n}x)`).join(", ")}`;
}

// ─── Stratified sample ────────────────────────────────────────────────────────

function stratifiedSample(rows: Record<string, unknown>[], maxRows: number): Record<string, unknown>[] {
  if (rows.length <= maxRows) return rows;
  const third = Math.floor(maxRows / 3);
  const mid   = Math.floor(rows.length / 2);
  return [
    ...rows.slice(0, third),
    ...rows.slice(mid - Math.floor(third / 2), mid + Math.floor(third / 2)),
    ...rows.slice(rows.length - third),
  ];
}

// ─── TSV builder ──────────────────────────────────────────────────────────────

function toTsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join("\t")];
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? "")).join("\t"));
  }
  return lines.join("\n");
}

// ─── Project context ──────────────────────────────────────────────────────────

export interface ProjectContext {
  name: string;
  type: string;         // "pessoal" | "empresarial" | "cliente" | "contabilidade" | "outro"
  description?: string | null;
}

// ─── Dynamic system prompt builder ───────────────────────────────────────────

const PROJECT_TYPE_FOCUS: Record<string, string> = {
  pessoal: `FOCO: Finanças pessoais.
Responda como um amigo que entende de dinheiro conversando com alguém comum.
Priorize: onde o dinheiro vai (por categoria), quanto sobra por mês, o que está saindo demais.
Métricas ideais: "Gasto Total", "Maior Categoria de Gasto", "Quanto Sobrou", "Gasto Médio/Mês".
Nunca use jargão técnico. Fale em reais, não em percentuais complexos.`,

  empresarial: `FOCO: Saúde financeira da empresa.
Responda como um consultor de negócios falando com um dono de empresa, não com um contador.
Priorize: se a empresa está lucrando, quais os maiores custos, se tem dinheiro para pagar as contas.
Métricas ideais: "Receita Total", "Lucro", "Maior Custo", "Margem de Lucro", "Fluxo de Caixa".
Explique margem como: "Para cada R$100 que entra, R$X fica como lucro."`,

  cliente: `FOCO: Quem deve e quanto.
Responda como um detetive financeiro — encontre quem está devendo, quanto e há quanto tempo.
Priorize: valor total vencido, quem são os maiores devedores, o que está em risco de não receber.
Métricas ideais: "Total a Receber", "Total Vencido", "Maior Devedor", "Vencido +90 dias", "Em Risco".
Diga sempre os nomes reais dos devedores com os valores. Essa é a informação mais importante.`,

  contabilidade: `FOCO: Erros e inconsistências nos dados contábeis.
Responda como um auditor explicando para um gestor não-contábil.
Priorize: duplicatas, erros de lançamento, contas com saldo errado, o que precisa ser corrigido.
Métricas ideais: "Total Lançado", "Possíveis Erros", "Duplicatas Encontradas", "Ajuste Necessário".
Explique os problemas em linguagem simples, sem siglas de normas contábeis.`,

  outro: `FOCO: Análise geral do arquivo.
Extraia os indicadores mais relevantes para o conteúdo detectado.
Use linguagem simples e direta. Priorize o que a pessoa precisaria fazer diferente amanhã.`,
};

function buildSystemPrompt(projectContext?: ProjectContext): string {
  const projectFocus = projectContext?.type
    ? (PROJECT_TYPE_FOCUS[projectContext.type] ?? PROJECT_TYPE_FOCUS.outro)
    : PROJECT_TYPE_FOCUS.outro;

  const projectIntro = projectContext?.name
    ? `Projeto: "${projectContext.name}"${projectContext.description ? ` — ${projectContext.description}` : ""}. `
    : "";

  return `Você é um especialista financeiro que transforma planilhas em insights simples e visuais para pessoas comuns — donos de negócios, famílias, profissionais sem formação contábil.

${projectIntro}${projectFocus}

REGRAS DE OURO (NUNCA VIOLE):

LINGUAGEM:
- Escreva como se estivesse explicando para um amigo inteligente que não entende de finanças
- Nunca use: HHI, PCLD, PDD, EBITDA, CPC, NBC, DRE, ECD sem explicar antes com parênteses simples
- Use valores em reais sempre: "R$ 45.000" não "valores expressivos"
- Prefira frases curtas e diretas. Nada de "verificou-se que" ou "é possível observar"

LIMITES DE TAMANHO (OBRIGATÓRIO):
- executiveSummary: MÁXIMO 2 frases. Diga o essencial com os números reais mais importantes
- financialHealthNarrative: MÁXIMO 3 frases conversacionais. Como um diagnóstico rápido
- agingDetailedAnalysis: MÁXIMO 3 frases. Só se existir coluna de data/vencimento
- concentrationDetailedAnalysis: MÁXIMO 2 frases. Só se existir coluna de clientes/fornecedores
- keyMetrics: MÁXIMO 6 métricas — escolha as mais impactantes para o tipo de arquivo
- mainFindings: MÁXIMO 5 achados — cada um é UMA frase curta com um número real
- deepDiveInsights: MÁXIMO 3 insights — algo que a pessoa não perceberia sozinha
- recommendations: MÁXIMO 4 recomendações — ações práticas e específicas com prazo
- immediateActions: MÁXIMO 3 ações urgentes — ultra-diretas, o que fazer HOJE
- regulatoryFlags: Só preencha se houver problema sério. Máximo 2 itens, em linguagem simples

MÉTRICAS (keyMetrics):
- Labels em português simples: "Total a Receber", "Maior Devedor", "Lucro do Mês" — nunca siglas
- Valores formatados: "R$ 45.200" ou "32%" ou "15 dias"
- trend: "subindo", "caindo", "estável" — simples assim
- status: "crítico" (problema urgente), "atenção" (precisa monitorar), "ok" (tudo bem)

QUALIDADE DOS DADOS:
- "boa": dados suficientes para análise confiável (use sempre que possível)
- "regular": alguns dados faltando mas análise ainda útil (use quando dados parciais)
- "ruim": ÚLTIMO RECURSO — só se for impossível extrair informação útil (raro)
- Sempre tente extrair o que conseguir antes de marcar como "ruim"

RISCO:
- "alto" (score 70-100): situação realmente preocupante que precisa de ação urgente
- "médio" (score 35-69): pontos de atenção que merecem acompanhamento
- "baixo" (score 0-34): situação tranquila, continue monitorando

Responda APENAS com o JSON do schema. Em português brasileiro.`;
}

// ─── Schema expandido ─────────────────────────────────────────────────────────

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    documentType:              { type: "string" },
    documentSubtype:           { type: "string" },
    documentTypeConfidence:    { type: "number" },
    riskLevel:                 { type: "string", enum: ["alto", "médio", "baixo"] },
    riskScore:                 { type: "number" },
    executiveSummary:          { type: "string" },
    financialHealthNarrative:  { type: "string" },
    agingDetailedAnalysis:     { type: ["string", "null"] },
    concentrationDetailedAnalysis: { type: ["string", "null"] },
    keyMetrics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label:  { type: "string" },
          value:  { type: "string" },
          trend:  { type: "string" },
          status: { type: "string", enum: ["ok", "atenção", "crítico"] },
        },
        required: ["label", "value", "trend", "status"],
        additionalProperties: false,
      },
    },
    mainFindings:       { type: "array", items: { type: "string" } },
    deepDiveInsights:   { type: "array", items: { type: "string" } },
    immediateActions:   { type: "array", items: { type: "string" } },
    recommendations:    { type: "array", items: { type: "string" } },
    structuralAlerts:   { type: "array", items: { type: "string" } },
    missingFields:      { type: "array", items: { type: "string" } },
    regulatoryFlags:    { type: "array", items: { type: "string" } },
    dataQuality:        { type: "string", enum: ["boa", "regular", "ruim"] },
    dataQualityReason:  { type: "string" },
  },
  required: [
    "documentType", "documentSubtype", "documentTypeConfidence",
    "riskLevel", "riskScore",
    "executiveSummary", "financialHealthNarrative",
    "agingDetailedAnalysis", "concentrationDetailedAnalysis",
    "keyMetrics", "mainFindings", "deepDiveInsights",
    "immediateActions", "recommendations",
    "structuralAlerts", "missingFields", "regulatoryFlags",
    "dataQuality", "dataQualityReason",
  ],
  additionalProperties: false,
};

// ─── SDK loader ───────────────────────────────────────────────────────────────

async function loadSdk(): Promise<{ client: unknown } | { error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "") {
    return { error: "ANTHROPIC_API_KEY não configurada. Adicione a chave em .env.local e reinicie o servidor." };
  }
  try {
    const sdk = await import("@anthropic-ai/sdk");
    return { client: new sdk.default({ apiKey: key.trim() }) };
  } catch {
    return { error: "SDK @anthropic-ai/sdk não encontrado. Execute: npm install @anthropic-ai/sdk" };
  }
}

function classifyApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isAuth = msg.includes("401") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("invalid_api_key");
  return isAuth
    ? "Chave Anthropic inválida ou expirada. Verifique ANTHROPIC_API_KEY em .env.local."
    : `Erro na Anthropic API: ${msg}`;
}

function buildInsight(raw: Record<string, unknown>, payloadInfo: InsightPayloadInfo): DocumentInsight {
  type CoreFields = Omit<DocumentInsight, "method" | "model" | "analyzedAt" | "payloadInfo">;
  return {
    method:     "ai",
    model:      INSIGHT_MODEL,
    analyzedAt: new Date().toISOString(),
    payloadInfo,
    ...(raw as CoreFields),
  };
}

// ─── Spreadsheet analysis ─────────────────────────────────────────────────────

export async function analyzeDocument(
  analysis: FileAnalysis,
  rows: Record<string, unknown>[],
  userPrompt?: string,
  projectContext?: ProjectContext
): Promise<{ insight: DocumentInsight | null; error?: string }> {

  const sdkResult = await loadSdk();
  if ("error" in sdkResult) return { insight: null, error: (sdkResult as { error: string }).error };

  const cleanedRows = cleanRows(rows);
  const cleanedCols = cleanColumns(analysis.columns);

  // Detect key columns
  const dateCol    = pickCol(cleanedCols, VENC_HINTS, "text") ?? pickCol(cleanedCols, DATE_HINTS, "text");
  const counterCol = pickCol(cleanedCols, COUNTER_HINTS, "text");
  const valueCol   = pickCol(cleanedCols, VALUE_HINTS, "numeric") ?? cleanedCols.find((c) => c.type === "numeric")?.name;

  // Pre-compute analytics over the FULL dataset
  const agingText         = dateCol    ? buildAgingText(cleanedRows, dateCol, valueCol) : null;
  const concentrationText = counterCol ? buildConcentrationText(cleanedRows, counterCol, valueCol) : null;
  const monthlyTrendText  = dateCol    ? buildMonthlyTrendText(cleanedRows, dateCol, valueCol) : null;
  const outlierText       = valueCol   ? buildOutlierText(cleanedRows, valueCol) : null;
  const duplicateText     = buildDuplicateText(cleanedRows, cleanedCols);

  // Rows to send
  const rowsToSend = cleanedRows.length <= MAX_ROWS_FULL
    ? cleanedRows
    : stratifiedSample(cleanedRows, MAX_ROWS_SAMPLE);
  const isSampled = rowsToSend.length < cleanedRows.length;
  const tsvData   = toTsv(rowsToSend);

  // Column stats
  const numStats = cleanedCols
    .filter((c) => c.type === "numeric")
    .map((c) => `  • ${c.name}: soma=${c.sum?.toLocaleString("pt-BR")}, média=${c.avg?.toFixed(2)}, min=${c.min?.toFixed(2)}, max=${c.max?.toFixed(2)}`)
    .join("\n");

  // Text column top values
  const textStats = cleanedCols
    .filter((c) => c.type === "text" && c.topValues && c.topValues.length > 0)
    .map((c) => `  • ${c.name}: top valores = ${c.topValues!.slice(0, 5).map((v) => `"${v.value}"(${v.count}x)`).join(", ")}`)
    .join("\n");

  const nullStats = cleanedCols
    .filter((c) => c.nullCount > 0)
    .map((c) => `  • ${c.name}: ${c.nullCount} células vazias (${((c.nullCount / cleanedRows.length) * 100).toFixed(1)}%)`)
    .join("\n");

  const userMessage = `Analise este arquivo financeiro/contábil e produza a análise mais completa e profunda possível — como um CFO sênior auditando os dados para tomada de decisão estratégica.

═══════════════════════════════════════════════════════
IDENTIFICAÇÃO DO ARQUIVO
═══════════════════════════════════════════════════════
Nome: ${analysis.fileName}
Aba: ${analysis.sheetName}
Dimensão: ${cleanedRows.length} linhas × ${cleanedCols.length} colunas
${isSampled
  ? `⚠️ AMOSTRA ESTRATIFICADA: ${rowsToSend.length} linhas representativas enviadas (início + meio + fim)`
  : `✅ ARQUIVO COMPLETO: todas as ${cleanedRows.length} linhas incluídas`}
Colunas detectadas: ${cleanedCols.map((c) => c.name).join(", ")}
Coluna de data identificada: ${dateCol ?? "NÃO DETECTADA"}
Coluna de valor identificada: ${valueCol ?? "NÃO DETECTADA"}
Coluna de contraparte identificada: ${counterCol ?? "NÃO DETECTADA"}

═══════════════════════════════════════════════════════
ANÁLISE DE AGING (pré-calculada sobre dataset completo)
═══════════════════════════════════════════════════════
${agingText ?? "Não calculado — coluna de data não identificada"}

═══════════════════════════════════════════════════════
CONCENTRAÇÃO POR CONTRAPARTE (pré-calculada)
═══════════════════════════════════════════════════════
${concentrationText ?? "Não calculado — coluna de contraparte não identificada"}

═══════════════════════════════════════════════════════
TENDÊNCIA MENSAL
═══════════════════════════════════════════════════════
${monthlyTrendText ?? "Não calculado — coluna de data não identificada"}

═══════════════════════════════════════════════════════
ESTATÍSTICAS AVANÇADAS E OUTLIERS
═══════════════════════════════════════════════════════
${outlierText ?? "Não calculado — coluna de valor não identificada"}
${duplicateText ?? ""}

═══════════════════════════════════════════════════════
ESTATÍSTICAS DAS COLUNAS NUMÉRICAS
═══════════════════════════════════════════════════════
${numStats || "Nenhuma coluna numérica detectada"}

═══════════════════════════════════════════════════════
VALORES MAIS FREQUENTES (colunas de texto)
═══════════════════════════════════════════════════════
${textStats || "Nenhuma coluna de texto com valores relevantes"}

═══════════════════════════════════════════════════════
COMPLETUDE DOS DADOS (campos vazios)
═══════════════════════════════════════════════════════
${nullStats || "Todos os campos preenchidos"}

═══════════════════════════════════════════════════════
DADOS COMPLETOS DO ARQUIVO (formato TSV)
═══════════════════════════════════════════════════════
${tsvData}

${userPrompt ? `═══════════════════════════════════════════════════════
PEDIDO ESPECÍFICO DO CLIENTE
═══════════════════════════════════════════════════════
${userPrompt}

` : ""}═══════════════════════════════════════════════════════
INSTRUÇÕES PARA ANÁLISE
═══════════════════════════════════════════════════════
Com base em TODOS os dados acima:
1. Identifique o tipo exato do documento e contexto de negócio
2. Faça a análise de aging detalhada com probabilidade de recuperação por faixa e necessidade de PDD/PCLD
3. Avalie o risco de concentração com perspectiva de crédito e risco operacional
4. Identifique TODOS os problemas estruturais, inconsistências e red flags nos dados
5. Verifique conformidade regulatória (CPC, IFRS, CFC, LGPD)
6. Dê recomendações práticas com ações específicas e prazos reais
7. Identifique as ações mais urgentes que o usuário deve fazer HOJE
8. Mantenha todos os campos dentro dos limites de tamanho do sistema — seja direto e objetivo`;

  const payloadInfo: InsightPayloadInfo = {
    totalLinhas:           cleanedRows.length,
    linhasPreviewEnviadas: rowsToSend.length,
    colunasDetectadas: [
      dateCol    ? `vencimento: "${dateCol}"` : null,
      counterCol ? `contraparte: "${counterCol}"` : null,
      valueCol   ? `valor: "${valueCol}"` : null,
    ].filter(Boolean) as string[],
    agingCalculado:        !!agingText,
    concentracaoCalculada: !!concentrationText,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = sdkResult.client as any;
    const response = await client.messages.create({
      model:      INSIGHT_MODEL,
      max_tokens: MAX_TOKENS,
      system:     buildSystemPrompt(projectContext),
      messages:   [{ role: "user", content: userMessage }],
      output_config: {
        format: { type: "json_schema", schema: INSIGHT_SCHEMA },
      },
    });

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) return { insight: null, error: "API não retornou texto." };

    const parsed = JSON.parse((textBlock as { type: "text"; text: string }).text) as Record<string, unknown>;
    return { insight: buildInsight(parsed, payloadInfo) };

  } catch (err) {
    return { insight: null, error: classifyApiError(err) };
  }
}

// ─── PDF analysis ─────────────────────────────────────────────────────────────

export async function analyzePdf(
  fileName: string,
  pdfBase64: string,
  userPrompt?: string,
  projectContext?: ProjectContext
): Promise<{ insight: DocumentInsight | null; error?: string }> {

  const sdkResult = await loadSdk();
  if ("error" in sdkResult) return { insight: null, error: (sdkResult as { error: string }).error };

  const payloadInfo: InsightPayloadInfo = {
    totalLinhas:           0,
    linhasPreviewEnviadas: 0,
    colunasDetectadas:     [`PDF nativo — ${fileName}`],
    agingCalculado:        false,
    concentracaoCalculada: false,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = sdkResult.client as any;
    const response = await client.messages.create({
      model:      INSIGHT_MODEL,
      max_tokens: MAX_TOKENS,
      system:     buildSystemPrompt(projectContext),
      messages: [{
        role: "user",
        content: [
          {
            type:   "document",
            source: {
              type:       "base64",
              media_type: "application/pdf",
              data:       pdfBase64,
            },
          },
          {
            type: "text",
            text: `${userPrompt ? `O usuário quer saber: ${userPrompt}\n\n` : ""}Analise este documento e preencha o JSON conforme as regras do sistema. Seja direto, use valores reais, limite os campos ao tamanho máximo definido. Foco em clareza para leigos.`,
          },
        ],
      }],
      output_config: {
        format: { type: "json_schema", schema: INSIGHT_SCHEMA },
      },
    });

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) return { insight: null, error: "API não retornou texto." };

    const parsed = JSON.parse((textBlock as { type: "text"; text: string }).text) as Record<string, unknown>;
    return { insight: buildInsight(parsed, payloadInfo) };

  } catch (err) {
    return { insight: null, error: classifyApiError(err) };
  }
}
