"use client";

import { Bell, Search, Plus, ChevronDown } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Título */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-slate-900 leading-none truncate">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 leading-none truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 ml-4 shrink-0">
        {/* Busca */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar análises…"
            className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-48 transition-all"
          />
        </div>

        {/* Nova análise */}
        <Link
          href="/upload"
          className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova análise
        </Link>

        {/* Notificações */}
        <button className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-[1.5px] ring-white" />
        </button>

        {/* User pill */}
        <button className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[9px] font-bold">JD</span>
          </div>
          <span className="text-[12px] font-medium text-slate-700">João Silva</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
