import React, { useRef, useState, useCallback } from 'react';
import StudioTiltCard from './StudioTiltCard';
import { useReducedMotion, useDocumentVisibility } from '../utils/motionTokens';

/**
 * 12 Segmentos do Medidor LED de Estúdio (do topo 12 ao fundo 1 para renderização vertical)
 * 8 Verdes (-48 a -6 dB), 2 Âmbar (-6 a -2 dB), 2 Vermelhos/Rose de Peak (-2 a 0 dB)
 */
const LED_SEGMENTS = [
  { id: 12, threshold: 90, colorClass: 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' },
  { id: 11, threshold: 82, colorClass: 'bg-rose-500 shadow-[0_0_5px_#f43f5e]' },
  { id: 10, threshold: 74, colorClass: 'bg-amber-400 shadow-[0_0_5px_#fbbf24]' },
  { id: 9, threshold: 66, colorClass: 'bg-amber-400 shadow-[0_0_4px_#fbbf24]' },
  { id: 8, threshold: 58, colorClass: 'bg-emerald-400 shadow-[0_0_4px_#34d399]' },
  { id: 7, threshold: 50, colorClass: 'bg-emerald-400' },
  { id: 6, threshold: 42, colorClass: 'bg-emerald-400' },
  { id: 5, threshold: 34, colorClass: 'bg-emerald-500' },
  { id: 4, threshold: 26, colorClass: 'bg-emerald-500' },
  { id: 3, threshold: 18, colorClass: 'bg-emerald-500' },
  { id: 2, threshold: 10, colorClass: 'bg-emerald-500' },
  { id: 1, threshold: 3, colorClass: 'bg-emerald-500' },
];

// Ordenação ascendente para o modo horizontal (Palco)
const LED_SEGMENTS_HORIZONTAL = [...LED_SEGMENTS].reverse();

// Perfis de 16 barras por stem para a Mini-Waveform do Modo Palco (Opção C)
const STEM_WAVE_PROFILES = {
  vocals: [38, 72, 90, 54, 82, 95, 60, 44, 78, 88, 65, 50, 84, 70, 42, 68],
  drums: [92, 48, 88, 42, 95, 52, 86, 46, 94, 58, 82, 44, 90, 50, 85, 62],
  bass: [64, 76, 68, 82, 74, 60, 85, 70, 62, 80, 72, 66, 78, 84, 68, 72],
  guitar: [52, 68, 84, 76, 62, 88, 92, 70, 58, 74, 86, 80, 64, 72, 56, 66],
  piano: [46, 80, 66, 90, 58, 76, 84, 62, 88, 52, 74, 86, 60, 78, 64, 54],
  other: [44, 62, 78, 56, 84, 68, 52, 80, 72, 60, 86, 58, 70, 64, 48, 60],
};

/**
 * Converte a porcentagem do fader (0..100, onde 80% = 0.0 dB Nominal) para leitura técnica em dB
 */
const formatStemDb = (volumePercent, isEffectivelyMuted) => {
  if (isEffectivelyMuted || volumePercent <= 0) return '-∞ dB';
  if (volumePercent === 80) return '0.0 dB';
  const db = 20 * Math.log10(volumePercent / 80);
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

/**
 * Channel Strip Profissional Dual-Mode (Ideia 2):
 * - Opção A (`consoleMode === 'daw'`): Bancada Vertical 3D com Fader Cap esculpido, escala dB e LED Bargraph de 12 segmentos.
 * - Opção C (`consoleMode === 'stage'`): Faixa Horizontal de Palco/Mobile com Mini-Waveform reativa, botões M/S 40x40px+ e LED Meter.
 * Reage em tempo real a `--level-{track}` sem re-renderizar a árvore React a 60fps.
 */
const StudioChannelStrip = ({
  track,
  channelNumber = 1,
  config,
  volume = 80,
  isMuted = false,
  isSolo = false,
  isEffectivelyMuted = false,
  isPlaying = false,
  consoleMode = 'daw', // 'daw' | 'stage'
  progressPercent = 0,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onHoverStart,
  onHoverEnd,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const isTabVisible = useDocumentVisibility();

  const verticalTrackRef = useRef(null);
  const [isDraggingFader, setIsDraggingFader] = useState(false);

  const dbLabel = formatStemDb(volume, isEffectivelyMuted);
  const isAudible = !isEffectivelyMuted && volume > 0;

  // Calcula o volume [0..100] a partir da posição vertical do ponteiro na trilha 3D
  const updateVolumeFromVerticalPointer = useCallback(
    (clientY) => {
      const el = verticalTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.height) return;
      const relativeY = clientY - rect.top;
      const ratio = 1 - Math.min(1, Math.max(0, relativeY / rect.height));
      const nextVol = Math.round(ratio * 100);
      onVolumeChange?.(track, nextVol);
    },
    [onVolumeChange, track]
  );

  const handlePointerDownVertical = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignora caso pointerId não seja capturável
      }
    }
    setIsDraggingFader(true);
    updateVolumeFromVerticalPointer(e.clientY);
  };

  const handlePointerMoveVertical = (e) => {
    if (!isDraggingFader) return;
    updateVolumeFromVerticalPointer(e.clientY);
  };

  const handlePointerUpVertical = (e) => {
    if (!isDraggingFader) return;
    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
    }
    setIsDraggingFader(false);
  };

  const handleDoubleClickReset = () => {
    onVolumeChange?.(track, 80);
  };

  // =========================================================================
  // MODO PALCO / HORIZONTAL (OPÇÃO C)
  // =========================================================================
  if (consoleMode === 'stage') {
    const waveHeights = STEM_WAVE_PROFILES[track] || STEM_WAVE_PROFILES.other;

    return (
      <StudioTiltCard
        maxTilt={1.6}
        hoverScale={1.005}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        style={{
          '--stem-level': isAudible ? `var(--level-${track}, 0)` : 0,
          '--stem-accent': config.accentHex,
        }}
        className={`relative rounded-2xl p-3.5 sm:p-4 border-2 shadow-md ${
          isEffectivelyMuted
            ? 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-300/80 dark:border-slate-800 opacity-65'
            : isSolo
            ? 'bg-amber-50/75 dark:bg-amber-950/35 border-amber-400 shadow-amber-500/15 ring-1 ring-amber-400/50'
            : 'bg-white/95 dark:bg-[#0B1325]/95 border-slate-200/90 dark:border-slate-800 hover:border-blue-400/70 dark:hover:border-blue-500/60'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Bloco Esquerdo: Número do Canal + Ícone + Nome + Botões M e S Táteis (>= 40x40px) */}
          <div className="flex items-center justify-between lg:justify-start gap-3 min-w-[240px]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 flex items-center justify-center p-2 shadow-inner shrink-0">
                <img
                  src={config.iconSrc}
                  alt={config.label}
                  className="w-full h-full object-contain"
                />
                <span
                  className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 rounded-md text-[9px] font-mono font-black text-white shadow-xs"
                  style={{ backgroundColor: config.accentHex }}
                  title={`Atalho de Teclado: ${channelNumber} (Mute) / Shift+${channelNumber} (Solo)`}
                >
                  CH {channelNumber}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {config.label}
                  </h4>
                  {isSolo && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-amber-400 text-slate-950">
                      SOLO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] font-bold tabular-nums">
                  <span style={{ color: config.accentHex }}>{volume}%</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-slate-500 dark:text-slate-400">{dbLabel}</span>
                </div>
              </div>
            </div>

            {/* Botões M e S de Palco (40x40px para toque imediato) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-pressed={isSolo}
                onClick={() => onToggleSolo?.(track)}
                title={`Solo ${config.label} (Atalho: Shift+${channelNumber})`}
                className={`w-10 h-10 rounded-xl font-mono text-xs font-black border studio-btn-transition active:scale-95 cursor-pointer flex flex-col items-center justify-center leading-none ${
                  isSolo
                    ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                <span>S</span>
                <span className="text-[8px] opacity-65 mt-0.5">⇧{channelNumber}</span>
              </button>

              <button
                type="button"
                aria-pressed={isMuted}
                onClick={() => onToggleMute?.(track)}
                title={`Mutar ${config.label} (Atalho: Tecla ${channelNumber})`}
                className={`w-10 h-10 rounded-xl font-mono text-xs font-black border studio-btn-transition active:scale-95 cursor-pointer flex flex-col items-center justify-center leading-none ${
                  isMuted
                    ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                    : 'bg-slate-800 dark:bg-slate-800 text-white border-slate-700 hover:border-rose-400'
                }`}
              >
                <span>M</span>
                <span className="text-[8px] opacity-65 mt-0.5">[{channelNumber}]</span>
              </button>
            </div>
          </div>

          {/* Bloco Central: Mini-Waveform de 16 Barras + Medidor LED Horizontal de 12 Segmentos */}
          <div className="flex items-center gap-3 flex-1">
            {/* Mini-Waveform de 16 barras */}
            <div
              className="hidden sm:flex items-center gap-0.5 h-9 px-2.5 bg-slate-100/90 dark:bg-slate-950/85 rounded-xl border border-slate-200/80 dark:border-slate-800 shrink-0"
              aria-hidden="true"
            >
              {waveHeights.map((h, idx) => {
                const scaledHeight = isAudible
                  ? Math.max(16, Math.round((h * volume) / 100))
                  : 12;
                const isPassed = (idx / waveHeights.length) * 100 <= progressPercent;
                return (
                  <span
                    key={idx}
                    className="w-1 rounded-full transition-transform duration-150"
                    style={{
                      height: `${scaledHeight}%`,
                      backgroundColor: isAudible
                        ? isPassed
                          ? config.accentHex
                          : 'rgba(148, 163, 184, 0.45)'
                        : 'rgba(148, 163, 184, 0.2)',
                      transform:
                        isPlaying && isAudible && !prefersReducedMotion && isTabVisible
                          ? `scaleY(${idx % 2 === 0 ? 1.12 : 0.88})`
                          : 'scaleY(1)',
                    }}
                  />
                );
              })}
            </div>

            {/* Fader Horizontal + Medidor LED Horizontal 12 Segmentos */}
            <div className="flex-1 flex flex-col gap-1.5">
              {/* Barra de 12 LEDs Horizontais em tempo real */}
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800"
                title="Medidor de nível em tempo real (Tone.Meter)"
              >
                <span className="text-[8px] font-mono font-bold text-slate-400 mr-1">
                  LVL
                </span>
                <div className="flex-1 grid grid-cols-12 gap-1 h-1.5">
                  {LED_SEGMENTS_HORIZONTAL.map((seg) => (
                    <span
                      key={seg.id}
                      className={`rounded-xs studio-led-segment ${seg.colorClass}`}
                      style={{ '--seg-threshold': seg.threshold }}
                    />
                  ))}
                </div>
              </div>

              {/* Slider Horizontal com duplo clique para 80% */}
              <div className="flex items-center gap-2.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onDoubleClick={handleDoubleClickReset}
                  onChange={(e) => onVolumeChange?.(track, e.target.value)}
                  aria-label={`Volume de ${config.label}`}
                  title="Arraste para ajustar ou dê duplo clique para resetar a 80% (0.0 dB)"
                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, ${config.accentHex} ${volume}%, #334155 ${volume}%)`,
                  }}
                />
                <button
                  type="button"
                  onClick={handleDoubleClickReset}
                  title="Resetar canal para 80% (0.0 dB Nominal)"
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 tabular-nums cursor-pointer"
                >
                  0dB
                </button>
              </div>
            </div>
          </div>
        </div>
      </StudioTiltCard>
    );
  }

  // =========================================================================
  // MODO BANCADA DAW VERTICAL 3D (OPÇÃO A — PADRÃO)
  // =========================================================================
  return (
    <StudioTiltCard
      maxTilt={2.2}
      hoverScale={1.01}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      style={{
        '--stem-level': isAudible ? `var(--level-${track}, 0)` : 0,
        '--stem-accent': config.accentHex,
      }}
      className={`relative rounded-2xl p-3.5 md:p-4 flex flex-col items-center justify-between border-2 shadow-lg select-none ${
        isEffectivelyMuted
          ? 'bg-slate-100/85 dark:bg-slate-900/55 border-slate-300 dark:border-slate-800 opacity-65'
          : isSolo
          ? 'bg-amber-50/75 dark:bg-[#111A2E] border-amber-400 shadow-amber-500/20 ring-2 ring-amber-400/60'
          : 'bg-white/95 dark:bg-[#0B1325]/95 backdrop-blur-md border-slate-200/90 dark:border-slate-800 hover:border-blue-400/80 dark:hover:border-blue-500/70'
      }`}
    >
      {/* Topo do Canal: Badge CH + Atalho + LED de Sinal */}
      <div className="relative z-10 w-full flex items-center justify-between text-[10px] font-mono font-black mb-2">
        <span
          className="px-1.5 py-0.5 rounded-md text-white shadow-2xs"
          style={{ backgroundColor: config.accentHex }}
          title={`Canal ${channelNumber} • Tecla [${channelNumber}] Mute / [Shift+${channelNumber}] Solo`}
        >
          CH 0{channelNumber}
        </span>

        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-400">
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] studio-led-segment"
            style={{ '--seg-threshold': 5 }}
          />
          <kbd className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[9px]">
            {channelNumber}
          </kbd>
        </span>
      </div>

      {/* Ícone e Nome do Instrumento/Stem */}
      <div className="relative z-10 w-full flex flex-col items-center text-center mb-2">
        <div
          className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center p-2 shadow-inner mb-1.5"
          style={{
            boxShadow: isAudible && isPlaying ? `0 0 16px ${config.accentHex}30` : undefined,
          }}
        >
          <img
            src={config.iconSrc}
            alt={config.label}
            className="w-full h-full object-contain drop-shadow-xs"
          />
        </div>
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 truncate max-w-full">
          {config.label}
        </h4>
      </div>

      {/* ===================================================================== */}
      {/* BANCADA CENTRAL: TRILHO 3D DO FADER + ESCALA DB + BARGRAPH 12 LEDS    */}
      {/* ===================================================================== */}
      <div className="relative z-10 flex items-center justify-center gap-2.5 h-52 w-full my-1.5 px-1">
        {/* Escala Técnica Graduada em Decibéis (Esquerda) */}
        <div
          className="h-44 flex flex-col justify-between text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 text-right pr-0.5 pointer-events-none select-none tabular-nums"
          aria-hidden="true"
        >
          <span className="text-amber-500 dark:text-amber-400">+2</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-black">0dB</span>
          <span>-6</span>
          <span>-12</span>
          <span>-24</span>
          <span>-∞</span>
        </div>

        {/* Trilho Vertical Escavado com Fader Cap 3D Motorizado */}
        <div
          ref={verticalTrackRef}
          onPointerDown={handlePointerDownVertical}
          onPointerMove={handlePointerMoveVertical}
          onPointerUp={handlePointerUpVertical}
          onPointerCancel={handlePointerUpVertical}
          onDoubleClick={handleDoubleClickReset}
          title="Arraste o Fader 3D ou dê duplo clique para retornar a 80% (0.0 dB Nominal)"
          className="relative h-44 w-9 flex items-center justify-center cursor-ns-resize touch-none"
        >
          {/* Marcações horizontais de estúdio atrás da fenda */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between py-1"
            aria-hidden="true"
          >
            {[0, 1, 2, 3, 4, 5].map((tick) => (
              <div
                key={tick}
                className={`w-full border-b ${
                  tick === 1
                    ? 'border-emerald-500/50 dark:border-emerald-400/50'
                    : 'border-slate-300/60 dark:border-slate-700/70'
                }`}
              />
            ))}
          </div>

          {/* Fenda Central Escavada do Console */}
          <div className="relative w-2.5 h-full rounded-full studio-fader-slot overflow-hidden">
            {/* Preenchimento luminoso na cor do Stem */}
            <div
              className="w-full rounded-full absolute bottom-0 inset-x-0 transition-[height] duration-75"
              style={{
                height: `${volume}%`,
                backgroundColor: config.accentHex,
                boxShadow: `0 0 10px ${config.accentHex}`,
                opacity: isEffectivelyMuted ? 0.3 : 0.9,
              }}
            />
          </div>

          {/* Fader Cap 3D Esculpido (Knob Deslizante Metálico) */}
          <div
            className={`studio-fader-cap pointer-events-none absolute left-1/2 -translate-x-1/2 w-8 h-5 rounded-md border flex flex-col items-center justify-center gap-0.5 ${
              isDraggingFader
                ? 'scale-105 border-blue-400'
                : 'border-slate-500/80 dark:border-slate-500/70'
            }`}
            style={{
              bottom: `calc(${volume}% - 10px)`,
            }}
            aria-hidden="true"
          >
            <span className="w-5 h-px bg-slate-400/40" />
            {/* Linha central óptica luminosa na cor do stem */}
            <span
              className="w-6 h-0.5 rounded-full"
              style={{
                backgroundColor: isEffectivelyMuted ? '#64748b' : config.accentHex,
                boxShadow: isEffectivelyMuted ? 'none' : `0 0 6px ${config.accentHex}`,
              }}
            />
            <span className="w-5 h-px bg-slate-400/40" />
          </div>

          {/* Input range nativo sincronizado para acessibilidade por teclado (Tab + Setas) */}
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange?.(track, e.target.value)}
            aria-label={`Volume de ${config.label} (${volume}%, ${dbLabel})`}
            className="sr-only"
          />
        </div>

        {/* Medidor LED Vertical de 12 Segmentos em Tempo Real (Tone.Meter -> --stem-level) */}
        <div
          className="h-44 w-3.5 rounded-lg bg-slate-950 border border-slate-800 p-1 flex flex-col justify-between shadow-inner"
          title={`Medidor de Nível Real (${config.label})`}
          aria-hidden="true"
        >
          {LED_SEGMENTS.map((seg) => (
            <span
              key={seg.id}
              className={`w-full h-2 rounded-[2px] studio-led-segment ${seg.colorClass}`}
              style={{ '--seg-threshold': seg.threshold }}
            />
          ))}
        </div>
      </div>

      {/* Visor Digital Duplo do Canal (% + dB em tabular-nums) */}
      <div
        onDoubleClick={handleDoubleClickReset}
        title="Duplo clique para restaurar a 80% (0.0 dB)"
        className="relative z-10 w-full my-1.5 py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between font-mono tabular-nums cursor-pointer"
      >
        <span className="text-xs font-black text-slate-900 dark:text-white">
          {volume}%
        </span>
        <span
          className={`text-[10px] font-bold ${
            isEffectivelyMuted
              ? 'text-rose-500 dark:text-rose-400'
              : volume === 80
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {dbLabel}
        </span>
      </div>

      {/* Botões de Console: SOLO (Shift+1..6) e MUTE (1..6) */}
      <div className="relative z-10 grid grid-cols-2 gap-1.5 w-full mt-1">
        <button
          type="button"
          aria-pressed={isSolo}
          onClick={() => onToggleSolo?.(track)}
          title={`Isolar faixa ${config.label} (Atalho: Shift+${channelNumber})`}
          className={`py-2 rounded-xl text-[11px] font-mono font-black tracking-wider border studio-btn-transition active:scale-95 cursor-pointer ${
            isSolo
              ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}
        >
          SOLO
        </button>

        <button
          type="button"
          aria-pressed={isMuted}
          onClick={() => onToggleMute?.(track)}
          title={`Silenciar faixa ${config.label} (Atalho: Tecla ${channelNumber})`}
          className={`py-2 rounded-xl text-[11px] font-mono font-black tracking-wider border studio-btn-transition active:scale-95 cursor-pointer ${
            isMuted
              ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.4)]'
              : 'bg-slate-800 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-white border-slate-700'
          }`}
        >
          {isMuted ? 'MUDO' : 'MUTE'}
        </button>
      </div>
    </StudioTiltCard>
  );
};

export default StudioChannelStrip;
