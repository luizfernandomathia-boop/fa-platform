"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Upload, FileText, X, CheckCircle, AlertCircle, CloudUpload,
  FileSpreadsheet, File, ArrowRight, Clock, Info, Sparkles,
  Lightbulb, Send, Bot, User, ChevronRight, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/Header";
import type { ProjectType } from "@/types/project";
import type { FileAnalysis, DocumentInsight, ChatMessage } from "@/types/analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "uploading" | "done" | "error";

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  errorMsg?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  color: string;
  type: ProjectType;
  description?: string | null;
}

// ─── Prompt suggestions by project type ──────────────────────────────────────

const SUGGESTIONS: Record<ProjectType | "default", string[]> = {
  pessoal: [
    "Para onde vai o meu dinheiro? Mostre meus maiores gastos e onde posso economizar.",
    "Estou conseguindo poupar? Analise minha evolução financeira ao longo do tempo.",
    "Quais categorias de gastos estão fora de controle?",
  ],
  empresarial: [
    "Qual a saúde financeira da empresa? Analise caixa, dívidas e lucratividade.",
    "Mostre os maiores custos operacionais e onde há oportunidade de redução.",
    "Existe risco de falta de caixa? Identifique gargalos de liquidez.",
  ],
  cliente: [
    "Quem são os maiores devedores e quando vencem os títulos em aberto?",
    "Qual o risco de não receber? Quanto está vencido há mais de 90 dias?",
    "Se o maior cliente não pagar, qual o impacto financeiro?",
  ],
  contabilidade: [
    "Tem algum lançamento repetido ou estranho nessa planilha?",
    "Quais contas estão com valores fora do normal?",
    "Tem algum erro ou inconsistência que eu preciso corrigir?",
  ],
  outro: [
    "Faça uma análise completa e destaque os pontos mais importantes.",
    "Identifique padrões, tendências e alertas nos dados deste arquivo.",
    "Quais são os principais números e o que eles significam?",
  ],
  default: [
    "Explique este arquivo em linguagem simples e destaque o que é mais importante.",
    "Identifique riscos, oportunidades e o que devo fazer com esta informação.",
    "Mostre os números que mais importam e o que eles significam.",
  ],
};

const STEPS = [
  { label: "Configurar",    desc: "Projeto e pergunta" },
  { label: "Enviar",        desc: "Upload do arquivo" },
  { label: "Analisar",      desc: "IA processando" },
  { label: "Conversar",     desc: "Chat com o analista" },
];

const FORMAT_GUIDE = [
  { ext: ".xlsx / .xls", icon: FileSpreadsheet, accent: "border-emerald-200 bg-emerald-50", iconColor: "text-emerald-600", label: "Planilha Excel", desc: "DRE, Balanço, Fluxo de Caixa." },
  { ext: ".csv",         icon: FileText,        accent: "border-blue-200 bg-blue-50",       iconColor: "text-blue-600",    label: "CSV",           desc: "Exportações de SAP, TOTVS ou Omie." },
  { ext: ".pdf",         icon: File,            accent: "border-red-200 bg-red-50",         iconColor: "text-red-600",     label: "PDF",           desc: "Demonstrativos em formato texto." },
  { ext: ".xml / SPED",  icon: File,            accent: "border-orange-200 bg-orange-50",   iconColor: "text-orange-600",  label: "XML / SPED",    desc: "SPED Contábil (ECD), SPED Fiscal e NF-e." },
];

// ─── Mini DocumentInsightCard (inline result view) ───────────────────────────

