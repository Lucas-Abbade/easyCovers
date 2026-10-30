import React from 'react';

/**
 * Ondas senoidais harmônicas de sala de controle para o Dashboard
 */
const ControlRoomHarmonicWaves = ({
  idPrefix = 'dash-wave-1',
  primaryColor = '#3b82f6',
  secondaryColor = '#f59e0b',
  className = 'w-full h-28',
}) => (
  <svg
    viewBox="0 0 1440 120"
    fill="none"
    className={className}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={`${idPrefix}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={primaryColor} stopOpacity="0" />
        <stop offset="25%" stopColor={primaryColor} stopOpacity="0.55" />
        <stop offset="75%" stopColor={secondaryColor} stopOpacity="0.55" />
        <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 0 60 C 240 12, 480 108, 720 60 C 960 12, 1200 108, 1440 60"
      stroke={`url(#${idPrefix}-grad)`}
      strokeWidth="1.8"
    />
    <path
      d="M 0 60 C 240 104, 480 16, 720 60 C 960 104, 1200 16, 1440 60"
      stroke={`url(#${idPrefix}-grad)`}
      strokeWidth="1.1"
      strokeDasharray="6 6"
      opacity="0.65"
    />
  </svg>
);

const STUDIO_TELEMETRY_NODES = [
  {
    id: 'node-preamp',
    title: 'CLASS-A PREAMP',
    detail: 'HEADROOM +24 dBu',
    badge: 'LOW NOISE',
    colorClass:
      'border-amber-500/35 bg-amber-950/45 text-amber-300 shadow-amber-500/10',
    dotClass: 'bg-amber-400',
    posClass: 'top-[44vh] left-[2.5%] 2xl:left-[5%]',
    speed: -0.14,
  },
  {
    id: 'node-acoustic',
    title: 'CONTROL ROOM RT60',
    detail: '0.24s • ISO-BOOTH',
    badge: 'PHASE 0°',
    colorClass:
      'border-purple-500/35 bg-purple-950/45 text-purple-300 shadow-purple-500/10',
    dotClass: 'bg-purple-400',
    posClass: 'top-[48vh] right-[2.5%] 2xl:right-[5%]',
    speed: -0.19,
  },
];

/**
 * Camada Parallax 3D de Sala de Controle para o Dashboard.
 * Apresenta os 4 equipamentos escolhidos pelo stakeholder em Smoked Glass & Rim-Light:
 * 1. Amplificador Valvulado (Tube Amp)
 * 2. Microfone Condensador (+48V Shockmount)
 * 3. Console Mixer Analógico (Faders & VU Bridge)
 * 4. Monitores de Referência (Nearfield Studio Monitors)
 */
const DashboardStudioBackground = ({
  studioLiveMode = true,
  phantomPower = true,
  hoveredSong = null,
}) => {
  const isEnergized = Boolean(studioLiveMode || hoveredSong);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* 1. SUPERFÍCIE DE GRID TÉCNICO ACÚSTICO */}
      <div className="absolute inset-0 studio-grid-surface" />

      {/* 2. ILUMINAÇÃO AMBIENTE REATIVA AO HARDWARE DO HERO ("TUBE WARMTH & CONSOLE GLOW") */}
      <div
        className={`absolute -top-36 left-1/6 w-[40rem] h-[40rem] rounded-full blur-3xl studio-ambient-glow ${
          isEnergized
            ? 'bg-amber-500/20 dark:bg-amber-500/18 scale-110'
            : 'bg-blue-500/10 dark:bg-blue-600/10 scale-95'
        }`}
      />
      <div
        className={`absolute top-1/4 -right-32 w-[38rem] h-[38rem] rounded-full blur-3xl studio-ambient-glow ${
          phantomPower && isEnergized
            ? 'bg-purple-500/22 dark:bg-purple-500/20 scale-110'
            : 'bg-purple-500/10 dark:bg-indigo-500/10 scale-95'
        }`}
      />
      <div
        className={`absolute bottom-0 left-1/4 w-[36rem] h-[36rem] rounded-full blur-3xl studio-ambient-glow ${
          isEnergized
            ? 'bg-emerald-500/18 dark:bg-emerald-500/16 opacity-100 scale-105'
            : 'bg-emerald-500/8 dark:bg-emerald-500/8 opacity-70 scale-95'
        }`}
      />

      {/* 3. FAIXAS DE ONDAS SENOIDAIS CROMÁTICAS EM PARALLAX */}
      <div
        className="absolute top-[18vh] inset-x-0 opacity-30 dark:opacity-40 studio-parallax-layer"
        style={{ '--parallax-speed': -0.07 }}
      >
        <ControlRoomHarmonicWaves
          idPrefix="dash-wave-top"
          primaryColor="#f59e0b"
          secondaryColor="#3b82f6"
          className="w-full h-28"
        />
      </div>

      <div
        className="absolute top-[66vh] inset-x-0 opacity-25 dark:opacity-38 studio-parallax-layer"
        style={{ '--parallax-speed': -0.15 }}
      >
        <ControlRoomHarmonicWaves
          idPrefix="dash-wave-bottom"
          primaryColor="#10b981"
          secondaryColor="#a855f7"
          className="w-full h-32"
        />
      </div>

      {/* ===================================================================== */}
      {/* 4. EQUIPAMENTOS 3D DE ESTÚDIO (SMOKED GLASS & RIM-LIGHT) EM PARALLAX  */}
      {/* ===================================================================== */}

      {/* EQUIPAMENTO 1: AMPLIFICADOR VALVULADO 3D (Topo-Esquerda) */}
      <div
        className="absolute top-[7vh] -left-20 sm:-left-12 xl:left-[0.5%] 2xl:left-[2%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.14 }}
      >
        <div className="relative">
          {/* Halo Quente das Válvulas (Âmbar + Azul Safira) */}
          <div
            className={`absolute inset-8 rounded-full blur-2xl studio-ambient-glow ${
              isEnergized
                ? 'bg-amber-500/28 dark:bg-amber-500/32 scale-110'
                : 'bg-blue-500/14 dark:bg-blue-500/18 scale-95'
            }`}
          />

          {/* Anel Técnico Orbital SVG */}
          <svg
            viewBox="0 0 300 300"
            className="absolute -inset-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] text-amber-500/25 dark:text-amber-400/30"
            fill="none"
          >
            <circle
              cx="150"
              cy="150"
              r="126"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="6 8"
            />
            <circle
              cx="150"
              cy="150"
              r="96"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeOpacity="0.55"
            />
          </svg>

          <img
            src="/assets/parallax/studio_tube_amp.png"
            alt=""
            className={`w-60 h-60 sm:w-72 sm:h-72 xl:w-84 xl:h-84 object-contain -rotate-3 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(245,158,11,0.32)] ${
              isEnergized
                ? 'opacity-50 dark:opacity-65 scale-105'
                : 'opacity-30 dark:opacity-42 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria do Amplificador Valvulado */}
          <div className="hidden xl:flex items-center gap-2.5 absolute bottom-4 left-8 px-3 py-1.5 rounded-xl bg-white/75 dark:bg-slate-900/80 border border-amber-500/40 backdrop-blur-md shadow-lg opacity-80 dark:opacity-90">
            <span
              className={`w-2 h-2 rounded-full ${
                isEnergized
                  ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                  : 'bg-slate-400'
              }`}
            />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                TUBE AMP • 12AX7 / EL34
              </div>
              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                {isEnergized ? 'VALVE BIAS WARM • ACTIVE' : 'VALVE STANDBY MODE'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EQUIPAMENTO 2: MICROFONE CONDENSADOR DE ESTÚDIO 3D (Topo-Direita) */}
      <div
        className="absolute top-[9vh] -right-20 sm:-right-12 xl:right-[0.5%] 2xl:right-[2%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.22 }}
      >
        <div className="relative">
          {/* Halo Roxo/Azul de Phantom Power +48V */}
          <div
            className={`absolute inset-8 rounded-full blur-2xl studio-ambient-glow ${
              phantomPower
                ? 'bg-purple-500/26 dark:bg-purple-500/30 scale-110'
                : 'bg-slate-500/12 dark:bg-slate-600/15 scale-95'
            }`}
          />

          <img
            src="/assets/parallax/studio_condenser_mic.png"
            alt=""
            className={`w-56 h-56 sm:w-68 sm:h-68 xl:w-80 xl:h-80 object-contain rotate-3 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(168,85,247,0.34)] ${
              phantomPower && isEnergized
                ? 'opacity-50 dark:opacity-65 scale-105'
                : 'opacity-30 dark:opacity-42 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria do Microfone Condensador */}
          <div className="hidden xl:flex items-center gap-2.5 absolute bottom-4 right-8 px-3 py-1.5 rounded-xl bg-white/75 dark:bg-slate-900/80 border border-purple-500/40 backdrop-blur-md shadow-lg opacity-80 dark:opacity-90">
            <span
              className={`w-2 h-2 rounded-full ${
                phantomPower
                  ? 'bg-purple-400 shadow-[0_0_8px_#a855f7]'
                  : 'bg-slate-400'
              }`}
            />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                CONDENSER • {phantomPower ? '+48V ON' : 'PAD -10dB'}
              </div>
              <div className="text-[9px] font-bold text-purple-600 dark:text-purple-400 tracking-wider">
                LARGE DIAPHRAGM • CARDIOID
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EQUIPAMENTO 3: CONSOLE MIXER ANALÓGICO 3D (Meio/Baixo-Esquerda • Sobe no Scroll) */}
      <div
        className="absolute top-[60vh] -left-20 sm:-left-10 xl:left-[0.5%] 2xl:left-[2%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.25 }}
      >
        <div className="relative">
          {/* Halo Azul/Ciano de Barramento Master */}
          <div
            className={`absolute inset-8 rounded-full blur-2xl studio-ambient-glow ${
              hoveredSong
                ? 'bg-blue-500/30 dark:bg-blue-500/35 scale-110'
                : 'bg-blue-500/18 dark:bg-blue-500/22 scale-100'
            }`}
          />

          <svg
            viewBox="0 0 300 300"
            className="absolute -inset-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] text-blue-500/25 dark:text-blue-400/30"
            fill="none"
          >
            <circle
              cx="150"
              cy="150"
              r="122"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          </svg>

          <img
            src="/assets/parallax/studio_analog_mixer.png"
            alt=""
            className={`w-60 h-60 sm:w-72 sm:h-72 xl:w-84 xl:h-84 object-contain rotate-3 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(59,130,246,0.34)] ${
              isEnergized
                ? 'opacity-50 dark:opacity-65 scale-105'
                : 'opacity-32 dark:opacity-44 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria da Mesa de Som */}
          <div className="hidden xl:flex items-center gap-2.5 absolute bottom-5 left-8 px-3 py-1.5 rounded-xl bg-white/75 dark:bg-slate-900/80 border border-blue-500/40 backdrop-blur-md shadow-lg opacity-80 dark:opacity-90">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white max-w-[170px] truncate">
                {hoveredSong ? hoveredSong.name : 'ANALOG CONSOLE • 8-CH'}
              </div>
              <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                {hoveredSong
                  ? `ROUTING 6 STEMS • ${hoveredSong.genre || 'STUDIO'}`
                  : 'MOTORIZED FADERS & VU BRIDGE'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EQUIPAMENTO 4: MONITORES DE REFERÊNCIA 3D (Meio/Baixo-Direita • Sobe no Scroll) */}
      <div
        className="absolute top-[64vh] -right-20 sm:-right-10 xl:right-[0.5%] 2xl:right-[2%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.29 }}
      >
        <div className="relative">
          {/* Halo Esmeralda/Ciano dos Cones Kevlar */}
          <div
            className={`absolute inset-8 rounded-full blur-2xl studio-ambient-glow ${
              isEnergized
                ? 'bg-emerald-500/26 dark:bg-emerald-500/30 scale-110'
                : 'bg-emerald-500/14 dark:bg-emerald-500/18 scale-95'
            }`}
          />

          <img
            src="/assets/parallax/studio_reference_monitors.png"
            alt=""
            className={`w-60 h-60 sm:w-72 sm:h-72 xl:w-84 xl:h-84 object-contain -rotate-3 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(16,185,129,0.32)] ${
              isEnergized
                ? 'opacity-50 dark:opacity-65 scale-105'
                : 'opacity-32 dark:opacity-44 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria dos Monitores de Referência */}
          <div className="hidden xl:flex items-center gap-2.5 absolute bottom-5 right-8 px-3 py-1.5 rounded-xl bg-white/75 dark:bg-slate-900/80 border border-emerald-500/40 backdrop-blur-md shadow-lg opacity-80 dark:opacity-90">
            <span
              className={`w-2 h-2 rounded-full ${
                isEnergized
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : 'bg-slate-400'
              }`}
            />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                NEARFIELD MONITORS • L/R
              </div>
              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                KEVLAR WOOFER • 38Hz–22kHz
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. NÓS EXTRAS DE TELEMETRIA ACÚSTICA EM PARALLAX */}
      {STUDIO_TELEMETRY_NODES.map((node) => (
        <div
          key={node.id}
          className={`hidden 2xl:flex items-center gap-2.5 absolute ${node.posClass} px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md studio-parallax-layer opacity-65 dark:opacity-75 ${node.colorClass}`}
          style={{ '--parallax-speed': node.speed }}
        >
          <span className={`w-2 h-2 rounded-full ${node.dotClass}`} />
          <div className="font-mono leading-tight tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 dark:text-white">
                {node.title}
              </span>
              <span className="text-[9px] font-bold opacity-80">
                {node.badge}
              </span>
            </div>
            <div className="text-[9px] font-bold tracking-wider opacity-90">
              {node.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStudioBackground;

