import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import * as XLSX from "xlsx";
import type { FileAnalysis, ColumnInfo, GroupSummary } from "@/types/analysis";
import { classifyEntries } from "@/lib/classifier";
import { analyzeDocument, analyzePdf, type ProjectContext } from "@/lib/analyzer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ─── Configuração ─────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".pdf"]);
const MAX_SIZE_BYTES      = 50 * 1024 * 1024; // 50 MB

// ─── CSV separator detection ──────────────────────────────────────────────────

function detectSeparator(raw: string): string {
  const first = raw.split(/\r?\n/)[0] ?? "";
  const counts = {
    ";":  (first.match(/;/g)  ?? []).length,
    ",":  (first.match(/,/g)  ?? []).length,
    "\t": (first.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Number parsing ───────────────────────────────────────────────────────────

function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw === null || raw === undefined) return null;
  const s = String(raw)
    .trim()
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Smart sheet parser ───────────────────────────────────────────────────────

/**
 * Improved sheet parser that finds the real header row.
 *
 * Problem: XLSX.utils.sheet_to_json() assumes row 0 is the header.
 * Many financial spreadsheets have title rows, blank rows, or company
 * information before the actual column headers, which causes SheetJS to
 * generate __EMPTY, __EMPTY_1, __EMPTY_2 … column names.
 *
 * Fix: read all rows as raw arrays, then scan the first 15 rows to find
 * the one with the most non-empty string cells — that's almost certainly
 * the real header row.
 */
function smartParseSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header:  1,
    defval:  "",
    raw:     false, // convert dates and numbers to strings for inspection
  });

  if (rawRows.length === 0) return [];

  // Find the header row: the one with the most non-trivial string cells
  let headerRowIdx = 0;
  let bestScore    = -1;
  const scanLimit  = Math.min(rawRows.length, 15);

  for (let i = 0; i < scanLimit; i++) {
    const row = rawRows[i] as unknown[];
    // Score: number of cells that look like column headers (short, non-numeric strings)
    const score = row.filter((v) => {
      const s = String(v ?? "").trim();
      return s.length >= 2 && s.length <= 60 && isNaN(Number(s));
    }).length;
    if (score > bestScore) {
      bestScore    = score;
      headerRowIdx = i;
    }
  }

  // Build header names from the chosen row; fall back to "Coluna_N" for blank cells
  const headerRow = rawRows[headerRowIdx] as unknown[];
  const usedNames = new Map<string, number>();
  const headers   = headerRow.map((h, idx) => {
    let name = String(h ?? "").trim();
    if (!name || name.length === 0) name = `Coluna_${idx + 1}`;
    // Deduplicate: "Valor", "Valor_2", "Valor_3" …
    const count = (usedNames.get(name) ?? 0) + 1;
    usedNames.set(name, count);
    return count === 1 ? name : `${name}_${count}`;
  });

  // Re-read the sheet in raw mode (dates as Date objects, numbers as numbers)
  const rawRowsTyped = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw:    true,
  });

  // Convert rows after the header row to objects, skip fully blank rows
  return rawRowsTyped
    .slice(headerRowIdx + 1)
    .filter((row) =>
      (row as unknown[]).some((v) => v !== "" && v !== null && v !== undefined)
    )
    .map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = (row as unknown[])[i] ?? "";
      });
      return obj;
    });
}

// ─── Best sheet selection ─────────────────────────────────────────────────────

/**
 * Pick the most data-rich sheet in a workbook.
 *
 * Some workbooks have a cover/instructions sheet as the first sheet, with the
 * actual data on a later sheet. We pick the sheet with the most rows.
 */
function bestSheetName(workbook: XLSX.WorkBook): string {
  if (workbook.SheetNames.length === 1) return workbook.SheetNames[0];

  let best      = workbook.SheetNames[0];
  let bestRows  = 0;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const ref   = sheet?.["!ref"];
    if (!ref) continue;
    try {
      const range    = XLSX.utils.decode_range(ref);
      const rowCount = range.e.r - range.s.r;
      if (rowCount > bestRows) {
        bestRows = rowCount;
        best     = name;
      }
    } catch {
      // ignore malformed ranges
    }
  }

  return best;
}

// ─── Column statistics ────────────────────────────────────────────────────────

