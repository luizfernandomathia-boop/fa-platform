import Link from "next/link";
import {
  BarChart3,
  ArrowRight,
  Upload,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
  Building2,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

// ─── Dados ────────────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    icon: Users,
    label: "Para você",
    title: "Suas finanças pessoais, simples assim",
    desc: "Jogue uma planilha do banco ou do cartão. Em segundos você vê para onde o seu dinheiro está indo, quanto sobrou e o que cortar.",
    color: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
    accent: "text-blue-600",
    border: "border-blue-100",
  },
  {
    icon: Building2,
    label: "Para sua empresa",
    title: "A saúde financeira do seu negócio de verdade",
    desc: "Envie os relatórios da sua empresa e descubra se está no lucro, quais são os maiores custos e onde estão os riscos — sem precisar de contador.",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    accent: "text-violet-600",
    border: "border-violet-100",
  },
  {
    icon: TrendingUp,
    label: "Para cobranças",
    title: "Quem te deve e quanto",
    desc: "Suba sua lista de clientes ou contas a receber e veja de imediato quem está atrasado, quanto está em risco e quem priorizar.",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
    accent: "text-emerald-600",
    border: "border-emerald-100",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: Upload,
    title: "Envie seu arquivo",
    desc: "Excel, CSV ou PDF — qualquer planilha ou extrato que você já usa no dia a dia.",
  },
  {
    step: "2",
    icon: Sparkles,
    title: "A IA interpreta por você",
    desc: "Em segundos, ela lê tudo, identifica o que importa e transforma em números fáceis de entender.",
  },
  {
    step: "3",
    icon: MessageCircle,
    title: "Pergunte o que quiser",
    desc: "Converse com a IA sobre os dados como se fosse um amigo que entende de finanças. Sem jargão, sem complicação.",
  },
];