function InlineInsightCard({ insight, error }: { insight: DocumentInsight | null; error?: string }) {
  const [showDetails, setShowDetails] = useState(false);

  if (error) return (
    <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-bold text-red-900 mb-1">Análise indisponível</p>
        <p className="text-[12px] text-red-700">{error}</p>
      </div>
    </div>
  );

  if (!insight) return null;

  const risk = {
    alto:  { bar: "bg-red-500",     bg: "bg-red-50 border-red-200",       dot: "🔴", label: "Atenção — Situação Crítica" },
    médio: { bar: "bg-amber-500",   bg: "bg-amber-50 border-amber-200",   dot: "🟡", label: "Atenção Moderada" },
    baixo: { bar: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200",dot: "🟢", label: "Situação Tranquila" },
  }[insight.riskLevel] ?? { bar: "bg-slate-400", bg: "bg-slate-50 border-slate-200", dot: "⚪", label: "Análise concluída" };

  const heroMetrics = (insight.keyMetrics ?? [])
    .sort((a, b) => ({ crítico: 0, atenção: 1, ok: 2 }[a.status as "ok"|"atenção"|"crítico"] ?? 2) - ({ crítico: 0, atenção: 1, ok: 2 }[b.status as "ok"|"atenção"|"crítico"] ?? 2))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Data quality warning */}
      {(insight.dataQuality === "ruim" || insight.dataQuality === "regular") && (
        <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${insight.dataQuality === "ruim" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
          <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${insight.dataQuality === "ruim" ? "text-amber-500" : "text-slate-400"}`} />
          <div>
            <p className={`text-[12px] font-bold ${insight.dataQuality === "ruim" ? "text-amber-800" : "text-slate-700"}`}>
              {insight.dataQuality === "ruim" ? "Arquivo com dados incompletos" : "Arquivo com alguns dados faltando"}
            </p>
            <p className={`text-[11px] mt-0.5 ${insight.dataQuality === "ruim" ? "text-amber-700" : "text-slate-500"}`}>
              {insight.dataQualityReason}
            </p>
          </div>
        </div>
      )}

      {/* Risk header */}
      <div className={`rounded-xl border p-4 ${risk.bg}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {insight.documentType}{insight.documentSubtype ? ` · ${insight.documentSubtype}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xl">{risk.dot}</span>
              <p className="text-[16px] font-black text-slate-900">{risk.label}</p>
            </div>
          </div>
          {insight.riskScore !== undefined && (
            <div className="text-center shrink-0">
              <p className={`text-4xl font-black leading-none ${insight.riskLevel === "alto" ? "text-red-600" : insight.riskLevel === "médio" ? "text-amber-600" : "text-emerald-600"}`}>
                {insight.riskScore}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">pontos de risco</p>
            </div>
          )}
        </div>
        <div className="mt-3 bg-white/60 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${insight.riskScore ?? 50}%` }} />
        </div>
      </div>

      {/* Immediate actions */}
      {insight.immediateActions?.length > 0 && (
        <div className="rounded-xl border-2 border-red-200 overflow-hidden">
          <div className="bg-red-500 px-4 py-2 flex items-center gap-2">
            <span>⚡</span>
            <p className="text-[12px] font-black text-white uppercase tracking-wide">O que fazer agora</p>
          </div>
          <div className="p-3 space-y-2.5">
            {insight.immediateActions.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-[13px] text-slate-800 font-semibold leading-snug pt-0.5">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero metrics */}
      {heroMetrics.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">📊 Números que importam</p>
          <div className="grid grid-cols-2 gap-3">
            {heroMetrics.map((m, i) => {
              const cardBg = m.status === "crítico" ? "bg-red-50 border-red-300" : m.status === "atenção" ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200";
              const numColor = m.status === "crítico" ? "text-red-700" : m.status === "atenção" ? "text-amber-700" : "text-slate-900";
              const icon = m.status === "crítico" ? "🔴" : m.status === "atenção" ? "🟡" : "🟢";
              return (
                <div key={i} className={`rounded-xl border-2 p-4 ${cardBg}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-tight flex-1">{m.label}</p>
                    <span className="text-sm shrink-0">{icon}</span>
                  </div>
                  <p className={`text-2xl font-black leading-none ${numColor}`}>{m.value}</p>
                  {m.trend && <p className="text-[10px] text-slate-400 mt-1">{m.trend}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top findings */}
      {insight.mainFindings?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
            <span>🔍</span>
            <p className="text-[12px] font-bold text-slate-800">O que encontramos</p>
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

      {/* Expand toggle */}
      <button
        onClick={() => setShowDetails(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[12px] font-semibold text-slate-600 transition-colors"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetails ? "rotate-90" : ""}`} />
        {showDetails ? "Ocultar detalhes" : "Ver análise completa"}
      </button>

      {showDetails && (
        <div className="space-y-4 border-l-4 border-violet-200 pl-4 text-[12px] text-slate-700 leading-relaxed">
          {insight.executiveSummary && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Resumo executivo</p>
              <p>{insight.executiveSummary}</p>
            </div>
          )}
          {insight.financialHealthNarrative && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Saúde financeira</p>
              <p className="whitespace-pre-line">{insight.financialHealthNarrative}</p>
            </div>
          )}
          {insight.agingDetailedAnalysis && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">📅 Vencimentos</p>
              <p className="whitespace-pre-line text-orange-900">{insight.agingDetailedAnalysis}</p>
            </div>
          )}
          {insight.concentrationDetailedAnalysis && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">🏢 Concentração</p>
              <p className="whitespace-pre-line text-blue-900">{insight.concentrationDetailedAnalysis}</p>
            </div>
          )}
          {insight.recommendations?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">✅ Recomendações</p>
              <ul className="space-y-1">
                {insight.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({ analysis }: { analysis: FileAnalysis }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Olá! Analisei o arquivo **${analysis.fileName}** e estou pronto para responder suas dúvidas.\n\nPergunte qualquer coisa: valores específicos, riscos, o que fazer com esses dados, comparações — estou aqui como seu analista financeiro pessoal. 😊`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLTextAreaElement>(null);

  const QUICK_QUESTIONS = [
    "Qual o maior risco neste arquivo?",
    "O que devo fazer primeiro?",
    "Como está a situação geral?",
    "Existe algum problema grave?",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const history = messages
        .filter(m => m.role !== "assistant" || messages.indexOf(m) > 0) // skip the greeting
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, analysis, history }),
      });
      const data = await res.json();

      const reply = data.reply ?? data.error ?? "Não foi possível obter resposta. Tente novamente.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão. Verifique sua internet e tente novamente.", timestamp: new Date().toISOString() }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [analysis, messages, sending]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-violet-600 rounded-t-2xl flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-white leading-none">Analista FA Solutions</p>
          <p className="text-[10px] text-blue-100 mt-0.5">Especialista no seu arquivo</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-blue-100">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
              m.role === "assistant" ? "bg-gradient-to-br from-blue-500 to-violet-600" : "bg-slate-200"
            }`}>
              {m.role === "assistant"
                ? <Bot className="w-3.5 h-3.5 text-white" />
                : <User className="w-3.5 h-3.5 text-slate-600" />
              }
            </div>
            {/* Bubble */}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
              m.role === "user"
                ? "bg-blue-600 text-white rounded-tr-sm"
                : "bg-slate-100 text-slate-800 rounded-tl-sm"
            }`}>
              {m.content.split("\n").map((line, j) => (
                <span key={j}>
                  {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                  {j < m.content.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions (shown only at start) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte qualquer coisa sobre este arquivo…"
            rows={2}
            className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 placeholder-slate-400 bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none leading-snug"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function UploadPageInner() {
  const searchParams = useSearchParams();

  const [files, setFiles]           = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [projectId, setProjectId]   = useState("");
  const [projects, setProjects]     = useState<ProjectOption[]>([]);
  const [doneAnalysis, setDoneAnalysis] = useState<FileAnalysis | null>(null);

  useEffect(() => {
    const pid = searchParams.get("project");
    if (pid) setProjectId(pid);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  const selectedProject = projects.find(p => p.id === projectId) ?? null;
  const suggestions     = selectedProject
    ? (SUGGESTIONS[selectedProject.type] ?? SUGGESTIONS.default)
    : SUGGESTIONS.default;

  const addFiles = (newFiles: FileList) => {
    const mapped = Array.from(newFiles).map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      status: "pending" as FileStatus,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...mapped]);
    setDoneAnalysis(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const runUpload = async () => {
    setUploading(true);
    setDoneAnalysis(null);

    const pending = files.filter(f => f.status === "pending");

    for (const f of pending) {
      setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "uploading", progress: 5 } : x));

      const progressTimer = setInterval(() => {
        setFiles(prev => prev.map(x =>
          x.id === f.id && x.progress < 85 ? { ...x, progress: x.progress + 13 } : x
        ));
      }, 300);

      try {
        const body = new FormData();
        body.append("file", f.file);
        body.append("userPrompt", userPrompt.trim());
        body.append("projectId", projectId);
        body.append("projectName",        selectedProject?.name ?? "");
        body.append("projectType",        selectedProject?.type ?? "");
        body.append("projectDescription", selectedProject?.description ?? "");

        const res  = await fetch("/api/upload", { method: "POST", body });
        const data = await res.json();

        clearInterval(progressTimer);

        if (!res.ok) {
          setFiles(prev => prev.map(x => x.id === f.id
            ? { ...x, status: "error", progress: 0, errorMsg: data.error ?? "Erro ao processar o arquivo." }
            : x
          ));
        } else {
          // Save to sessionStorage (tagged with projectId)
          if (data.analysis) {
            try {
              const stored = JSON.parse(sessionStorage.getItem("fa_analyses") ?? "[]");
              stored.unshift({ ...data.analysis, projectId: projectId || null });
              sessionStorage.setItem("fa_analyses", JSON.stringify(stored.slice(0, 20)));
            } catch { /* sessionStorage unavailable */ }
          }
          setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "done", progress: 100 } : x));
          // Show result + chat for the last processed file
          if (data.analysis) setDoneAnalysis(data.analysis as FileAnalysis);
        }
      } catch {
        clearInterval(progressTimer);
        setFiles(prev => prev.map(x => x.id === f.id
          ? { ...x, status: "error", progress: 0, errorMsg: "Falha na conexão. Verifique sua rede e tente novamente." }
          : x
        ));
      }
    }

    setUploading(false);
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const doneCount    = files.filter(f => f.status === "done").length;
  const activeStep   = doneAnalysis ? 3 : uploading ? 2 : files.length > 0 ? 1 : 0;

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") return <FileSpreadsheet className="w-[18px] h-[18px] text-emerald-600" />;
    if (ext === "pdf")  return <File className="w-[18px] h-[18px] text-red-600" />;
    if (ext === "xml")  return <File className="w-[18px] h-[18px] text-orange-600" />;
    return <FileText className="w-[18px] h-[18px] text-blue-600" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Upload de Arquivos"
        subtitle="Envie demonstrativos contábeis e converse com a IA sobre os dados"
      />

      <div className="flex-1 p-8 max-w-7xl w-full mx-auto">

        {/* Stepper */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-5 mb-7">
          <div className="flex items-center">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all ${
                    i < activeStep ? "bg-emerald-500 text-white"
                    : i === activeStep ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-slate-100 text-slate-400"
                  }`}>
                    {i < activeStep ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-[12px] font-semibold leading-none ${i <= activeStep ? "text-slate-900" : "text-slate-400"}`}>{step.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-4 transition-colors ${i < activeStep ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main layout: split when analysis is done ── */}
        <div className={`flex gap-7 ${doneAnalysis ? "flex-row items-start" : "flex-col"}`}>

          {/* ─── Left / Full column: Upload form ─── */}
          <div className={`space-y-6 ${doneAnalysis ? "w-[380px] shrink-0" : "w-full max-w-3xl mx-auto"}`}>

            {/* Context card (project + prompt) — always visible */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-[13px] font-bold text-slate-900">Contexto da análise</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Escolha o projeto e o que quer saber — a IA adapta a análise para você.</p>
              </div>
              <div className="p-5 space-y-4">
                {projects.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Projeto</label>
                    <select
                      value={projectId}
                      onChange={e => { setProjectId(e.target.value); setUserPrompt(""); }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    >
                      <option value="">— Sem projeto —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    O que você quer saber? <span className="text-slate-400 font-normal normal-case">(opcional)</span>
                  </label>
                  <textarea
                    value={userPrompt}
                    onChange={e => setUserPrompt(e.target.value)}
                    placeholder="Ex: Quero entender quem são os maiores devedores e o risco de não receber."
                    rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 placeholder-slate-400 bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                  />

                  {/* Suggestion chips */}
                  <div className="mt-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3 h-3 text-amber-500" />
                      <p className="text-[10px] font-semibold text-slate-500">
                        {selectedProject ? `Sugestões para "${selectedProject.name}"` : "Sugestões"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setUserPrompt(s)}
                          className={`text-left text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                            userPrompt === s
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl py-12 px-8 text-center transition-all cursor-pointer group ${
                isDragging ? "border-blue-500 bg-blue-50/80" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
              }`}
            >
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.pdf,.xml"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${isDragging ? "bg-blue-100" : "bg-slate-100 group-hover:bg-blue-100"}`}>
                <CloudUpload className={`w-7 h-7 transition-colors ${isDragging ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`} />
              </div>
              <p className="text-[15px] font-semibold text-slate-900 mb-1">
                {isDragging ? "Solte para adicionar" : "Arraste o arquivo aqui"}
              </p>
              <p className="text-[12px] text-slate-500 mb-4">
                ou <span className="text-blue-600 font-medium">clique para selecionar</span>
              </p>
              <div className="flex justify-center flex-wrap gap-2">
                {[".xlsx", ".csv", ".pdf", ".xml"].map(fmt => (
                  <span key={fmt} className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{fmt}</span>
                ))}
                <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Info className="w-2.5 h-2.5" /> Até 50 MB
                </span>
              </div>
            </div>

            {/* File queue */}
            {files.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-[12px] font-semibold text-slate-900">Fila de envio</h3>
                    <p className="text-[10px] text-slate-500">{files.length} arquivo(s) · {doneCount} processado(s)</p>
                  </div>
                  <button
                    onClick={runUpload}
                    disabled={uploading || pendingCount === 0}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold px-3.5 py-2 rounded-lg text-[12px] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Enviando…" : `Enviar${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
                  </button>
                </div>

                <div className="divide-y divide-slate-50">
                  {files.map(f => (
                    <div key={f.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                        {getFileIcon(f.file.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[12px] font-medium text-slate-900 truncate">{f.file.name}</p>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span className="text-[10px] text-slate-400">{formatSize(f.file.size)}</span>
                            {f.status === "done"      && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {f.status === "error"     && <AlertCircle className="w-4 h-4 text-red-500" />}
                            {f.status === "uploading" && <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
                            {f.status === "pending"   && <button onClick={() => removeFile(f.id)} className="text-slate-300 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
                          </div>
                        </div>
                        {f.status === "uploading" && (
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-1 bg-blue-500 rounded-full transition-all" style={{ width: `${f.progress}%` }} />
                          </div>
                        )}
                        {f.status === "done"    && <p className="text-[10px] text-emerald-600 font-medium">Processado · Chat disponível abaixo →</p>}
                        {f.status === "pending" && <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Aguardando</p>}
                        {f.status === "error"   && <p className="text-[10px] text-red-500">{f.errorMsg}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {doneAnalysis && (
                  <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <p className="text-[12px] font-medium text-emerald-800 flex-1">Análise pronta! Converse com a IA ao lado.</p>
                    {projectId && (
                      <Link href={`/projetos/${projectId}`} className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
                        Ver no projeto <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Format guide — compact */}
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_GUIDE.map(fmt => (
                <div key={fmt.label} className={`rounded-xl p-3 border flex items-start gap-2.5 ${fmt.accent}`}>
                  <fmt.icon className={`w-4 h-4 shrink-0 mt-0.5 ${fmt.iconColor}`} />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-800">{fmt.label} <span className="font-normal text-slate-500">{fmt.ext}</span></p>
                    <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{fmt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Right panel: Analysis + Chat ─── */}
          {doneAnalysis && (
            <div className="flex-1 min-w-0 flex flex-col gap-5">

              {/* Analysis result */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">📄 Resultado da análise — {doneAnalysis.fileName}</p>
                <InlineInsightCard
                  insight={doneAnalysis.insight ?? null}
                  error={doneAnalysis.insightError}
                />
              </div>

              {/* Chat panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "500px" }}>
                <ChatPanel analysis={doneAnalysis} />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadPageInner />
    </Suspense>
  );
}
