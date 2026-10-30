import React from 'react';

/**
 * Ondas senoidais harmônicas com gradiente cromático de estúdio
 */
const StudioHarmonicWaves = ({
  idPrefix = 'wave-1',
  primaryColor = '#3b82f6',
  secondaryColor = '#a855f7',
  className = 'w-full h-32',
}) => (
  <svg
    viewBox="0 0 1440 140"
    fill="none"
    className={className}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={`${idPrefix}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={primaryColor} stopOpacity="0" />
        <stop offset="25%" stopColor={primaryColor} stopOpacity="0.65" />
        <stop offset="75%" stopColor={secondaryColor} stopOpacity="0.65" />
        <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 0 70 C 240 10, 480 130, 720 70 C 960 10, 1200 130, 1440 70"
      stroke={`url(#${idPrefix}-grad)`}
      strokeWidth="2"
    />
    <path
      d="M 0 70 C 240 120, 480 20, 720 70 C 960 120, 1200 20, 1440 70"
      stroke={`url(#${idPrefix}-grad)`}
      strokeWidth="1.2"
      strokeDasharray="6 6"
      opacity="0.7"
    />
  </svg>
);

// Nós extras de telemetria acústica e cifras flutuantes com alta nitidez
const FLOATING_CHORD_BADGES = [
  {
    id: 'chord-cmaj9',
    chord: 'Cmaj9',
    freq: '261.6 Hz • HARMONIC LOCK',
    db: '-1.8 dBFS',
    colorClass:
      'border-blue-500/35 bg-blue-950/45 text-blue-300 shadow-blue-500/10',
    dotClass: 'bg-blue-400',
    posClass: 'top-[44vh] left-[4%] xl:left-[6%]',
    speed: -0.15,
  },
  {
    id: 'chord-em11',
    chord: 'Em11',
    freq: '329.6 Hz • STEREO BUS',
    db: '-2.4 dBFS',
    colorClass:
      'border-purple-500/35 bg-purple-950/45 text-purple-300 shadow-purple-500/10',
    dotClass: 'bg-purple-400',
    posClass: 'top-[52vh] right-[4%] xl:right-[6%]',
    speed: -0.21,
  },
  {
    id: 'chord-a7alt',
    chord: 'A7alt',
    freq: '440.0 Hz • PITCH REFERENCE',
    db: '0.0 dBFS',
    colorClass:
      'border-emerald-500/35 bg-emerald-950/45 text-emerald-300 shadow-emerald-500/10',
    dotClass: 'bg-emerald-400',
    posClass: 'top-[112vh] left-[5%] xl:left-[7%]',
    speed: -0.3,
  },
];

/**
 * Camada de Background Parallax de Alto Nível com Instrumentos 3D (Smoked Glass & Rim Light),
 * Ondas Senoidais Cromáticas e Telemetria de Estúdio.
 */
const StudioParallaxBackground = ({ isAudioPlaying = false }) => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* 1. SUPERFÍCIE DE GRID TÉCNICO ACÚSTICO */}
      <div className="absolute inset-0 studio-grid-surface" />

      {/* 2. ILUMINAÇÃO AMBIENTE (MODO "FOCO NO CONSOLE" — AMBIENT GLOW REATIVO) */}
      <div
        className={`absolute -top-40 left-1/5 w-[42rem] h-[42rem] rounded-full blur-3xl studio-ambient-glow ${
          isAudioPlaying
            ? 'bg-blue-500/28 dark:bg-blue-500/25 scale-110'
            : 'bg-blue-500/16 dark:bg-blue-600/14 scale-100'
        }`}
      />
      <div
        className={`absolute top-1/4 -right-36 w-[38rem] h-[38rem] rounded-full blur-3xl studio-ambient-glow ${
          isAudioPlaying
            ? 'bg-purple-500/25 dark:bg-indigo-500/25 scale-110'
            : 'bg-purple-500/14 dark:bg-indigo-500/14 scale-100'
        }`}
      />
      <div
        className={`absolute bottom-0 left-1/4 w-[36rem] h-[36rem] rounded-full blur-3xl studio-ambient-glow ${
          isAudioPlaying
            ? 'bg-emerald-500/22 dark:bg-emerald-500/20 opacity-100 scale-105'
            : 'bg-emerald-500/10 dark:bg-emerald-500/10 opacity-75 scale-95'
        }`}
      />

      {/* 3. FAIXAS DE ONDAS SENOIDAIS CROMÁTICAS EM PARALLAX */}
      <div
        className="absolute top-[20vh] inset-x-0 opacity-35 dark:opacity-45 studio-parallax-layer"
        style={{ '--parallax-speed': -0.08 }}
      >
        <StudioHarmonicWaves
          idPrefix="wave-hero"
          primaryColor="#3b82f6"
          secondaryColor="#a855f7"
          className="w-full h-32"
        />
      </div>

      <div
        className="absolute top-[68vh] inset-x-0 opacity-30 dark:opacity-40 studio-parallax-layer"
        style={{ '--parallax-speed': -0.18 }}
      >
        <StudioHarmonicWaves
          idPrefix="wave-mid"
          primaryColor="#10b981"
          secondaryColor="#3b82f6"
          className="w-full h-36"
        />
      </div>

      <div
        className="absolute top-[118vh] inset-x-0 opacity-35 dark:opacity-45 studio-parallax-layer"
        style={{ '--parallax-speed': -0.26 }}
      >
        <StudioHarmonicWaves
          idPrefix="wave-bottom"
          primaryColor="#f59e0b"
          secondaryColor="#ec4899"
          className="w-full h-32"
        />
      </div>

      {/* ===================================================================== */}
      {/* 4. INSTRUMENTOS 3D DE ESTÚDIO (SMOKED GLASS & RIM-LIGHT) EM PARALLAX  */}
      {/* ===================================================================== */}

      {/* INSTRUMENTO 1: GUITARRA ELÉTRICA 3D (Topo-Esquerda • Visível já na Hero) */}
      <div
        className="absolute top-[5vh] -left-16 sm:-left-6 xl:left-[1.5%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.16 }}
      >
        <div className="relative group">
          {/* Halo Luminoso Azul Safira atrás da Guitarra */}
          <div className="absolute inset-8 rounded-full bg-blue-500/20 dark:bg-blue-500/25 blur-2xl" />

          {/* Anel Técnico Orbital SVG */}
          <svg
            viewBox="0 0 300 300"
            className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] text-blue-500/25 dark:text-blue-400/30"
            fill="none"
          >
            <circle
              cx="150"
              cy="150"
              r="128"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="6 8"
            />
            <circle
              cx="150"
              cy="150"
              r="98"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeOpacity="0.6"
            />
          </svg>

          <img
            src="/assets/parallax/instrument_guitar.png"
            alt=""
            className={`w-64 h-64 sm:w-80 sm:h-80 xl:w-96 xl:h-96 object-contain -rotate-6 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(59,130,246,0.32)] ${
              isAudioPlaying
                ? 'opacity-55 dark:opacity-65 scale-105'
                : 'opacity-40 dark:opacity-50 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria da Guitarra */}
          <div className="hidden md:flex items-center gap-2.5 absolute bottom-6 left-10 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/75 border border-blue-500/35 backdrop-blur-md shadow-lg opacity-75 dark:opacity-85">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                Am7 • 440.0 Hz
              </div>
              <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                GUITAR STEM • 80Hz–8kHz
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSTRUMENTO 2: MICROFONE CONDENSADOR & TECLAS 3D (Topo-Direita) */}
      <div
        className="absolute top-[10vh] -right-16 sm:-right-6 xl:right-[1.5%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.24 }}
      >
        <div className="relative">
          <div className="absolute inset-8 rounded-full bg-purple-500/20 dark:bg-purple-500/25 blur-2xl" />

          <img
            src="/assets/parallax/instrument_mic_keys.png"
            alt=""
            className={`w-60 h-60 sm:w-76 sm:h-76 xl:w-88 xl:h-88 object-contain rotate-6 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(168,85,247,0.32)] ${
              isAudioPlaying
                ? 'opacity-55 dark:opacity-65 scale-105'
                : 'opacity-38 dark:opacity-48 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria Vocal & Keys */}
          <div className="hidden md:flex items-center gap-2.5 absolute bottom-4 right-10 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/75 border border-purple-500/35 backdrop-blur-md shadow-lg opacity-75 dark:opacity-85">
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                Fmaj7 • -2.1 dB
              </div>
              <div className="text-[9px] font-bold text-purple-600 dark:text-purple-400 tracking-wider">
                VOCALS & SYNTH KEYS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSTRUMENTO 3: CONTRABAIXO 4 CORDAS 3D (Meio-Esquerda • Sobe com o Scroll) */}
      <div
        className="absolute top-[74vh] -left-14 sm:-left-4 xl:left-[2%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.26 }}
      >
        <div className="relative">
          {/* Halo Luminoso Esmeralda/Ciano */}
          <div className="absolute inset-8 rounded-full bg-emerald-500/20 dark:bg-emerald-500/25 blur-2xl" />

          {/* Anel Técnico Orbital SVG */}
          <svg
            viewBox="0 0 300 300"
            className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] text-emerald-500/25 dark:text-emerald-400/30"
            fill="none"
          >
            <circle
              cx="150"
              cy="150"
              r="124"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          </svg>

          <img
            src="/assets/parallax/instrument_bass.png"
            alt=""
            className={`w-64 h-64 sm:w-80 sm:h-80 xl:w-96 xl:h-96 object-contain rotate-6 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(16,185,129,0.32)] ${
              isAudioPlaying
                ? 'opacity-55 dark:opacity-65 scale-105'
                : 'opacity-40 dark:opacity-52 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria do Contrabaixo */}
          <div className="hidden md:flex items-center gap-2.5 absolute top-8 left-12 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/75 border border-emerald-500/35 backdrop-blur-md shadow-lg opacity-75 dark:opacity-85">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                Dm9 • 32 Hz – 800 Hz
              </div>
              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                PRECISION BASS • SUB GROOVE
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSTRUMENTO 4: BATERIA ACÚSTICA 3D (Meio/Baixo-Direita • Sobe no Catálogo/Personas) */}
      <div
        className="absolute top-[102vh] -right-14 sm:-right-4 xl:right-[2%] studio-parallax-layer"
        style={{ '--parallax-speed': -0.32 }}
      >
        <div className="relative">
          {/* Halo Luminoso Âmbar/Ouro */}
          <div className="absolute inset-8 rounded-full bg-amber-500/20 dark:bg-amber-500/25 blur-2xl" />

          <img
            src="/assets/parallax/instrument_drums.png"
            alt=""
            className={`w-64 h-64 sm:w-80 sm:h-80 xl:w-96 xl:h-96 object-contain -rotate-3 studio-ambient-glow drop-shadow-[0_18px_36px_rgba(245,158,11,0.3)] ${
              isAudioPlaying
                ? 'opacity-55 dark:opacity-65 scale-105'
                : 'opacity-40 dark:opacity-50 scale-100'
            }`}
          />

          {/* HUD Badge de Telemetria da Bateria */}
          <div className="hidden md:flex items-center gap-2.5 absolute bottom-6 right-12 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/75 border border-amber-500/35 backdrop-blur-md shadow-lg opacity-75 dark:opacity-85">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
            <div className="font-mono leading-tight tabular-nums">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                G13 • 118.0 BPM
              </div>
              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                DRUM KIT • TRANSIENT LOCK
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. BADGES DE CIFRAS E FREQUÊNCIAS INTERMEDIÁRIAS EM PARALLAX */}
      {FLOATING_CHORD_BADGES.map((badge) => (
        <div
          key={badge.id}
          className={`hidden lg:flex items-center gap-2.5 absolute ${badge.posClass} px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md studio-parallax-layer opacity-65 dark:opacity-75 ${badge.colorClass}`}
          style={{ '--parallax-speed': badge.speed }}
        >
          <span className={`w-2 h-2 rounded-full ${badge.dotClass}`} />
          <div className="font-mono leading-tight tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 dark:text-white">
                {badge.chord}
              </span>
              <span className="text-[10px] font-bold opacity-80">
                {badge.db}
              </span>
            </div>
            <div className="text-[9px] font-bold tracking-wider opacity-90">
              {badge.freq}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StudioParallaxBackground;
