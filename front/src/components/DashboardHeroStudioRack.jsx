import React, { useState, useEffect, useMemo } from 'react';
import {
  useReducedMotion,
  useDocumentVisibility,
  useAnimatedCounter,
} from '../utils/motionTokens';

const DRIVE_PRESETS = [
  { id: 'warm', label: 'Warm Bias', angle: -38, needleBase: -14, glowClass: 'from-amber-500/35 to-orange-500/20', dbText: '-2.4 dBFS' },
  { id: 'crunch', label: 'Studio Drive', angle: 12, needleBase: 4, glowClass: 'from-amber-400/50 to-blue-500/35', dbText: '-0.6 dBFS' },
  { id: 'hot', label: 'Full Tube', angle: 52, needleBase: 18, glowClass: 'from-orange-500/60 to-purple-500/40', dbText: '+1.2 dBFS' },
];

/**
 * Medidor VU Analógico Vetorial com Agulha Balística e Zona Vermelha (+3 dB)
 */
const AnalogVuMeter = ({
  channelLabel = 'CH L',
  needleAngle = -28,
  isEnergized = true,
  isPeak = false,
}) => {
  return (
    <div className="relative rounded-xl bg-gradient-to-b from-slate-900 via-[#0E172A] to-slate-950 border border-slate-700/80 p-2.5 shadow-inner overflow-hidden select-none">
      {/* Iluminação de fundo âmbar clássica de VU analógico */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          isEnergized ? 'opacity-100' : 'opacity-25'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 95%, rgba(245, 158, 11, 0.24), rgba(59, 130, 246, 0.08) 55%, transparent 80%)',
        }}
      />

      {/* Cabeçalho do Medidor */}
      <div className="relative z-10 flex items-center justify-between text-[9px] font-mono font-bold tracking-wider mb-1">
        <span className="text-slate-400">{channelLabel}</span>
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isPeak
                ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                : isEnergized
                ? 'bg-emerald-400 shadow-[0_0_5px_#34d399]'
                : 'bg-slate-600'
            }`}
          />
          <span className={isPeak ? 'text-rose-400' : 'text-amber-300/90'}>
            {isPeak ? 'PEAK' : 'VU'}
          </span>
        </span>
      </div>

      {/* Escala Curva + Agulha Balística SVG */}
      <svg
        viewBox="0 0 120 62"
        className="w-full h-12 overflow-visible relative z-10"
        aria-hidden="true"
      >
        {/* Arco principal de medição (-20dB até 0dB) */}
        <path
          d="M 14 52 A 48 48 0 0 1 88 22"
          fill="none"
          stroke="rgba(148, 163, 184, 0.45)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Arco de sobrecarga (0dB até +3dB em vermelho/âmbar) */}
        <path
          d="M 88 22 A 48 48 0 0 1 106 52"
          fill="none"
          stroke="rgba(244, 63, 94, 0.85)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Marcações de escala */}
        <text x="14" y="42" fill="#94a3b8" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
          -20
        </text>
        <text x="38" y="24" fill="#94a3b8" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
          -7
        </text>
        <text x="64" y="19" fill="#fbbf24" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
          0
        </text>
        <text x="90" y="29" fill="#fb7185" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
          +3
        </text>

        {/* Agulha do VU Meter */}
        <g
          className="vu-needle-ballistics"
          style={{
            transform: `rotate(${needleAngle}deg)`,
          }}
        >
          <line
            x1="60"
            y1="55"
            x2="60"
            y2="12"
            stroke={isEnergized ? '#fbbf24' : '#64748b'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="60" cy="14" r="1.6" fill={isPeak ? '#f43f5e' : '#fbbf24'} />
        </g>

        {/* Pivô Metálico Inferior */}
        <circle
          cx="60"
          cy="55"
          r="5"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="1.2"
        />
        <circle cx="60" cy="55" r="2" fill="#94a3b8" />
      </svg>
    </div>
  );
};

/**
 * Válvula Termiônica 3D/SVG (12AX7 / EL34) com Filamento Incandescente
 */
const VacuumTubeUnit = ({
  code = '12AX7',
  isEnergized = true,
  driveIndex = 1,
  prefersReducedMotion = false,
}) => {
  const filamentOpacity = !isEnergized
    ? 0.15
    : driveIndex === 2
    ? 0.98
    : driveIndex === 1
    ? 0.85
    : 0.68;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-10 h-14 rounded-t-full rounded-b-md bg-gradient-to-b from-slate-800/90 via-slate-900/95 to-slate-950 border border-slate-700/80 shadow-inner flex items-center justify-center overflow-hidden">
        {/* Halo de aquecimento interno da válvula */}
        <div
          className={`absolute inset-1 rounded-t-full bg-gradient-to-t from-amber-500 via-orange-400/70 to-blue-400/30 blur-xs transition-opacity duration-500 ${
            isEnergized && !prefersReducedMotion ? 'animate-tube-glow' : ''
          }`}
          style={{ opacity: filamentOpacity }}
        />

        {/* Estrutura metálica interna (Anodo + Grade + Filamento) */}
        <svg viewBox="0 0 40 56" className="w-full h-full relative z-10" aria-hidden="true">
          {/* Reflexo de vidro fumê (Smoked Glass) */}
          <path
            d="M 10 8 Q 10 3, 18 3"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          {/* Placas metálicas internas */}
          <rect
            x="11"
            y="14"
            width="18"
            height="24"
            rx="2"
            fill="rgba(15, 23, 42, 0.72)"
            stroke="rgba(148, 163, 184, 0.45)"
            strokeWidth="1"
          />
          {/* Filamento central incandescente */}
          <circle
            cx="20"
            cy="26"
            r="4.5"
            fill={isEnergized ? '#fbbf24' : '#334155'}
            opacity={isEnergized ? 0.95 : 0.35}
          />
          <circle
            cx="20"
            cy="18"
            r="2.2"
            fill={isEnergized ? '#60a5fa' : '#334155'}
            opacity={isEnergized ? 0.85 : 0.2}
          />
          {/* Base metálica de pinos */}
          <rect x="8" y="42" width="24" height="10" rx="1.5" fill="#334155" />
          <line x1="8" y1="45" x2="32" y2="45" stroke="#64748b" strokeWidth="1" />
        </svg>
      </div>
      <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
        {code}
      </span>
    </div>
  );
};

/**
 * Knob Rotativo Tátil de Estúdio (Potenciômetro de Precisão)
 */
const StudioRotaryKnob = ({
  label,
  valueLabel,
  angle = 0,
  accentColor = '#3b82f6',
  onClick,
  title,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="group flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-slate-800/70 studio-btn-transition active:scale-95 cursor-pointer"
  >
    <div className="relative w-10 h-10 rounded-full bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border border-slate-600 group-hover:border-blue-400/80 shadow-md flex items-center justify-center">
      {/* Anel externo serrilhado */}
      <div
        className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center transition-transform duration-200"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        {/* Marcador luminoso de posição do potenciômetro */}
        <span
          className="w-1 h-3 rounded-full -translate-y-1.5"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
          }}
        />
      </div>
    </div>
    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-slate-200">
      {label}
    </span>
    <span className="text-[10px] font-mono font-bold text-blue-400 tabular-nums max-w-[78px] truncate">
      {valueLabel}
    </span>
  </button>
);

/**
 * Cone de Monitor de Referência Acústica (Nearfield Woofer)
 */
const ReferenceMonitorDriver = ({
  side = 'L',
  isEnergized = true,
  isPulsing = false,
}) => (
  <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
    <div className="relative w-11 h-11 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-inner">
      {/* Anel de suspensão acústica iluminado */}
      <div
        className={`w-8 h-8 rounded-full border border-emerald-400/50 bg-gradient-to-br from-emerald-500/25 via-slate-900 to-cyan-500/25 flex items-center justify-center ${
          isEnergized && isPulsing ? 'animate-monitor-cone' : ''
        }`}
      >
        {/* Dust cap central do woofer */}
        <div
          className={`w-3.5 h-3.5 rounded-full border ${
            isEnergized
              ? 'bg-emerald-400/30 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : 'bg-slate-800 border-slate-700'
          }`}
        />
      </div>
    </div>
    <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest">
      MON {side}
    </span>
  </div>
);

/**
 * Hardware 2.5D/SVG Interativo no Hero do Dashboard:
 * Combina Cabeçote Valvulado (Tube Amp), Microfone Phantom +48V,
 * Duplo VU Meter Analógico e Monitores de Referência com Knobs de Bancada.
 */
const DashboardHeroStudioRack = ({
  metrics = { total: 0, genreCount: 0, instrumentCount: 0 },
  hoveredSong = null,
  studioLiveMode = true,
  onToggleStudioLive,
  phantomPower = true,
  onTogglePhantomPower,
  filterGenre = '',
  availableGenres = [],
  onSelectGenre,
  viewMode = 'list',
  onToggleViewMode,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const isTabVisible = useDocumentVisibility();

  const [driveIndex, setDriveIndex] = useState(1); // 0: Warm, 1: Studio Drive, 2: Full Tube
  const [idleTick, setIdleTick] = useState(0);

  // Contadores animados em tabular-nums
  const animatedTotalSongs = useAnimatedCounter(metrics.total, true);
  const animatedTotalGenres = useAnimatedCounter(metrics.genreCount, true);

  // Oscilação orgânica suave para as agulhas do VU quando o estúdio está ligado
  useEffect(() => {
    if (!studioLiveMode || prefersReducedMotion || !isTabVisible) {
      return undefined;
    }
    const timer = setInterval(() => {
      setIdleTick((t) => (t + 1) % 12);
    }, 360);
    return () => clearInterval(timer);
  }, [studioLiveMode, prefersReducedMotion, isTabVisible]);

  const currentDrive = DRIVE_PRESETS[driveIndex] || DRIVE_PRESETS[1];

  // Calcula os ângulos das agulhas L/R do VU Meter de forma pura durante o render
  const { leftNeedleAngle, rightNeedleAngle, isPeakSignal } = useMemo(() => {
    if (!studioLiveMode) {
      return { leftNeedleAngle: -38, rightNeedleAngle: -38, isPeakSignal: false };
    }

    const waveOffsets = [-4, 3, -2, 6, 1, -3, 5, -1, 4, -2, 7, 0];
    const deltaL = waveOffsets[idleTick % waveOffsets.length];
    const deltaR = waveOffsets[(idleTick + 5) % waveOffsets.length];

    // Se o usuário estiver inspecionando uma música com o mouse, o sinal sobe!
    const hoverBoost = hoveredSong ? 16 : 0;
    const phantomBoost = phantomPower ? 4 : 0;

    const rawLeft = currentDrive.needleBase + hoverBoost + phantomBoost + deltaL;
    const rawRight = currentDrive.needleBase + hoverBoost + phantomBoost + deltaR - 2;

    const clampedLeft = Math.min(36, Math.max(-36, rawLeft));
    const clampedRight = Math.min(36, Math.max(-36, rawRight));

    return {
      leftNeedleAngle: clampedLeft,
      rightNeedleAngle: clampedRight,
      isPeakSignal: clampedLeft >= 24 || clampedRight >= 24,
    };
  }, [studioLiveMode, idleTick, hoveredSong, phantomPower, currentDrive]);

  // Cicla pelo filtro de gêneros ao clicar no knob "GENRE TUNER"
  const handleCycleGenreKnob = () => {
    if (!onSelectGenre || availableGenres.length === 0) return;
    if (!filterGenre) {
      onSelectGenre(availableGenres[0]);
      return;
    }
    const currentIndex = availableGenres.indexOf(filterGenre);
    if (currentIndex === -1 || currentIndex + 1 >= availableGenres.length) {
      onSelectGenre('');
    } else {
      onSelectGenre(availableGenres[currentIndex + 1]);
    }
  };

  const genreKnobAngle = useMemo(() => {
    if (!filterGenre || availableGenres.length === 0) return -45;
    const idx = availableGenres.indexOf(filterGenre);
    if (idx === -1) return -45;
    return Math.round(-30 + (idx / Math.max(1, availableGenres.length - 1)) * 90);
  }, [filterGenre, availableGenres]);

  return (
    /* Concentric Radius: Outer rounded-2xl (16px) p-1.5 -> Inner rounded-xl (12px) */
    <div className="w-full lg:w-[470px] xl:w-[510px] shrink-0 rounded-2xl p-1.5 bg-gradient-to-b from-slate-200/90 via-slate-300/70 to-blue-200/60 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 border border-slate-300/90 dark:border-slate-700/90 shadow-xl">
      <div className="rounded-xl bg-[#0B1325] text-slate-100 border border-slate-800 overflow-hidden relative">
        {/* Glow interno reativo das válvulas e amplificador */}
        <div
          className={`pointer-events-none absolute -top-12 left-1/3 w-52 h-32 rounded-full bg-gradient-to-r ${currentDrive.glowClass} blur-2xl transition-opacity duration-500 ${
            studioLiveMode ? 'opacity-100' : 'opacity-15'
          }`}
        />

        {/* Barra Superior do Rack Hardware (Parafusos de Rack + Chaves Power & +48V) */}
        <div className="px-3.5 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Parafuso de Rack Esquerdo */}
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-500 shadow-inner" />
            <span className="text-[10px] font-mono font-black tracking-wider uppercase text-slate-300">
              STUDIO RACK
            </span>
          </div>

          {/* Interruptores Táteis: +48V Mic Phantom & Tube Live Power */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTogglePhantomPower}
              aria-pressed={phantomPower}
              title="Ativar/Desativar Phantom Power +48V do Microfone Condensador"
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border studio-btn-transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                phantomPower
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  phantomPower ? 'bg-purple-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              <span>+48V MIC</span>
            </button>

            <button
              type="button"
              onClick={onToggleStudioLive}
              aria-pressed={studioLiveMode}
              title="Ligar/Desligar Válvulas e Iluminação 3D do Estúdio"
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold border studio-btn-transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                studioLiveMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  studioLiveMode ? 'bg-amber-400' : 'bg-slate-500'
                }`}
              />
              <span>{studioLiveMode ? 'TUBE ON' : 'STANDBY'}</span>
            </button>
          </div>
        </div>

        {/* Corpo Principal do Rack: Monitores + Válvulas + Duplo VU Meter */}
        <div className="p-3.5 grid grid-cols-12 gap-2.5 items-center">
          {/* Monitor de Referência Esquerdo */}
          <div className="hidden sm:flex sm:col-span-2 justify-center">
            <ReferenceMonitorDriver
              side="L"
              isEnergized={studioLiveMode}
              isPulsing={Boolean(hoveredSong) || studioLiveMode}
            />
          </div>

          {/* Janela de Válvulas do Amplificador (Tube Stage) */}
          <div className="col-span-5 sm:col-span-4 rounded-xl bg-slate-950/90 border border-slate-800/90 p-2 flex flex-col items-center justify-between relative overflow-hidden">
            <div className="w-full flex items-center justify-between text-[8px] font-mono font-bold text-slate-400 uppercase px-1 mb-1">
              <span>VALVE STAGE</span>
              <span className="text-amber-400">{currentDrive.label}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <VacuumTubeUnit
                code="12AX7"
                isEnergized={studioLiveMode}
                driveIndex={driveIndex}
                prefersReducedMotion={prefersReducedMotion}
              />
              <VacuumTubeUnit
                code="EL34"
                isEnergized={studioLiveMode}
                driveIndex={driveIndex}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
          </div>

          {/* Ponte Dupla de Medidores VU Analógicos (Left & Right) */}
          <div className="col-span-7 sm:col-span-4 grid grid-cols-2 gap-2">
            <AnalogVuMeter
              channelLabel="L-BUS"
              needleAngle={leftNeedleAngle}
              isEnergized={studioLiveMode}
              isPeak={isPeakSignal}
            />
            <AnalogVuMeter
              channelLabel="R-BUS"
              needleAngle={rightNeedleAngle}
              isEnergized={studioLiveMode}
              isPeak={isPeakSignal}
            />
          </div>

          {/* Monitor de Referência Direito */}
          <div className="hidden sm:flex sm:col-span-2 justify-center">
            <ReferenceMonitorDriver
              side="R"
              isEnergized={studioLiveMode}
              isPulsing={Boolean(hoveredSong) || studioLiveMode}
            />
          </div>
        </div>

        {/* Visor Digital OLED de Telemetria + Knobs Interativos de Bancada */}
        <div className="px-3.5 py-2.5 bg-slate-900/90 border-t border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Visor OLED Dinâmico (Reage ao Hover nos Cards da Biblioteca) */}
          <div className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-mono font-extrabold uppercase tracking-wider">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hoveredSong
                      ? 'bg-emerald-400 animate-ping'
                      : studioLiveMode
                      ? 'bg-blue-400'
                      : 'bg-slate-600'
                  }`}
                />
                <span className={hoveredSong ? 'text-emerald-400' : 'text-blue-400'}>
                  {hoveredSong ? 'SINAL EM FOCO NA MESA' : 'TELEMETRIA DA BANCADA'}
                </span>
              </div>

              {hoveredSong ? (
                <div className="text-xs font-black text-white truncate mt-0.5">
                  {hoveredSong.name}{' '}
                  <span className="text-slate-400 font-semibold">
                    • {hoveredSong.artist || 'Artista'}
                  </span>
                </div>
              ) : (
                <div className="text-xs font-bold text-slate-200 truncate mt-0.5 tabular-nums">
                  {animatedTotalSongs} Faixa{animatedTotalSongs !== 1 ? 's' : ''} •{' '}
                  {animatedTotalGenres} Gênero{animatedTotalGenres !== 1 ? 's' : ''} •{' '}
                  <span className="text-emerald-400">6 Stems IA</span>
                </div>
              )}
            </div>

            <div className="text-right font-mono tabular-nums shrink-0">
              <span className="block text-[10px] font-black text-amber-300">
                {hoveredSong?.original_key && hoveredSong.original_key !== 'Unknown'
                  ? `TOM ${hoveredSong.original_key}`
                  : currentDrive.dbText}
              </span>
              <span className="block text-[9px] font-bold text-slate-400">
                {phantomPower ? '+48V ON' : 'LINE IN'}
              </span>
            </div>
          </div>

          {/* Trio de Knobs Rotativos Táteis */}
          <div className="flex items-center justify-around sm:justify-end gap-1 shrink-0">
            <StudioRotaryKnob
              label="TUBE DRIVE"
              valueLabel={currentDrive.label}
              angle={currentDrive.angle}
              accentColor="#f59e0b"
              onClick={() => setDriveIndex((i) => (i + 1) % DRIVE_PRESETS.length)}
              title="Girar Knob: Alternar saturação das válvulas e ganho dos medidores VU"
            />
            <StudioRotaryKnob
              label="GÊNERO"
              valueLabel={filterGenre || 'Todos'}
              angle={genreKnobAngle}
              accentColor="#3b82f6"
              onClick={handleCycleGenreKnob}
              title="Girar Knob: Filtrar biblioteca rapidamente por gênero musical"
            />
            <StudioRotaryKnob
              label="LAYOUT"
              valueLabel={viewMode === 'grid' ? 'Grade 3D' : 'Lista DAW'}
              angle={viewMode === 'grid' ? 38 : -38}
              accentColor="#10b981"
              onClick={() =>
                onToggleViewMode?.(viewMode === 'list' ? 'grid' : 'list')
              }
              title="Girar Knob: Alternar entre modo Lista DAW e Grade 3D"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeroStudioRack;

