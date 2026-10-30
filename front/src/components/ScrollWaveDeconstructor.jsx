import React, { useRef } from 'react';
import { useSectionScrollProgress } from '../utils/motionTokens';
import { ScissorsIcon, BoltAiIcon } from './Icons';

const STEM_WAVE_LANES = [
  {
    id: 'vocals',
    name: 'Vocais',
    freq: '85 Hz – 12 kHz',
    db: '-2.1 dB',
    colorHex: '#a855f7',
    badgeClass:
      'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    dotClass: 'bg-purple-500',
    // Caminho SVG com formantes vocais suaves e expressivas
    wavePath:
      'M 0 24 Q 30 6, 60 24 T 120 24 Q 150 4, 180 24 T 240 24 Q 270 10, 300 24 T 360 24 Q 390 5, 420 24 T 480 24 Q 510 12, 540 24 T 600 24',
  },
  {
    id: 'drums',
    name: 'Bateria',
    freq: '20 Hz – 16 kHz',
    db: '-0.8 dB',
    colorHex: '#f59e0b',
    badgeClass:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
    // Transientes percussivos agudos (bumbo e caixa)
    wavePath:
      'M 0 24 L 20 24 L 28 4 L 36 44 L 44 24 L 95 24 L 104 3 L 112 45 L 120 24 L 175 24 L 184 6 L 192 42 L 200 24 L 260 24 L 268 3 L 276 45 L 284 24 L 345 24 L 354 5 L 362 43 L 370 24 L 430 24 L 438 4 L 446 44 L 454 24 L 515 24 L 524 6 L 532 42 L 540 24 L 600 24',
  },
  {
    id: 'bass',
    name: 'Baixo',
    freq: '32 Hz – 800 Hz',
    db: '-1.5 dB',
    colorHex: '#10b981',
    badgeClass:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    // Senoide grave de longo comprimento de onda (Sub-bass groove)
    wavePath:
      'M 0 24 Q 50 4, 100 24 T 200 24 Q 250 5, 300 24 T 400 24 Q 450 4, 500 24 T 600 24',
  },
  {
    id: 'guitar',
    name: 'Guitarra',
    freq: '80 Hz – 8 kHz',
    db: '-3.0 dB',
    colorHex: '#3b82f6',
    badgeClass:
      'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-500',
    // Harmônicos densos de guitarra base e solo
    wavePath:
      'M 0 24 Q 15 8, 30 24 T 60 24 Q 75 6, 90 24 T 120 24 Q 135 9, 150 24 T 180 24 Q 195 5, 210 24 T 240 24 Q 255 8, 270 24 T 300 24 Q 315 6, 330 24 T 360 24 Q 375 9, 390 24 T 420 24 Q 435 5, 450 24 T 480 24 Q 495 10, 510 24 T 540 24 Q 555 7, 570 24 T 600 24',
  },
  {
    id: 'piano',
    name: 'Piano / Teclas',
    freq: '27 Hz – 10 kHz',
    db: '-4.2 dB',
    colorHex: '#ec4899',
    badgeClass:
      'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
    dotClass: 'bg-pink-500',
    // Envelope de ataque rápido e decaimento harmônico (voicings)
    wavePath:
      'M 0 24 Q 25 7, 50 24 T 100 24 Q 125 11, 150 24 T 200 24 Q 225 6, 250 24 T 300 24 Q 325 12, 350 24 T 400 24 Q 425 7, 450 24 T 500 24 Q 525 11, 550 24 T 600 24',
  },
  {
    id: 'other',
    name: 'Outros / FX',
    freq: 'Full Spectrum',
    db: '-5.4 dB',
    colorHex: '#64748b',
    badgeClass:
      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    dotClass: 'bg-slate-500',
    // Textura atmosférica / synths e cordas
    wavePath:
      'M 0 24 Q 40 12, 80 24 T 160 24 Q 200 10, 240 24 T 320 24 Q 360 12, 400 24 T 480 24 Q 520 10, 560 24 T 600 24',
  },
];

/**
 * Componente de Storytelling Scroll-Scrub ("Desconstrução de Onda em 6 Faixas").
 * Conforme o usuário rola a página, uma Forma de Onda Master única se divide
 * proporcionalmente ao scroll nas 6 faixas cromáticas isoladas pelo Demucs v4 HT-6s.
 */
