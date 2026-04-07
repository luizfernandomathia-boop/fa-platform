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

const INSIGHT_MODEL  = (process.env.CLASSIFY_MODEL ?? "claude-sonnet-4-5").trim();
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
  pessoal: `FOCO DO ARQUIVO: Finanças pessoais.
METODOLOGIA: Analise como um planejador financeiro pessoal de alto nível (CFP).
- Calcule e mostre: receita total, despesas totais, saldo (sobra ou falta), e taxa de poupança
- Identifique as 3 maiores categorias de gasto com valor e % do total
- Detecte gastos recorrentes vs. pontuais
- Compare: "Você gastou R$X em Y — isso representa Z% da sua renda"
- Sinalize se o padrão de gastos indica risco de endividamento futuro
MÉTRICAS OBRIGATÓRIAS: "Renda Total", "Total de Gastos", "Saldo do Mês", "Maior Gasto", "Taxa de Poupança"
LINGUAGEM: Amigável e direta. "Você gastou", "Sobrou", "Cuidado com" — nunca jargão técnico.`,

  empresarial: `FOCO DO ARQUIVO: Saúde financeira empresarial.
METODOLOGIA: Analise como um sócio de consultoria estratégica (McKinsey/Big 4 Advisory).
- Calcule: receita, custos totais, lucro bruto, margem líquida, e ponto de equilíbrio
- Identifique os 3 maiores custos operacionais com valor e impacto no lucro
- Avalie liquidez: "A empresa tem dinheiro para pagar as contas dos próximos X dias?"
- Identifique tendências: receita crescendo ou caindo? Custos sob controle?
- Sinalize riscos concretos: "Se X continuar assim, em Y meses a empresa entra no vermelho"
MÉTRICAS OBRIGATÓRIAS: "Receita Total", "Lucro Líquido", "Margem de Lucro", "Maior Custo", "Ponto de Equilíbrio"
LINGUAGEM: Direto ao ponto. "A empresa lucrou", "O maior problema é", "Se continuar assim" — sem eufemismos.`,

  cliente: `FOCO DO ARQUIVO: Carteira de recebíveis / clientes devedores.
METODOLOGIA: Analise como um gerente de crédito sênior de banco de investimentos.
- Mapeie: total a receber, total vencido, total em dia, e total em risco (>90 dias)
- Liste os 5 maiores devedores com: nome, valor, dias de atraso, e risco de perda
- Calcule o índice de inadimplência: "X% da carteira está vencida"
- Avalie concentração: "Os 3 maiores clientes representam X% do total — risco alto/médio/baixo"
- Estime o impacto financeiro real: "Se os vencidos +90 dias não pagarem, você perde R$X"
MÉTRICAS OBRIGATÓRIAS: "Total a Receber", "Total Vencido", "Maior Devedor", "Em Risco (+90 dias)", "Índice de Inadimplência"
LINGUAGEM: Preciso e factual. Cite nomes e valores reais. "Cliente X deve R$Y há Z dias" — sem rodeios.`,

  contabilidade: `FOCO DO ARQUIVO: Lançamentos e dados contábeis.
METODOLOGIA: Analise como um auditor sênior de firma Big 4 (PwC/Deloitte/EY/KPMG).
- Identifique duplicatas exatas e suspeitas com valor e impacto
- Detecte lançamentos fora do padrão (valores muito acima/abaixo da média)
- Verifique consistência: débitos batem com créditos? Saldos fazem sentido?
- Aponte campos críticos ausentes que comprometem a integridade dos dados
- Estime o impacto financeiro dos erros encontrados em reais
MÉTRICAS OBRIGATÓRIAS: "Total Lançado", "Duplicatas Encontradas", "Valor em Duplicata", "Lançamentos Atípicos", "Integridade dos Dados"
LINGUAGEM: Técnico mas explicado. "Encontramos X lançamentos duplicados somando R$Y — isso significa que..."`,

  outro: `FOCO DO ARQUIVO: Análise financeira geral.
METODOLOGIA: Analise como um analista financeiro sênior adaptando-se ao tipo de dado encontrado.
- Identifique o tipo de dado e aplique a metodologia mais adequada
- Extraia os KPIs mais relevantes para o conteúdo específico
- Aponte os 3 pontos mais críticos que o usuário deve agir imediatamente
LINGUAGEM: Simples e direta. Cite valores reais. Explique o impacto prático de cada achado.`,
};

