/**
 * GET /api/projects/[id]/analyses — list analyses for a project
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("analyses")
    .select("id, file_name, analysis_data, created_at, updated_at")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Table might not have project_id yet — return empty gracefully
    console.error("[GET analyses]", error.message);
    return Response.json({ analyses: [] });
  }

  return Response.json({ analyses: data ?? [] });
}
