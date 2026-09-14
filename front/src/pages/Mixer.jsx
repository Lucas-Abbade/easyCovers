import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Tone from 'tone';
import PlayPauseButton from '../components/PlayPauseButton';

// Identidade visual cromática e metadados padronizados para os 6 stems isolados
const STEM_CONFIG = {
  vocals: {
    label: "Vocais",
    iconSrc: "/assets/icons/stem_vocals.png",
    color: "from-purple-500 to-indigo-600",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    borderColor: "border-purple-200",
    accent: "text-purple-600",
    accentHex: "#9333ea"
  },
  drums: {
    label: "Bateria",
    iconSrc: "/assets/icons/stem_drums.png",
    color: "from-amber-500 to-orange-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    borderColor: "border-amber-200",
    accent: "text-amber-600",
    accentHex: "#f59e0b"
  },
  bass: {
    label: "Baixo",
    iconSrc: "/assets/icons/stem_bass.png",
    color: "from-emerald-500 to-teal-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    borderColor: "border-emerald-200",
    accent: "text-emerald-600",
    accentHex: "#10b981"
  },
  guitar: {
    label: "Guitarra",
    iconSrc: "/assets/icons/stem_guitar.png",
    color: "from-blue-500 to-cyan-600",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    borderColor: "border-blue-200",
    accent: "text-blue-600",
    accentHex: "#2563eb"
  },
  piano: {
    label: "Teclado / Piano",
    iconSrc: "/assets/icons/stem_piano.png",
    color: "from-pink-500 to-rose-600",
    badgeBg: "bg-pink-50",
    badgeText: "text-pink-700",
    borderColor: "border-pink-200",
    accent: "text-pink-600",
    accentHex: "#ec4899"
  },
  other: {
    label: "Outros / FX",
    iconSrc: "/assets/icons/stem_other.png",
    color: "from-slate-500 to-gray-700",
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-700",
    borderColor: "border-slate-200",
    accent: "text-slate-600",
    accentHex: "#64748b"
  }
};

const STEM_KEYS = ["vocals", "drums", "bass", "other", "guitar", "piano"];
const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const normalizeKeyName = (key) => {
  if (!key) return "Unknown";
  if (typeof key === 'object' && key.value) return key.value;
  return key;
};

const getShiftedKey = (originalKey, semitones) => {
  const normalized = normalizeKeyName(originalKey);
  if (!normalized || normalized === "Unknown") return "Unknown";
  const isMinor = normalized.endsWith("m");
  const root = isMinor ? normalized.slice(0, -1) : normalized;
  const index = KEY_NAMES.indexOf(root);
  if (index === -1) return normalized;
  const shiftedIndex = (index + semitones + 120) % 12;
  return `${KEY_NAMES[shiftedIndex]}${isMinor ? 'm' : ''}`;
};