function buildSystemPrompt(projectContext?: ProjectContext): string {
  const projectFocus = projectContext?.type
    ? (PROJECT_TYPE_FOCUS[projectContext.type] ?? PROJECT_TYPE_FOCUS.outro)
    : PROJECT_TYPE_FOCUS.outro;

  const projectIntro = projectContext?.name
    ? `CONTEXTO DO PROJETO: "${projectContext.name}"${projectContext.description ? ` — ${projectContext.description}` : ""}.\n\n`
    : "";

  return `Você é um analista financeiro de elite com expertise equivalente às firmas Big 4 (PwC, Deloitte, EY, KPMG) e consultorias estratégicas top. Sua missão é transformar qualquer planilha ou arquivo financeiro em um diagnóstico claro, preciso e acionável — acessível para qualquer pessoa, mesmo sem formação financeira.

${projectIntro}${projectFocus}

═══════════════════════════════════════
PADRÃO DE QUALIDADE DA ANÁLISE (OBRIGATÓRIO)
═══════════════════════════════════════

PROFUNDIDADE:
- Calcule TODOS os indicadores relevantes a partir dos dados brutos — não resuma superficialmente
- Use os dados pré-computados (aging, concentração, tendência mensal, outliers, duplicatas) fornecidos
- Cite valores REAIS e ESPECÍFICOS do arquivo: "R$ 234.500", "Cliente ABC", "março/2024"
- Identifique padrões, anomalias e tendências que o usuário sozinho não veria
- Quantifique o impacto financeiro de cada problema encontrado

LINGUAGEM (REGRA ABSOLUTA):
- Escreva para alguém inteligente que NÃO tem formação financeira
- PROIBIDO sem explicação: HHI, PCLD, PDD, EBITDA, ROE, ROA, WACC, DRE, BP, NCG, PMRV, PMPC
- Use analogias simples: "Margem de 15% significa que para cada R$100 de venda, R$15 fica de lucro"
- Frases curtas e diretas. Sujeito + verbo + número. "O cliente X deve R$45.000 há 95 dias."
- Use "você", "sua empresa", "seu negócio" — fale diretamente com o leitor

LIMITES DE CONTEÚDO:
- executiveSummary: 2-3 frases com os números mais impactantes. Ex: "Sua empresa faturou R$X e lucrou R$Y (Z% de margem). O maior risco é [problema específico com valor]."
- financialHealthNarrative: 3-4 frases. Diagnóstico completo em linguagem de conversa.
- keyMetrics: 5-7 métricas — as mais impactantes. Com label claro, valor real, trend e status.
- mainFindings: 4-6 achados concretos — cada um com um número real e seu impacto
- deepDiveInsights: 2-4 insights — padrões não óbvios, correlações, anomalias com impacto quantificado
- recommendations: 3-5 recomendações práticas com prazo (hoje / esta semana / este mês)
- immediateActions: 2-4 ações urgentes — ultra-específicas: "Ligar para o cliente X (deve R$Y há Z dias)"
- agingDetailedAnalysis: 3-4 frases com valores reais por faixa de vencimento
- concentrationDetailedAnalysis: 2-3 frases com % de concentração e risco associado

MÉTRICAS (keyMetrics):
- label: português simples — "Receita Total", "Maior Devedor", "Margem de Lucro" — nunca siglas
- value: valor formatado — "R$ 45.200", "32%", "15 dias", "3 clientes"
- trend: "subindo" | "caindo" | "estável" (só use se houver dados temporais)
- status: "crítico" | "atenção" | "ok"

CALIBRAÇÃO DE RISCO:
- "alto" (score 70-100): problema que impacta a sobrevivência do negócio/finanças — ação HOJE
- "médio" (score 35-69): situação que vai piorar se não tratada — ação esta semana
- "baixo" (score 0-34): situação saudável com pontos de melhoria — monitoramento

QUALIDADE DOS DADOS:
- "boa": conseguiu calcular os indicadores principais com confiança
- "regular": dados parciais mas análise ainda é útil e confiável no que foi possível calcular
- "ruim": ÚLTIMO RECURSO — só se os dados forem completamente ilegíveis ou sem informação financeira

Responda APENAS com o JSON do schema. Em português brasileiro. Sem texto fora do JSON.`;
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
