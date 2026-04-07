"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, BarChart3, Home, Building2,
  Users, BookOpen, FolderOpen, Briefcase, PiggyBank,
  AlertCircle, CheckCircle, ChevronRight, Plus, Upload,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  LayoutDashboard, X, Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types/project";
import type { FileAnalysis, DocumentInsight } from "@/types/analysis";
import { PROJECT_TYPE_LABELS, COLOR_CLASSES } from "@/types/project";

// ─── Icons & helpers ──────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Building2, Users, BookOpen, FolderOpen, Briefcase, PiggyBank, BarChart3, FileText,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number) {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `R$ ${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Consolidated dashboard computation ───────────────────────────────────────

interface ConsolidatedData {
  totalFiles: number;
  analyzedFiles: number;
  riskCounts: { alto: number; médio: number; baixo: number };
  avgRiskScore: number;
  dominantRisk: "alto" | "médio" | "baixo";
  allImmediateActions: string[];
  topMetrics: { label: string; value: string; status?: string; trend?: string; source: string }[];
  allAlerts: string[];
  documentTypes: string[];
  totalRowsAnalyzed: number;
}

function consolidate(analyses: FileAnalysis[]): ConsolidatedData {
  const withInsight = analyses.filter(a => a.insight);
  const riskCounts = { alto: 0, médio: 0, baixo: 0 };
  let scoreSum = 0;
  const allActions: string[]    = [];
  const allMetrics: ConsolidatedData["topMetrics"] = [];
  const allAlerts: string[]     = [];
  const docTypes: string[]      = [];
  let totalRows = 0;

  for (const a of analyses) {
    totalRows += a.rowCount ?? 0;
    if (!a.insight) continue;
    const ins = a.insight;

    // Risk counts
    if (ins.riskLevel === "alto")  riskCounts.alto++;
    else if (ins.riskLevel === "médio") riskCounts.médio++;
    else riskCounts.baixo++;
    scoreSum += ins.riskScore ?? (ins.riskLevel === "alto" ? 80 : ins.riskLevel === "médio" ? 50 : 20);

    // Immediate actions (top 2 per file)
    ins.immediateActions?.slice(0, 2).forEach(ac => {
      if (!allActions.includes(ac)) allActions.push(ac);
    });

    // Metrics (critical/atenção first, top 2 per file)
    const sorted = [...(ins.keyMetrics ?? [])].sort((a, b) => {
      const o = { crítico: 0, atenção: 1, ok: 2 };
      return (o[a.status as keyof typeof o] ?? 2) - (o[b.status as keyof typeof o] ?? 2);
    });
    sorted.slice(0, 3).forEach(m => {
      allMetrics.push({ ...m, source: a.fileName });
    });

    // Alerts (structural)
    ins.structuralAlerts?.slice(0, 2).forEach(al => {
      if (!allAlerts.includes(al)) allAlerts.push(al);
    });

    // Doc types
    if (ins.documentType && !docTypes.includes(ins.documentType)) docTypes.push(ins.documentType);
  }

  const avgScore = withInsight.length > 0 ? Math.round(scoreSum / withInsight.length) : 0;
  const dominant: "alto" | "médio" | "baixo" = riskCounts.alto > 0 ? "alto"
    : riskCounts.médio > 0 ? "médio" : "baixo";

  // Keep only the most critical unique metrics (max 8)
  const seen = new Set<string>();
  const dedupedMetrics = allMetrics.filter(m => {
    if (seen.has(m.label)) return false;
    seen.add(m.label);
    return true;
  }).slice(0, 8);

  return {
    totalFiles: analyses.length,
    analyzedFiles: withInsight.length,
    riskCounts,
    avgRiskScore: avgScore,
    dominantRisk: dominant,
    allImmediateActions: allActions.slice(0, 5),
    topMetrics: dedupedMetrics,
    allAlerts: allAlerts.slice(0, 6),
    documentTypes: docTypes,
    totalRowsAnalyzed: totalRows,
  };
}

// ─── Project Dashboard (consolidated) ────────────────────────────────────────

