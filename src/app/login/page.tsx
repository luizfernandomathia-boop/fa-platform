"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Eye, EyeOff, Lock, Mail, ArrowRight, CheckCircle, TrendingUp, Shield, AlertCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const TRUST_ITEMS = [
  { icon: TrendingUp, text: "Jogue qualquer planilha ou extrato — a IA lê e explica tudo" },
  { icon: Shield,     text: "Seus dados são seus. Armazenados com segurança e nunca compartilhados" },
  { icon: CheckCircle,text: "Sem precisar saber contabilidade, finanças ou termos técnicos" },
];

const STATS = [
  { value: "< 1 min", label: "Por análise" },
  { value: "100%",    label: "Linguagem simples" },
  { value: "Grátis",  label: "Para começar" },
];

function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/projetos";

  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [form,         setForm]         = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    form.email.trim(),
      password: form.password,
    });

    if (authError) {
      const msg = authError.message;
      setError(
        msg === "Invalid login credentials"
          ? "E-mail ou senha incorretos. Verifique e tente novamente."
          : msg.toLowerCase().includes("email not confirmed")
          ? "Você precisa confirmar seu e-mail antes de entrar. Verifique sua caixa de entrada (e o spam)."
          : msg
      );
      setLoading(false);
    } else {
      router.push(next);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo (branding) ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-slate-950 flex-col justify-between p-12 overflow-hidden">

        {/* Padrão de grid decorativo */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Círculo de luz */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 z-10">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">FA Solutions</span>
        </Link>

        {/* Copy central */}
        <div className="relative z-10">
          <h2 className="text-[32px] font-bold text-white leading-tight tracking-tight mb-4">
            Entenda suas finanças<br />sem precisar ser contador
          </h2>
          <p className="text-slate-400 text-[15px] leading-relaxed mb-10 max-w-md">
            Suba qualquer planilha ou extrato e converse com a IA como se fosse
            um amigo que entende de dinheiro. Simples, rápido e sem jargão.
          </p>

          <div className="space-y-4">
            {TRUST_ITEMS.map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-8 border-t border-slate-800">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold text-white tracking-tight">{s.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Painel direito (formulário) ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-10">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">FA Solutions</span>
          </div>

          {/* Cabeçalho do form */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
              Acesse sua conta
            </h1>
            <p className="text-sm text-slate-500">
              Informe suas credenciais para continuar na plataforma
            </p>
          </div>

          {/* Card do formulário */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* E-mail */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="seu@empresa.com.br"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-[14px] text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-semibold text-slate-700">
                    Senha
                  </label>
                  <a href="#" className="text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl text-[14px] text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Manter conectado */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                />
                <span className="text-[13px] text-slate-600">Manter conectado por 30 dias</span>
              </label>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-700 leading-relaxed">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-[14px] shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando credenciais…
                  </>
                ) : (
                  <>
                    Entrar na plataforma
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Rodapé do card */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-[13px] text-slate-500">
                Ainda não tem uma conta?{" "}
                <Link href="/cadastro" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Criar conta grátis
                </Link>
              </p>
            </div>
          </div>

          {/* Termos */}
          <p className="text-center text-[11px] text-slate-400 mt-5 leading-relaxed">
            Ao acessar, você concorda com nossos{" "}
            <a href="#" className="underline underline-offset-2 hover:text-slate-600 transition-colors">
              Termos de Uso
            </a>{" "}
            e{" "}
            <a href="#" className="underline underline-offset-2 hover:text-slate-600 transition-colors">
              Política de Privacidade
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