const Mixer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const song = location.state?.song;

  // Estados de reprodução e sincronização
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Estados de mixagem por stem (volume, mute e solo de nível DAW)
  const [volumes, setVolumes] = useState({ vocals: 80, drums: 80, bass: 80, other: 80, guitar: 80, piano: 80 });
  const [mutes, setMutes] = useState({ vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false });
  const [solos, setSolos] = useState({ vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false });

  // Master Volume e Mute Master
  const [masterVolume, setMasterVolume] = useState(100);
  const [isMasterMuted, setIsMasterMuted] = useState(false);
  const prevMasterVolumeRef = useRef(100);

  const rawKey = song?.original_key || song?.originalKey || "Unknown";
  // Controle de Transposição Harmônica (Pitch Shifting)
  const [originalKey] = useState(() => normalizeKeyName(rawKey));
  const [currentPitch, setCurrentPitch] = useState(0);
  const [currentKey, setCurrentKey] = useState(() => getShiftedKey(rawKey, 0));

  const players = useRef(null);
  const pitchShift = useRef(null);
  const progressInterval = useRef(null);

  // Formatação de tempo (MM:SS)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
    const min = Math.floor(timeInSeconds / 60);
    const sec = Math.floor(timeInSeconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Aplicação da matriz de Mute / Solo de estúdio
  const applyAudioRouting = useCallback((activeMutes, activeSolos) => {
    if (!players.current) return;
    const hasAnySolo = Object.values(activeSolos).some(Boolean);

    STEM_KEYS.forEach(track => {
      if (players.current.has(track)) {
        let shouldMute;
        if (hasAnySolo) {
          // Se qualquer faixa estiver em solo, silencia todas que não estão em solo ou que estão mutadas
          shouldMute = !activeSolos[track] || activeMutes[track];
        } else {
          shouldMute = activeMutes[track];
        }
        players.current.player(track).mute = shouldMute;
      }
    });
  }, []);

  // Inicialização do Tone.js e dos 6 players de áudio
  useEffect(() => {
    if (!song) {
      navigate('/dashboard');
      return;
    }

    const caminhoDaPasta = song.folder_path || song.folder;
    if (!caminhoDaPasta) {
      navigate('/dashboard');
      return;
    }

    const pastaID = caminhoDaPasta.split(/[\\/]/).pop();
    const baseUrl = `http://localhost:8000/stems/${pastaID}/`;

    // Cadeia de efeitos: Players -> PitchShift -> Destination
    pitchShift.current = new Tone.PitchShift(0).toDestination();

    players.current = new Tone.Players({
      vocals: baseUrl + "vocals.wav",
      drums: baseUrl + "drums.wav",
      bass: baseUrl + "bass.wav",
      other: baseUrl + "other.wav",
      guitar: baseUrl + "guitar.wav",
      piano: baseUrl + "piano.wav",
    }).connect(pitchShift.current);

    Tone.loaded().then(() => {
      setIsLoaded(true);
      Tone.Destination.volume.value = 0;

      // Pega duração a partir da faixa de vocais ou fallback
      if (players.current.has("vocals")) {
        setDuration(players.current.player("vocals").buffer.duration);
      }

      // Sincroniza todas as 6 faixas no Transport do Tone.js
      STEM_KEYS.forEach(track => {
        if (players.current.has(track)) {
          const player = players.current.player(track);
          player.volume.value = 20 * Math.log10((80 / 100) * 0.5);
          player.sync().start(0);
        }
      });
    }).catch(err => {
      console.error("Falha ao carregar stems no Tone.js:", err);
    });

    return () => {
      cancelAnimationFrame(progressInterval.current);
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
      players.current?.dispose();
      pitchShift.current?.dispose();
    };
  }, [song, navigate]);

  // Atualização fluida do progresso do áudio via requestAnimationFrame
  useEffect(() => {
    const updateProgress = () => {
      if (Tone.Transport.state === 'started') {
        setProgress(Tone.Transport.seconds);

        if (duration > 0 && Tone.Transport.seconds >= duration) {
          Tone.Transport.stop();
          Tone.Transport.seconds = 0;
          setProgress(0);
          setIsPlaying(false);
        } else {
          progressInterval.current = requestAnimationFrame(updateProgress);
        }
      }
    };

    if (isPlaying) {
      progressInterval.current = requestAnimationFrame(updateProgress);
    }

    return () => cancelAnimationFrame(progressInterval.current);
  }, [isPlaying, duration]);

  // Alternar Play / Pause
  const togglePlay = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    if (isPlaying) {
      Tone.Transport.pause();
    } else {
      Tone.Transport.start();
    }
    setIsPlaying(!isPlaying);
  };

  // Salto de tempo (+ ou - segundos)
  const handleSeekDelta = (deltaSeconds) => {
    if (!isLoaded || duration <= 0) return;
    const target = Math.max(0, Math.min(duration, Tone.Transport.seconds + deltaSeconds));
    Tone.Transport.seconds = target;
    setProgress(target);
  };

  // Reiniciar faixa do início
  const handleRestart = () => {
    Tone.Transport.seconds = 0;
    setProgress(0);
  };

  // Arrastar barra de progresso da linha do tempo
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setProgress(newTime);
    Tone.Transport.seconds = newTime;
  };

  // Mudança de volume de um stem individual
  const handleVolumeChange = (track, value) => {
    const numericValue = parseFloat(value);
    setVolumes(prev => ({ ...prev, [track]: numericValue }));

    if (players.current && players.current.has(track)) {
      const player = players.current.player(track);
      player.volume.value = numericValue === 0
        ? -Infinity
        : 20 * Math.log10((numericValue / 100) * 0.5);
    }
  };

  // Alternar Mute individual
  const toggleMute = (track) => {
    setMutes(prev => {
      const nextMutes = { ...prev, [track]: !prev[track] };
      applyAudioRouting(nextMutes, solos);
      return nextMutes;
    });
  };

  // Alternar Solo individual
  const toggleSolo = (track) => {
    setSolos(prev => {
      const nextSolos = { ...prev, [track]: !prev[track] };
      applyAudioRouting(mutes, nextSolos);
      return nextSolos;
    });
  };

  // Controle de Master Volume
  const handleMasterVolumeChange = (value) => {
    const numericValue = parseFloat(value);
    setMasterVolume(numericValue);
    setIsMasterMuted(numericValue === 0);

    if (Tone.Destination) {
      Tone.Destination.volume.value = numericValue === 0
        ? -Infinity
        : 20 * Math.log10(numericValue / 100);
    }
  };

  // Alternar Mute Master
  const toggleMasterMute = () => {
    if (isMasterMuted) {
      const restored = prevMasterVolumeRef.current || 80;
      handleMasterVolumeChange(restored);
      setIsMasterMuted(false);
    } else {
      prevMasterVolumeRef.current = masterVolume;
      handleMasterVolumeChange(0);
      setIsMasterMuted(true);
    }
  };

  // Transposição Harmônica em Semitons (-12 a +12)
  const changePitch = (delta) => {
    const nextPitch = currentPitch + delta;
    if (!pitchShift.current || nextPitch < -12 || nextPitch > 12) return;
    pitchShift.current.pitch = nextPitch;
    setCurrentPitch(nextPitch);
    setCurrentKey(getShiftedKey(originalKey, nextPitch));
  };

  const resetPitch = () => {
    if (!pitchShift.current) return;
    pitchShift.current.pitch = 0;
    setCurrentPitch(0);
    setCurrentKey(getShiftedKey(originalKey, 0));
  };

  // Presets de Estúdio: "Backing Track" (muta o instrumento do usuário)
  const handleBackingTrackPreset = () => {
    const instrument = (song?.instrument || "").toLowerCase();
    let targetStem = null;

    if (instrument.includes("guitar") || instrument.includes("violão")) targetStem = "guitar";
    else if (instrument.includes("voz") || instrument.includes("vocal") || instrument.includes("canto")) targetStem = "vocals";
    else if (instrument.includes("baixo")) targetStem = "bass";
    else if (instrument.includes("bateria")) targetStem = "drums";
    else if (instrument.includes("teclado") || instrument.includes("piano")) targetStem = "piano";

    if (!targetStem) {
      targetStem = "guitar"; // Fallback padrão
    }

    const nextMutes = {
      vocals: targetStem === 'vocals',
      drums: targetStem === 'drums',
      bass: targetStem === 'bass',
      other: targetStem === 'other',
      guitar: targetStem === 'guitar',
      piano: targetStem === 'piano',
    };

    setMutes(nextMutes);
    setSolos({ vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false });
    applyAudioRouting(nextMutes, { vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false });
  };

  // Reset de todos os níveis para 80% e desmutar tudo
  const handleResetVolumes = () => {
    const defaultVol = { vocals: 80, drums: 80, bass: 80, other: 80, guitar: 80, piano: 80 };
    const defaultMute = { vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false };
    const defaultSolo = { vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false };

    setVolumes(defaultVol);
    setMutes(defaultMute);
    setSolos(defaultSolo);

    STEM_KEYS.forEach(track => handleVolumeChange(track, 80));
    applyAudioRouting(defaultMute, defaultSolo);
  };

  // Atalhos de teclado profissionais (Espaço, Setas, M, R)
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = {
      togglePlay,
      handleSeekDelta,
      toggleMasterMute,
      handleRestart,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlersRef.current.togglePlay?.();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlersRef.current.handleSeekDelta?.(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handlersRef.current.handleSeekDelta?.(5);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handlersRef.current.toggleMasterMute?.();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handlersRef.current.handleRestart?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasAnySolo = Object.values(solos).some(Boolean);

  return (
    <div
      className="font-sans min-h-screen bg-repeat flex flex-col"
      style={{
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      {/* HEADER PADRONIZADO EASYCOVERS */}
      <header className="bg-white/95 backdrop-blur-md shadow-md px-6 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img
            src="/assets/logo_symbol.png"
            alt="EasyCovers Logo"
            className="h-10 md:h-12 w-auto object-contain drop-shadow-sm"
          />
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-[var(--color-brand-deep)] leading-tight">
              EasyCovers
            </h1>
            <span className="text-xs text-gray-500 font-medium hidden sm:inline-block">
              AI Audio Stem Separation Studio • Console de Mixagem
            </span>
          </div>
        </div>

        {/* Status da Engine & Botão Voltar */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-[var(--color-brand-deep)]">
            {!isLoaded ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>Decodificando Stems WAV...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Engine Pronta (44.1 kHz Estéreo)</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              Tone.Transport.stop();
              navigate('/dashboard');
            }}
            className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-[var(--color-brand-medium)] bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition border border-gray-200 shadow-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Voltar à Biblioteca</span>
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL DO ESTÚDIO */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 my-4 flex flex-col gap-6">

        {/* 1. CARD DE METADADOS DA MÚSICA & PITCH SHIFTER */}
        <section className="bg-white/95 backdrop-blur-md rounded-2xl p-6 md:p-7 shadow-xl border border-white/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          
          {/* Capa com Efeito Vinil Animado + Dados da Faixa */}
          <div className="flex items-center gap-5 sm:gap-6 min-w-0">
            <div className="relative flex items-center shrink-0">
              {/* Disco de Vinil que projeta e gira com o áudio tocando */}
              <div
                className={`hidden sm:flex absolute left-4 w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-900 border-4 border-slate-800 shadow-xl transition-all duration-500 items-center justify-center ${
                  isPlaying ? 'translate-x-7 md:translate-x-8 animate-[spin_4s_linear_infinite]' : 'translate-x-2'
                }`}
              >
                {/* Ranhuras do vinil */}
                <div className="w-14 h-14 rounded-full border border-slate-700/50 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--color-brand-medium)] to-indigo-600 border-2 border-white/20 flex items-center justify-center shadow-inner">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900"></div>
                  </div>
                </div>
              </div>

              {/* Capa Principal */}
              <div className="relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-[var(--color-brand-light)] bg-gradient-to-br from-blue-600 to-[var(--color-brand-deep)] flex items-center justify-center shrink-0">
                <img
                  src="/assets/favicon.jpg"
                  alt="Track Cover"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight truncate">
                  {song?.name || "Música sem título"}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-600">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span>6 Stems Isolados</span>
                </span>
              </div>

              <p className="text-base md:text-lg text-gray-600 font-medium truncate">
                Artista: <span className="font-bold text-[var(--color-brand-deep)]">{song?.artist || "Desconhecido"}</span>
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-gray-200">
                  <img src="/assets/icons/icon_genre_disc.png" alt="" className="w-4 h-4 object-contain" />
                  <span>{song?.genre || "Gênero Geral"}</span>
                </span>
                {song?.instrument && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-xs font-bold rounded-lg uppercase tracking-wider border border-blue-200">
                    <img src="/assets/icons/icon_instrument_pick.png" alt="" className="w-4 h-4 object-contain" />
                    <span>{song.instrument}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Módulo de Transposição Harmônica (Pitch Shifting) */}
          <div className="w-full lg:w-auto bg-slate-50/90 p-4 md:p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="text-left lg:text-right">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Afinação Harmônica
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">Tom Original: <strong className="text-gray-800">{originalKey}</strong></span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm font-black text-[var(--color-brand-medium)]">
                    Atual: {currentKey}
                  </span>
                </div>
              </div>

              {currentPitch !== 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                  {currentPitch > 0 ? `+${currentPitch}` : currentPitch} st
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePitch(-1)}
                disabled={currentPitch <= -12}
                title="Diminuir 1 semitom"
                className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-700 font-bold text-xs rounded-xl border border-slate-300 shadow-xs transition active:scale-95"
              >
                - Semitom
              </button>

              {currentPitch !== 0 && (
                <button
                  type="button"
                  onClick={resetPitch}
                  title="Restaurar afinação original"
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold text-xs rounded-xl border border-amber-200 transition active:scale-95"
                >
                  Reset (0)
                </button>
              )}

              <button
                type="button"
                onClick={() => changePitch(1)}
                disabled={currentPitch >= 12}
                title="Aumentar 1 semitom"
                className="px-3 py-1.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
              >
                + Semitom
              </button>
            </div>
          </div>
        </section>

        {/* 2. PLAYER CENTRAL & TIMELINE ESTILO SPOTIFY / DAW */}
        <section className="bg-white/95 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-xl border-t-4 border-[var(--color-brand-medium)] flex flex-col items-center gap-5">
          
          {/* Controles de Transporte (Rewind 5s, Play/Pause, Forward 5s, Restart) */}
          <div className="flex items-center gap-4 md:gap-6">
            <button
              type="button"
              onClick={handleRestart}
              disabled={!isLoaded}
              title="Voltar ao início (R)"
              className="p-3 text-gray-400 hover:text-gray-700 disabled:opacity-40 transition active:scale-95 rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V7.19c0-1.44-1.555-2.343-2.805-1.628L12 9.529v-2.34c0-1.44-1.555-2.343-2.805-1.628L2.25 9.53c-1.25.714-1.25 2.54 0 3.255l6.945 5.655z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleSeekDelta(-5)}
              disabled={!isLoaded}
              title="Voltar 5 segundos (Seta Esquerda)"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-40 transition active:scale-95 rounded-xl border border-gray-200 shadow-xs cursor-pointer"
            >
              <img src="/assets/icons/icon_seek_backward.png" alt="" className="w-4 h-4 object-contain opacity-75" />
              <span>-5s</span>
            </button>

            {/* BOTÃO PLAY / PAUSE PRINCIPAL */}
            <div className="flex items-center justify-center mx-2">
              <PlayPauseButton
                isPlaying={isPlaying}
                isLoaded={isLoaded}
                togglePlay={togglePlay}
                size="large"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSeekDelta(5)}
              disabled={!isLoaded}
              title="Avançar 5 segundos (Seta Direita)"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-40 transition active:scale-95 rounded-xl border border-gray-200 shadow-xs cursor-pointer"
            >
              <span>+5s</span>
              <img src="/assets/icons/icon_seek_forward.png" alt="" className="w-4 h-4 object-contain opacity-75" />
            </button>

            <div className="text-xs text-gray-400 font-bold hidden sm:block">
              {isPlaying ? (
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                  Tocando
                </span>
              ) : (
                <span>Pausado</span>
              )}
            </div>
          </div>

          {/* Barra da Linha do Tempo Estilo Spotify com Gradiente Suave */}
          <div className="w-full flex items-center gap-4">
            <span className="text-xs md:text-sm font-bold text-gray-600 w-12 text-right tabular-nums">
              {formatTime(progress)}
            </span>

            <div className="relative flex-1 flex items-center group">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={progress}
                onChange={handleSeek}
                disabled={!isLoaded}
                aria-label="Progresso da música"
                className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(to right, #2563eb ${(progress / (duration || 100)) * 100}%, #e2e8f0 ${(progress / (duration || 100)) * 100}%)`
                }}
              />
            </div>

            <div className="flex items-center gap-2 w-20 text-xs md:text-sm font-bold text-gray-500 tabular-nums">
              <span>{formatTime(duration)}</span>
              {duration > 0 && (
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  (-{formatTime(Math.max(0, duration - progress))})
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 3. BARRA MASTER & PRESETS DE ENSAIO */}
        <section className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-lg border border-white/80 flex flex-col md:flex-row items-center justify-between gap-5">
          
          {/* Master Volume */}
          <div className="w-full md:w-80 flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={toggleMasterMute}
              title={isMasterMuted ? "Desmutar Master (M)" : "Mutar Master (M)"}
              className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
                isMasterMuted ? 'bg-red-500 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isMasterMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13.5 4.06c0-1.333-1.612-2.003-2.553-1.062l-4.506 4.506H4.5a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25h1.941l4.506 4.506c.941.941 2.553.271 2.553-1.062V4.06zM17.28 9.22a.75.75 0 10-1.06 1.06L17.44 11.5l-1.22 1.22a.75.75 0 101.06 1.06l1.22-1.22 1.22 1.22a.75.75 0 101.06-1.06L19.56 11.5l1.22-1.22a.75.75 0 10-1.06-1.06l-1.22 1.22-1.22-1.22z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13.5 4.06c0-1.333-1.612-2.003-2.553-1.062l-4.506 4.506H4.5a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25h1.941l4.506 4.506c.941.941 2.553.271 2.553-1.062V4.06zM18.75 12a.75.75 0 00-1.5 0 4.25 4.25 0 01-4.25 4.25.75.75 0 000 1.5 5.75 5.75 0 005.75-5.75z" />
                </svg>
              )}
            </button>

            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                <span>Master Gain</span>
                <span className="text-gray-900 font-extrabold">{masterVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => handleMasterVolumeChange(e.target.value)}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #2563eb ${masterVolume}%, #cbd5e1 ${masterVolume}%)`
                }}
              />
            </div>
          </div>

          {/* Ações Rápidas / Presets de Prática para Músicos */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleBackingTrackPreset}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition active:scale-95 shadow-xs"
              title="Muta automaticamente o seu instrumento principal para você praticar junto"
            >
              <img src="/assets/icons/icon_backing_track.png" alt="" className="w-4 h-4 object-contain" />
              <span>Modo Backing Track</span>
            </button>

            <button
              type="button"
              onClick={handleResetVolumes}
              className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition active:scale-95 shadow-xs"
              title="Restaura todas as faixas para volume padrão (80%) e remove solos/mutes"
            >
              <img src="/assets/icons/icon_reset_levels.png" alt="" className="w-4 h-4 object-contain" />
              <span>Resetar Níveis</span>
            </button>

            {hasAnySolo && (
              <button
                type="button"
                onClick={() => {
                  const noSolo = { vocals: false, drums: false, bass: false, other: false, guitar: false, piano: false };
                  setSolos(noSolo);
                  applyAudioRouting(mutes, noSolo);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L10 8.94l3.72-3.72a.75.75 0 111.06 1.06L11.06 10l3.72 3.72a.75.75 0 01-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 01-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 011.06-1.06z" />
                </svg>
                <span>Limpar Solos</span>
              </button>
            )}
          </div>
        </section>

        {/* 4. CONSOLE DE MIXAGEM VERTICAL COM 6 CANAIS (STEMS) */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-600 flex items-center gap-2">
              <img src="/assets/icons/icon_mixer_board.png" alt="" className="w-5 h-5 object-contain" />
              <span>Canais de Mixagem Multifaixa</span>
              <span className="text-xs text-[var(--color-brand-medium)] font-bold">
                (Isolamento Cirúrgico HTDemucs)
              </span>
            </h3>
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">
              Clique duas vezes no fader para resetar a 80%
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
            {STEM_KEYS.map((track) => {
              const config = STEM_CONFIG[track];
              const isMuted = mutes[track];
              const isSolo = solos[track];
              const isEffectivelyMuted = hasAnySolo ? (!isSolo || isMuted) : isMuted;
              const isSounding = isPlaying && !isEffectivelyMuted && volumes[track] > 0;

              return (
                <div
                  key={track}
                  className={`relative rounded-2xl p-4 md:p-5 flex flex-col items-center justify-between transition-all duration-200 border-2 shadow-sm ${
                    isEffectivelyMuted
                      ? 'bg-slate-100/80 border-slate-300 opacity-60'
                      : isSolo
                      ? 'bg-amber-50/40 border-amber-400 shadow-md ring-2 ring-amber-300'
                      : 'bg-white/95 backdrop-blur-sm border-gray-200/90 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  {/* Cabeçalho do Canal: Ícone + Nome do Stem */}
                  <div className="w-full flex flex-col items-center text-center">
                    <div className="flex flex-col items-center gap-2 mb-1">
                      <img
                        src={config.iconSrc}
                        alt={config.label}
                        className="w-10 h-10 object-contain drop-shadow-sm transition-transform duration-200 hover:scale-105"
                      />
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-800">
                        {config.label}
                      </h4>
                    </div>

                    {/* VU Meter / Equalizador Visual Animado */}
                    <div className="h-5 flex items-end justify-center gap-1 my-2" title="Nível de sinal do canal">
                      {isSounding ? (
                        <>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-1"></span>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-2"></span>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-3"></span>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-4"></span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 opacity-30">
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fader Vertical de Ganho com Escala Visual */}
                  <div className="relative flex items-center justify-center h-48 w-full my-2">
                    {/* Linhas de marcação métrica (-∞, -18, -6, 0 dB) */}
                    <div className="absolute right-3 h-40 flex flex-col justify-between text-[9px] font-bold text-gray-300 pointer-events-none select-none">
                      <span>0dB</span>
                      <span>-6</span>
                      <span>-18</span>
                      <span>-∞</span>
                    </div>

                    {/* Trilha do Fader com rotação de -90 graus */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volumes[track]}
                      onDoubleClick={() => handleVolumeChange(track, 80)}
                      onChange={(e) => handleVolumeChange(track, e.target.value)}
                      aria-label={`Volume de ${config.label}`}
                      className="appearance-none w-40 h-2 rounded-lg cursor-pointer accent-blue-600 focus:outline-none origin-center -rotate-90"
                      style={{
                        background: `linear-gradient(to right, ${config.accentHex} ${volumes[track]}%, #cbd5e1 ${volumes[track]}%)`
                      }}
                    />
                  </div>

                  {/* Badge de Porcentagem / Decibéis */}
                  <div className="my-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-black bg-gray-100 text-gray-700 border border-gray-200 tabular-nums">
                      {volumes[track]}%
                    </span>
                  </div>

                  {/* Ações do Canal: SOLO e MUTE de Alta Legibilidade */}
                  <div className="grid grid-cols-2 gap-1.5 w-full mt-1">
                    {/* Botão SOLO */}
                    <button
                      type="button"
                      onClick={() => toggleSolo(track)}
                      title={`Isolar faixa ${config.label} (Solo)`}
                      className={`py-2 rounded-xl text-[11px] font-black tracking-wider transition active:scale-95 cursor-pointer ${
                        isSolo
                          ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                      }`}
                    >
                      SOLO
                    </button>

                    {/* Botão MUTE */}
                    <button
                      type="button"
                      onClick={() => toggleMute(track)}
                      title={`Mutar faixa ${config.label}`}
                      className={`py-2 rounded-xl text-[11px] font-black tracking-wider transition active:scale-95 cursor-pointer ${
                        isMuted
                          ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-700'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                    >
                      {isMuted ? 'MUDO' : 'MUTE'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. GUIA DE ATALHOS DE TECLADO NO RODAPÉ */}
        <footer className="mt-2 py-3 px-4 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-500 gap-3">
          <div className="flex items-center gap-2">
            <img src="/assets/icons/icon_keyboard_shortcuts.png" alt="" className="w-4 h-4 object-contain" />
            <span className="font-bold text-gray-700">Atalhos Rápidos:</span>
            <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-mono font-bold">Espaço</span>
            <span>Tocar / Pausar</span>
            <span className="text-gray-300">•</span>
            <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-mono font-bold">← / →</span>
            <span>±5 Segundos</span>
            <span className="text-gray-300">•</span>
            <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-mono font-bold">M</span>
            <span>Mutar Geral</span>
            <span className="text-gray-300">•</span>
            <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-mono font-bold">R</span>
            <span>Reiniciar</span>
          </div>

          <div className="text-[11px] text-gray-400">
            EasyCovers Audio Engine • Tone.js Web Audio API
          </div>
        </footer>

      </main>
    </div>
  );
};

export default Mixer;