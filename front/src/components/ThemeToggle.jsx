import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Botão de alternância On/Off de Modo Claro / Modo Escuro
 * 
 * Estética conforme requisitos:
 * - Modo Claro: Fundo azul mais claro, manípulo na esquerda com o Sol dourado e raios solares.
 * - Modo Escuro: Fundo azul escuro, manípulo na direita com a Lua crescente prateada.
 * - Transição suave de:
 *   1. Cor (azul claro -> azul escuro)
 *   2. Movimento (deslizamento com amortecimento natural)
 *   3. Ilustração (rotação, escala e opacidade sincronizadas entre Sol e Lua)
 */
const ThemeToggle = ({ className = "" }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
      title={isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      onClick={toggleTheme}
      className={`relative inline-flex items-center w-16 h-8 rounded-full p-1 cursor-pointer transition-all duration-500 ease-in-out select-none shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95 group ${
        isDark 
          ? "bg-[#0c1a3b] border border-blue-900/60 shadow-inner" 
          : "bg-[#60A5FA] border border-blue-300/80 shadow-xs"
      } ${className}`}
    >
      {/* ========================================================================= */}
      {/* DETALHES DE AMBIENTAÇÃO DE FUNDO DA TRILHA                                */}
      {/* ========================================================================= */}
      
      {/* Estrelas decorativas da noite (Lado Esquerdo - Visíveis no Modo Escuro) */}
      <div 
        className={`absolute left-2 flex items-center gap-1 pointer-events-none transition-all duration-500 ${
          isDark ? "opacity-100 scale-100" : "opacity-0 scale-50"
        }`}
        aria-hidden="true"
      >
        <span className="w-1 h-1 rounded-full bg-blue-200/80 animate-pulse"></span>
        <span className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_3px_#fff]"></span>
        <span className="w-0.5 h-0.5 rounded-full bg-indigo-200/70"></span>
      </div>

      {/* Nuvens suaves do dia (Lado Direito - Visíveis no Modo Claro) */}
      <div 
        className={`absolute right-2 flex items-center pointer-events-none transition-all duration-500 ${
          isDark ? "opacity-0 scale-50" : "opacity-90 scale-100"
        }`}
        aria-hidden="true"
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          className="w-4 h-4 text-white/90 drop-shadow-xs"
        >
          <path 
            fill="currentColor" 
            d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" 
          />
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* MANÍPULO DESLIZANTE (THUMB) COM ILUSTRAÇÃO SOL & LUA                      */}
      {/* ========================================================================= */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-500 transform shadow-md ${
          isDark
            ? "translate-x-8 bg-gradient-to-br from-slate-100 to-indigo-100 text-slate-800 shadow-black/40"
            : "translate-x-0 bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-400 text-amber-950 shadow-amber-500/30"
        }`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* ILUSTRAÇÃO: SOL (MODO CLARO) */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${
            isDark 
              ? "opacity-0 rotate-90 scale-50 pointer-events-none" 
              : "opacity-100 rotate-0 scale-100"
          }`}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-amber-950"
          >
            {/* Centro do Sol */}
            <circle cx="12" cy="12" r="4.5" />
            {/* Raios do Sol */}
            <path
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              d="M12 2.5v2m0 15v2M2.5 12h2m15 12h2M5.28 5.28l1.42 1.42m10.6 10.6l1.42 1.42M5.28 18.72l1.42-1.42m10.6-10.6l1.42-1.42"
            />
          </svg>
        </div>

        {/* ILUSTRAÇÃO: LUA (MODO ESCURO) */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${
            isDark 
              ? "opacity-100 rotate-0 scale-100" 
              : "opacity-0 -rotate-90 scale-50 pointer-events-none"
          }`}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3.5 h-3.5 text-indigo-950"
          >
            {/* Lua Crescente com acabamento vetorial fino */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z"
            />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;