function buildAnalysis(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string
): FileAnalysis {
  const uploadedAt = new Date().toISOString();
  const id         = `file-${Date.now()}`;

  if (rows.length === 0) {
    return {
      id, fileName, sheetName,
      rowCount: 0, columnCount: 0,
      columns: [], preview: [], groups: [],
      alerts: [{
        type:    "warning",
        message: "Planilha vazia: nenhuma linha de dados encontrada após o cabeçalho.",
      }],
      uploadedAt,
    };
  }

  const headers  = Object.keys(rows[0]);
  const rowCount = rows.length;

  // ── Per-column statistics ──────────────────────────────────────────────────

  const columns: ColumnInfo[] = headers.map((name) => {
    const rawValues = rows.map((r) => r[name]);
    const nonEmpty  = rawValues.filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
    const nullCount = rawValues.length - nonEmpty.length;

    if (nonEmpty.length === 0) {
      return { name, type: "empty", nullCount, uniqueCount: 0, sample: [] };
    }

    // Numeric: ≥80% of non-empty values parse as numbers
    const numericVals = nonEmpty
      .map(parseNumber)
      .filter((n): n is number => n !== null);

    if (numericVals.length / nonEmpty.length >= 0.8) {
      const sum = numericVals.reduce((a, b) => a + b, 0);
      return {
        name, type: "numeric",
        nullCount, uniqueCount: new Set(numericVals).size,
        sample:  numericVals.slice(0, 3).map(String),
        sum,
        min: Math.min(...numericVals),
        max: Math.max(...numericVals),
        avg: sum / numericVals.length,
      };
    }

    // Text column
    const strs = nonEmpty.map((v) => String(v).trim());
    const freq: Record<string, number> = {};
    strs.forEach((v) => { freq[v] = (freq[v] ?? 0) + 1; });
    const topValues = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)                         // keep top 10 in analysis object
      .map(([value, count]) => ({ value, count }));

    return {
      name, type: "text",
      nullCount, uniqueCount: new Set(strs).size,
      sample:    strs.slice(0, 3),
      topValues,
    };
  });

  // ── Groupings ─────────────────────────────────────────────────────────────

  const groups: GroupSummary[] = [];
  const catCols = columns.filter(
    (c) => c.type === "text" && c.uniqueCount >= 2 && c.uniqueCount <= 30
  );
  const numCols = columns.filter((c) => c.type === "numeric");

  if (catCols.length > 0 && numCols.length > 0) {
    const gCol = catCols[0];
    const vCol = numCols[0];
    const map: Record<string, { total: number; count: number }> = {};

    rows.forEach((row) => {
      const key = String(row[gCol.name] ?? "").trim() || "(vazio)";
      const val = parseNumber(row[vCol.name]);
      if (!map[key]) map[key] = { total: 0, count: 0 };
      if (val !== null) { map[key].total += val; map[key].count += 1; }
    });

    groups.push({
      groupColumn: gCol.name,
      valueColumn: vCol.name,
      groups: Object.entries(map)
        .map(([label, { total, count }]) => ({ label, total, count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    });
  }

  // ── Alerts ────────────────────────────────────────────────────────────────

  const alerts: FileAnalysis["alerts"] = [];

  columns
    .filter((c) => c.type === "empty")
    .forEach((c) =>
      alerts.push({ type: "warning", message: `Coluna "${c.name}" está completamente vazia.` })
    );

  columns
    .filter((c) => c.type !== "empty" && c.nullCount > rowCount * 0.3)
    .forEach((c) => {
      const pct = Math.round((c.nullCount / rowCount) * 100);
      alerts.push({
        type:    "warning",
        message: `Coluna "${c.name}": ${pct}% de valores ausentes (${c.nullCount}/${rowCount}).`,
      });
    });

  if (numCols.length === 0) {
    alerts.push({
      type:    "info",
      message: "Nenhuma coluna numérica identificada. Verifique se os valores estão formatados corretamente.",
    });
  }

  if (groups.length > 0) {
    const g = groups[0];
    alerts.push({
      type:    "info",
      message: `Agrupamento detectado: "${g.groupColumn}" × "${g.valueColumn}" — ${g.groups.length} categorias.`,
    });
  }

  if (numCols.length > 0) {
    const totalSum = numCols[0].sum ?? 0;
    alerts.push({
      type:    "ok",
      message: `${rowCount} linhas e ${columns.length} colunas lidas. Soma de "${numCols[0].name}": ${totalSum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    });
  } else {
    alerts.push({
      type:    "ok",
      message: `${rowCount} linhas e ${columns.length} colunas lidas com sucesso.`,
    });
  }

  // ── Preview (first 5 rows for the UI table) ────────────────────────────────

  const preview = rows.slice(0, 5).map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((h) => { out[h] = String(row[h] ?? ""); });
    return out;
  });

  return {
    id, fileName, sheetName,
    rowCount, columnCount: columns.length,
    columns, preview, groups, alerts, uploadedAt,
  };
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file     = formData.get("file");
    const userPrompt         = formData.get("userPrompt")         as string | null;
    const projectId          = formData.get("projectId")          as string | null;
    const projectName        = formData.get("projectName")        as string | null;
    const projectType        = formData.get("projectType")        as string | null;
    const projectDescription = formData.get("projectDescription") as string | null;

    const projectContext: ProjectContext | undefined =
      projectName
        ? { name: projectName, type: projectType ?? "outro", description: projectDescription }
        : undefined;

    if (!file || typeof file === "string") {
      return Response.json(
        { error: "Nenhum arquivo recebido. Verifique o envio e tente novamente." },
        { status: 400 }
      );
    }

    const { name, size } = file as File;

    // Validate extension
    const dotIndex = name.lastIndexOf(".");
    const ext      = dotIndex !== -1 ? name.slice(dotIndex).toLowerCase() : "";

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      const label = ext ? `"${ext}"` : "sem extensão";
      return Response.json(
        { error: `Formato ${label} não é aceito. Envie arquivos .xlsx, .xls, .csv ou .pdf.` },
        { status: 422 }
      );
    }

    // Validate size
    if (size > MAX_SIZE_BYTES) {
      const mb = (size / 1024 / 1024).toFixed(1);
      return Response.json(
        { error: `Arquivo muito grande (${mb} MB). O limite é 50 MB por arquivo.` },
        { status: 413 }
      );
    }

    // Read bytes
    const bytes  = await (file as File).arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to temp directory
    const uploadDir = join(tmpdir(), "fa-uploads");
    await mkdir(uploadDir, { recursive: true });
    const safeName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    // ── PDF path ──────────────────────────────────────────────────────────────

    if (ext === ".pdf") {
      // Send the PDF natively to the Anthropic API — no intermediate parsing.
      // The model reads the PDF directly, the same way Claude chat does.
      const pdfBase64 = buffer.toString("base64");

      const pdfAnalysis: FileAnalysis = {
        id:          `file-${Date.now()}`,
        fileName:    name,
        sheetName:   "PDF",
        rowCount:    0,
        columnCount: 0,
        columns:     [],
        preview:     [],
        groups:      [],
        alerts:      [{
          type:    "info",
          message: "Documento PDF enviado para análise direta pela IA (leitura nativa).",
        }],
        uploadedAt: new Date().toISOString(),
      };

      const { insight, error: insightError } = await analyzePdf(name, pdfBase64, userPrompt ?? undefined, projectContext);
      if (insight)      pdfAnalysis.insight      = insight;
      if (insightError) pdfAnalysis.insightError = insightError;

      // Save to Supabase
      try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("analyses").insert({
            user_id: user.id,
            project_id: projectId || null,
            file_name: name,
            analysis_data: pdfAnalysis,
          });
        }
      } catch (dbErr) {
        console.warn("[upload] Failed to save to Supabase:", dbErr);
      }

      return Response.json({
        success:  true,
        fileName: name,
        savedAs:  safeName,
        sizeKb:   Math.round(size / 1024),
        message:  "PDF recebido e analisado com sucesso.",
        analysis: pdfAnalysis,
      });
    }

    // ── Spreadsheet path ──────────────────────────────────────────────────────

    let workbook: XLSX.WorkBook;

    if (ext === ".csv") {
      const raw = buffer.toString("utf-8");
      const sep = detectSeparator(raw);
      workbook  = XLSX.read(raw, { type: "string", FS: sep });
    } else {
      workbook = XLSX.read(buffer, { type: "buffer" });
    }

    const sheetName = bestSheetName(workbook);
    if (!sheetName) {
      return Response.json(
        { error: "O arquivo não contém nenhuma planilha ou está corrompido." },
        { status: 422 }
      );
    }

    const sheet    = workbook.Sheets[sheetName];

    // Use smart parser to find the real header row and avoid __EMPTY columns
    const rows     = smartParseSheet(sheet);
    const analysis = buildAnalysis(rows, sheetName, name);

    // ── AI / heuristic classification (per-row) ───────────────────────────────
    if (rows.length > 0) {
      const classification = await classifyEntries(rows, analysis.columns);
      if (classification) {
        analysis.classification = classification;
      }
    }

    // ── Document-level AI interpretation ──────────────────────────────────────
    const { insight, error: insightError } = await analyzeDocument(analysis, rows, userPrompt ?? undefined, projectContext);
    if (insight)      analysis.insight      = insight;
    if (insightError) analysis.insightError = insightError;

    // Save to Supabase
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("analyses").insert({
          user_id: user.id,
          project_id: projectId || null,
          file_name: name,
          analysis_data: analysis,
        });
      }
    } catch (dbErr) {
      console.warn("[upload] Failed to save to Supabase:", dbErr);
    }

    return Response.json({
      success:  true,
      fileName: name,
      savedAs:  safeName,
      sizeKb:   Math.round(size / 1024),
      message:  "Arquivo recebido e processado com sucesso.",
      analysis,
    });

  } catch (err) {
    console.error("[/api/upload] Erro:", err);
    return Response.json(
      { error: "Erro interno ao processar o arquivo. Tente novamente." },
      { status: 500 }
    );
  }
}
