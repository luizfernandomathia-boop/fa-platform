"use client";

import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  CheckCircle,
  Info,
  AlertCircle,
} from "lucide-react";
import Header from "@/components/Header";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Dados fictícios ──────────────────────────────────────────────────────────

const revenueData = [
  { month: "Ago/25", receita: 420000, despesas: 310000, lucro: 110000 },
  { month: "Set/25", receita: 380000, despesas: 290000, lucro: 90000 },
  { month: "Out/25", receita: 510000, despesas: 340000, lucro: 170000 },
  { month: "Nov/25", receita: 490000, despesas: 360000, lucro: 130000 },
  { month: "Dez/25", receita: 630000, despesas: 380000, lucro: 250000 },
  { month: "Jan/26", receita: 580000, despesas: 410000, lucro: 170000 },
  { month: "Fev/26", receita: 720000, despesas: 430000, lucro: 290000 },
];

const expenseData = [
  { name: "Pessoal e Encargos",     value: 45 },
  { name: "Custos Operacionais",    value: 25 },
  { name: "Despesas Financeiras",   value: 15 },
  { name: "Administrativo e Geral", value: 15 },
];

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

const kpis = [
  {
    title:    "Receita Bruta",
    value:    "R$ 720.400",
    detail:   "Fevereiro 2026",
    change:   "+12,4%",
    positive: true,
    icon:     DollarSign,
    accent:   "border-blue-500",
    iconBg:   "text-blue-600 bg-blue-50",
  },
  {
    title:    "Lucro Líquido",
    value:    "R$ 290.160",
    detail:   "Margem de 40,2%",
    change:   "+8,1%",
    positive: true,
    icon:     TrendingUp,
    accent:   "border-emerald-500",
    iconBg:   "text-emerald-600 bg-emerald-50",
  },
  {
    title:    "Despesas Totais",
    value:    "R$ 430.240",
    detail:   "59,7% da receita",
    change:   "+4,7%",
    positive: false,
    icon:     TrendingDown,
    accent:   "border-orange-500",
    iconBg:   "text-orange-600 bg-orange-50",
  },
  {
    title:    "Margem EBITDA",
    value:    "40,2%",
    detail:   "+2,3 p.p. vs. Jan/26",
    change:   "+2,3 p.p.",
    positive: true,
    icon:     BarChart3,
    accent:   "border-violet-500",
    iconBg:   "text-violet-600 bg-violet-50",
  },
];

const recentAnalyses = [
  { name: "DRE Trimestral Q1 2026",         type: "DRE",           date: "27/03/2026", status: "Concluído",  statusColor: "bg-emerald-100 text-emerald-700" },
  { name: "Balanço Patrimonial Jan/26",      type: "Balanço",       date: "25/03/2026", status: "Concluído",  statusColor: "bg-emerald-100 text-emerald-700" },
  { name: "Fluxo de Caixa Fev/26",          type: "Fluxo de Caixa",date: "22/03/2026", status: "Em análise", statusColor: "bg-yellow-100 text-yellow-700" },
  { name: "Análise de Endividamento Q4/25", type: "Indicadores",   date: "20/03/2026", status: "Concluído",  statusColor: "bg-emerald-100 text-emerald-700" },
  { name: "DRE Anual 2025",                 type: "DRE",           date: "15/03/2026", status: "Revisão",    statusColor: "bg-blue-100 text-blue-700" },
];

const alerts = [
  { type: "warning",  icon: AlertTriangle, text: "Despesas com pessoal cresceram 18,2% — acima da receita (+12,4%)" },
  { type: "critical", icon: AlertCircle,   text: "Endividamento Q4/25 ultrapassou 50%. Revisão do plano recomendada." },
  { type: "info",     icon: Info,          text: "Fluxo de Caixa Fev/26 em análise — dados parciais disponíveis." },
  { type: "ok",       icon: CheckCircle,   text: "DRE Q1 2026 concluído. Margem EBITDA acima da meta de 35%." },
];

