import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PlayOpticalIcon,
  PauseOpticalIcon,
  PitchShiftIcon,
  LoopRepeatIcon,
  HeadphonesStudioIcon,
} from './Icons';
import { useReducedMotion, useDocumentVisibility } from '../utils/motionTokens';

const DEMO_STEMS = [
  {
    id: 'vocals',
    label: 'Vocais Principais',
    shortLabel: 'VOZ',
    src: '/stems/vocals.wav',
    icon: '/assets/icons/stem_vocals.png',
    accentBg: 'bg-purple-500',
    accentText: 'text-purple-600 dark:text-purple-400',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
    barColor: 'bg-gradient-to-r from-purple-500 to-indigo-500',
    waveHeights: [38, 72, 90, 54, 82, 95, 60, 44, 78, 88, 65, 50, 84, 70, 42, 68],
  },
  {
    id: 'drums',
    label: 'Bateria Acústica',
    shortLabel: 'DRM',
    src: '/stems/drums.wav',
    icon: '/assets/icons/stem_drums.png',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    barColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
    waveHeights: [92, 48, 88, 42, 95, 52, 86, 46, 94, 58, 82, 44, 90, 50, 85, 62],
  },
  {
    id: 'bass',
    label: 'Contra-Baixo Groove',
    shortLabel: 'BAS',
    src: '/stems/bass.wav',
    icon: '/assets/icons/stem_bass.png',
    accentBg: 'bg-emerald-500',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    barColor: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    waveHeights: [64, 76, 68, 82, 74, 60, 85, 70, 62, 80, 72, 66, 78, 84, 68, 72],
  },
  {
    id: 'other',
    label: 'Guitarras & Synths',
    shortLabel: 'GTR',
    src: '/stems/other.wav',
    icon: '/assets/icons/stem_guitar.png',
    accentBg: 'bg-blue-500',
    accentText: 'text-blue-600 dark:text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
    barColor: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    waveHeights: [52, 68, 84, 76, 62, 88, 92, 70, 58, 74, 86, 80, 64, 72, 56, 66],
  },
];

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_KEY_INDEX = 9; // Am (A menor)

const PRESET_MIXES = [
  {
    id: 'full',
    label: 'Mix Completo',
    mutes: { vocals: false, drums: false, bass: false, other: false },
    solos: { vocals: false, drums: false, bass: false, other: false },
  },
  {
    id: 'karaoke',
    label: 'Karaokê (Sem Voz)',
    mutes: { vocals: true, drums: false, bass: false, other: false },
    solos: { vocals: false, drums: false, bass: false, other: false },
  },
  {
    id: 'backing_guitar',
    label: 'Backing p/ Guitarra',
    mutes: { vocals: false, drums: false, bass: false, other: true },
    solos: { vocals: false, drums: false, bass: false, other: false },
  },
  {
    id: 'rhythm_section',
    label: 'Só Cozinha (Bass + Drums)',
    mutes: { vocals: false, drums: false, bass: false, other: false },
    solos: { vocals: false, drums: true, bass: true, other: false },
  },
];