const ScrollWaveDeconstructor = ({
  selectedStem = 'vocals',
  onSelectStem,
}) => {
  const containerRef = useRef(null);
  const scrollProgress = useSectionScrollProgress(containerRef);

  // Curva suave (smoothstep) para que a separação tenha início e pouso orgânicos
  const splitFactor =
    scrollProgress * scrollProgress * (3 - 2 * scrollProgress);
  const splitPercent = Math.round(splitFactor * 100);

  return (
    <div ref={containerRef} className="mb-8">
      {/* Concentric Radius: Outer rounded-3xl (24px) com p-2 (8px) -> Inner rounded-2xl (16px) */}
      <div className="rounded-3xl p-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl backdrop-blur-md">
        <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/90 p-5 sm:p-7 overflow-hidden">
          {/* Cabeçalho de Telemetria do Scroll-Scrub */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                <ScissorsIcon className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    Desconstrução Espectral
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Role a página para ver a mixagem Master se dividir nas 6 faixas isoladas (clique em uma faixa para inspecionar)
                </p>
              </div>
            </div>

            {/* Medidor Numérico em Tabular Nums */}
            <div className="flex items-center gap-3 self-start sm:self-auto tabular-nums">
              <div className="text-right">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Separação Neural
                </span>
                <span className="text-sm sm:text-base font-mono font-black text-[var(--color-brand-medium)] dark:text-blue-400">
                  {splitPercent}% ISOLADO
                </span>
              </div>
              <div className="w-20 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/70 dark:border-slate-700/70">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-brand-medium)] via-indigo-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.max(8, splitPercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Palco Visual: Feixe Master Unificado -> 6 Canais Isolados */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Coluna Esquerda (3 Colunas): Nó de Entrada Master Mix */}
            <div className="lg:col-span-3 flex flex-col items-center lg:items-start text-center lg:text-left p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ENTRADA • MASTER BUS
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                Mixagem Original (Stereo)
              </span>

              {/* Mini Onda Master Unificada */}
              <div className="w-full h-11 my-2.5 px-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center">
                <svg
                  viewBox="0 0 240 40"
                  className="w-full h-8 text-[var(--color-brand-medium)] dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M 0 20 Q 15 4, 30 20 T 60 20 Q 75 2, 90 20 T 120 20 Q 135 5, 150 20 T 180 20 Q 195 3, 210 20 T 240 20" />
                </svg>
              </div>

              <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                <span>20 Hz – 20 kHz</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  ● Fase 0°
                </span>
              </div>
            </div>

            {/* Coluna Central/Direita (9 Colunas): As 6 Faixas que se abrem no Scroll */}
            <div className="lg:col-span-9 relative py-2">
              <div className="space-y-2">
                {STEM_WAVE_LANES.map((lane, index) => {
                  // Distância do centro (índices 0..5 -> offsets -2.5, -1.5, -0.5, +0.5, +1.5, +2.5)
                  const centerOffset = index - 2.5;
                  // Quando splitFactor = 0, as faixas convergem para o centro; quando = 1, ficam em suas posições reais
                  const collapsedY = -centerOffset * 34 * (1 - splitFactor);
                  const isActive = selectedStem === lane.id;

                  return (
                    <button
                      key={lane.id}
                      type="button"
                      onClick={() => onSelectStem?.(lane.id)}
                      style={{
                        transform: `translate3d(0, ${collapsedY.toFixed(1)}px, 0) scale(${
                          0.97 + splitFactor * 0.03
                        })`,
                        opacity: 0.45 + splitFactor * 0.55,
                      }}
                      className={`w-full px-3.5 py-2 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer studio-btn-transition ${
                        isActive
                          ? 'bg-slate-100/95 dark:bg-slate-800/95 border-[var(--color-brand-medium)] dark:border-blue-400 shadow-sm'
                          : 'bg-slate-50/85 dark:bg-slate-900/75 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Identificação da Faixa */}
                      <div className="flex items-center gap-2.5 min-w-[130px] sm:min-w-[155px] shrink-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${lane.dotClass}`}
                        />
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {lane.name}
                        </span>
                      </div>

                      {/* Forma de Onda Vetorial Colorida da Faixa */}
                      <div className="flex-1 h-7 overflow-hidden flex items-center">
                        <svg
                          viewBox="0 0 600 48"
                          className="w-full h-7"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            d={lane.wavePath}
                            fill="none"
                            stroke={lane.colorHex}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              strokeDasharray: 620,
                              strokeDashoffset: Math.round(
                                (1 - Math.max(0.25, splitFactor)) * 260
                              ),
                            }}
                          />
                        </svg>
                      </div>

                      {/* Metadados Espectrais (Freq + Ganho dB) */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0 tabular-nums">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${lane.badgeClass}`}
                        >
                          {lane.freq}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 w-14 text-right">
                          {lane.db}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrollWaveDeconstructor;

