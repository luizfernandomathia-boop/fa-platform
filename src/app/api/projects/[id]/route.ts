/**
 * GET    /api/projects/[id]  — fetch a single project (with analysis count)
 * PATCH  /api/projects/[id]  — update project fields
 * DELETE /api/projects/[id]  — delete project (analyses are set to null project_id)
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, user_id, name, description, type, color, icon, created_at, updated_at,
      analyses(count)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const { analyses, ...rest } = data as typeof data & {
    analyses: { count: number }[];
  };

  return Response.json({
    project: { ...rest, analysis_count: analyses?.[0]?.count ?? 0 },
  });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const allowed = ["name", "description", "type", "color", "icon"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ error: "Projeto não encontrado ou sem permissão." }, { status: 404 });
  }

  return Response.json({ project: data });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
