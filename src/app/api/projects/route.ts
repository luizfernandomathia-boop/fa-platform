/**
 * GET  /api/projects  — list the current user's projects (with analysis count)
 * POST /api/projects  — create a new project
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CreateProjectInput } from "@/types/project";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Fetch projects with a count of linked analyses
  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, user_id, name, description, type, color, icon, created_at, updated_at,
      analyses(count)
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[GET /api/projects]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Flatten the nested count into a top-level field
  const projects = (data ?? []).map((row) => {
    const { analyses, ...rest } = row as typeof row & {
      analyses: { count: number }[];
    };
    return {
      ...rest,
      analysis_count: analyses?.[0]?.count ?? 0,
    };
  });

  return Response.json({ projects });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: CreateProjectInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body inválido." }, { status: 400 });
  }

  const { name, description, type, color, icon } = body;

  if (!name?.trim()) {
    return Response.json({ error: "Nome do projeto é obrigatório." }, { status: 400 });
  }

  const validTypes  = ["pessoal", "empresarial", "cliente", "contabilidade", "outro"];
  const validColors = ["blue", "violet", "emerald", "amber", "rose", "slate"];

  if (!validTypes.includes(type)) {
    return Response.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (!validColors.includes(color)) {
    return Response.json({ error: "Cor inválida." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id:     user.id,
      name:        name.trim(),
      description: description?.trim() || null,
      type,
      color,
      icon: icon || "FolderOpen",
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/projects]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ project: { ...data, analysis_count: 0 } }, { status: 201 });
}
