"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FileText, Clock, CheckCircle, AlertCircle, Loader2, Upload, Search } from "lucide-react";
import Link from "next/link";

interface Analysis {
  id: string;
  file_name: string;
  file_size_kb: number | null;
  document_type: string | null;
  risk_level: string | null;
  status: string;
  created_at: string;
  executive_summary: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  completed: "Concluído",
  processing: "Processando",
  pending: "Pendente",
  failed: "Falhou",
};

const RISK_COLOR: Record<string, string> = {
  alto:  "bg-red-100 text-red-700",
  médio: "bg-amber-100 text-amber-700",
  baixo: "bg-emerald-100 text-emerald-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatSize(kb: number | null) {
  if (!kb) return "—";
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function HistoricoPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows, error: err } = await sb
        .from("analyses")
        .select("id, file_name, file_size_kb, document_type, risk_level, status, created_at, executive_summary")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });

      if (err) setError(err.message);
      else setAnalyses(rows ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = analyses.filter((a) =>
    a.file_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.document_type ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900">Histórico de Análises</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Todos os arquivos analisados pela IA</p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Nova análise
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-5">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou tipo de documento…"
            className="w-full pl-10 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Carregando histórico…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-700 mb-1">
              {search ? "Nenhum resultado" : "Nenhuma análise ainda"}
            </p>
            <p className="text-[13px] text-slate-400 mb-6">
              {search ? "Tente outro termo de busca." : "Envie um arquivo para começar."}
            </p>
            {!search && (
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" />
                Enviar primeiro arquivo
              </Link>
            )}
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              {filtered.length} {filtered.length === 1 ? "análise" : "análises"}
            </p>
            {filtered.map((a) => (
              <Link
                key={a.id}
                href={`/resultados?id=${a.id}`}
                className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                    <FileText className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-slate-900 truncate">{a.file_name}</p>
                      {a.risk_level && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RISK_COLOR[a.risk_level] ?? "bg-slate-100 text-slate-600"}`}>
                          Risco {a.risk_level}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        a.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        a.status === "failed"    ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    {a.executive_summary && (
                      <p className="text-[12px] text-slate-500 mt-1 line-clamp-1">{a.executive_summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      {a.document_type && <span>{a.document_type}</span>}
                      <span>·</span>
                      <span>{formatSize(a.file_size_kb)}</span>
                      <span>·</span>
                      <span>{formatDate(a.created_at)}</span>
                    </div>
                  </div>
                  <CheckCircle className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
