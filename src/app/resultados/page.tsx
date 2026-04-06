"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  ChevronRight,
  BarChart2,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  FileSpreadsheet,
  Table2,
  Hash,
  Type,
  Send,
  Bot,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/Header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type { FileAnalysis, ClassificationResult, DocumentInsight, ChatMessage } from "@/types/analysis";

// ─── Tipos (mock analyses) ────────────────────────────────────────────────────

interface ExpenseItem {
  categoria: string;
  valor: number;
  percentual: number;
  variacao: number;
}

interface AlertItem {
  type: "critical" | "warning" | "info" | "ok";
  title: string;
  desc: string;
}

interface MockAnalysis {
  id: string;
  name: string;
  type: string;
  date: string;
  period: string;
  status: string;
  resumo: string;
  indicators: { liquidez: number; rentabilidade: number; endividamento: number; margem: number };
  despesas: ExpenseItem[];
  alertas: AlertItem[];
  radar: { subject: string; value: number }[];
}

type ListItem =
  | { kind: "mock"; data: MockAnalysis }
  | { kind: "file"; data: FileAnalysis };

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ANALYSES: MockAnalysis[] = [
  {
    id: "1",
    name: "DRE Trimestral Q1 2026",
    type: "DRE",
    date: "27/03/2026",
    period: "Jan–Mar 2026",
    status: "Concluído",
    resumo:
      "A empresa encerrou o primeiro trimestre de 2026 com receita bruta de R$ 2.161.200, crescimento de 12,4% em relação ao mesmo período de 2025. O lucro líquido atingiu R$ 290.160, representando margem de 13,4%. O EBITDA de R$ 869.002 reflete expansão operacional consistente, embora as despesas com pessoal tenham crescido acima da receita (+18,2%), o que exige atenção no próximo trimestre.",
    indicators: { liquidez: 1.8, rentabilidade: 15.2, endividamento: 42.1, margem: 40.2 },
    despesas: [
      { categoria: "Pessoal e Encargos",   valor: 193608, percentual: 45.0, variacao: 18.2 },
      { categoria: "Custos Operacionais",  valor: 107560, percentual: 25.0, variacao: 4.3  },
      { categoria: "Despesas Financeiras", valor:  64536, percentual: 15.0, variacao: -2.1 },
      { categoria: "Administrativo",       valor:  64536, percentual: 15.0, variacao: 6.8  },
    ],
    alertas: [
      { type: "warning",  title: "Crescimento de pessoal acima da receita", desc: "Despesas com pessoal cresceram 18,2% contra 12,4% da receita. Avaliar eficiência de headcount." },
      { type: "ok",       title: "Liquidez corrente saudável",              desc: "Índice de 1,8x supera o benchmark setorial de 1,5x. Capacidade de honrar obrigações de curto prazo garantida." },
      { type: "info",     title: "Redução de despesas financeiras",         desc: "Queda de 2,1% nas despesas financeiras pode indicar amortização de dívidas de longo prazo." },
      { type: "warning",  title: "Endividamento próximo do limite",         desc: "Nível de 42,1% está a 7,9 pontos do limiar de atenção (50%). Monitorar alavancagem." },
    ],
    radar: [
      { subject: "Liquidez",     value: 80 },
      { subject: "Rentabilidade",value: 85 },
      { subject: "Endividamento",value: 65 },
      { subject: "Eficiência",   value: 72 },
      { subject: "Crescimento",  value: 88 },
    ],
  },
  {
    id: "2",
    name: "Balanço Patrimonial Jan 2026",
    type: "Balanço",
    date: "25/03/2026",
    period: "Janeiro 2026",
    status: "Concluído",
    resumo:
      "O balanço de janeiro de 2026 evidencia solidez patrimonial com ativo total de R$ 4.830.000. O patrimônio líquido cresceu 8,3% em relação a dezembro de 2025, impulsionado pela retenção de lucros. A estrutura de capital apresenta relação dívida/PL de 0,65x, dentro dos parâmetros estabelecidos pela política financeira da companhia.",
    indicators: { liquidez: 2.1, rentabilidade: 12.8, endividamento: 38.5, margem: 36.4 },
    despesas: [
      { categoria: "Passivo Circulante",     valor: 580000, percentual: 36.2, variacao: -3.4 },
      { categoria: "Passivo Não Circulante", valor: 780000, percentual: 48.7, variacao:  1.2 },
      { categoria: "Provisões",             valor: 142000, percentual:  8.9, variacao:  5.1 },
      { categoria: "Outros Passivos",       valor:  98000, percentual:  6.2, variacao:  0.8 },
    ],
    alertas: [
      { type: "ok",   title: "Liquidez acima do setor",   desc: "Índice de 2,1x supera a média do setor (1,5x). Boa folga financeira de curto prazo." },
      { type: "ok",   title: "Endividamento sob controle",desc: "38,5% está abaixo do limiar de atenção. Estrutura de capital equilibrada." },
      { type: "info", title: "Redução do passivo circulante", desc: "Queda de 3,4% no passivo circulante sugere amortização de obrigações de curto prazo." },
    ],
    radar: [
      { subject: "Liquidez",     value: 92 },
      { subject: "Rentabilidade",value: 75 },
      { subject: "Endividamento",value: 78 },
      { subject: "Eficiência",   value: 68 },
      { subject: "Crescimento",  value: 70 },
    ],
  },
  {
    id: "3",
    name: "Fluxo de Caixa Fev 2026",
    type: "Fluxo de Caixa",
    date: "22/03/2026",
    period: "Fevereiro 2026",
    status: "Em análise",
    resumo:
      "O fluxo de caixa de fevereiro apresenta saldo operacional positivo de R$ 148.320, porém inferior à média dos últimos 6 meses (R$ 201.450). As atividades de investimento consumiram R$ 92.000 em aquisição de equipamentos. O fluxo de financiamento foi negativo em R$ 38.400 pelo pagamento de parcelas de empréstimo. Saldo final: R$ 312.780.",
    indicators: { liquidez: 1.6, rentabilidade: 11.4, endividamento: 44.2, margem: 38.1 },
    despesas: [
      { categoria: "Saídas Operacionais",  valor: 412000, percentual: 52.3, variacao:  7.8 },
      { categoria: "Investimentos (CAPEX)",valor:  92000, percentual: 11.7, variacao: 45.2 },
      { categoria: "Serviço da Dívida",   valor: 189000, percentual: 24.0, variacao: -1.3 },
      { categoria: "Tributos e Encargos", valor:  94000, percentual: 11.9, variacao:  3.2 },
    ],
    alertas: [
      { type: "critical", title: "Fluxo operacional abaixo da média",  desc: "Saldo de R$ 148.320 está 26,4% abaixo da média histórica. Investigar causas do aumento de saídas." },
      { type: "warning",  title: "CAPEX elevado no período",            desc: "Investimentos em imobilizado cresceram 45,2% vs. mês anterior. Verificar retorno esperado." },
      { type: "info",     title: "Análise em andamento",               desc: "Dados de contas a receber ainda sendo conciliados. Resultado final pode variar." },
    ],
    radar: [
      { subject: "Liquidez",     value: 68 },
      { subject: "Rentabilidade",value: 70 },
      { subject: "Endividamento",value: 58 },
      { subject: "Eficiência",   value: 62 },
      { subject: "Crescimento",  value: 75 },
    ],
  },
];

