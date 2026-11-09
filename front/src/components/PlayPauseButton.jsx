import React from 'react';
import { PlayOpticalIcon, PauseOpticalIcon } from './Icons';

/**
 * Botão Play/Pause 3D Óptico de Console de Estúdio (Ideia 5).
 * Anel concêntrico metálico com halo luminoso reativo, centro óptico para o triângulo de Play
 * e transições explícitas via `studio-btn-transition` (zero `transition-all`).
 */
const PlayPauseButton = ({ isPlaying, isLoaded, togglePlay, size = 'large' }) => {
  const isLarge = size === 'large';
  const outerSize = isLarge ? 'w-20 h-20 md:w-22 md:h-22 p-1.5' : 'w-14 h-14 p-1';
  const iconSize = isLarge ? 'w-8 h-8 md:w-9 md:h-9' : 'w-6 h-6';

  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={!isLoaded}
      aria-label={
        !isLoaded
          ? 'Carregando áudio...'
          : isPlaying
          ? 'Pausar reprodução (Espaço)'
          : 'Iniciar reprodução (Espaço)'
      }
      title={
        !isLoaded
          ? 'Carregando faixas de áudio...'
          : isPlaying
          ? 'Pausar (Espaço)'
          : 'Tocar (Espaço)'
      }
      className={`group relative flex items-center justify-center rounded-full studio-btn-transition active:scale-95 cursor-pointer disabled:cursor-wait disabled:opacity-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/60 ${outerSize} ${
        !isLoaded
          ? 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-md'
          : isPlaying
          ? 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-amber-400/70 shadow-[0_0_32px_rgba(245,158,11,0.42)] hover:scale-105'
          : 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-blue-400/60 shadow-[0_0_32px_rgba(43,105,230,0.45)] hover:scale-105'
      }`}
    >
      {/* Halo pulsante externo quando o transporte está ativo */}
      {isPlaying && isLoaded && (
        <span
          className="absolute inset-0 rounded-full bg-amber-400/25 animate-ping pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Anel interno 3D concêntrico chanfrado */}
      <span
        className={`relative z-10 w-full h-full rounded-full flex items-center justify-center studio-btn-transition overflow-hidden ${
          !isLoaded
            ? 'bg-slate-300 dark:bg-slate-900 text-slate-500'
            : isPlaying
            ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white shadow-inner'
            : 'bg-gradient-to-br from-[var(--color-brand-medium)] via-blue-600 to-[var(--color-brand-dark)] text-white shadow-inner'
        }`}
      >
        {/* Reflexo especular superior do domo 3D */}
        <span
          className="pointer-events-none absolute inset-x-2 top-0.5 h-1/3 rounded-t-full bg-gradient-to-b from-white/30 to-transparent"
          aria-hidden="true"
        />

        {/* LED superior de estado no aro do botão */}
        {isLoaded && (
          <span
            className={`pointer-events-none absolute top-1.5 w-1.5 h-1.5 rounded-full ${
              isPlaying
                ? 'bg-amber-200 shadow-[0_0_6px_#fef08a]'
                : 'bg-cyan-300 shadow-[0_0_6px_#67e8f9]'
            }`}
            aria-hidden="true"
          />
        )}

        {!isLoaded ? (
          <svg
            className="w-7 h-7 text-[var(--color-brand-medium)] dark:text-blue-400 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3.5"
            />
            <path
              className="opacity-85"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : isPlaying ? (
          <PauseOpticalIcon className={`${iconSize} text-white drop-shadow-md`} />
        ) : (
          <PlayOpticalIcon
            className={`${iconSize} text-white translate-x-[2px] drop-shadow-md`}
          />
        )}
      </span>
    </button>
  );
};

export default PlayPauseButton;
