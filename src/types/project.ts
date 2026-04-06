// ─── Project entity ───────────────────────────────────────────────────────────

export type ProjectType =
  | "pessoal"
  | "empresarial"
  | "cliente"
  | "contabilidade"
  | "outro";

export type ProjectColor =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

export interface Project {
  id:             string;
  user_id:        string;
  name:           string;
  description:    string | null;
  type:           ProjectType;
  color:          ProjectColor;
  icon:           string;           // Lucide icon name, e.g. "Home", "Building2"
  analysis_count: number;           // computed via join, not stored
  created_at:     string;           // ISO timestamp
  updated_at:     string;           // ISO timestamp — updated when files are added
}

export interface CreateProjectInput {
  name:         string;
  description?: string;
  type:         ProjectType;
  color:        ProjectColor;
  icon:         string;
}

// ─── Display metadata (client-side only) ─────────────────────────────────────

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  pessoal:        "Pessoal",
  empresarial:    "Empresarial",
  cliente:        "Cliente",
  contabilidade:  "Contabilidade",
  outro:          "Outro",
};

export const PROJECT_TYPE_DESCRIPTIONS: Record<ProjectType, string> = {
  pessoal:       "Finanças domésticas, gastos pessoais e orçamento familiar",
  empresarial:   "DRE, Balanço, Fluxo de Caixa e gestão financeira da empresa",
  cliente:       "Análises para clientes externos, relatórios e consultoria",
  contabilidade: "Escrituração, SPED, relatórios fiscais e demonstrações contábeis",
  outro:         "Projeto de uso geral ou categoria personalizada",
};

/** Default color per project type */
export const PROJECT_TYPE_COLOR: Record<ProjectType, ProjectColor> = {
  pessoal:       "emerald",
  empresarial:   "blue",
  cliente:       "violet",
  contabilidade: "amber",
  outro:         "slate",
};

/** Default icon per project type */
export const PROJECT_TYPE_ICON: Record<ProjectType, string> = {
  pessoal:       "Home",
  empresarial:   "Building2",
  cliente:       "Users",
  contabilidade: "BookOpen",
  outro:         "FolderOpen",
};

// ─── Tailwind class map (must be full strings for purge safety) ───────────────

export const COLOR_CLASSES: Record<
  ProjectColor,
  { bg: string; text: string; accent: string; border: string; light: string }
> = {
  blue: {
    bg:     "bg-blue-100",
    text:   "text-blue-700",
    accent: "bg-blue-600",
    border: "border-blue-200",
    light:  "bg-blue-50",
  },
  violet: {
    bg:     "bg-violet-100",
    text:   "text-violet-700",
    accent: "bg-violet-600",
    border: "border-violet-200",
    light:  "bg-violet-50",
  },
  emerald: {
    bg:     "bg-emerald-100",
    text:   "text-emerald-700",
    accent: "bg-emerald-600",
    border: "border-emerald-200",
    light:  "bg-emerald-50",
  },
  amber: {
    bg:     "bg-amber-100",
    text:   "text-amber-700",
    accent: "bg-amber-600",
    border: "border-amber-200",
    light:  "bg-amber-50",
  },
  rose: {
    bg:     "bg-rose-100",
    text:   "text-rose-700",
    accent: "bg-rose-600",
    border: "border-rose-200",
    light:  "bg-rose-50",
  },
  slate: {
    bg:     "bg-slate-100",
    text:   "text-slate-600",
    accent: "bg-slate-500",
    border: "border-slate-200",
    light:  "bg-slate-50",
  },
};