const EXPENSE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
const GROUP_COLORS   = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alertStyle(type: AlertItem["type"]) {
  switch (type) {
    case "critical": return { bg: "bg-red-50 border-red-400",        title: "text-red-900",     desc: "text-red-700",     icon: <AlertCircle   className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> };
    case "warning":  return { bg: "bg-amber-50 border-amber-400",    title: "text-amber-900",   desc: "text-amber-700",   icon: <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /> };
    case "ok":       return { bg: "bg-emerald-50 border-emerald-400",title: "text-emerald-900", desc: "text-emerald-700", icon: <CheckCircle   className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> };
    default:         return { bg: "bg-blue-50 border-blue-400",      title: "text-blue-900",    desc: "text-blue-700",    icon: <Info          className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> };
  }
}

function fileAlertStyle(type: "warning" | "info" | "ok") {
  switch (type) {
    case "warning": return { bg: "bg-amber-50 border-amber-400",    title: "text-amber-900",   desc: "text-amber-700",   icon: <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /> };
    case "ok":      return { bg: "bg-emerald-50 border-emerald-400",title: "text-emerald-900", desc: "text-emerald-700", icon: <CheckCircle   className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> };
    default:        return { bg: "bg-blue-50 border-blue-400",      title: "text-blue-900",    desc: "text-blue-700",    icon: <Info          className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> };
  }
}

function statusBadge(status: string) {
  if (status === "Concluído")  return "bg-emerald-100 text-emerald-700";
  if (status === "Em análise") return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-600";
}

function statusIcon(status: string) {
  if (status === "Concluído")  return <CheckCircle  className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === "Em análise") return <Clock        className="w-3.5 h-3.5 text-yellow-500" />;
  return                              <AlertCircle  className="w-3.5 h-3.5 text-slate-400" />;
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ─── Classification Panel ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Fornecedor hospitalar":        "#3b82f6",
  "Prestador de serviço":         "#10b981",
  "Infraestrutura / Manutenção":  "#f59e0b",
  "Infraestrutura / Equipamentos":"#8b5cf6",
  "Infraestrutura / Tecnologia":  "#06b6d4",
  "Fornecedor operacional":       "#14b8a6",
  "Médico":                       "#ec4899",
  "Trabalhista":                  "#f97316",
  "Trabalhista / Benefícios":     "#84cc16",
  "Trabalhista / Empréstimo":     "#a78bfa",
  "Impostos":                     "#ef4444",
  "Administrativo":               "#64748b",
  "Administrativo / Taxas":       "#94a3b8",
  "Financeiro":                   "#0ea5e9",
  "Não classificado":             "#d1d5db",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