const formatTimecode = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}.${tenths}`;
};

const LandingInteractiveMixer = ({ onOpenStudio }) => {
  const prefersReducedMotion = useReducedMotion();
  const isTabVisible = useDocumentVisibility();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(18.0);
  const [activePreset, setActivePreset] = useState('full');
  const [semitones, setSemitones] = useState(0);
  const [loopActive, setLoopActive] = useState(true);

  const [volumes, setVolumes] = useState({
    vocals: 90,
    drums: 85,
    bass: 85,
    other: 80,
  });
  const [mutes, setMutes] = useState({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });
  const [solos, setSolos] = useState({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });

  const audioRefs = useRef({});
  const fallbackTimerRef = useRef(null);

  // Calcula o tom transposto de forma pura durante o render (Regra 1 de react-patterns)
  const transposedKeyLabel = useMemo(() => {
    const shifted = (BASE_KEY_INDEX + semitones + 120) % 12;
    return `${CHROMATIC_SCALE[shifted]}m`;
  }, [semitones]);

  const anySoloActive = useMemo(
    () => Object.values(solos).some(Boolean),
    [solos]
  );

  // Calcula se um canal está efetivamente audível
  const isStemAudible = useCallback(
    (stemId) => {
      if (anySoloActive) {
        return Boolean(solos[stemId]) && !mutes[stemId] && volumes[stemId] > 0;
      }
      return !mutes[stemId] && volumes[stemId] > 0;
    },
    [anySoloActive, solos, mutes, volumes]
  );

  // Inicializa elementos de áudio HTML5 apontando para os stems locais reais
  useEffect(() => {
    const instances = {};
    DEMO_STEMS.forEach((stem) => {
      const audio = new Audio(stem.src);
      audio.preload = 'metadata';
      audio.loop = true;
      instances[stem.id] = audio;
    });

    const leadAudio = instances.vocals;
    const handleLoadedMetadata = () => {
      if (leadAudio && leadAudio.duration && isFinite(leadAudio.duration)) {
        setDuration(leadAudio.duration);
      }
    };
    const handleTimeUpdate = () => {
      if (leadAudio) {
        setCurrentTime(leadAudio.currentTime);
      }
    };

    if (leadAudio) {
      leadAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
      leadAudio.addEventListener('timeupdate', handleTimeUpdate);
    }

    audioRefs.current = instances;

    return () => {
      if (leadAudio) {
        leadAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        leadAudio.removeEventListener('timeupdate', handleTimeUpdate);
      }
      Object.values(instances).forEach((a) => {
        try {
          a.pause();
          a.src = '';
        } catch {
          // Ignora erros de desmontagem
        }
      });
    };
  }, []);

  // Sincroniza ganhos (Mute / Solo / Volume) e taxa de reprodução em tempo real
  useEffect(() => {
    DEMO_STEMS.forEach((stem) => {
      const audio = audioRefs.current[stem.id];
      if (!audio) return;
      const audible = isStemAudible(stem.id);
      audio.volume = audible ? Math.min(1, Math.max(0, volumes[stem.id] / 100)) : 0;
      audio.loop = loopActive;
    });
  }, [volumes, mutes, solos, loopActive, isStemAudible]);

  // Pausa automaticamente se a aba ficar oculta (Regra 2 e Regra 7 de motion-advanced)
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        Object.values(audioRefs.current).forEach((a) => {
          try {
            a.pause();
          } catch {
            // Ignora
          }
        });
        setIsPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Fallback de relógio visual suave caso o áudio esteja tocando
  useEffect(() => {
    if (!isPlaying) {
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
      return undefined;
    }

    fallbackTimerRef.current = setInterval(() => {
      const lead = audioRefs.current.vocals;
      if (lead && !lead.paused && lead.currentTime > 0) {
        setCurrentTime(lead.currentTime);
      } else {
        setCurrentTime((prev) => (prev + 0.1 >= duration ? 0 : prev + 0.1));
      }
    }, 100);

    return () => {
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [isPlaying, duration]);

  const handleTogglePlay = async () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    const audios = Object.values(audioRefs.current);
    if (nextPlaying) {
      const targetTime = audioRefs.current.vocals?.currentTime || 0;
      await Promise.allSettled(
        audios.map((audio) => {
          try {
            if (Math.abs(audio.currentTime - targetTime) > 0.08) {
              audio.currentTime = targetTime;
            }
            return audio.play();
          } catch {
            return Promise.resolve();
          }
        })
      );
    } else {
      audios.forEach((audio) => {
        try {
          audio.pause();
        } catch {
          // Ignora
        }
      });
    }
  };

  const handleApplyPreset = (preset) => {
    setActivePreset(preset.id);
    setMutes(preset.mutes);
    setSolos(preset.solos);
  };

  const handleToggleMute = (stemId) => {
    setActivePreset('custom');
    setMutes((prev) => ({ ...prev, [stemId]: !prev[stemId] }));
  };

  const handleToggleSolo = (stemId) => {
    setActivePreset('custom');
    setSolos((prev) => ({ ...prev, [stemId]: !prev[stemId] }));
  };

  const handleVolumeChange = (stemId, newValue) => {
    setVolumes((prev) => ({ ...prev, [stemId]: Number(newValue) }));
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    /* Concentric Radius: Outer container rounded-3xl (24px) com p-2 (8px) -> Inner console rounded-2xl (16px) */
    <div className="rounded-3xl p-2 bg-gradient-to-b from-white/80 via-white/60 to-blue-100/50 dark:from-slate-800/90 dark:via-slate-900/90 dark:to-slate-950/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl">
      <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Barra Superior estilo Hardware DAW */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700"></span>
            <div className="flex items-center gap-1.5">
              <HeadphonesStudioIcon className="w-3.5 h-3.5 text-[var(--color-brand-medium)] dark:text-blue-400" />
              <span className="text-xs font-black tracking-tight text-slate-800 dark:text-slate-100">
                LIVE SANDBOX • 4 STEMS REAIS
              </span>
            </div>
          </div>

          {/* Telemetria em Tabular Numerals */}
          <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
              118 BPM
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              Tom: {transposedKeyLabel}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {formatTimecode(currentTime)}
            </span>
          </div>
        </div>

        {/* Barra de Transporte Principal + Seletor de Presets Rápidos */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-slate-50/50 via-white to-blue-50/30 dark:from-slate-900/40 dark:via-[#0B1325] dark:to-blue-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            {/* Botão Play/Pause com área de toque >= 44x44px e alinhamento óptico */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Pausar demonstração multitrack' : 'Tocar demonstração multitrack ao vivo'}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg studio-btn-transition active:scale-95 cursor-pointer shrink-0 ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
                    : 'bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] shadow-blue-500/30'
                }`}
              >
                {isPlaying ? (
                  <PauseOpticalIcon className="w-5 h-5" />
                ) : (
                  <PlayOpticalIcon className="w-5 h-5 translate-x-[1px]" />
                )}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    Sessão Demo — Studio Groove
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isPlaying
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPlaying ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                      }`}
                    ></span>
                    {isPlaying ? 'TOCANDO AO VIVO' : 'CLIQUE EM PLAY'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Teste os botões <strong>M (Mute)</strong>, <strong>S (Solo)</strong> e os volumes abaixo em tempo real
                </p>
              </div>
            </div>

            {/* Controle Interativo de Pitch Shift (Semitons) */}
            <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-100/90 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/80">
              <PitchShiftIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Pitch:</span>
              <div className="flex items-center gap-1 tabular-nums">
                <button
                  type="button"
                  onClick={() => setSemitones((s) => Math.max(-6, s - 1))}
                  aria-label="Diminuir 1 semitom"
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black text-xs border border-slate-200 dark:border-slate-600 studio-btn-transition active:scale-95 cursor-pointer"
                >
                  −
                </button>
                <span className="w-11 text-center text-xs font-black text-slate-900 dark:text-white">
                  {semitones > 0 ? `+${semitones}` : semitones} st
                </span>
                <button
                  type="button"
                  onClick={() => setSemitones((s) => Math.min(6, s + 1))}
                  aria-label="Aumentar 1 semitom"
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black text-xs border border-slate-200 dark:border-slate-600 studio-btn-transition active:scale-95 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Barra de Progresso com Marcadores de Loop A-B */}
          <div className="mt-3.5">
            <div className="relative h-2 rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden">
              {/* Região de Loop A-B destacada */}
              {loopActive && (
                <div
                  className="absolute inset-y-0 left-[15%] right-[20%] bg-blue-500/15 dark:bg-blue-400/15 border-x border-blue-500/40"
                  title="Região de Loop A-B Ativa"
                />
              )}
              <div
                className="h-full bg-gradient-to-r from-[var(--color-brand-medium)] to-indigo-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 tabular-nums">
              <span>00:00.0</span>
              <button
                type="button"
                onClick={() => setLoopActive((l) => !l)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  loopActive
                    ? 'text-[var(--color-brand-medium)] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LoopRepeatIcon className="w-3 h-3" />
                <span>Loop A-B {loopActive ? 'Ativo (Refrão)' : 'Off'}</span>
              </button>
              <span>{formatTimecode(duration)}</span>
            </div>
          </div>

          {/* Seletor Rápido de Presets de Estudo */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/70">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
              Presets de Ensaio:
            </span>
            {PRESET_MIXES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold studio-btn-transition active:scale-95 cursor-pointer ${
                  activePreset === preset.id
                    ? 'bg-[var(--color-brand-medium)] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista dos 4 Canais Multitrack Interativos */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {DEMO_STEMS.map((stem) => {
            const audible = isStemAudible(stem.id);
            const isMuted = mutes[stem.id];
            const isSolo = solos[stem.id];
            const vol = volumes[stem.id];

            return (
              <div
                key={stem.id}
                className={`p-3 rounded-xl border studio-card-transition ${
                  audible
                    ? 'bg-slate-50/90 dark:bg-slate-900/75 border-slate-200/90 dark:border-slate-800'
                    : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/40 dark:border-slate-800/40 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Identificação do Canal */}
                  <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-[175px]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center p-1.5 shadow-2xs shrink-0">
                        <img
                          src={stem.icon}
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {stem.label}
                          </span>
                        </div>
                        <span
                          className={`inline-block text-[10px] font-extrabold px-1.5 py-0.2 rounded border mt-0.5 ${stem.badgeClass}`}
                        >
                          {stem.shortLabel} • {audible ? `${vol}%` : 'SILENCIADO'}
                        </span>
                      </div>
                    </div>

                    {/* Botões M (Mute) e S (Solo) mobile/desktop */}
                    <div className="flex items-center gap-1.5 sm:ml-auto">
                      <button
                        type="button"
                        aria-pressed={isMuted}
                        aria-label={`Silenciar canal ${stem.label}`}
                        onClick={() => handleToggleMute(stem.id)}
                        className={`w-8 h-8 rounded-lg text-xs font-black studio-btn-transition active:scale-95 cursor-pointer border ${
                          isMuted
                            ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400'
                        }`}
                        title="Mute (Silenciar faixa)"
                      >
                        M
                      </button>
                      <button
                        type="button"
                        aria-pressed={isSolo}
                        aria-label={`Isolar (Solo) canal ${stem.label}`}
                        onClick={() => handleToggleSolo(stem.id)}
                        className={`w-8 h-8 rounded-lg text-xs font-black studio-btn-transition active:scale-95 cursor-pointer border ${
                          isSolo
                            ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        }`}
                        title="Solo (Ouvir apenas esta faixa)"
                      >
                        S
                      </button>
                    </div>
                  </div>

                  {/* Mini-Waveform Reativa + Fader de Volume */}
                  <div className="flex items-center gap-3 flex-1">
                    {/* Barras de Forma de Onda */}
                    <div
                      className="hidden md:flex items-center gap-0.5 h-7 px-2 bg-white/80 dark:bg-slate-950/60 rounded-lg border border-slate-200/60 dark:border-slate-800/80 shrink-0"
                      aria-hidden="true"
                    >
                      {stem.waveHeights.map((h, idx) => {
                        const scaledHeight = audible
                          ? Math.max(15, Math.round((h * vol) / 100))
                          : 12;
                        const isPassed = (idx / stem.waveHeights.length) * 100 <= progressPercent;
                        return (
                          <span
                            key={idx}
                            className={`w-1 rounded-full transition-transform duration-150 ${
                              audible
                                ? isPassed
                                  ? stem.accentBg
                                  : 'bg-slate-300 dark:bg-slate-700'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                            style={{
                              height: `${scaledHeight}%`,
                              transform:
                                isPlaying && audible && !prefersReducedMotion && isTabVisible
                                  ? `scaleY(${idx % 2 === 0 ? 1.08 : 0.92})`
                                  : 'scaleY(1)',
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Fader de Volume Acessível */}
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={vol}
                        aria-label={`Volume de ${stem.label}`}
                        onChange={(e) => handleVolumeChange(stem.id, e.target.value)}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-brand-medium)]"
                      />
                      <span className="w-9 text-right text-xs font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        {vol}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé do Console com Call to Action para Separar Própria Música */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              No Studio completo você isola <strong>6 faixas</strong> (incluindo Piano e Guitarra separados) de qualquer MP3 ou WAV.
            </span>
          </div>
          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              className="w-full sm:w-auto shrink-0 px-3.5 py-1.5 rounded-xl bg-[var(--color-brand-deep)] dark:bg-blue-600 hover:bg-[var(--color-brand-medium)] dark:hover:bg-blue-500 text-white text-xs font-black studio-btn-transition active:scale-95 cursor-pointer"
            >
              Testar com Minha Música →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingInteractiveMixer;
