"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle, Eye, EyeOff, TrendingUp } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function CadastroPage() {
  const router = useRouter();

  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data:            { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (authError) {
      setError(
        authError.message === "User already registered"
          ? "Este e-mail já está cadastrado. Tente entrar na sua conta."
          : authError.message
      );
      setLoading(false);
    } else if (data.session) {
      // Confirmação de e-mail desabilitada — já está logado
      router.push("/projetos");
    } else {
      // Confirmação de e-mail habilitada — precisa verificar o e-mail
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-[20px] font-bold text-slate-900 mb-2">Confirme seu e-mail</h2>
          <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
            Enviamos um link de confirmação para <span className="font-semibold text-slate-800">{email}</span>.
          </p>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            Abra seu e-mail, clique no link de confirmação e depois volte aqui para entrar.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-[13px] text-blue-600 hover:text-blue-700 font-semibold"
          >
            Já confirmei → Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <span className="text-[18px] font-bold text-slate-900">FA Solutions</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="mb-7">
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight">
            Criar conta grátis
          </h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Comece a analisar documentos financeiros agora.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full name */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="João da Silva"
              required
              autoComplete="name"
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              E-mail profissional
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              required
              autoComplete="email"
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Senha <span className="text-slate-400 font-normal">(mínimo 8 caracteres)</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Confirmar senha
            </label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-[14px] font-semibold rounded-lg transition-colors shadow-sm mt-1"
          >
            {loading ? "Criando conta…" : "Criar conta grátis"}
          </button>
        </form>

        <p className="text-center text-[12px] text-slate-500 mt-6">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