function ClassificationPanel({ classification }: { classification: ClassificationResult }) {
  const [showAll, setShowAll] = useState(false);
  const displayEntries = showAll ? classification.entries : classification.entries.slice(0, 50);
  const reviewEntries  = classification.entries.filter((e) => e.needsReview);

  return (
    <div className="space-y-6">

      {/* Method banner */}
      <div className={`rounded-xl border px-5 py-4 flex flex-wrap items-center gap-4 ${
        classification.method === "ai"
          ? "bg-violet-50 border-violet-200"
          : "bg-blue-50 border-blue-200"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${classification.method === "ai" ? "bg-violet-500" : "bg-blue-500"}`} />
          <span className={`text-[12px] font-semibold ${classification.method === "ai" ? "text-violet-800" : "text-blue-800"}`}>
            {classification.method === "ai"
              ? `IA · ${classification.model ?? "claude"}`
              : "Heurística · regras por palavras-chave"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 ml-auto text-[11px]">
          <span className="bg-white border rounded-full px-2.5 py-0.5 text-slate-600">
            <span className="font-semibold text-slate-900">{classification.entries.length}</span> lançamentos
          </span>
          {reviewEntries.length > 0 && (
            <span className="bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5 text-amber-700">
              <span className="font-semibold">{reviewEntries.length}</span> para revisão
            </span>
          )}
          <span className="text-slate-400">{fmtDate(classification.classifiedAt)}</span>
        </div>
      </div>

      {/* Category summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-1 h-5 bg-violet-400 rounded-full" />
          <h3 className="text-[13px] font-semibold text-slate-900">Resumo por categoria</h3>
          <span className="ml-auto text-[11px] text-slate-400">{classification.summary.length} categorias</span>
        </div>
        <div className="divide-y divide-slate-50">
          {classification.summary.map((s) => {
            const color = CATEGORY_COLORS[s.category] ?? "#94a3b8";
            const maxVal = classification.summary[0]?.totalValue ?? 1;
            const pct = maxVal > 0 ? (s.totalValue / maxVal) * 100 : 0;
            return (
              <div key={s.category} className="px-6 py-3 flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[12px] text-slate-800 w-52 shrink-0 truncate" title={s.category}>{s.category}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 w-28 text-right">{fmtBRL(s.totalValue)}</span>
                <span className="text-[11px] text-slate-400 w-16 text-right">{s.count} itens</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-400 rounded-full" />
          <h3 className="text-[13px] font-semibold text-slate-900">Lançamentos classificados</h3>
          <span className="ml-auto text-[11px] text-slate-400">
            {showAll ? classification.entries.length : Math.min(50, classification.entries.length)} de {classification.entries.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#", "Texto do lançamento", "Categoria", "Valor", "Confiança", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide ${i === 0 ? "text-center w-10" : i >= 3 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayEntries.map((entry) => {
                const color = CATEGORY_COLORS[entry.category] ?? "#94a3b8";
                return (
                  <tr key={entry.rowIndex} className={`hover:bg-slate-50 transition-colors ${entry.needsReview ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-3 text-center text-slate-400">{entry.rowIndex + 1}</td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <p className="text-slate-700 truncate" title={entry.text}>{entry.text}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={entry.justification}>{entry.justification}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full text-white truncate max-w-[160px]"
                        style={{ backgroundColor: color }}
                        title={entry.category}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                      {entry.value !== null ? fmtBRL(entry.value) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 w-28">
                      <ConfidenceBar value={entry.confidence} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {entry.needsReview && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3" /> Revisar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {classification.entries.length > 50 && (
          <div className="px-6 py-4 border-t border-slate-100 text-center">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showAll
                ? "Mostrar menos"
                : `Ver todos os ${classification.entries.length} lançamentos`}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Document Insight Card ────────────────────────────────────────────────────

function DocumentInsightCard({ insight, error }: { insight?: DocumentInsight; error?: string }) {
  const [showMore, setShowMore] = useState(false);

  if (error) return (
    <div className="bg-red-50 rounded-2xl border border-red-200 p-5 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-[14px] font-bold text-red-900 mb-1">Análise indisponível</p>
        <p className="text-[13px] text-red-700">{error}</p>
      </div>
    </div>
  );

  if (!insight) return null;

  const riskCfg = {
    alto:  { gradient: "from-red-500 to-rose-600",       dot: "🔴", label: "Situação Crítica",   sub: "Ação urgente necessária." },
    médio: { gradient: "from-amber-400 to-orange-500",   dot: "🟡", label: "Atenção Necessária",  sub: "Monitore de perto." },
    baixo: { gradient: "from-emerald-400 to-teal-500",   dot: "🟢", label: "Tudo Tranquilo",      sub: "Continue monitorando." },
  }[insight.riskLevel] ?? { gradient: "from-slate-400 to-slate-500", dot: "⚪", label: "Analisado", sub: "" };

  const sortedMetrics = [...(insight.keyMetrics ?? [])].sort((a, b) => {
    const o = { crítico: 0, atenção: 1, ok: 2 };
    return (o[a.status as keyof typeof o] ?? 2) - (o[b.status as keyof typeof o] ?? 2);
  });
  const heroMetrics = sortedMetrics.slice(0, 4);
  const extraMetrics = sortedMetrics.slice(4);

  return (
    <div className="space-y-4">

      {/* ── Hero: gradient risk card ─────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${riskCfg.gradient} rounded-2xl p-6 text-white`}>
        <p className="text-white/70 text-[11px] font-semibold uppercase tracking-widest mb-1">
          {insight.documentType}{insight.documentSubtype ? ` · ${insight.documentSubtype}` : ""}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-black leading-tight">
              {riskCfg.dot} {riskCfg.label}
            </p>
            <p className="text-white/80 text-[14px] mt-1">{insight.executiveSummary}</p>
          </div>
          <div className="text-center shrink-0">
            <p className="text-6xl font-black leading-none">{insight.riskScore ?? "—"}</p>
            <p className="text-white/60 text-[10px] mt-1">0 ótimo · 100 crítico</p>
          </div>
        </div>
        <div className="mt-4 bg-white/25 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${insight.riskScore ?? 50}%` }} />
        </div>
      </div>

      {/* ── Immediate actions — only if alto/médio ───────────────────────── */}
      {insight.immediateActions?.length > 0 && insight.riskLevel !== "baixo" && (
        <div className="rounded-2xl overflow-hidden border-2 border-red-200">
          <div className="bg-red-500 px-5 py-2.5 flex items-center gap-2">
            <span>⚡</span>
            <p className="text-[12px] font-black text-white uppercase tracking-wider">Faça isso agora</p>
          </div>
          <div className="bg-white p-4 space-y-3">
            {insight.immediateActions.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-[14px] text-slate-800 font-semibold leading-snug pt-0.5">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key metrics — big numbers ────────────────────────────────────── */}
      {heroMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {heroMetrics.map((m, i) => {
            const bg  = m.status === "crítico" ? "bg-red-50 border-red-300" : m.status === "atenção" ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200";
            const num = m.status === "crítico" ? "text-red-700" : m.status === "atenção" ? "text-amber-700" : "text-slate-900";
            const ic  = m.status === "crítico" ? "🔴" : m.status === "atenção" ? "🟡" : "🟢";
            return (
              <div key={i} className={`rounded-2xl border-2 p-4 ${bg}`}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">{m.label}</p>
                  <span className="text-base">{ic}</span>
                </div>
                <p className={`text-[28px] font-black leading-none ${num}`}>{m.value}</p>
                {m.trend && <p className="text-[10px] text-slate-400 mt-1.5">{m.trend}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Findings + Recommendations side by side ──────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {insight.mainFindings?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <span>🔍</span>
              <p className="text-[13px] font-bold text-slate-800">O que encontramos</p>
            </div>
            <div className="divide-y divide-slate-100">
              {insight.mainFindings.slice(0, 4).map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-[12px] text-slate-700 leading-snug">{f}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {insight.recommendations?.length > 0 && (
          <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50 flex items-center gap-2">
              <span>✅</span>
              <p className="text-[13px] font-bold text-emerald-800">O que fazer</p>
            </div>
            <div className="divide-y divide-slate-100">
              {insight.recommendations.slice(0, 4).map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-slate-700 leading-snug">{r}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Extra metrics row ────────────────────────────────────────────── */}
      {extraMetrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {extraMetrics.map((m, i) => (
            <div key={i} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mb-1">{m.label}</p>
              <p className={`text-[17px] font-black ${m.status === "crítico" ? "text-red-600" : m.status === "atenção" ? "text-amber-600" : "text-slate-800"}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Expand for narrative detail ──────────────────────────────────── */}
      {(insight.financialHealthNarrative || insight.agingDetailedAnalysis || insight.concentrationDetailedAnalysis || insight.deepDiveInsights?.length > 0) && (
        <>
          <button
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[12px] font-semibold text-slate-500 transition-colors"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMore ? "rotate-90" : ""}`} />
            {showMore ? "Ocultar detalhes" : "Ver mais detalhes da análise"}
          </button>

          {showMore && (
            <div className="space-y-4 pt-1">
              {insight.financialHealthNarrative && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">💊 Diagnóstico geral</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{insight.financialHealthNarrative}</p>
                </div>
              )}
              {insight.agingDetailedAnalysis && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">📅 Vencimentos</p>
                  <p className="text-[12px] text-orange-900 leading-relaxed">{insight.agingDetailedAnalysis}</p>
                </div>
              )}
              {insight.concentrationDetailedAnalysis && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">🏢 Dependência</p>
                  <p className="text-[12px] text-blue-900 leading-relaxed">{insight.concentrationDetailedAnalysis}</p>
                </div>
              )}
              {insight.deepDiveInsights?.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">🧠 Insights adicionais</p>
                  <div className="space-y-2">
                    {insight.deepDiveInsights.map((d, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-slate-300 leading-relaxed">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Messy data notice — only shown in detail, not at top */}
              {insight.dataQuality === "ruim" && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-800">
                    <span className="font-bold">Dados incompletos: </span>{insight.dataQualityReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "O que eu devo fazer primeiro?",
  "Para onde está indo o meu dinheiro?",
  "Tem alguma coisa estranha ou errada nesses dados?",
  "Quem me deve mais dinheiro?",
  "Estou no lucro ou no prejuízo?",
];

function ChatPanel({ analysis }: { analysis: FileAnalysis }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        role:      "user",
        content:   trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);
      scrollBottom();

      try {
        const history = messages.map(({ role, content }) => ({ role, content }));
        const res = await fetch("/api/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message: trimmed, analysis, history }),
        });

        const data = await res.json() as { reply?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? `Erro ${res.status}`);

        setMessages((prev) => [
          ...prev,
          {
            role:      "assistant",
            content:   data.reply ?? "",
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao contatar a API.");
      } finally {
        setLoading(false);
        scrollBottom();
        inputRef.current?.focus();
      }
    },
    [loading, messages, analysis, scrollBottom]
  );

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-violet-50/50 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <Bot className="w-4.5 h-4.5 text-violet-600" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-0.5">
            Assistente Financeiro · Anthropic API
          </p>
          <p className="text-[14px] font-semibold text-slate-900 leading-tight truncate">
            Perguntas sobre: {analysis.fileName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-500 hidden sm:block">
            {analysis.insight ? "Contexto carregado" : "Metadados disponíveis"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-[240px] max-h-[500px] overflow-y-auto p-5 space-y-4 scroll-smooth">

        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="space-y-4">
            {/* Welcome bubble */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-sm px-4 py-3 max-w-[82%]">
                <p className="text-[13px] text-slate-700 leading-relaxed">
                  Olá! Analisei o arquivo{" "}
                  <span className="font-semibold text-slate-900">
                    {analysis.fileName}
                  </span>
                  {analysis.insight ? (
                    <> e tenho o contexto completo carregado. Faça qualquer pergunta sobre o documento.</>
                  ) : (
                    <> e tenho os metadados disponíveis. Posso responder com base na estrutura detectada.</>
                  )}
                </p>
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="ml-10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                Sugestões de perguntas
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={loading}
                    className="text-[11px] font-medium bg-violet-50 hover:bg-violet-100 active:scale-95 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-full transition-all text-left disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message history */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "user" ? "bg-violet-600" : "bg-violet-100"
              }`}
            >
              {msg.role === "user" ? (
                <span className="text-[9px] font-bold text-white">EU</span>
              ) : (
                <Bot className="w-3.5 h-3.5 text-violet-600" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-xl text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-tr-sm"
                  : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-sm"
              }`}
            >
              {/* Preserve line breaks and bullet points */}
              {msg.content.split("\n").map((line, li, arr) => (
                <span key={li}>
                  {line}
                  {li < arr.length - 1 && <br />}
                </span>
              ))}
              <p className={`text-[10px] mt-2 ${msg.role === "user" ? "text-violet-300" : "text-slate-400"}`}>
                {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Faça uma pergunta sobre o documento analisado..."
          disabled={loading}
          className="flex-1 text-[13px] bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all placeholder:text-slate-400 disabled:opacity-60"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          aria-label="Enviar pergunta"
          className="w-10 h-10 bg-violet-600 hover:bg-violet-700 active:scale-95 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── File Analysis Panel ──────────────────────────────────────────────────────

function FileAnalysisPanel({ analysis }: { analysis: FileAnalysis }) {
  const numCols  = analysis.columns.filter((c) => c.type === "numeric");
  const textCols = analysis.columns.filter((c) => c.type === "text");
  const emptyCols= analysis.columns.filter((c) => c.type === "empty");
  const headers  = analysis.preview.length > 0 ? Object.keys(analysis.preview[0]) : [];

  return (
    <div className="p-8 space-y-7 pb-16">

      {/* Document-level AI insight */}
      {(analysis.insight || analysis.insightError) && (
        <DocumentInsightCard
          insight={analysis.insight}
          error={analysis.insightError}
        />
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Linhas de dados",    value: analysis.rowCount.toLocaleString("pt-BR"), icon: Table2,          accent: "text-blue-500"   },
          { label: "Colunas encontradas",value: analysis.columnCount,                       icon: Hash,            accent: "text-violet-500" },
          { label: "Colunas numéricas",  value: numCols.length,                             icon: TrendingUp,      accent: "text-emerald-500"},
          { label: "Colunas de texto",   value: textCols.length,                            icon: Type,            accent: "text-amber-500"  },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-slate-500 leading-tight">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.accent}`} />
            </div>
            <p className="text-[28px] font-bold text-slate-900 leading-none">{kpi.value}</p>
            {emptyCols.length > 0 && kpi.label === "Colunas encontradas" && (
              <p className="text-[11px] text-amber-600 mt-1">{emptyCols.length} vazia(s)</p>
            )}
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="text-[13px] font-semibold text-slate-900">Alertas e observações</h3>
          <span className="ml-auto text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {analysis.alerts.filter((a) => a.type === "warning").length} atenção
          </span>
        </div>
        <div className="space-y-3">
          {analysis.alerts.map((alert, i) => {
            const s = fileAlertStyle(alert.type);
            return (
              <div key={i} className={`p-4 rounded-xl border-l-4 flex items-start gap-3 ${s.bg}`}>
                {s.icon}
                <p className={`text-[13px] leading-relaxed ${s.desc}`}>{alert.message}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview table */}
      {analysis.preview.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-[13px] font-semibold text-slate-900">Prévia dos dados</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Primeiras {analysis.preview.length} linhas de {analysis.rowCount.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analysis.preview.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-50 transition-colors">
                    {headers.map((h) => (
                      <td key={h} className="px-4 py-3 text-slate-700 whitespace-nowrap max-w-[200px] truncate" title={row[h]}>
                        {row[h] || <span className="text-slate-300 italic">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Column statistics */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[13px] font-semibold text-slate-900">Estatísticas por coluna</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{analysis.columnCount} colunas identificadas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Coluna", "Tipo", "Ausentes", "Únicos", "Estatísticas"].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide ${i === 0 ? "text-left" : i < 3 ? "text-center" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {analysis.columns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-medium text-slate-900 max-w-[160px] truncate" title={col.name}>{col.name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      col.type === "numeric" ? "bg-blue-100 text-blue-700"
                      : col.type === "text"  ? "bg-violet-100 text-violet-700"
                      : "bg-slate-100 text-slate-500"
                    }`}>
                      {col.type === "numeric" ? <Hash className="w-3 h-3" /> : col.type === "text" ? <Type className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {col.type === "numeric" ? "Numérico" : col.type === "text" ? "Texto" : "Vazio"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-[12px] font-medium ${col.nullCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {col.nullCount}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-[12px] text-slate-600">
                    {col.uniqueCount}
                  </td>
                  <td className="px-5 py-3.5">
                    {col.type === "numeric" && col.sum !== undefined && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                        <span><span className="text-slate-400">Soma</span> <span className="font-semibold text-slate-800">{fmtBRL(col.sum)}</span></span>
                        <span><span className="text-slate-400">Média</span> <span className="font-semibold text-slate-800">{fmtBRL(col.avg!)}</span></span>
                        <span><span className="text-slate-400">Mín</span> <span className="font-semibold text-slate-800">{fmtBRL(col.min!)}</span></span>
                        <span><span className="text-slate-400">Máx</span> <span className="font-semibold text-slate-800">{fmtBRL(col.max!)}</span></span>
                      </div>
                    )}
                    {col.type === "text" && col.topValues && (
                      <div className="flex flex-wrap gap-1">
                        {col.topValues.slice(0, 3).map((tv) => (
                          <span key={tv.value} className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full max-w-[120px] truncate" title={tv.value}>
                            {tv.value} <span className="text-slate-400">×{tv.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {col.type === "empty" && (
                      <span className="text-[11px] text-slate-400 italic">Sem dados</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grouping chart */}
      {analysis.groups.length > 0 && (() => {
        const g = analysis.groups[0];
        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[13px] font-semibold text-slate-900 mb-0.5">
              Agrupamento: {g.groupColumn}
            </h3>
            <p className="text-[11px] text-slate-500 mb-5">
              Soma de <span className="font-medium">{g.valueColumn}</span> por categoria · Top {g.groups.length}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(180, g.groups.length * 36)}>
              <BarChart
                data={g.groups}
                layout="vertical"
                barCategoryGap="30%"
                margin={{ left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [typeof v === "number" ? fmtBRL(v) : v, g.valueColumn]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {g.groups.map((_, i) => (
                    <Cell key={i} fill={GROUP_COLORS[i % GROUP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Classification results */}
      {analysis.classification ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-1 h-5 bg-violet-400 rounded-full" />
            <h3 className="text-[13px] font-semibold text-slate-900">Classificação inteligente</h3>
          </div>
          <div className="p-6">
            <ClassificationPanel classification={analysis.classification} />
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-8 text-center">
          <p className="text-[13px] text-slate-400">Classificação não disponível para este arquivo.</p>
        </div>
      )}

      {/* ── AI Chat ─────────────────────────────────────────────────────────── */}
      <ChatPanel analysis={analysis} />

    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ResultadosPage() {
  const [fileAnalyses, setFileAnalyses] = useState<FileAnalysis[]>([]);
  const [selected, setSelected]         = useState<ListItem | null>(null);
  const [search, setSearch]             = useState("");

  // Load file analyses from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("fa_analyses");
      if (raw) {
        const parsed: FileAnalysis[] = JSON.parse(raw);
        setFileAnalyses(parsed);
        if (parsed.length > 0) {
          setSelected({ kind: "file", data: parsed[0] });
          return;
        }
      }
    } catch {
      // ignore parse errors
    }
    setSelected({ kind: "mock", data: MOCK_ANALYSES[0] });
  }, []);

  // Build unified list: file analyses first; mocks only when no real files exist
  const allItems: ListItem[] = [
    ...fileAnalyses.map((fa): ListItem => ({ kind: "file", data: fa })),
    ...(fileAnalyses.length === 0
      ? MOCK_ANALYSES.map((ma): ListItem => ({ kind: "mock", data: ma }))
      : []),
  ];

  const filtered = allItems.filter((item) => {
    const q = search.toLowerCase();
    if (item.kind === "file") {
      return item.data.fileName.toLowerCase().includes(q);
    }
    return item.data.name.toLowerCase().includes(q) || item.data.type.toLowerCase().includes(q);
  });

  const isSelected = (item: ListItem) => {
    if (!selected) return false;
    if (item.kind !== selected.kind) return false;
    return item.data.id === selected.data.id;
  };

  if (!selected) return null;

  // ── Render mock analysis details ──────────────────────────────────────────

  const renderMockDetail = (mock: MockAnalysis) => {
    const { liquidez, rentabilidade, endividamento, margem } = mock.indicators;
    return (
      <div className="p-8 space-y-7 pb-16">

        {/* KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Liquidez Corrente",   value: `${liquidez.toFixed(2)}x`,      positive: liquidez >= 1.5,      meta: "Meta ≥ 1,50x",  icon: BarChart2   },
            { label: "Rentabilidade (ROE)",  value: `${rentabilidade.toFixed(1)}%`, positive: rentabilidade >= 12,  meta: "Meta ≥ 12,0%",  icon: TrendingUp  },
            { label: "Endividamento Geral",  value: `${endividamento.toFixed(1)}%`, positive: endividamento < 50,   meta: "Limite < 50,0%",icon: TrendingDown },
            { label: "Margem EBITDA",        value: `${margem.toFixed(1)}%`,        positive: margem >= 35,         meta: "Meta ≥ 35,0%",  icon: BarChart2   },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-slate-500 leading-tight">{kpi.label}</p>
                <kpi.icon className={`w-4 h-4 ${kpi.positive ? "text-emerald-500" : "text-red-400"}`} />
              </div>
              <p className="text-[22px] font-bold text-slate-900 leading-none mb-1">{kpi.value}</p>
              <div className={`flex items-center gap-1 text-[11px] font-medium ${kpi.positive ? "text-emerald-600" : "text-red-500"}`}>
                {kpi.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.positive ? "Dentro da meta" : "Abaixo da meta"}
                <span className="text-slate-400 font-normal ml-1">· {kpi.meta}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo executivo */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            <h3 className="text-[13px] font-semibold text-slate-900">Resumo Executivo</h3>
          </div>
          <p className="text-[13px] text-slate-600 leading-relaxed">{mock.resumo}</p>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[13px] font-semibold text-slate-900 mb-0.5">Composição das Despesas</h3>
            <p className="text-[11px] text-slate-500 mb-4">{mock.period}</p>
            <ResponsiveContainer width="100%" height={175}>
              <PieChart>
                <Pie data={mock.despesas} dataKey="percentual" nameKey="categoria" cx="50%" cy="50%" innerRadius={46} outerRadius={74} paddingAngle={3}>
                  {mock.despesas.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {mock.despesas.map((d, i) => (
                <div key={d.categoria} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i] }} />
                    <span className="text-[11px] text-slate-600 truncate max-w-[140px]">{d.categoria}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800">{d.percentual.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[13px] font-semibold text-slate-900 mb-0.5">Score de Saúde Financeira</h3>
            <p className="text-[11px] text-slate-500 mb-2">Escala 0–100 · benchmark setorial</p>
            <ResponsiveContainer width="100%" height={225}>
              <RadarChart data={mock.radar} cx="50%" cy="50%" outerRadius={78}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
                <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.18} strokeWidth={2} />
                <Tooltip formatter={(v) => [`${v}/100`, "Score"]} contentStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-[13px] font-semibold text-slate-900">Classificação Detalhada de Despesas</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Valores em R$ · variação vs. período anterior</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Categoria", "Valor (R$)", "Participação", "Variação"].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mock.despesas.map((d, i) => (
                  <tr key={d.categoria} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i] }} />
                        <span className="text-[13px] font-medium text-slate-900">{d.categoria}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right text-[13px] text-slate-700 font-medium tabular-nums">
                      {d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-1 rounded-full" style={{ width: `${d.percentual}%`, backgroundColor: EXPENSE_COLORS[i] }} />
                        </div>
                        <span className="text-[12px] text-slate-600 w-9 text-right tabular-nums">{d.percentual.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${d.variacao > 5 ? "text-red-600" : d.variacao < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {d.variacao > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {d.variacao > 0 ? "+" : ""}{d.variacao.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-6 py-3 text-[13px] font-bold text-slate-900">Total</td>
                  <td className="px-6 py-3 text-right text-[13px] font-bold text-slate-900 tabular-nums">
                    {mock.despesas.reduce((s, d) => s + d.valor, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-6 py-3 text-right text-[13px] font-bold text-slate-900">100%</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Benchmark */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-[13px] font-semibold text-slate-900 mb-0.5">Indicadores vs. Benchmark Setorial</h3>
          <p className="text-[11px] text-slate-500 mb-5">Valores normalizados para fins comparativos</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart
              data={[
                { name: "Liquidez",      resultado: liquidez * 40,     benchmark: 60 },
                { name: "Rentabilidade", resultado: rentabilidade * 4,  benchmark: 50 },
                { name: "Margem EBITDA", resultado: margem * 1.4,       benchmark: 55 },
              ]}
              layout="vertical"
              barCategoryGap="35%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [`${Number(v).toFixed(1)}`, n === "resultado" ? "Resultado" : "Benchmark"]} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="resultado" name="resultado" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="benchmark" name="benchmark" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-blue-500 rounded inline-block" /> Resultado</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-slate-200 rounded inline-block" /> Benchmark</span>
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-5 bg-amber-400 rounded-full" />
            <h3 className="text-[13px] font-semibold text-slate-900">Alertas e Recomendações</h3>
            <span className="ml-auto text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {mock.alertas.filter((a) => a.type === "critical" || a.type === "warning").length} atenção
            </span>
          </div>
          <div className="space-y-3">
            {mock.alertas.map((alert) => {
              const s = alertStyle(alert.type);
              return (
                <div key={alert.title} className={`p-4 rounded-xl border-l-4 flex items-start gap-3 ${s.bg}`}>
                  {s.icon}
                  <div>
                    <p className={`text-[13px] font-semibold mb-0.5 ${s.title}`}>{alert.title}</p>
                    <p className={`text-[12px] leading-relaxed ${s.desc}`}>{alert.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="Resultados das Análises" subtitle="Relatórios financeiros, indicadores e recomendações" />

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — list */}
        <div className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">

          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar análise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Filter className="w-3 h-3" />
              {filtered.length} análise(s)
              {fileAnalyses.length > 0 && (
                <span className="ml-auto bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full text-[10px]">
                  {fileAnalyses.length} novo(s)
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-50">
            {filtered.map((item) => {
              const active = isSelected(item);
              if (item.kind === "file") {
                const fa = item.data;
                return (
                  <button
                    key={fa.id}
                    onClick={() => setSelected(item)}
                    className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${active ? "bg-blue-50 border-r-2 border-blue-600" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${active ? "bg-blue-100" : "bg-slate-100"}`}>
                        <FileSpreadsheet className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-[13px] font-medium text-slate-900 truncate leading-snug flex-1">{fa.fileName}</p>
                          <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full shrink-0">NOVO</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{fa.rowCount.toLocaleString("pt-BR")} linhas · {fa.columnCount} colunas</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {fmtDate(fa.uploadedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }

              const ma = item.data;
              return (
                <button
                  key={ma.id}
                  onClick={() => setSelected(item)}
                  className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${active ? "bg-blue-50 border-r-2 border-blue-600" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${active ? "bg-blue-100" : "bg-slate-100"}`}>
                      <FileText className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate leading-snug">{ma.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ma.period}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {statusIcon(ma.status)}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(ma.status)}`}>
                          {ma.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-100">
            <Link
              href="/upload"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              Nova análise
            </Link>
          </div>
        </div>

        {/* Right panel — detail */}
        <div className="flex-1 overflow-y-auto bg-slate-50 scrollbar-thin">

          {/* Sticky subheader */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                <span>Resultados</span>
                <ChevronRight className="w-3 h-3" />
                <span className="font-medium text-slate-700">
                  {selected.kind === "file" ? "Arquivo" : selected.data.type}
                </span>
              </div>
              <h2 className="text-[15px] font-bold text-slate-900 leading-tight truncate">
                {selected.kind === "file" ? selected.data.fileName : selected.data.name}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selected.kind === "file"
                  ? `${selected.data.rowCount.toLocaleString("pt-BR")} linhas · ${selected.data.columnCount} colunas · enviado em ${fmtDate(selected.data.uploadedAt)}`
                  : `Período: ${selected.data.period} · Gerado em ${selected.data.date}`}
              </p>
            </div>
            <button className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-3.5 py-2 rounded-lg text-[13px] transition-colors shrink-0 ml-4">
              <Download className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
          </div>

          {selected.kind === "file"
            ? <FileAnalysisPanel analysis={selected.data} />
            : renderMockDetail(selected.data)
          }

        </div>
      </div>
    </div>
  );
}
