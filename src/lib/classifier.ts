/**
 * classifier.ts
 *
 * Intelligent financial-entry classification for Brazilian healthcare companies.
 *
 * ── AI mode (recommended) ────────────────────────────────────────────────────
 * Set ANTHROPIC_API_KEY in .env.local.  Calls the Anthropic Messages API and
 * returns per-row: category, confidence, justification, needsReview flag.
 *
 * Model: claude-haiku-4-5 by default (fast, cost-effective).
 * Override: set CLASSIFY_MODEL=claude-sonnet-4-6 for higher accuracy.
 *
 * ── Heuristic fallback ───────────────────────────────────────────────────────
 * Used automatically when ANTHROPIC_API_KEY is absent.
 * Keyword-based rules, zero cost, lower accuracy.
 */

import type {
  ColumnInfo,
  KeyColumns,
  ClassifiedEntry,
  ClassificationResult,
  CategorySummary,
  TaxonomyCategory,
} from "@/types/analysis";
import { TAXONOMY } from "@/types/analysis";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Model used for AI classification. Override via CLASSIFY_MODEL env var. */
const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL ?? "claude-haiku-4-5";
const BATCH_SIZE     = 50;    // entries per API request
const LOW_CONFIDENCE = 0.75;  // below this → needsReview = true

// ─── Column detection ─────────────────────────────────────────────────────────

const COL_HINTS: Record<keyof KeyColumns, string[]> = {
  description: ["descricao", "descr", "historico", "hist", "complemento",
                 "lancamento", "memo", "observacao", "obs", "detalhe", "item",
                 "servico", "produto", "operacao"],
  supplier:    ["fornecedor", "empresa", "razao", "beneficiario", "favorecido",
                 "sacado", "pagador", "credor", "prestador", "emitente"],
  value:       ["valor", "vl", "debito", "credito", "montante", "total",
                 "pago", "liquido", "bruto", "quantia"],
  dueDate:     ["data", "dt", "vencimento", "venc", "competencia",
                 "emissao", "pagamento", "referencia"],
};

function normalizeColName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function colScore(name: string, hints: string[]): number {
  const n = normalizeColName(name);
  return hints.reduce((acc, h) => acc + (n.includes(h) ? 1 : 0), 0);
}

export function detectKeyColumns(columns: ColumnInfo[]): KeyColumns {
  const pick = (hints: string[], type: "numeric" | "text" | null) => {
    const pool = type ? columns.filter((c) => c.type === type) : columns;
    if (pool.length === 0) return undefined;
    const best = pool
      .map((c) => ({ name: c.name, score: colScore(c.name, hints) }))
      .sort((a, b) => b.score - a.score)[0];
    return best.score > 0 ? best.name : pool[0]?.name;
  };

  return {
    description: pick(COL_HINTS.description, "text"),
    supplier:    pick(COL_HINTS.supplier, "text"),
    value:       pick(COL_HINTS.value, "numeric"),
    dueDate:     pick(COL_HINTS.dueDate, "text"),
  };
}

// ─── Text normalisation ───────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Heuristic rules ──────────────────────────────────────────────────────────

interface Rule {
  keywords: string[];
  category: TaxonomyCategory;
  confidence: number;
}

