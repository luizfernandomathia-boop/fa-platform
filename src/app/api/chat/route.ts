/**
 * POST /api/chat
 *
 * Stateless chat endpoint. On every request it receives:
 *   • message   — the user's latest question
 *   • analysis  — the full FileAnalysis object (used as context)
 *   • history   — prior turns (accumulated client-side)
 *
 * The server builds a rich system prompt from the analysis and calls the
 * Anthropic API. No conversation state is stored server-side.
 */

import type { FileAnalysis } from "@/types/analysis";

const CHAT_MODEL  = process.env.CLASSIFY_MODEL ?? "claude-sonnet-4-5";
const MAX_TOKENS  = 1024;
const MAX_HISTORY = 20; // trim to avoid ballooning context on long conversations

// ─── Context builder ──────────────────────────────────────────────────────────

function buildAnalysisContext(analysis: FileAnalysis): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════");
  lines.push(`ARQUIVO ANALISADO: ${analysis.fileName}`);
  lines.push(
    `Aba: ${analysis.sheetName}  |  ` +
    `${analysis.rowCount.toLocaleString("pt-BR")} linhas  |  ` +
    `${analysis.columnCount} colunas`
  );
  lines.push(
    `Processado em: ${new Date(analysis.uploadedAt).toLocaleString("pt-BR")}`
  );

  // ── AI insight (the richest source of context) ────────────────────────────
  if (analysis.insight) {
    const ins = analysis.insight;
    lines.push("");
    lines.push(`TIPO DO DOCUMENTO: ${ins.documentType}`);
    lines.push(`CONFIANÇA NA IDENTIFICAÇÃO: ${Math.round(ins.documentTypeConfidence * 100)}%`);
    lines.push(`NÍVEL DE RISCO: ${ins.riskLevel.toUpperCase()}`);

    lines.push("\nRESUMO EXECUTIVO:");
    lines.push(ins.executiveSummary);

    if (ins.keyMetrics?.length > 0) {
      lines.push("\nMÉTRICAS-CHAVE (dados pré-computados do arquivo completo):");
      ins.keyMetrics.forEach((m) => lines.push(`  • ${m.label}: ${m.value}`));
    }

    if (ins.mainFindings?.length > 0) {
      lines.push("\nPRINCIPAIS ACHADOS:");
      ins.mainFindings.forEach((f) => lines.push(`  • ${f}`));
    }

    if (ins.structuralAlerts?.length > 0) {
      lines.push("\nALERTAS ESTRUTURAIS:");
      ins.structuralAlerts.forEach((a) => lines.push(`  • ${a}`));
    }

    if (ins.missingFields?.length > 0) {
      lines.push("\nCAMPOS AUSENTES ESPERADOS PARA ESTE TIPO DE DOCUMENTO:");
      ins.missingFields.forEach((f) => lines.push(`  • ${f}`));
    }

    if (ins.recommendations?.length > 0) {
      lines.push("\nRECOMENDAÇÕES JÁ IDENTIFICADAS PELA ANÁLISE:");
      ins.recommendations.forEach((r) => lines.push(`  • ${r}`));
    }

    lines.push(`\nQUALIDADE DOS DADOS: ${ins.dataQuality}`);
    lines.push(ins.dataQualityReason);

    if (ins.payloadInfo) {
      const pi = ins.payloadInfo;
      lines.push(`\nSCOPE DA ANÁLISE: ${pi.linhasPreviewEnviadas} linhas no preview enviado, aging e concentração calculados sobre todas as ${pi.totalLinhas} linhas.`);
      if (pi.colunasDetectadas.length > 0) {
        lines.push(`Colunas-chave detectadas: ${pi.colunasDetectadas.join(", ")}`);
      }
    }
  } else if (analysis.insightError) {
    lines.push("\n⚠ A análise automática falhou — responda com base nos metadados disponíveis abaixo.");
    lines.push(`Erro registrado: ${analysis.insightError}`);
  }

  // ── Column statistics ─────────────────────────────────────────────────────
  const meaningfulCols = analysis.columns.filter((c) => !/^__EMPTY/.test(c.name));
  if (meaningfulCols.length > 0) {
    lines.push(`\nESTATÍSTICAS POR COLUNA (${meaningfulCols.length} colunas):`);
    meaningfulCols.forEach((c) => {
      let line = `  • "${c.name}" [${c.type}]`;
      if (c.nullCount > 0) line += ` — ${c.nullCount} valores ausentes`;
      if (c.type === "numeric" && c.sum !== undefined) {
        const fmt = (n: number) =>
          n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        line += ` — soma: ${fmt(c.sum)}, média: ${fmt(c.avg ?? 0)}, mín: ${fmt(c.min ?? 0)}, máx: ${fmt(c.max ?? 0)}`;
      }
      if (c.type === "text" && c.topValues?.length) {
        line += ` — valores mais frequentes: ${c.topValues.slice(0, 6).map((v) => `"${v.value}"`).join(", ")}`;
      }
      lines.push(line);
    });
  }

  // ── Preview (TSV — most readable to the model) ────────────────────────────
  if (analysis.preview.length > 0) {
    const headers = Object.keys(analysis.preview[0]).filter(
      (h) => !/^__EMPTY/.test(h)
    );
    if (headers.length > 0) {
      lines.push(
        `\nPREVIA DOS DADOS (primeiras ${analysis.preview.length} linhas — formato TSV):`
      );
      lines.push(headers.join("\t"));
      analysis.preview.forEach((row) => {
        lines.push(headers.map((h) => String(row[h] ?? "")).join("\t"));
      });
    }
  }

  // ── Automatic alerts ──────────────────────────────────────────────────────
  if (analysis.alerts.length > 0) {
    lines.push("\nALERTAS AUTOMÁTICOS DO SISTEMA:");
    analysis.alerts.forEach((a) =>
      lines.push(`  [${a.type.toUpperCase()}] ${a.message}`)
    );
  }

  lines.push("═══════════════════════════════════════════════════════");
  return lines.join("\n");
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(context: string): string {
  return `Você é um assistente financeiro amigável que ajuda pessoas comuns a entenderem suas finanças. Você fala de forma simples, clara e direta — como um amigo de confiança que entende de dinheiro, não como um contador ou auditor.

O usuário acabou de enviar uma planilha ou documento financeiro. Você tem acesso à análise completa desse arquivo.

REGRAS IMPORTANTES:
1. Linguagem SIMPLES — evite jargões técnicos (nada de "HHI", "EBITDA", "PDD", "PCLD", "inadimplência aging"). Se precisar usar um termo técnico, explique em seguida com palavras do dia a dia.
2. Seja DIRETO — responda o que foi perguntado em 2-4 parágrafos no máximo. Sem enrolação.
3. Use NÚMEROS REAIS do documento — cite valores em reais, porcentagens e quantidades concretas.
4. Fale como se estivesse EXPLICANDO para alguém que não tem formação financeira — use frases curtas e exemplos práticos.
5. Quando houver um problema, explique O QUE FAZER, não apenas o que está errado.
6. Se os dados não permitirem responder, diga claramente o que faltaria.
7. Responda sempre em português brasileiro.
8. Use bullet points apenas quando listar 3 ou mais itens — caso contrário, escreva em texto corrido.

${context}`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      message:  string;
      analysis: FileAnalysis;
      history:  { role: "user" | "assistant"; content: string }[];
    };

    const { message, analysis, history } = body;

    if (!message?.trim()) {
      return Response.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey?.trim()) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY não configurada. Adicione a chave em .env.local e reinicie o servidor." },
        { status: 500 }
      );
    }

    let sdk: typeof import("@anthropic-ai/sdk") | null = null;
    try {
      sdk = await import("@anthropic-ai/sdk");
    } catch {
      return Response.json(
        { error: "SDK @anthropic-ai/sdk não encontrado. Execute: npm install @anthropic-ai/sdk" },
        { status: 500 }
      );
    }

    const client = new sdk.default({ apiKey: apiKey.trim() });

    const context      = buildAnalysisContext(analysis);
    const systemPrompt = buildSystemPrompt(context);

    // Keep only the last MAX_HISTORY messages so long conversations don't
    // balloon the context window or exceed token limits
    const trimmedHistory = history.slice(-MAX_HISTORY);

    const messages = [
      ...trimmedHistory.map((h) => ({
        role:    h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message.trim() },
    ];

    const response = await client.messages.create({
      model:      CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply     = textBlock?.type === "text" ? textBlock.text : "";

    return Response.json({ reply });

  } catch (err: unknown) {
    const msg    = err instanceof Error ? err.message : String(err);
    const isAuth =
      msg.includes("401") ||
      msg.toLowerCase().includes("authentication") ||
      msg.toLowerCase().includes("invalid_api_key");

    return Response.json(
      {
        error: isAuth
          ? "Chave Anthropic inválida ou expirada. Verifique ANTHROPIC_API_KEY em .env.local."
          : `Erro na Anthropic API: ${msg}`,
      },
      { status: 500 }
    );
  }
}
