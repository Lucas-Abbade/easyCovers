import React, { useMemo } from 'react';
import { useReducedMotion } from '../utils/motionTokens';

const VARISPEED_PRESETS = [0.5, 0.75, 0.9, 1.0, 1.1, 1.25];

const formatPreciseTimecode = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}.${tenths}`;
};

const formatMasterDb = (volumePercent, isMuted) => {
  if (isMuted || volumePercent <= 0) return '-∞ dB';
  if (volumePercent === 100) return '0.0 dB';
  const db = 20 * Math.log10(volumePercent / 100);
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

/**
 * Medidor VU Analógico Master Bus com Agulha Balística guiada por variável CSS (--vu-angle-l / --vu-angle-r)
 */
const MasterAnalogVuMeter = ({
  channelLabel = 'MASTER L',
  angleVar = '--vu-angle-l',
  levelVar = '--level-master-l',
  fallbackAngle = -36,
  isEnergized = true,
  isPlaying = false,
}) => (
  <div
    className="relative rounded-xl bg-gradient-to-b from-slate-900 via-[#0E172A] to-slate-950 border border-slate-700/80 p-2.5 shadow-inner overflow-hidden select-none"
    style={{ '--stem-level': `var(${levelVar}, 0)` }}
  >
    {/* Iluminação âmbar de fundo de VU analógico */}
    <div
      className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
        isEnergized ? 'opacity-100' : 'opacity-25'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at 50% 95%, rgba(245, 158, 11, 0.25), rgba(59, 130, 246, 0.08) 55%, transparent 80%)',
      }}
    />

    {/* Cabeçalho do Medidor + LED de Peak reativo via --stem-level */}
    <div className="relative z-10 flex items-center justify-between text-[9px] font-mono font-bold tracking-wider mb-1">
      <span className="text-slate-300">{channelLabel}</span>
      <span className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e] studio-led-segment"
          style={{ '--seg-threshold': 84 }}
          title="Indicador de Peak (> -3 dBFS)"
        />
        <span className="text-amber-300/90">VU</span>
      </span>
    </div>

    {/* Escala Curva + Agulha Balística SVG */}
    <svg
      viewBox="0 0 120 62"
      className="w-full h-12 overflow-visible relative z-10"
      aria-hidden="true"
    >
      {/* Arco principal (-20dB a 0dB) */}
      <path
        d="M 14 52 A 48 48 0 0 1 88 22"
        fill="none"
        stroke="rgba(148, 163, 184, 0.45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Zona Vermelha (0dB a +3dB) */}
      <path
        d="M 88 22 A 48 48 0 0 1 106 52"
        fill="none"
        stroke="rgba(244, 63, 94, 0.88)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

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
        PEAK
      </text>

      {/* Agulha Balística impulsionada em tempo real pela variável CSS --vu-angle-l / --vu-angle-r */}
      <g
        className="vu-needle-ballistics"
        style={{
          transform: isEnergized
            ? `rotate(var(${angleVar}, ${fallbackAngle}deg))`
            : 'rotate(-38deg)',
        }}
      >
        <line
          x1="60"
          y1="55"
          x2="60"
          y2="12"
          stroke={isEnergized ? '#fbbf24' : '#64748b'}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle
          cx="60"
          cy="14"
          r="1.7"
          fill={isPlaying && isEnergized ? '#f59e0b' : '#94a3b8'}
        />
      </g>

      {/* Pivô Metálico */}
      <circle cx="60" cy="55" r="5" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
      <circle cx="60" cy="55" r="2" fill="#94a3b8" />
    </svg>
  </div>
);

/**
 * Válvula Termiônica 3D/SVG (12AX7 / EL34)
 */
const VacuumTubeUnit = ({
  code = '12AX7',
  isEnergized = true,
  isPlaying = false,
  prefersReducedMotion = false,
}) => {
  const filamentOpacity = !isEnergized ? 0.16 : isPlaying ? 0.96 : 0.75;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-10 h-14 rounded-t-full rounded-b-md bg-gradient-to-b from-slate-800/90 via-slate-900/95 to-slate-950 border border-slate-700/80 shadow-inner flex items-center justify-center overflow-hidden">
        <div
          className={`absolute inset-1 rounded-t-full bg-gradient-to-t from-amber-500 via-orange-400/75 to-blue-400/35 blur-xs transition-opacity duration-500 ${
            isEnergized && !prefersReducedMotion ? 'animate-tube-glow' : ''
          }`}
          style={{ opacity: filamentOpacity }}
        />

        <svg viewBox="0 0 40 56" className="w-full h-full relative z-10" aria-hidden="true">
          <path
            d="M 10 8 Q 10 3, 18 3"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
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
 * Cone de Monitor de Referência Acústica (MON L / MON R)
 */
const ReferenceMonitorDriver = ({ side = 'L', isEnergized = true, isPulsing = false }) => (
  <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
    <div className="relative w-11 h-11 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow-inner">
      <div
        className={`w-8 h-8 rounded-full border border-emerald-400/50 bg-gradient-to-br from-emerald-500/25 via-slate-900 to-cyan-500/25 flex items-center justify-center ${
          isEnergized && isPulsing ? 'animate-monitor-cone' : ''
        }`}
      >
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
    className="group flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-slate-800/75 studio-btn-transition active:scale-95 cursor-pointer"
  >
    <div className="relative w-10 h-10 rounded-full bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border border-slate-600 group-hover:border-blue-400/80 shadow-md flex items-center justify-center">
      <div
        className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center transition-transform duration-200"
        style={{ transform: `rotate(${angle}deg)` }}
      >
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
    <span className="text-[10px] font-mono font-bold text-blue-400 tabular-nums max-w-[82px] truncate">
      {valueLabel}
    </span>
  </button>
);

/**
 * Hardware Master Rack 2.5D/SVG para o Hero do Mixer (Ideia 4).
 * Reúne Válvulas 12AX7/EL34, Monitores MON L/R, Ponte Dupla VU Master L/R reativa ao Web Audio API,
 * Visor OLED de Timecode/Tom/Varispeed, 3 Knobs Rotativos e Controles Harmônicos/Master Bus.
 */
const MixerMasterRack = ({
  isPlaying = false,
  progress = 0,
  duration = 0,
  originalKey = 'Unknown',
  currentKey = 'Unknown',
  currentPitch = 0,
  onChangePitch,
  onResetPitch,
  playbackSpeed = 1.0,
  onSpeedChange,
  masterVolume = 100,
  isMasterMuted = false,
  onMasterVolumeChange,
  onToggleMasterMute,
  consoleMode = 'daw',
  onToggleConsoleMode,
  studioLiveMode = true,
  onToggleStudioLive,
  phantomPower = true,
  onTogglePhantomPower,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Ângulo do Knob de Pitch (-12 a +12 semitons -> -130° a +130°)
  const pitchKnobAngle = useMemo(
    () => Math.round((currentPitch / 12) * 125),
    [currentPitch]
  );

  // Ângulo do Knob de Varispeed (0.5x a 1.25x -> -90° a +90°)
  const speedKnobAngle = useMemo(
    () => Math.round(((playbackSpeed - 0.875) / 0.375) * 90),
    [playbackSpeed]
  );

  // Clique no knob de Pitch: incrementa +1 st (ou cicla de +6 de volta a -6)
  const handleCyclePitchKnob = () => {
    if (currentPitch >= 6) {
      onResetPitch?.();
    } else {
      onChangePitch?.(1);
    }
  };

  // Clique no knob de Varispeed: cicla pelos presets de estudo
  const handleCycleSpeedKnob = () => {
    const idx = VARISPEED_PRESETS.findIndex(
      (s) => Math.abs(s - playbackSpeed) < 0.02
    );
    const nextIdx = idx === -1 ? 3 : (idx + 1) % VARISPEED_PRESETS.length;
    onSpeedChange?.(VARISPEED_PRESETS[nextIdx]);
  };

  return (
    /* Concentric Radius: Outer rounded-2xl (16px) p-1.5 -> Inner rounded-xl (12px) */
    <div className="w-full lg:w-[540px] xl:w-[580px] shrink-0 rounded-2xl p-1.5 bg-gradient-to-b from-slate-200/90 via-slate-300/70 to-blue-200/60 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 border border-slate-300/90 dark:border-slate-700/90 shadow-xl">
      <div className="rounded-xl bg-[#0B1325] text-slate-100 border border-slate-800 overflow-hidden relative">
        {/* Glow interno reativo das válvulas e barramento Master */}
        <div
          className={`pointer-events-none absolute -top-12 left-1/3 w-60 h-32 rounded-full bg-gradient-to-r from-amber-500/45 via-blue-500/35 to-purple-500/35 blur-2xl transition-opacity duration-500 ${
            studioLiveMode ? 'opacity-100' : 'opacity-15'
          }`}
        />

        {/* Barra Superior do Rack Hardware (Parafusos + Interruptores +48V & Tube Stage) */}
        <div className="px-3.5 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-500 shadow-inner" />
            <span className="text-[10px] font-mono font-black tracking-wider uppercase text-slate-300">
              MASTER BUS RACK • HARMONIC PITCH & VU BRIDGE
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTogglePhantomPower}
              aria-pressed={phantomPower}
              title="Ativar/Desativar +48V Air Exciter na Sala de Controle"
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
              <span>+48V AIR</span>
            </button>

            <button
              type="button"
              onClick={onToggleStudioLive}
              aria-pressed={studioLiveMode}
              title="Ligar/Desligar Válvulas e Iluminação 3D da Sala de Controle"
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

        {/* Corpo Central: Monitores L/R + Válvulas 12AX7/EL34 + Duplo VU Meter Master L/R */}
        <div className="p-3.5 grid grid-cols-12 gap-2.5 items-center">
          <div className="hidden sm:flex sm:col-span-2 justify-center">
            <ReferenceMonitorDriver
              side="L"
              isEnergized={studioLiveMode && !isMasterMuted}
              isPulsing={isPlaying && !isMasterMuted}
            />
          </div>

          {/* Janela de Válvulas Termiônicas */}
          <div className="col-span-5 sm:col-span-4 rounded-xl bg-slate-950/90 border border-slate-800/90 p-2 flex flex-col items-center justify-between relative overflow-hidden">
            <div className="w-full flex items-center justify-between text-[8px] font-mono font-bold text-slate-400 uppercase px-1 mb-1">
              <span>VALVE STAGE</span>
              <span className="text-amber-400">
                {isPlaying ? 'DRIVING' : 'WARM BIAS'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <VacuumTubeUnit
                code="12AX7"
                isEnergized={studioLiveMode}
                isPlaying={isPlaying}
                prefersReducedMotion={prefersReducedMotion}
              />
              <VacuumTubeUnit
                code="EL34"
                isEnergized={studioLiveMode}
                isPlaying={isPlaying}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
          </div>

          {/* Ponte Dupla de Medidores VU Analógicos (MASTER L / MASTER R) */}
          <div className="col-span-7 sm:col-span-4 grid grid-cols-2 gap-2">
            <MasterAnalogVuMeter
              channelLabel="MASTER L"
              angleVar="--vu-angle-l"
              levelVar="--level-master-l"
              fallbackAngle={isPlaying && !isMasterMuted ? 6 : -36}
              isEnergized={studioLiveMode && !isMasterMuted}
              isPlaying={isPlaying}
            />
            <MasterAnalogVuMeter
              channelLabel="MASTER R"
              angleVar="--vu-angle-r"
              levelVar="--level-master-r"
              fallbackAngle={isPlaying && !isMasterMuted ? 4 : -36}
              isEnergized={studioLiveMode && !isMasterMuted}
              isPlaying={isPlaying}
            />
          </div>

          <div className="hidden sm:flex sm:col-span-2 justify-center">
            <ReferenceMonitorDriver
              side="R"
              isEnergized={studioLiveMode && !isMasterMuted}
              isPulsing={isPlaying && !isMasterMuted}
            />
          </div>
        </div>

        {/* Visor Digital OLED + Trio de Knobs Rotativos Táteis */}
        <div className="px-3.5 py-2.5 bg-slate-900/90 border-t border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Visor OLED de Timecode, Afinação Harmônica e Pitch Lock */}
          <div className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-mono font-extrabold uppercase tracking-wider">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPlaying
                      ? 'bg-emerald-400 animate-ping'
                      : 'bg-blue-400'
                  }`}
                />
                <span className={isPlaying ? 'text-emerald-400' : 'text-blue-400'}>
                  PITCH LOCK ACTIVE
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-300 tabular-nums">
                  {Math.round(playbackSpeed * 100)}% ({playbackSpeed}x)
                </span>
              </div>

              {/* Timecode de alta precisão em tabular-nums */}
              <div className="flex items-baseline gap-2 mt-0.5 font-mono tabular-nums">
                <span className="text-sm sm:text-base font-black text-white tracking-tight">
                  {formatPreciseTimecode(progress)}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  / {formatPreciseTimecode(duration)}
                </span>
              </div>
            </div>

            {/* Telemetria Harmônica (Tom Original vs Atual) */}
            <div className="text-right font-mono tabular-nums shrink-0">
              <span className="block text-[10px] font-black text-amber-300">
                TOM: {currentKey}{' '}
                {currentPitch !== 0
                  ? `(${currentPitch > 0 ? `+${currentPitch}` : currentPitch} st)`
                  : ''}
              </span>
              <span className="block text-[9px] font-bold text-slate-400">
                ORIG: {originalKey}
              </span>
            </div>
          </div>

          {/* 3 Knobs Rotativos Táteis Funcionais */}
          <div className="flex items-center justify-around sm:justify-end gap-1 shrink-0">
            <StudioRotaryKnob
              label="PITCH SHIFT"
              valueLabel={
                currentPitch === 0
                  ? '0 st (Orig)'
                  : `${currentPitch > 0 ? `+${currentPitch}` : currentPitch} st`
              }
              angle={pitchKnobAngle}
              accentColor="#f59e0b"
              onClick={handleCyclePitchKnob}
              title="Girar Knob: Avançar semitom de afinação harmônica (+1 st / Reset)"
            />
            <StudioRotaryKnob
              label="VARISPEED"
              valueLabel={`${playbackSpeed}x (${Math.round(playbackSpeed * 100)}%)`}
              angle={speedKnobAngle}
              accentColor="#3b82f6"
              onClick={handleCycleSpeedKnob}
              title="Girar Knob: Alternar velocidade de estudo (0.5x a 1.25x com Pitch Lock)"
            />
            <StudioRotaryKnob
              label="CONSOLE VIEW"
              valueLabel={consoleMode === 'daw' ? 'Bancada 3D' : 'Modo Palco'}
              angle={consoleMode === 'daw' ? -38 : 38}
              accentColor="#10b981"
              onClick={() =>
                onToggleConsoleMode?.(consoleMode === 'daw' ? 'stage' : 'daw')
              }
              title="Girar Knob: Alternar entre Modo Bancada DAW (Vertical 3D) e Modo Palco (Horizontal)"
            />
          </div>
        </div>

        {/* Barra Inferior Integrada: Semitons Diretos (-1 / Reset / +1) + Master Bus Gain & Mute */}
        <div className="px-3.5 py-2.5 bg-slate-950/95 border-t border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Controles Diretos de Transposição Harmônica */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 mr-1">
              AFINAÇÃO:
            </span>
            <button
              type="button"
              onClick={() => onChangePitch?.(-1)}
              disabled={currentPitch <= -12}
              title="Diminuir 1 semitom"
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-mono font-black text-xs border border-slate-700 studio-btn-transition active:scale-95 cursor-pointer"
            >
              -1 st
            </button>

            <button
              type="button"
              onClick={onResetPitch}
              disabled={currentPitch === 0}
              title="Restaurar tom original (0 st)"
              className={`px-2.5 py-1 rounded-lg font-mono font-extrabold text-[11px] border studio-btn-transition active:scale-95 cursor-pointer tabular-nums ${
                currentPitch !== 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30'
                  : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60 cursor-default'
              }`}
            >
              {currentPitch === 0
                ? '0 st'
                : `Reset (${currentPitch > 0 ? `+${currentPitch}` : currentPitch})`}
            </button>

            <button
              type="button"
              onClick={() => onChangePitch?.(1)}
              disabled={currentPitch >= 12}
              title="Aumentar 1 semitom"
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-mono font-black text-xs border border-blue-500 shadow-xs studio-btn-transition active:scale-95 cursor-pointer"
            >
              +1 st
            </button>
          </div>

          {/* Controle Direto do Master Bus (Mute M + Fader Master + Leitura Dupla % / dB) */}
          <div className="flex items-center gap-2.5 flex-1 sm:max-w-[275px] bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={onToggleMasterMute}
              aria-pressed={isMasterMuted}
              title={
                isMasterMuted
                  ? 'Desmutar Master Bus (Atalho: M)'
                  : 'Mutar Master Bus (Atalho: M)'
              }
              className={`w-7 h-7 rounded-lg font-mono font-black text-[11px] border studio-btn-transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center ${
                isMasterMuted
                  ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.5)]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-rose-400/60 hover:text-white'
              }`}
            >
              M
            </button>

            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] font-mono font-bold tabular-nums">
                <span className="text-slate-400 uppercase tracking-wider">
                  MASTER BUS
                </span>
                <span
                  className={
                    isMasterMuted ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'
                  }
                >
                  {isMasterMuted ? 'MUTED' : `${masterVolume}% • ${formatMasterDb(masterVolume, isMasterMuted)}`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange?.(e.target.value)}
                aria-label="Volume do Master Bus"
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${masterVolume}%, #1e293b ${masterVolume}%)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MixerMasterRack;