const alertColors = {
  warning:  { bg: "bg-amber-50",   text: "text-amber-800",   icon: "text-amber-500"  },
  critical: { bg: "bg-red-50",     text: "text-red-800",     icon: "text-red-500"    },
  info:     { bg: "bg-blue-50",    text: "text-blue-800",    icon: "text-blue-500"   },
  ok:       { bg: "bg-emerald-50", text: "text-emerald-800", icon: "text-emerald-500"},
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Dashboard Financeiro"
        subtitle="Consolidado · Fevereiro 2026 · Empresa Demonstração S.A."
      />

      {/* Barra de contexto / ações rápidas */}
      <div className="bg-white border-b border-slate-200 px-8 py-2.5 flex items-center gap-3">
        <Link
          href="/upload"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          Enviar demonstrativo
        </Link>
        <Link
          href="/resultados"
          className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Ver resultados
        </Link>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          Atualizado em 27/03/2026 às 14:32
        </div>
      </div>

      <div className="flex-1 p-8 space-y-7">

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {kpis.map((kpi) => (
            <div
              key={kpi.title}
              className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
            >
              {/* Accent border top */}
              <div className={`h-[3px] ${kpi.accent} w-full`} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{kpi.title}</p>
                  <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                    <kpi.icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[22px] font-bold text-slate-900 leading-none mb-1">{kpi.value}</p>
                <p className="text-[11px] text-slate-400 mb-3">{kpi.detail}</p>
                <div className={`flex items-center gap-1 text-[11px] font-semibold ${kpi.positive ? "text-emerald-600" : "text-red-500"}`}>
                  {kpi.positive
                    ? <ArrowUpRight className="w-3.5 h-3.5" />
                    : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {kpi.change} vs. mês anterior
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Área */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">Evolução Financeira</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Receita, despesas e lucro · Ago/25 – Fev/26</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] bg-blue-500 inline-block rounded" /> Receita
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] bg-amber-500 inline-block rounded" /> Despesas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] bg-emerald-500 inline-block rounded" /> Lucro
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLucro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  width={56}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.06)" }}
                  formatter={(value) => [
                    typeof value === "number"
                      ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : String(value),
                    "",
                  ]}
                />
                <Area type="monotone" dataKey="receita"  name="Receita"  stroke="#3b82f6" strokeWidth={2} fill="url(#gReceita)" />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#f59e0b" strokeWidth={2} fill="url(#gDespesas)" />
                <Area type="monotone" dataKey="lucro"    name="Lucro"    stroke="#10b981" strokeWidth={2} fill="url(#gLucro)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pizza */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[13px] font-semibold text-slate-900">Composição das Despesas</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-4">Por categoria · Fev/26</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {expenseData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, ""]} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {expenseData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index] }} />
                    <span className="text-[11px] text-slate-600 truncate max-w-[130px]">{item.name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Linha inferior */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Análises recentes */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">Análises Recentes</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Últimos processamentos</p>
              </div>
              <Link href="/resultados" className="text-[12px] text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Ver todas →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentAnalyses.map((item) => (
                <Link
                  key={item.name}
                  href="/resultados"
                  className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">{item.type} · {item.date}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${item.statusColor}`}>
                    {item.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Alertas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-slate-900">Alertas Ativos</h3>
              <span className="text-[11px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                {alerts.filter((a) => a.type === "warning" || a.type === "critical").length} pendentes
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {alerts.map((alert) => {
                const c = alertColors[alert.type as keyof typeof alertColors];
                return (
                  <div
                    key={alert.text}
                    className={`p-3 rounded-lg flex items-start gap-2.5 ${c.bg}`}
                  >
                    <alert.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${c.icon}`} />
                    <p className={`text-[11px] leading-relaxed ${c.text}`}>{alert.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
