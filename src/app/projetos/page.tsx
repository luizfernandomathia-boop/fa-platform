"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  Home,
  Building2,
  Users,
  BookOpen,
  FolderOpen,
  Briefcase,
  PiggyBank,
  BarChart3,
  FileText,
  Clock,
  ChevronRight,
  AlertCircle,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Project, ProjectColor } from "@/types/project";
import {
  PROJECT_TYPE_LABELS,
  COLOR_CLASSES,
} from "@/types/project";

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Building2, Users, BookOpen, FolderOpen,
  Briefcase, PiggyBank, BarChart3, FileText, FolderKanban,
};

function ProjectIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? FolderOpen;
  return <Icon className={className} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 2)  return "agora mesmo";
  if (mins  < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days  < 30) return `há ${days} dia${days > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-1/2" />
    </div>
  );
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  project,
  onConfirm,
  onCancel,
  loading,
}: {
  project: Project;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <h3 className="text-[16px] font-bold text-slate-900 text-center mb-2">
          Excluir projeto?
        </h3>
        <p className="text-[13px] text-slate-500 text-center leading-relaxed mb-6">
          O projeto <span className="font-semibold text-slate-700">"{project.name}"</span> e todas as suas análises serão excluídos permanentemente.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Trash2 className="w-3.5 h-3.5" /> Excluir</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onDeleted,
}: {
  project: Project;
  onDeleted: (id: string) => void;
}) {
  const color = COLOR_CLASSES[project.color as ProjectColor] ?? COLOR_CLASSES.blue;
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(project.id);
    }
    setDeleting(false);
    setShowModal(false);
  };

  return (
    <>
      {showModal && (
        <ConfirmDeleteModal
          project={project}
          onConfirm={handleDelete}
          onCancel={() => setShowModal(false)}
          loading={deleting}
        />
      )}

      <div className="group relative bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden">
        {/* Colored accent bar */}
        <div className={`h-1 w-full ${color.accent}`} />

        {/* 3-dot menu button */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-40">
                <button
                  onClick={(e) => { e.preventDefault(); setMenuOpen(false); setShowModal(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir projeto
                </button>
              </div>
            </>
          )}
        </div>

        <Link href={`/projetos/${project.id}`} className="p-5 flex flex-col flex-1">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
              <ProjectIcon name={project.icon} className={`w-5 h-5 ${color.text}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5 pr-6">
              <h3 className="text-[14px] font-bold text-slate-900 leading-tight truncate group-hover:text-blue-700 transition-colors">
                {project.name}
              </h3>
              <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                {PROJECT_TYPE_LABELS[project.type]}
              </span>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">
              {project.description}
            </p>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <FileText className="w-3.5 h-3.5" />
              <span>{project.analysis_count} análise{project.analysis_count !== 1 ? "s" : ""}</span>
              <span className="mx-1.5">·</span>
              <Clock className="w-3.5 h-3.5" />
              <span>{relativeTime(project.updated_at)}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>
      </div>
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
        <FolderKanban className="w-9 h-9 text-slate-400" />
      </div>
      <h3 className="text-[18px] font-bold text-slate-900 mb-2 text-center">
        Nenhum projeto ainda
      </h3>
      <p className="text-[13px] text-slate-500 text-center max-w-sm leading-relaxed mb-7">
        Organize suas análises financeiras por projeto. Crie um contexto para cada realidade — empresa, cliente ou uso pessoal.
      </p>
      <Link
        href="/projetos/novo"
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        Criar primeiro projeto
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjetosPage() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [userName,  setUserName]  = useState("");

  useEffect(() => {
    // Get user name for greeting
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = (data.user.user_metadata?.full_name as string | undefined)
          || data.user.email?.split("@")[0]
          || "Usuário";
        setUserName(name.split(" ")[0]); // first name only
      }
    });

    // Fetch projects
    fetch("/api/projects")
      .then((r) => r.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setProjects(body.projects ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" :
    hour < 18 ? "Boa tarde" :
                "Boa noite";

  const totalAnalyses = projects.reduce((s, p) => s + p.analysis_count, 0);

  return (
    <div className="flex-1 flex flex-col">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
            Início
          </p>
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight">
            {greeting}{userName ? `, ${userName}` : ""}
          </h1>
        </div>
        <Link
          href="/projetos/novo"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo projeto
        </Link>
      </div>

      <div className="flex-1 p-8 space-y-7 max-w-6xl w-full mx-auto">

        {/* ── Stats row (only when there are projects) ───────────────────── */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Projetos",  value: projects.length,  icon: FolderKanban, color: "text-blue-600",    bg: "bg-blue-50"    },
              { label: "Análises",  value: totalAnalyses,    icon: FileText,     color: "text-violet-600",  bg: "bg-violet-50"  },
              { label: "Atualizado",value: relativeTime(projects[0]?.updated_at ?? new Date().toISOString()), icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[20px] font-bold text-slate-900 leading-none">{stat.value}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────────── */}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-red-900">Não foi possível carregar os projetos</p>
              <p className="text-[12px] text-red-700 mt-0.5 leading-relaxed">{error}</p>
              <p className="text-[11px] text-red-500 mt-2">
                Verifique se as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY estão configuradas no .env.local e se a migration 002 foi aplicada no banco.
              </p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && projects.length === 0 && <EmptyState />}

        {/* Grid */}
        {!loading && !error && projects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-semibold text-slate-500 uppercase tracking-widest">
                Seus projetos
              </h2>
              <span className="text-[11px] text-slate-400">{projects.length} projeto{projects.length > 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDeleted={(id) => setProjects((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}

              {/* "New project" card */}
              <Link
                href="/projetos/novo"
                className="border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 rounded-xl p-5 flex flex-col items-center justify-center gap-3 transition-all group min-h-[160px]"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <p className="text-[13px] font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
                  Novo projeto
                </p>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