function ProjectDashboard({ analyses, project }: { analyses: FileAnalysis[]; project: Project }) {
  const data = useMemo(() => consolidate(analyses), [analyses]);
  const colors = COLOR_CLASSES[project.color];

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
        <div className={`w-20 h-20 rounded-3xl ${colors.bg} flex items-center justify-center mb-6`}>
          <Upload className={`w-10 h-10 ${colors.text}`} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Comece enviando um arquivo</h2>
        <p className="text-slate-500 text-[15px] mb-8 max-w-md leading-relaxed">
          Envie planilhas, PDFs ou CSVs e a IA vai gerar automaticamente um dashboard consolidado com os dados mais importantes do projeto.
        </p>
        <Link
          href={`/upload?project=${project.id}`}
          className="flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3.5 rounded-2xl text-[15px] transition-all shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          Upload de arquivo
        </Link>
      </div>
    );
  }

  const riskConfig = {
    alto:  { gradient: "from-red-500 to-rose-600",     dot: "🔴", label: "Atenção Urgente",    sub: "Este projeto tem situações críticas que precisam de ação imediata." },
    médio: { gradient: "from-amber-400 to-orange-500", dot: "🟡", label: "Atenção Moderada",   sub: "Existem pontos importantes que merecem acompanhamento próximo." },
    baixo: { gradient: "from-emerald-400 to-teal-500", dot: "🟢", label: "Projeto Saudável",   sub: "Os dados estão em boa ordem. Continue monitorando regularmente." },
  }[data.dominantRisk];

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto pb-16">

      {/* ── Hero: Project health card ─────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${riskConfig.gradient} rounded-3xl p-8 text-white shadow-xl`}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-white/70 text-[12px] font-semibold uppercase tracking-widest mb-2">
              Visão geral do projeto
            </p>
            <h1 className="text-3xl font-black leading-tight mb-1">
              {riskConfig.dot} {riskConfig.label}
            </h1>
            <p className="text-white/80 text-[15px]">{riskConfig.sub}</p>
            {data.documentTypes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {data.documentTypes.map((t, i) => (
                  <span key={i} className="text-[11px] font-semibold bg-white/20 px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Risk score + file stats */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-center">
              <p className="text-7xl font-black leading-none">{data.avgRiskScore}</p>
              <p className="text-white/70 text-[11px] mt-1 font-medium">risco médio<br/>(0 ótimo · 100 crítico)</p>
            </div>
            <div className="space-y-3">
              <div className="bg-white/20 rounded-2xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-black">{data.totalFiles}</p>
                <p className="text-white/70 text-[10px] font-medium">arquivo{data.totalFiles !== 1 ? "s" : ""}</p>
              </div>
              <div className="bg-white/20 rounded-2xl px-4 py-3 text-center">
                <p className="text-2xl font-black">{data.totalRowsAnalyzed.toLocaleString("pt-BR")}</p>
                <p className="text-white/70 text-[10px] font-medium">linhas analisadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk score bar */}
        <div className="mt-6 bg-white/20 rounded-full h-3 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${data.avgRiskScore}%` }} />
        </div>
      </div>

      {/* ── Risk distribution ────────────────────────────────────────────── */}
      {data.analyzedFiles > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">📂 Situação dos arquivos</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "alto",  label: "Crítico",   count: data.riskCounts.alto,  bg: "bg-red-50 border-red-200",     num: "text-red-600",     dot: "🔴" },
              { key: "médio", label: "Atenção",   count: data.riskCounts.médio, bg: "bg-amber-50 border-amber-200", num: "text-amber-600",   dot: "🟡" },
              { key: "baixo", label: "Tranquilo", count: data.riskCounts.baixo, bg: "bg-emerald-50 border-emerald-100", num: "text-emerald-600", dot: "🟢" },
            ].map(r => (
              <div key={r.key} className={`rounded-2xl border-2 p-5 ${r.bg}`}>
                <div className="text-2xl mb-2">{r.dot}</div>
                <p className={`text-5xl font-black leading-none ${r.num}`}>{r.count}</p>
                <p className="text-[12px] text-slate-600 font-semibold mt-1">{r.label}</p>
                <p className="text-[10px] text-slate-400">arquivo{r.count !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Immediate actions ─────────────────────────────────────────────── */}
      {data.allImmediateActions.length > 0 && (
        <div className="rounded-3xl border-2 border-red-200 overflow-hidden bg-white">
          <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-[13px] font-black text-white uppercase tracking-wide">Ações urgentes</p>
              <p className="text-[11px] text-red-100">O que precisa ser feito agora, neste projeto</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {data.allImmediateActions.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-red-500 text-white text-[13px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-[14px] text-slate-800 font-semibold leading-snug pt-0.5">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key metrics ───────────────────────────────────────────────────── */}
      {data.topMetrics.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">📊 Números que importam</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.topMetrics.map((m, i) => {
              const cardBg  = m.status === "crítico" ? "bg-red-50 border-red-300"    : m.status === "atenção" ? "bg-amber-50 border-amber-300"    : "bg-white border-slate-200";
              const numColor = m.status === "crítico" ? "text-red-700"               : m.status === "atenção" ? "text-amber-700"                  : "text-slate-900";
              const icon    = m.status === "crítico" ? "🔴"                          : m.status === "atenção" ? "🟡"                              : "🟢";
              const TrendIcon = m.trend?.toLowerCase().includes("alta") ? TrendingUp
                : m.trend?.toLowerCase().includes("baixa") ? TrendingDown : Minus;
              const trendColor = m.trend?.toLowerCase().includes("alta") ? "text-red-400"
                : m.trend?.toLowerCase().includes("baixa") ? "text-emerald-400" : "text-slate-300";

              return (
                <div key={i} className={`rounded-2xl border-2 p-5 ${cardBg}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-tight flex-1">{m.label}</p>
                    <span className="text-sm">{icon}</span>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <p className={`text-2xl font-black leading-none ${numColor}`}>{m.value}</p>
                    <TrendIcon className={`w-4 h-4 mb-0.5 ${trendColor}`} />
                  </div>
                  {m.trend && <p className="text-[10px] text-slate-400 mt-1 truncate">{m.trend}</p>}
                  <p className="text-[9px] text-slate-300 mt-2 truncate">{m.source}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Alerts across all files ───────────────────────────────────────── */}
      {data.allAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-4">⚠️ Problemas identificados nos arquivos</p>
          <div className="space-y-2">
            {data.allAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-amber-900">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Files list mini ───────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
          📁 Arquivos do projeto ({analyses.length})
        </p>
        <div className="space-y-2">
          {analyses.map((a) => {
            const risk    = a.insight?.riskLevel;
            const riskDot = risk === "alto" ? "bg-red-500" : risk === "médio" ? "bg-amber-400" : "bg-emerald-500";
            const riskBg  = risk === "alto" ? "bg-red-50 border-red-200" : risk === "médio" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200";
            return (
              <div key={a.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${riskBg}`}>
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{a.fileName}</p>
                  <p className="text-[11px] text-slate-400">
                    {a.insight?.documentType ?? "Sem análise IA"} · {fmtDate(a.uploadedAt)}
                    {a.rowCount > 0 && ` · ${a.rowCount.toLocaleString("pt-BR")} linhas`}
                  </p>
                </div>
                {risk && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${riskDot}`} />
                    <span className="text-[11px] font-semibold text-slate-600 capitalize">{risk}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ─── Individual file analysis view ────────────────────────────────────────────

function IndividualAnalysis({ analysis, onBack }: { analysis: FileAnalysis; onBack: () => void }) {
  const ins = analysis.insight;
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto pb-16">
      {/* Back + file header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard do projeto
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-[12px] text-slate-600 font-medium truncate">{analysis.fileName}</span>
      </div>

      {!ins ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold mb-1">{analysis.fileName}</p>
          {analysis.insightError
            ? <p className="text-[13px] text-red-600">{analysis.insightError}</p>
            : <p className="text-[13px] text-slate-400">Análise de IA não disponível para este arquivo.</p>
          }
        </div>
      ) : (
        <div className="space-y-6">
          {/* Risk + type */}
          {(() => {
            const risk = {
              alto:  { bar: "bg-red-500",    bg: "bg-red-50 border-red-200",       dot: "🔴", label: "Atenção — Situação Crítica" },
              médio: { bar: "bg-amber-500",  bg: "bg-amber-50 border-amber-200",   dot: "🟡", label: "Atenção Moderada" },
              baixo: { bar: "bg-emerald-500",bg: "bg-emerald-50 border-emerald-200",dot: "🟢", label: "Situação Tranquila" },
            }[ins.riskLevel] ?? { bar: "bg-slate-400", bg: "bg-slate-50 border-slate-200", dot: "⚪", label: "Analisado" };
            return (
              <div className={`rounded-2xl border p-6 ${risk.bg}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {ins.documentType}{ins.documentSubtype ? ` · ${ins.documentSubtype}` : ""}
                    </p>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-2xl">{risk.dot}</span>
                      <p className="text-xl font-black text-slate-900">{risk.label}</p>
                    </div>
                    <p className="text-[12px] text-slate-500">{analysis.fileName} · {fmtDate(analysis.uploadedAt)}</p>
                  </div>
                  <div className="text-center shrink-0">
                    <p className={`text-6xl font-black ${ins.riskLevel === "alto" ? "text-red-600" : ins.riskLevel === "médio" ? "text-amber-600" : "text-emerald-600"}`}>
                      {ins.riskScore}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">pontos de risco</p>
                  </div>
                </div>
                <div className="mt-4 bg-white/60 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${ins.riskScore ?? 50}%` }} />
                </div>
              </div>
            );
          })()}

          {/* Immediate actions */}
          {ins.immediateActions?.length > 0 && (
            <div className="rounded-2xl border-2 border-red-300 overflow-hidden">
              <div className="bg-red-500 px-5 py-3 flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <p className="text-[13px] font-black text-white uppercase tracking-wide">O que fazer agora</p>
              </div>
              <div className="bg-white p-5 space-y-3">
                {ins.immediateActions.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-red-500 text-white text-[13px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="text-[14px] text-slate-800 font-semibold leading-snug pt-0.5">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key metrics */}
          {ins.keyMetrics?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">📊 Números que importam</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...ins.keyMetrics].sort((a, b) => {
                  const o = { crítico: 0, atenção: 1, ok: 2 };
                  return (o[a.status as keyof typeof o] ?? 2) - (o[b.status as keyof typeof o] ?? 2);
                }).map((m, i) => {
                  const cardBg   = m.status === "crítico" ? "bg-red-50 border-red-300"    : m.status === "atenção" ? "bg-amber-50 border-amber-300"    : "bg-white border-slate-200";
                  const numColor = m.status === "crítico" ? "text-red-700"                : m.status === "atenção" ? "text-amber-700"                  : "text-slate-900";
                  const icon     = m.status === "crítico" ? "🔴"                          : m.status === "atenção" ? "🟡"                              : "🟢";
                  return (
                    <div key={i} className={`rounded-2xl border-2 p-5 ${cardBg}`}>
                      <div className="flex justify-between gap-2 mb-2">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">{m.label}</p>
                        <span className="text-sm">{icon}</span>
                      </div>
                      <p className={`text-2xl font-black leading-none ${numColor}`}>{m.value}</p>
                      {m.trend && <p className="text-[10px] text-slate-400 mt-1">{m.trend}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Findings (top 5) */}
          {ins.mainFindings?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <span>🔍</span>
                <p className="text-[13px] font-bold text-slate-800">O que encontramos</p>
              </div>
              <div className="divide-y divide-slate-100">
                {ins.mainFindings.slice(0, showAll ? undefined : 5).map((f, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-[13px] text-slate-700 leading-snug">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations (top 5) */}
          {ins.recommendations?.length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50 flex items-center gap-2">
                <span>✅</span>
                <p className="text-[13px] font-bold text-emerald-800">O que fazer</p>
              </div>
              <div className="divide-y divide-slate-100">
                {ins.recommendations.slice(0, showAll ? undefined : 5).map((r, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[13px] text-slate-700 leading-snug">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[13px] font-semibold text-slate-600 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? "rotate-90" : ""}`} />
            {showAll ? "Ocultar detalhes" : "Ver análise completa — narrativa e dados detalhados"}
          </button>

          {showAll && (
            <div className="space-y-5 border-l-4 border-violet-200 pl-5">
              {ins.executiveSummary && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resumo executivo</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{ins.executiveSummary}</p>
                </div>
              )}
              {ins.financialHealthNarrative && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Saúde financeira</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{ins.financialHealthNarrative}</p>
                </div>
              )}
              {ins.agingDetailedAnalysis && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mb-2">📅 Análise de vencimentos</p>
                  <p className="text-[12px] text-orange-900 leading-relaxed whitespace-pre-line">{ins.agingDetailedAnalysis}</p>
                </div>
              )}
              {ins.concentrationDetailedAnalysis && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2">🏢 Análise de concentração</p>
                  <p className="text-[12px] text-blue-900 leading-relaxed whitespace-pre-line">{ins.concentrationDetailedAnalysis}</p>
                </div>
              )}
              {ins.deepDiveInsights?.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">🧠 Insights aprofundados</p>
                  <div className="space-y-2.5">
                    {ins.deepDiveInsights.map((d, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-slate-300 leading-relaxed">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ins.regulatoryFlags?.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-purple-600 uppercase tracking-widest mb-2">⚖️ Conformidade</p>
                  {ins.regulatoryFlags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-purple-900">
                      <AlertCircle className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />{f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [project,       setProject]       = useState<Project | null>(null);
  const [analyses,      setAnalyses]      = useState<FileAnalysis[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [showDelModal,  setShowDelModal]  = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  // null = show project dashboard; FileAnalysis = show individual
  const [selected, setSelected] = useState<FileAnalysis | null>(null);

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/projetos");
    } else {
      setDeleting(false);
      setShowDelModal(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(d => { if (d.project) setProject(d.project); else setError("Projeto não encontrado."); })
      .catch(() => setError("Falha ao carregar projeto."))
      .finally(() => setLoading(false));

    // sessionStorage
    try {
      const stored: (FileAnalysis & { projectId?: string })[] = JSON.parse(sessionStorage.getItem("fa_analyses") ?? "[]");
      const filtered = stored.filter(a => a.projectId === id);
      setAnalyses(filtered);
    } catch {}

    // Supabase
    fetch(`/api/projects/${id}/analyses`)
      .then(r => r.json())
      .then(d => {
        if (d.analyses?.length > 0) {
          const fromDb = d.analyses.map((a: { id: string; file_name: string; analysis_data: FileAnalysis; created_at: string }) => ({
            ...a.analysis_data,
            id: a.id,
            fileName: a.file_name,
            uploadedAt: a.created_at,
          }));
          setAnalyses(prev => {
            const ids = new Set(prev.map(a => a.id));
            return [...fromDb.filter((a: FileAnalysis) => !ids.has(a.id)), ...prev];
          });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !project) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-slate-700 font-semibold">{error ?? "Projeto não encontrado."}</p>
      <Link href="/projetos" className="text-blue-600 text-sm mt-2 inline-block hover:underline">← Voltar</Link>
    </div>
  );

  const colors   = COLOR_CLASSES[project.color];
  const IconComp = ICON_MAP[project.icon] ?? FolderOpen;

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">

        {/* Project header */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <Link href="/projetos" className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 mb-3 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Todos os projetos
          </Link>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
              <IconComp className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 truncate leading-tight">{project.name}</p>
              <p className={`text-[11px] font-medium ${colors.text}`}>{PROJECT_TYPE_LABELS[project.type]}</p>
            </div>
          </div>
          {project.description && (
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{project.description}</p>
          )}
        </div>

        {/* Upload button */}
        <div className="p-3 border-b border-slate-100 shrink-0 space-y-2">
          <Link
            href={`/upload?project=${id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            Upload novo arquivo
          </Link>
          <button
            onClick={() => setShowDelModal(true)}
            className="flex items-center justify-center gap-2 w-full py-2 border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 text-[12px] font-semibold rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir projeto
          </button>
        </div>

        {/* Delete confirmation modal */}
        {showDelModal && project && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDelModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 text-center mb-2">Excluir projeto?</h3>
              <p className="text-[13px] text-slate-500 text-center leading-relaxed mb-6">
                O projeto <span className="font-semibold text-slate-700">"{project.name}"</span> e todas as suas análises serão excluídos permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDelModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
                >
                  {deleting
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Trash2 className="w-3.5 h-3.5" /> Excluir</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation: Dashboard geral + files */}
        <div className="flex-1 overflow-y-auto">
          {/* Dashboard link */}
          <div className="p-2 border-b border-slate-100">
            <button
              onClick={() => setSelected(null)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                selected === null
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Dashboard do projeto</span>
              {analyses.length > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selected === null ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {analyses.length}
                </span>
              )}
            </button>
          </div>

          {/* Files list */}
          {analyses.length > 0 && (
            <div className="p-2 space-y-0.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 py-1.5">Arquivos</p>
              {analyses.map(a => {
                const isActive = selected?.id === a.id;
                const risk     = a.insight?.riskLevel;
                const riskDot  = risk === "alto" ? "bg-red-500" : risk === "médio" ? "bg-amber-400" : "bg-emerald-500";
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive ? "bg-violet-50 border border-violet-200" : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-600" : "text-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold truncate leading-tight ${isActive ? "text-violet-900" : "text-slate-700"}`}>
                        {a.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400">{fmtDate(a.uploadedAt)}</p>
                    </div>
                    {risk && <span className={`w-2 h-2 rounded-full shrink-0 ${riskDot}`} />}
                  </button>
                );
              })}
            </div>
          )}

          {analyses.length === 0 && (
            <div className="p-6 text-center">
              <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-[11px] text-slate-400">Nenhuma análise ainda.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {selected === null
          ? <ProjectDashboard analyses={analyses} project={project} />
          : <IndividualAnalysis analysis={selected} onBack={() => setSelected(null)} />
        }
      </div>
    </div>
  );
}
