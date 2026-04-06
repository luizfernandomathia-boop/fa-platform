"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, FolderKanban, FileText, Settings, LogOut,
  ChevronDown, Plus, History, ChevronRight, Building2, Home,
  Users, BookOpen, FolderOpen, Briefcase, PiggyBank,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Project } from "@/types/project";

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Building2, Users, BookOpen, FolderOpen, Briefcase, PiggyBank, BarChart3, FileText,
};

const COLOR_DOT: Record<string, string> = {
  blue:    "bg-blue-500",
  violet:  "bg-violet-500",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
  slate:   "bg-slate-400",
};

const NAV_ACCOUNT = [
  { href: "/historico",     icon: History,  label: "Histórico de Análises" },
  { href: "/configuracoes", icon: Settings, label: "Configurações" },
];

interface AuthUser { name: string; email: string; initials: string; }

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [user,       setUser]       = useState<AuthUser | null>(null);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [projOpen,   setProjOpen]   = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingProj, setLoadingProj] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const fullName = data.user.user_metadata?.full_name as string | undefined;
      const email    = data.user.email ?? "";
      const name     = fullName || email.split("@")[0] || "Usuário";
      const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
      setUser({ name, email, initials });
    });
  }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {})
      .finally(() => setLoadingProj(false));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-950 flex flex-col z-40 border-r border-slate-800/60">

      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <BarChart3 className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white leading-none">FA Solutions</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-none">Análise Financeira</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">

        {/* Projetos */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <button
              onClick={() => setProjOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${projOpen ? "rotate-90" : ""}`} />
              Projetos
            </button>
            <Link
              href="/projetos/novo"
              title="Novo projeto"
              className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Projects overview link */}
          <NavLink
            href="/projetos"
            icon={FolderKanban}
            label="Meus Projetos"
            active={pathname === "/projetos"}
          />

          {/* Project list */}
          {projOpen && (
            <div className="mt-1 space-y-0.5 ml-1">
              {loadingProj ? (
                <div className="space-y-1.5 px-2 py-1">
                  {[1,2,3].map((n) => (
                    <div key={n} className="h-5 bg-slate-800/60 rounded animate-pulse" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <p className="text-[11px] text-slate-600 px-3 py-1">Nenhum projeto ainda</p>
              ) : (
                projects.map((p) => {
                  const IconComp = ICON_MAP[p.icon] ?? FolderOpen;
                  const active   = pathname === `/projetos/${p.id}`;
                  return (
                    <Link
                      key={p.id}
                      href={`/projetos/${p.id}`}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        active
                          ? "bg-slate-800 text-white"
                          : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/50"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[p.color] ?? "bg-slate-400"}`} />
                      <IconComp className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{p.name}</span>
                      {p.analysis_count > 0 && (
                        <span className="ml-auto text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
                          {p.analysis_count}
                        </span>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Conta */}
        <div>
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1.5">
            Conta
          </p>
          <div className="space-y-0.5">
            {NAV_ACCOUNT.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href, true)} />
            ))}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-slate-800/60 pt-3 shrink-0 space-y-1">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">{user?.initials ?? "…"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-200 truncate leading-none mb-0.5">
              {user?.name ?? "Carregando…"}
            </p>
            <p className="text-[10px] text-slate-500 truncate leading-none">{user?.email ?? ""}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800/70 transition-all w-full disabled:opacity-50"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {loggingOut ? "Saindo…" : "Sair"}
        </button>
      </div>
    </aside>
  );
}

function NavLink({ href, icon: Icon, label, active }: {
  href: string; icon: React.ElementType; label: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}