const SIMPLE_FEATURES = [
  "Sem precisar saber contabilidade ou finanças",
  "Resultados em menos de 1 minuto",
  "Perguntas em linguagem natural — tipo WhatsApp",
  "Dashboard visual com os números que importam",
  "Alertas automáticos sobre riscos e problemas",
  "Funciona para pessoa física e empresas de qualquer tamanho",
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-white antialiased">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <BarChart3 className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="text-[15px] font-bold text-slate-900 tracking-tight">FA Solutions</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-slate-900 font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/login"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Inteligência artificial aplicada às suas finanças
          </div>

          {/* Título */}
          <h1 className="text-[48px] md:text-[62px] font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
            Entenda suas finanças{" "}
            <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              sem precisar ser contador
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Jogue qualquer planilha ou arquivo financeiro. Em segundos, a IA lê tudo,
            explica o que está acontecendo e te diz o que fazer — em linguagem simples,
            sem termos técnicos.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-sm text-[15px]"
            >
              Testar agora — é grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium px-7 py-3.5 rounded-xl transition-colors text-[15px]"
            >
              Como funciona?
            </a>
          </div>

          <p className="text-xs text-slate-400 mt-5">
            Sem cartão de crédito · Pronto em menos de 1 minuto
          </p>
        </div>
      </section>

      {/* ── Mockup / visual ilustrativo ─────────────────────────────────────── */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">

            {/* Barra superior do "app" */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-red-400/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
              <div className="ml-3 flex-1 bg-slate-700/50 rounded-md h-6 flex items-center px-3">
                <span className="text-slate-500 text-xs">fa-solutions.com/projetos/minha-empresa</span>
              </div>
            </div>

            {/* Cards de preview dentro do mockup */}
            <div className="grid md:grid-cols-3 gap-3">

              {/* Card risco */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
                <p className="text-xs font-medium text-emerald-100 mb-1">Risco geral</p>
                <p className="text-4xl font-black">72</p>
                <p className="text-xs text-emerald-100 mt-1">Situação estável</p>
                <div className="mt-3 bg-white/20 rounded-full h-1.5">
                  <div className="bg-white rounded-full h-1.5 w-[72%]" />
                </div>
              </div>

              {/* Card receita */}
              <div className="bg-slate-700/60 rounded-xl p-4 text-white">
                <p className="text-xs font-medium text-slate-400 mb-1">Receita Total</p>
                <p className="text-2xl font-black">R$ 84.200</p>
                <p className="text-xs text-slate-400 mt-1">últimos 30 dias</p>
                <div className="flex items-center gap-1 mt-3">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold">+12% vs mês anterior</span>
                </div>
              </div>

              {/* Card chat */}
              <div className="bg-slate-700/60 rounded-xl p-4 text-white flex flex-col gap-2">
                <p className="text-xs font-medium text-slate-400 mb-0.5">IA respondendo…</p>
                <div className="bg-slate-600/60 rounded-lg p-2.5">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    "Seu maior custo é <span className="text-white font-semibold">Folha de Pagamento</span> com R$ 28.400 (34% do total)."
                  </p>
                </div>
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2">
                  <p className="text-xs text-blue-300">💡 Reduzindo 10%, você economiza R$ 2.840/mês</p>
                </div>
              </div>
            </div>

            {/* Linha de "ação imediata" */}
            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-6 h-6 bg-amber-400/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-amber-400 text-xs">⚡</span>
              </div>
              <div>
                <p className="text-amber-300 text-xs font-semibold">O que fazer agora</p>
                <p className="text-amber-200/80 text-xs mt-0.5">Renegocie o contrato de aluguel vencendo em 15 dias — economia potencial de R$ 1.200/mês.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Para quem é ─────────────────────────────────────────────────────── */}
      <section id="para-quem" className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Para quem é</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Qualquer pessoa pode usar
            </h2>
            <p className="text-base text-slate-500 max-w-xl mx-auto">
              Não importa se você é autônomo, tem uma empresa ou só quer entender seu extrato bancário.
              A IA faz o trabalho pesado por você.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {USE_CASES.map((uc) => (
              <div
                key={uc.title}
                className={`bg-white rounded-2xl p-7 border ${uc.border} hover:shadow-lg transition-all duration-200`}
              >
                <div className={`w-12 h-12 rounded-xl ${uc.bg} flex items-center justify-center mb-5`}>
                  <uc.icon className={`w-6 h-6 ${uc.accent}`} />
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest ${uc.accent} mb-2 block`}>
                  {uc.label}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">{uc.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Simples como mandar uma mensagem
            </h2>
            <p className="text-base text-slate-500 max-w-xl mx-auto">
              Três passos e você já tem respostas claras sobre a situação financeira que enviou.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Linha conectora */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+16px)] right-[calc(16.66%+16px)] h-px bg-gradient-to-r from-slate-200 via-blue-200 to-slate-200" />

            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200/50 relative z-10">
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-blue-300 rounded-full flex items-center justify-center text-[9px] font-black text-blue-600 z-20" style={{ marginLeft: '24px', marginTop: '-2px' }}>
                  {step.step}
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── O que está incluído ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Tudo isso incluído</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-5 leading-tight">
                A IA que interpreta as finanças por você
              </h2>
              <p className="text-base text-slate-400 mb-9 leading-relaxed">
                Você não precisa saber o que é DRE, balanço patrimonial ou fluxo de caixa.
                Basta enviar o arquivo — a IA traduz tudo em informações que fazem sentido
                para você.
              </p>

              <ul className="space-y-3">
                {SIMPLE_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="w-4.5 h-4.5 w-[18px] h-[18px] text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat preview */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-700">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Assistente Financeiro</p>
                  <p className="text-xs text-emerald-400">● Online agora</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Mensagem do usuário */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm text-white">Estou no lucro ou no prejuízo?</p>
                  </div>
                </div>

                {/* Resposta da IA */}
                <div className="flex justify-start">
                  <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-sm text-slate-200 leading-relaxed">
                      Você está <span className="text-emerald-400 font-semibold">no lucro</span> em R$ 4.800 esse mês.
                      Sua receita foi R$ 28.400 e seus gastos totais foram R$ 23.600. 🎉
                    </p>
                  </div>
                </div>

                {/* Segunda mensagem */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm text-white">O que está saindo mais?</p>
                  </div>
                </div>

                {/* Segunda resposta */}
                <div className="flex justify-start">
                  <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-sm text-slate-200 leading-relaxed">
                      Seu maior gasto é <span className="text-amber-400 font-semibold">Alimentação</span> com R$ 6.200 (26% do total).
                      No mês passado foi R$ 4.800 — subiu bastante.
                    </p>
                  </div>
                </div>

                {/* Input */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700">
                  <input
                    disabled
                    placeholder="Pergunte qualquer coisa…"
                    className="flex-1 bg-slate-600/50 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-400 placeholder-slate-500 cursor-not-allowed"
                  />
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-200/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Comece agora. É de graça.
          </h2>
          <p className="text-base text-slate-500 mb-9 leading-relaxed max-w-xl mx-auto">
            Crie sua conta, suba seu primeiro arquivo e veja o que a IA descobre
            sobre suas finanças. Sem cartão de crédito, sem configuração.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-9 py-4 rounded-xl transition-colors text-[15px] shadow-lg shadow-blue-200"
          >
            Criar conta grátis
            <ArrowRight className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </Link>
          <p className="text-xs text-slate-400 mt-5">
            Sem cartão de crédito · Sem limite de tempo · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-sm">FA Solutions</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                A IA que interpreta suas finanças e te diz, em linguagem simples, o que está acontecendo e o que fazer.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Produto</p>
                <ul className="space-y-2">
                  {["Como funciona", "Para quem é", "Preços", "Segurança"].map((link) => (
                    <li key={link}>
                      <a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Suporte</p>
                <ul className="space-y-2">
                  {["Ajuda", "Contato", "Privacidade", "Termos"].map((link) => (
                    <li key={link}>
                      <a href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">© 2026 FA Solutions. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