const RULES: Rule[] = [
  // ── Trabalhista
  {
    keywords: ["salario", "folha de pagamento", "folha pagamento",
               "pagamento de funcionario", "remuneracao", "pro labore"],
    category: "Trabalhista", confidence: 0.90,
  },
  {
    keywords: ["vale refeicao", "vale alimentacao", "vale transporte",
               "plano de saude", "plano saude", "odontologico",
               "beneficio funcionario", "auxilio", "seguro de vida"],
    category: "Trabalhista / Benefícios", confidence: 0.88,
  },
  {
    keywords: ["consignado", "emprestimo consignado", "emprestimo funcionario",
               "desconto em folha"],
    category: "Trabalhista / Empréstimo", confidence: 0.88,
  },

  // ── Impostos
  {
    keywords: ["irpj", "csll", "pis", "cofins", "iss", "icms", "iof",
               "fgts", "inss", "darf", "das", "simples nacional",
               "parcelamento fiscal", "receita federal", "tributo",
               "imposto de renda", "contribuicao social"],
    category: "Impostos", confidence: 0.95,
  },

  // ── Médico
  {
    keywords: ["honorario medico", "honorario cirurgiao", "plantao medico",
               "medico", "cirurgiao", "anestesista", "intensivista",
               "pediatra", "clinico geral", "ortopedista", "cardiologista",
               "neurologista", "onco", "radiologo", "dr ", "dra "],
    category: "Médico", confidence: 0.88,
  },

  // ── Fornecedor hospitalar
  {
    keywords: ["hospital", "clinica", "laboratorio", "farmacia", "drogaria",
               "medicamento", "material hospitalar", "opme", "ortese",
               "protese", "implante", "hemo", "imunobiologico",
               "material cirurgico", "kit cirurgico", "sonda", "cateter",
               "oxigenio", "kit descartavel", "luva", "mascara"],
    category: "Fornecedor hospitalar", confidence: 0.90,
  },

  // ── Infraestrutura / Manutenção
  {
    keywords: ["energia eletrica", "conta de luz", "conta luz",
               "copel", "cemig", "cpfl", "enel", "equatorial",
               "agua e esgoto", "saneamento", "sabesp", "caesb",
               "gas natural", "comgas", "aluguel", "locacao imovel",
               "condominio", "manutencao predial", "manutencao preventiva",
               "limpeza", "vigilancia", "portaria", "seguranca patrimonial",
               "dedetizacao", "jardinagem", "lavanderia"],
    category: "Infraestrutura / Manutenção", confidence: 0.85,
  },

  // ── Infraestrutura / Equipamentos
  {
    keywords: ["equipamento medico", "equipamento hospitalar", "aparelho",
               "eletromedico", "monitor multiparametro", "ventilador mecanico",
               "bisturi", "instrumental cirurgico", "leito hospitalar",
               "maca", "cadeira de rodas", "desfibrilador", "oximetro",
               "autoclave", "raio x", "ultrassom", "tomografo"],
    category: "Infraestrutura / Equipamentos", confidence: 0.85,
  },

  // ── Infraestrutura / Tecnologia
  {
    keywords: ["software", "licenca", "microsoft", "oracle", "totvs", "sap",
               "sistema de gestao", "cloud", "nuvem", "hospedagem",
               "dominio", "suporte tecnico", "ti ", "tecnologia da informacao",
               "servidor", "computador", "notebook", "impressora", "rede",
               "internet", "telefonia", "telecom"],
    category: "Infraestrutura / Tecnologia", confidence: 0.85,
  },

  // ── Prestador de serviço
  {
    keywords: ["prestacao de servico", "servicos profissionais",
               "consultoria", "assessoria", "auditoria", "contabilidade",
               "advocacia", "juridico", "terceirizado", "outsourcing",
               "agencia", "publicidade", "marketing", "treinamento",
               "capacitacao", "traducao"],
    category: "Prestador de serviço", confidence: 0.80,
  },

  // ── Financeiro
  {
    keywords: ["juros", "encargos financeiros", "financiamento",
               "emprestimo bancario", "amortizacao", "credito rotativo",
               "cheque especial", "tarifa bancaria", "tarifas bancarias",
               "iof operacao", "spread", "cdb", "lca", "lci"],
    category: "Financeiro", confidence: 0.85,
  },

  // ── Administrativo / Taxas
  {
    keywords: ["taxa", "anuidade", "cartorio", "registro de",
               "certidao", "emolumento", "alvara", "licenca prefeitura",
               "vigilancia sanitaria", "anvisa", "cnes", "crc", "cfm",
               "conselho regional", "conselho federal"],
    category: "Administrativo / Taxas", confidence: 0.83,
  },

  // ── Administrativo
  {
    keywords: ["material de escritorio", "papelaria", "refeicao",
               "almoco", "lanche", "coffee break", "passagem aerea",
               "hotel", "hospedagem administrativa", "locacao de veiculo",
               "combustivel", "estacionamento", "correios", "frete"],
    category: "Administrativo", confidence: 0.75,
  },

  // ── Fornecedor operacional (catch-all)
  {
    keywords: ["fornecedor", "compra de", "aquisicao de", "produto",
               "insumo", "materia prima", "mercadoria", "estoque"],
    category: "Fornecedor operacional", confidence: 0.60,
  },
];

