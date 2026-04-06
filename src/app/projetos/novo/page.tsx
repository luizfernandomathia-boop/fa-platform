"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Building2,
  Users,
  BookOpen,
  FolderOpen,
  Briefcase,
  PiggyBank,
  BarChart3,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react";
import type { ProjectType, ProjectColor } from "@/types/project";
import {
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_DESCRIPTIONS,
  PROJECT_TYPE_COLOR,
  PROJECT_TYPE_ICON,
  COLOR_CLASSES,
} from "@/types/project";

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICONS: { name: string; component: React.ElementType }[] = [
  { name: "Home",       component: Home       },
  { name: "Building2",  component: Building2  },
  { name: "Users",      component: Users      },
  { name: "BookOpen",   component: BookOpen   },
  { name: "FolderOpen", component: FolderOpen },
  { name: "Briefcase",  component: Briefcase  },
  { name: "PiggyBank",  component: PiggyBank  },
  { name: "BarChart3",  component: BarChart3  },
  { name: "FileText",   component: FileText   },
];

const COLORS: ProjectColor[] = ["blue", "violet", "emerald", "amber", "rose", "slate"];

const TYPE_OPTIONS: { type: ProjectType; emoji: string }[] = [
  { type: "pessoal",       emoji: "🏠" },
  { type: "empresarial",   emoji: "🏢" },
  { type: "cliente",       emoji: "👥" },
  { type: "contabilidade", emoji: "📒" },
  { type: "outro",         emoji: "📁" },
];

// ─── Preview card ─────────────────────────────────────────────────────────────

function PreviewCard({
  name,
  description,
  type,
  color,
  icon,
}: {
  name: string;
  description: string;
  type: ProjectType;
  color: ProjectColor;
  icon: string;
}) {
  const c    = COLOR_CLASSES[color];
  const Icon = ICONS.find((i) => i.name === icon)?.component ?? FolderOpen;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className={`h-1 w-full ${c.accent}`} />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[14px] font-bold text-slate-900 leading-tight truncate">
              {name || "Nome do projeto"}
            </p>
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
              {PROJECT_TYPE_LABELS[type]}
            </span>
          </div>
        </div>
        {description && (
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}
        <div className="flex items-center gap-1 text-[11px] text-slate-300 mt-3 pt-3 border-t border-slate-100">
          <FileText className="w-3.5 h-3.5" />
          <span>0 análises · agora mesmo</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NovoProjetoPage() {
  const router = useRouter();

  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [type,        setType]        = useState<ProjectType>("empresarial");
  const [color,       setColor]       = useState<ProjectColor>(PROJECT_TYPE_COLOR["empresarial"]);
  const [icon,        setIcon]        = useState<string>(PROJECT_TYPE_ICON["empresarial"]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleTypeSelect = (t: ProjectType) => {
    setType(t);
    setColor(PROJECT_TYPE_COLOR[t]);
    setIcon(PROJECT_TYPE_ICON[t]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("O nome do projeto é obrigatório."); return; }

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/projects", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), description: description.trim(), type, color, icon }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Erro ao criar projeto.");

      router.push(`/projetos/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center gap-4 sticky top-0 z-20">
        <Link
          href="/projetos"
          className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Meus Projetos
        </Link>
        <span className="text-slate-200">/</span>
        <p className="text-[15px] font-bold text-slate-900">Novo Projeto</p>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">

            {/* ── Form ──────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-7">

              {/* Section 1: Type */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900 mb-0.5">
                    Tipo de projeto
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Escolha o contexto que melhor descreve esse projeto.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TYPE_OPTIONS.map(({ type: t, emoji }) => {
                    const selected = type === t;
                    const c = COLOR_CLASSES[PROJECT_TYPE_COLOR[t]];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTypeSelect(t)}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? `${c.border} ${c.light}`
                            : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-[20px] leading-none mt-0.5">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-[13px] font-semibold ${selected ? c.text : "text-slate-800"}`}>
                              {PROJECT_TYPE_LABELS[t]}
                            </p>
                            {selected && (
                              <div className={`w-4 h-4 rounded-full ${c.accent} flex items-center justify-center shrink-0`}>
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            {PROJECT_TYPE_DESCRIPTIONS[t]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Name & description */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-[15px] font-bold text-slate-900">Identidade do projeto</h2>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Nome <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Finanças da Empresa SA, Cliente Hospital X…"
                    maxLength={80}
                    required
                    className="w-full px-3.5 py-2.5 text-[14px] border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Descrição <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o objetivo ou contexto desse projeto…"
                    rows={3}
                    maxLength={300}
                    className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400 resize-none"
                  />
                  <p className="text-right text-[10px] text-slate-300 mt-1">
                    {description.length}/300
                  </p>
                </div>
              </div>

              {/* Section 3: Color & icon */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <h2 className="text-[15px] font-bold text-slate-900">Visual</h2>

                {/* Color picker */}
                <div>
                  <p className="text-[12px] font-semibold text-slate-700 mb-2.5">Cor</p>
                  <div className="flex gap-2.5">
                    {COLORS.map((c) => {
                      const cl = COLOR_CLASSES[c];
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-8 h-8 rounded-full ${cl.accent} transition-transform hover:scale-110 ${
                            color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <p className="text-[12px] font-semibold text-slate-700 mb-2.5">Ícone</p>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(({ name: n, component: Icon }) => {
                      const selected = icon === n;
                      const c = COLOR_CLASSES[color];
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setIcon(n)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            selected
                              ? `${c.accent} text-white shadow-sm`
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-700">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-[14px] font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Criando…
                    </>
                  ) : (
                    "Criar projeto"
                  )}
                </button>
                <Link
                  href="/projetos"
                  className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors px-4 py-2.5"
                >
                  Cancelar
                </Link>
              </div>

            </form>

            {/* ── Preview ────────────────────────────────────────────────── */}
            <div className="lg:sticky lg:top-28">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Pré-visualização
              </p>
              <PreviewCard
                name={name}
                description={description}
                type={type}
                color={color}
                icon={icon}
              />
              <p className="text-[11px] text-slate-400 text-center mt-3">
                É assim que o projeto vai aparecer na lista.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
