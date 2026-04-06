/**
 * GET /api/check-api
 *
 * Valida se ANTHROPIC_API_KEY está configurada e funcional.
 * Faz uma chamada mínima à API (1 token de saída) para confirmar autenticação.
 * Nunca expõe a chave — apenas informa se está presente e válida.
 */

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key || key.trim() === "") {
    return Response.json(
      {
        ok: false,
        error: "ANTHROPIC_API_KEY não configurada",
        detail:
          "Abra o arquivo .env.local na raiz do projeto e adicione: ANTHROPIC_API_KEY=sk-ant-...",
        keyPresent: false,
      },
      { status: 200 }
    );
  }

  // Tenta uma chamada mínima para verificar autenticação
  let sdkModule: typeof import("@anthropic-ai/sdk") | null = null;
  try {
    sdkModule = await import("@anthropic-ai/sdk");
  } catch {
    return Response.json(
      {
        ok: false,
        error: "SDK @anthropic-ai/sdk não encontrado",
        detail: "Execute: npm install @anthropic-ai/sdk",
        keyPresent: true,
      },
      { status: 200 }
    );
  }

  try {
    const client = new sdkModule.default({ apiKey: key.trim() });
    const response = await client.messages.create({
      model: process.env.CLASSIFY_MODEL ?? "claude-haiku-4-5",
      max_tokens: 5,
      messages: [{ role: "user", content: "Responda apenas: ok" }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return Response.json({
      ok: true,
      keyPresent: true,
      keyPrefix: key.slice(0, 12) + "...",
      model: process.env.CLASSIFY_MODEL ?? "claude-haiku-4-5",
      apiResponse: text.trim(),
      message: "Chave válida — Anthropic API respondeu com sucesso.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isAuthError =
      message.includes("401") ||
      message.includes("authentication") ||
      message.includes("invalid_api_key");

    return Response.json(
      {
        ok: false,
        keyPresent: true,
        keyPrefix: key.slice(0, 12) + "...",
        error: isAuthError ? "Chave inválida ou expirada" : "Erro ao conectar à API",
        detail: message,
      },
      { status: 200 }
    );
  }
}