// ─── Internal entry type ──────────────────────────────────────────────────────

interface EntryInput {
  rowIndex:   number;
  /** Joined description + supplier — used by the heuristic path */
  text:       string;
  /** Raw description field value */
  descricao:  string;
  /** Raw supplier / beneficiary field value */
  fornecedor: string;
  /** Monetary value when available */
  value:      number | null;
  /** Date string when available (due date, reference date, etc.) */
  data:       string;
}

// ─── Heuristic classifier ─────────────────────────────────────────────────────

function heuristicClassify(entries: EntryInput[]): ClassifiedEntry[] {
  return entries.map((e) => {
    const norm = normalize(e.text);

    let best: { category: TaxonomyCategory; confidence: number; kw: string } | null = null;

    for (const rule of RULES) {
      for (const kw of rule.keywords) {
        if (norm.includes(kw)) {
          if (!best || rule.confidence > best.confidence) {
            best = { category: rule.category, confidence: rule.confidence, kw };
          }
          break;
        }
      }
    }

    if (!best) {
      return {
        rowIndex:      e.rowIndex,
        text:          e.text,
        value:         e.value,
        category:      "Não classificado",
        confidence:    0,
        justification: "Nenhum padrão reconhecido no texto do lançamento.",
        needsReview:   true,
      };
    }

    return {
      rowIndex:      e.rowIndex,
      text:          e.text,
      value:         e.value,
      category:      best.category,
      confidence:    best.confidence,
      justification: `Palavra-chave identificada: "${best.kw}".`,
      needsReview:   best.confidence < LOW_CONFIDENCE,
    };
  });
}

// ─── AI classifier ────────────────────────────────────────────────────────────

/**
 * Detailed system prompt — describes every taxonomy category, decision rules,
 * and confidence calibration guidance so the model classifies consistently.
 */
const SYSTEM_PROMPT = `\
Você é um especialista em classificação de lançamentos financeiros de empresas \
de saúde brasileiras (hospitais, clínicas, laboratórios, operadoras de planos).

TAXONOMIA — use EXATAMENTE estes valores, sem variação de capitalização ou acento:
${TAXONOMY.map((t) => `• ${t}`).join("\n")}

DESCRIÇÃO DAS CATEGORIAS:
• Fornecedor hospitalar — insumos, materiais médico-hospitalares, medicamentos, \
OPME (órteses, próteses, implantes), kits cirúrgicos, descartáveis, oxigênio, \
hemoderivados, imunobiológicos. Fornecedor PJ que vende produtos ao hospital.
• Prestador de serviço — empresa ou autônomo PJ contratado para serviços não médicos: \
consultoria, auditoria, contabilidade, advocacia, marketing, TI terceirizado, \
limpeza terceirizada, segurança terceirizada, outsourcing de pessoal.
• Infraestrutura / Manutenção — contas de concessionárias (luz, água, gás), aluguel \
de imóvel, condomínio, manutenção predial, limpeza, vigilância patrimonial, lavanderia, \
jardinagem, dedetização. Tudo que mantém o prédio funcionando.
• Infraestrutura / Equipamentos — aquisição ou locação de equipamentos médicos \
(aparelhos, monitores, ventiladores, autoclaves, raio-x, ultrassom), mobiliário \
hospitalar (macas, leitos, cadeiras de rodas), instrumental cirúrgico.
• Infraestrutura / Tecnologia — software, licenças, assinaturas SaaS, sistemas de \
gestão (ERP, HIS, RIS), servidores, cloud, domínios, suporte de TI, telefonia, \
telecomunicações, internet, hardware de TI (computadores, impressoras, roteadores).
• Fornecedor operacional — fornecedores que não se enquadram em categorias mais \
específicas; compras diversas de produtos sem classificação clara.
• Médico — pagamentos diretos a médicos e profissionais de saúde: honorários, \
plantões, procedimentos. Inclui PF e PJ médica. Prefira esta categoria a \
"Prestador de serviço" quando o profissional for da área de saúde.
• Trabalhista — salários, décimo terceiro, férias, folha de pagamento, pro labore, \
FGTS pago ao trabalhador, rescisões. Relação empregatícia CLT ou sócio.
• Trabalhista / Benefícios — vale-alimentação, vale-refeição, vale-transporte, \
plano de saúde corporativo, seguro de vida, odontológico, auxílio creche.
• Trabalhista / Empréstimo — empréstimo consignado, adiantamento salarial, \
descontos em folha por empréstimos.
• Impostos — tributos federais, estaduais e municipais: INSS patronal, FGTS (recolhimento \
ao governo), IRPJ, CSLL, PIS, COFINS, ISS, ICMS, IOF, DAS/Simples Nacional, DARF, \
parcelamentos fiscais, Receita Federal.
• Administrativo — despesas de escritório e operacionais gerais: material de escritório, \
viagens corporativas, hospedagem, alimentação de equipe, combustível, estacionamento, \
frete, correios.
• Administrativo / Taxas — taxas e emolumentos a órgãos públicos: certidões, alvarás, \
registros em cartório, anuidades de conselhos (CRM, CRN, CRO, CREF), ANVISA, CNES, \
licenças municipais, vigilância sanitária.
• Financeiro — operações financeiras: juros bancários, IOF de operações, tarifas \
bancárias, amortizações de empréstimos, financiamentos, spread, aplicações financeiras.
• Não classificado — quando as informações disponíveis não são suficientes para \
classificar com confiança mínima. Use apenas como último recurso.

REGRAS DE DECISÃO:
1. Especificidade: prefira categorias específicas a genéricas. \
   Ex.: médico autônomo → "Médico" (não "Prestador de serviço").
2. Contexto de valor: valores muito altos (acima de R$ 50.000) em fornecedores \
   podem indicar equipamentos; valores baixos recorrentes sugerem insumos ou serviços.
3. "Trabalhista" é para relação CLT/sócio. Médicos e prestadores PJ autônomos \
   recebem em "Médico" ou "Prestador de serviço".
4. INSS e FGTS como tributos ao governo → "Impostos". \
   INSS e FGTS como benefício ao empregado dentro da folha → "Trabalhista".
5. confidence: 0.0 a 1.0 (1.0 = certeza absoluta; 0.5 = chute educado).
6. needsReview: true quando confidence < ${LOW_CONFIDENCE} ou quando o contexto \
   for genuinamente ambíguo mesmo com alta confiança.
7. justification: uma frase objetiva (máx. 15 palavras) explicando a escolha.
8. Responda SOMENTE com o JSON solicitado. Nenhum texto antes ou depois.`;

