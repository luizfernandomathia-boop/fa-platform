"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { User, Mail, Shield, BarChart3, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface Profile {
  full_name: string | null;
  email: string;
  plan: string;
  monthly_limit: number;
  monthly_used: number;
  total_analyses: number;
  created_at: string;
}

const PLAN_LABEL: Record<string, string> = {
  free:       "Gratuito",
  pro:        "Pro",
  enterprise: "Enterprise",
};

export default function ConfiguracoesPage() {
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saved,    setSaved]    = useState(false);
  const [name,     setName]     = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      let { data: p, error: err } = await sb
        .from("profiles")
        .select("full_name, email, plan, monthly_limit, monthly_used, total_analyses, created_at")
        .eq("id", data.user.id)
        .maybeSingle();

      // Profile missing — user registered before migration 001, build a fallback from auth data
      if (!err && !p) {
        const email = data.user.email ?? "";
        const full_name = (data.user.user_metadata?.full_name as string) || email.split("@")[0] || "Usuário";
        p = {
          full_name,
          email,
          plan: "free",
          monthly_limit: 50,
          monthly_used: 0,
          total_analyses: 0,
          created_at: data.user.created_at ?? new Date().toISOString(),
        };
      }

      if (err) setError(err.message);
      else {
        setProfile(p);
        setName(p?.full_name ?? "");
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const sb = createSupabaseBrowserClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const usedPct = profile ? Math.min(100, Math.round((profile.monthly_used / profile.monthly_limit) * 100)) : 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-20">
        <h1 className="text-[18px] font-bold text-slate-900">Configurações</h1>
        <p className="text-[12px] text-slate-500 mt-0.5">Gerencie sua conta e preferências</p>
      </div>

      {/* Body */}
      <div className="flex-1 p-8 max-w-2xl w-full mx-auto space-y-6">

        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Carregando perfil…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {!loading && profile && (
          <>
            {/* Profile card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-[15px] font-bold text-slate-900">Perfil</h2>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-3.5 py-2.5 text-[14px] border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    E-mail
                  </label>
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-[14px] text-slate-500">{profile.email}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">O e-mail não pode ser alterado.</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {saving ? "Salvando…" : "Salvar alterações"}
                  </button>
                  {saved && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-[13px] font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Salvo!
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Plan card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-violet-600" />
                </div>
                <h2 className="text-[15px] font-bold text-slate-900">Plano</h2>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-500">Plano atual</p>
                  <p className="text-[16px] font-bold text-slate-900 mt-0.5">
                    {PLAN_LABEL[profile.plan] ?? profile.plan}
                  </p>
                </div>
                {profile.plan === "free" && (
                  <button className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    Fazer upgrade →
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-slate-700">Análises este mês</p>
                  <p className="text-[12px] text-slate-500">{profile.monthly_used} / {profile.monthly_limit}</p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{usedPct}% do limite utilizado</p>
              </div>
            </div>

            {/* Stats card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-[15px] font-bold text-slate-900">Estatísticas</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[24px] font-bold text-slate-900">{profile.total_analyses}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">Análises realizadas</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[24px] font-bold text-slate-900">
                    {new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-0.5">Membro desde</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