/**
 * Payload sent to the API for each entry.
 * Fields are omitted when empty to save tokens.
 */
interface AIEntryPayload {
  id:          number;
  descricao?:  string;
  fornecedor?: string;
  valor?:      number;
  data?:       string;
}

async function classifyWithAI(entries: EntryInput[]): Promise<ClassifiedEntry[]> {
  // Dynamic import — safe even if SDK isn't installed (though it should be)
  const AnthropicModule = await import("@anthropic-ai/sdk").catch(() => null);
  if (!AnthropicModule) {
    throw new Error(
      "Pacote @anthropic-ai/sdk não encontrado. Execute: npm install @anthropic-ai/sdk"
    );
  }
  const Anthropic = AnthropicModule.default;
  const client    = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env

  const responseSchema = {
    type: "object",
    properties: {
      classificacoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id:            { type: "integer" },
            categoria:     { type: "string", enum: TAXONOMY as unknown as string[] },
            confianca:     { type: "number" },
            justificativa: { type: "string" },
            revisar:       { type: "boolean" },
          },
          required: ["id", "categoria", "confianca", "justificativa", "revisar"],
          additionalProperties: false,
        },
      },
    },
    required: ["classificacoes"],
    additionalProperties: false,
  };

  const results: ClassifiedEntry[] = [];

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    // Build compact payload — omit empty fields to reduce tokens
    const payload: AIEntryPayload[] = batch.map((e) => {
      const item: AIEntryPayload = { id: e.rowIndex };
      if (e.descricao)            item.descricao  = e.descricao;
      if (e.fornecedor)           item.fornecedor = e.fornecedor;
      if (e.value !== null)       item.valor      = e.value;
      if (e.data)                 item.data       = e.data;
      return item;
    });

    const userMessage = `Classifique os ${batch.length} lançamentos abaixo:\n\n${JSON.stringify(payload, null, 2)}`;

    let response;
    try {
      response = await client.messages.create({
        model:      CLASSIFY_MODEL,
        max_tokens: 4096,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: userMessage }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output_config: { format: { type: "json_schema", schema: responseSchema } } as any,
      });
    } catch (err: unknown) {
      // Surface Anthropic API errors clearly in server logs
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[classifier] Anthropic API error (batch ${i}–${i + batch.length - 1}):`, msg);
      throw err;
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn(`[classifier] No text block in response for batch ${i}`);
      continue;
    }

    let parsed: { classificacoes: { id: number; categoria: TaxonomyCategory; confianca: number; justificativa: string; revisar: boolean }[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      console.warn(`[classifier] Failed to parse JSON for batch ${i}:`, textBlock.text.slice(0, 200));
      continue;
    }

    for (const c of parsed.classificacoes) {
      const entry = batch.find((e) => e.rowIndex === c.id);
      if (!entry) continue;

      const confidence = Math.min(1, Math.max(0, c.confianca));
      results.push({
        rowIndex:      c.id,
        text:          entry.text || `${entry.descricao} ${entry.fornecedor}`.trim(),
        value:         entry.value,
        category:      TAXONOMY.includes(c.categoria) ? c.categoria : "Não classificado",
        confidence,
        justification: c.justificativa,
        needsReview:   c.revisar || confidence < LOW_CONFIDENCE,
      });
    }
  }

  return results;
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(entries: ClassifiedEntry[]): CategorySummary[] {
  const map = new Map<TaxonomyCategory, CategorySummary>();
  for (const e of entries) {
    const existing = map.get(e.category) ?? { category: e.category, count: 0, totalValue: 0 };
    map.set(e.category, {
      ...existing,
      count:      existing.count + 1,
      totalValue: existing.totalValue + (e.value ?? 0),
    });
  }
  return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
}

// ─── Number parser ────────────────────────────────────────────────────────────

function parseNum(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify every data row from the uploaded spreadsheet.
 *
 * Routing:
 * - ANTHROPIC_API_KEY present → AI mode (Anthropic Messages API)
 * - ANTHROPIC_API_KEY absent  → heuristic mode (keyword rules, no network call)
 *
 * Returns null on unexpected errors so the caller degrades gracefully
 * (upload still succeeds; classification section will show "not available").
 */
export async function classifyEntries(
  rows: Record<string, unknown>[],
  columns: ColumnInfo[]
): Promise<ClassificationResult | null> {
  try {
    const keyColumns = detectKeyColumns(columns);

    const entries: EntryInput[] = rows.map((row, i) => {
      const descricao  = keyColumns.description ? String(row[keyColumns.description]  ?? "").trim() : "";
      const fornecedor = keyColumns.supplier    ? String(row[keyColumns.supplier]     ?? "").trim() : "";
      const data       = keyColumns.dueDate     ? String(row[keyColumns.dueDate]      ?? "").trim() : "";
      const text       = [descricao, fornecedor].filter(Boolean).join(" | ") || "(sem descrição)";
      const value      = keyColumns.value ? parseNum(row[keyColumns.value]) : null;
      return { rowIndex: i, text, descricao, fornecedor, value, data };
    });

    const useAI = !!process.env.ANTHROPIC_API_KEY;
    const classified = useAI
      ? await classifyWithAI(entries)
      : heuristicClassify(entries);

    // Guarantee every row has a result (AI batches may skip some on parse failure)
    const byIndex = new Map(classified.map((c) => [c.rowIndex, c]));
    const allClassified: ClassifiedEntry[] = entries.map((e) =>
      byIndex.get(e.rowIndex) ?? {
        rowIndex:      e.rowIndex,
        text:          e.text,
        value:         e.value,
        category:      "Não classificado",
        confidence:    0,
        justification: "Lançamento não processado durante a classificação.",
        needsReview:   true,
      }
    );

    return {
      method:           useAI ? "ai" : "heuristic",
      model:            useAI ? CLASSIFY_MODEL : undefined,
      keyColumns,
      entries:          allClassified,
      summary:          buildSummary(allClassified),
      needsReviewCount: allClassified.filter((c) => c.needsReview).length,
      classifiedAt:     new Date().toISOString(),
    };
  } catch (err) {
    console.error("[classifier] Erro inesperado:", err);
    return null;
  }
}
