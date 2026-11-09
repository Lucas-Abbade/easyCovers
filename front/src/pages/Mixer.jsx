import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PlayPauseButton from '../components/PlayPauseButton';
import ThemeToggle from '../components/ThemeToggle';
import DashboardStudioBackground from '../components/DashboardStudioBackground';
import MixerMasterRack from '../components/MixerMasterRack';
import StudioChannelStrip from '../components/StudioChannelStrip';
import { StudioAudioEngine } from '../utils/studioAudioEngine';
import {
  MixerFadersIcon,
  WaveformIcon,
  LoopRepeatIcon,
  MetronomeIcon,
  MicLyricsIcon,
  HeadphonesStudioIcon,
} from '../components/Icons';
import { getGenreImage } from '../utils/genreImages';
import {
  useScrollVariable,
  useDocumentVisibility,
} from '../utils/motionTokens';

// Identidade visual cromática e metadados padronizados para os 6 stems isolados
const STEM_CONFIG = {
  vocals: {
    label: 'Vocais',
    shortLabel: 'VOZ',
    iconSrc: '/assets/icons/stem_vocals.png',
    color: 'from-purple-500 to-indigo-600',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    borderColor: 'border-purple-200',
    accent: 'text-purple-600',
    accentHex: '#9333ea',
  },
  drums: {
    label: 'Bateria',
    shortLabel: 'DRM',
    iconSrc: '/assets/icons/stem_drums.png',
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-200',
    accent: 'text-amber-600',
    accentHex: '#f59e0b',
  },
  bass: {
    label: 'Baixo',
    shortLabel: 'BAS',
    iconSrc: '/assets/icons/stem_bass.png',
    color: 'from-emerald-500 to-teal-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    accent: 'text-emerald-600',
    accentHex: '#10b981',
  },
  other: {
    label: 'Outros / FX',
    shortLabel: 'SYN',
    iconSrc: '/assets/icons/stem_other.png',
    color: 'from-slate-500 to-gray-700',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-200',
    accent: 'text-slate-600',
    accentHex: '#64748b',
  },
  guitar: {
    label: 'Guitarra',
    shortLabel: 'GTR',
    iconSrc: '/assets/icons/stem_guitar.png',
    color: 'from-blue-500 to-cyan-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-200',
    accent: 'text-blue-600',
    accentHex: '#2563eb',
  },
  piano: {
    label: 'Teclado / Piano',
    shortLabel: 'PNO',
    iconSrc: '/assets/icons/stem_piano.png',
    color: 'from-pink-500 to-rose-600',
    badgeBg: 'bg-pink-50',
    badgeText: 'text-pink-700',
    borderColor: 'border-pink-200',
    accent: 'text-pink-600',
    accentHex: '#ec4899',
  },
};

const STEM_KEYS = ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'];
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WAVEFORM_BAR_COUNT = 72;

const normalizeKeyName = (key) => {
  if (!key) return 'Unknown';
  if (typeof key === 'object' && key.value) return key.value;
  return key;
};

const getShiftedKey = (originalKey, semitones) => {
  const normalized = normalizeKeyName(originalKey);
  if (!normalized || normalized === 'Unknown') return 'Unknown';
  const isMinor = normalized.endsWith('m');
  const root = isMinor ? normalized.slice(0, -1) : normalized;
  const index = KEY_NAMES.indexOf(root);
  if (index === -1) return normalized;
  const shiftedIndex = (index + semitones + 120) % 12;
  return `${KEY_NAMES[shiftedIndex]}${isMinor ? 'm' : ''}`;
};

// Parser para arquivos .lrc com timestamps [mm:ss.xx]
const parseLrc = (lrcString) => {
  if (!lrcString || typeof lrcString !== 'string') return [];
  const lines = lrcString.split('\n');
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const match = regex.exec(lines[i]);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const time = minutes * 60 + seconds + fraction;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text, id: i });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
};

const loadInitialPracticeMarkers = (songObj) => {
  if (!songObj?.id) return [];
  const storageKey = `easycovers_markers_${songObj.id}`;
  try {
    const local = localStorage.getItem(storageKey);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao ler marcadores locais:', e);
  }
  if (songObj.practice_markers) {
    try {
      const parsed =
        typeof songObj.practice_markers === 'string'
          ? JSON.parse(songObj.practice_markers)
          : songObj.practice_markers;
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('Erro ao ler marcadores do banco:', e);
    }
  }
  return [];
};

const Mixer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const song = location.state?.song;

  const mixerRootRef = useRef(null);
  useScrollVariable(mixerRootRef);
  const isTabVisible = useDocumentVisibility();

  // Estados da Sala de Controle 3D e Modo do Console (Opção A: 'daw' vertical | Opção C: 'stage' horizontal)
  const [studioLiveMode, setStudioLiveMode] = useState(true);
  const [phantomPower, setPhantomPower] = useState(true);
  const [consoleMode, setConsoleMode] = useState('daw'); // 'daw' | 'stage'
  const [activeMixPreset, setActiveMixPreset] = useState('full');
  const [hoveredStem, setHoveredStem] = useState(null);

  const initialMarker = location.state?.initialMarker;

  // Estados de reprodução e sincronização
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(() =>
    typeof initialMarker?.start === 'number' ? initialMarker.start : 0
  );
  const [duration, setDuration] = useState(0);

  // Estados do Timeline Waveform Scrubber (Hover Timecode Guide & Drag)
  const waveformContainerRef = useRef(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [isScrubbingWaveform, setIsScrubbingWaveform] = useState(false);

  // Estados do Modo Karaokê & Letras Sincronizadas
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsData, setLyricsData] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(() => Boolean(song?.name));
  const [parsedLyrics, setParsedLyrics] = useState([]);
  const lyricsContainerRef = useRef(null);

  // Estados de mixagem por stem (volume, mute e solo de nível DAW)
  const [volumes, setVolumes] = useState({
    vocals: 80,
    drums: 80,
    bass: 80,
    other: 80,
    guitar: 80,
    piano: 80,
  });
  const [mutes, setMutes] = useState({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
    guitar: false,
    piano: false,
  });
  const [solos, setSolos] = useState({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
    guitar: false,
    piano: false,
  });

  // Master Volume e Mute Master
  const [masterVolume, setMasterVolume] = useState(100);
  const [isMasterMuted, setIsMasterMuted] = useState(false);
  const prevMasterVolumeRef = useRef(100);

  const rawKey = song?.original_key || song?.originalKey || 'Unknown';
  // Controle de Transposição Harmônica (Pitch Shifting)
  const [originalKey] = useState(() => normalizeKeyName(rawKey));
  const [currentPitch, setCurrentPitch] = useState(0);
  const [currentKey, setCurrentKey] = useState(() => getShiftedKey(rawKey, 0));

  // --- STUDIO PRACTICE SUITE: Estados de Loop A-B, Velocidade, Metrônomo e Marcadores ---
  const [loopA, setLoopA] = useState(() =>
    typeof initialMarker?.start === 'number' ? initialMarker.start : null
  ); // segundos
  const [loopB, setLoopB] = useState(() =>
    typeof initialMarker?.end === 'number' ? initialMarker.end : null
  ); // segundos
  const [isLooping, setIsLooping] = useState(() =>
    typeof initialMarker?.start === 'number' && typeof initialMarker?.end === 'number'
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.5x a 1.25x
  const [isCountInEnabled, setIsCountInEnabled] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInNumber, setCountInNumber] = useState(null); // 4, 3, 2, 1
  const countInTimersRef = useRef([]);

  // Marcadores de Treino Nomeados (ex: Solo, Riff, Refrão)
  const [practiceMarkers, setPracticeMarkers] = useState(() =>
    loadInitialPracticeMarkers(song)
  );
  const [isSavingMarker, setIsSavingMarker] = useState(false);
  const [newMarkerName, setNewMarkerName] = useState('');

  // Referência da Engine de Áudio Studio-Grade (WSOLA Phase-Locked + Bit-Exact Bypass)
  const audioEngineRef = useRef(null);
  const progressInterval = useRef(null);
  const lastProgressStateUpdateRef = useRef(0);

  // Refs espelhadas para leitura síncrona no loop de 60fps sem recriar o rAF
  const audioStateRef = useRef({
    volumes,
    mutes,
    solos,
    masterVolume,
    isMasterMuted,
    playbackSpeed,
    currentPitch,
    initialMarker,
  });

  useEffect(() => {
    audioStateRef.current = {
      volumes,
      mutes,
      solos,
      masterVolume,
      isMasterMuted,
      playbackSpeed,
      currentPitch,
      initialMarker,
    };
  }, [volumes, mutes, solos, masterVolume, isMasterMuted, playbackSpeed, currentPitch, initialMarker]);

  const hasAnySolo = useMemo(() => Object.values(solos).some(Boolean), [solos]);

  // Verifica se um canal está efetivamente mutado
  const isTrackEffectivelyMuted = useCallback(
    (track) => {
      if (hasAnySolo) {
        return !solos[track] || mutes[track];
      }
      return mutes[track];
    },
    [hasAnySolo, solos, mutes]
  );

  // Grade determinística de 72 barras para o Waveform Scrubber (Ideia 3)
  const waveformBars = useMemo(() => {
    const seedStr = `${song?.id || ''}-${song?.name || 'EasyCovers'}-${song?.artist || ''}`;
    let hash = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      hash ^= seedStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    // Ganho médio ativo dos 6 canais para modular a envoltória visual
    const activeGainSum = STEM_KEYS.reduce((acc, key) => {
      const muted = hasAnySolo ? !solos[key] || mutes[key] : mutes[key];
      return acc + (muted ? 0 : volumes[key]);
    }, 0);
    const activeFactor = Math.max(0.22, Math.min(1.15, activeGainSum / 480));

    return Array.from({ length: WAVEFORM_BAR_COUNT }, (_, idx) => {
      const pos = idx / WAVEFORM_BAR_COUNT;
      // Envoltória musical natural (intro suave, corpo denso, final gradual)
      const envelope =
        pos < 0.07
          ? 0.45 + (pos / 0.07) * 0.55
          : pos > 0.92
          ? 0.4 + ((1 - pos) / 0.08) * 0.6
          : 1.0;

      const wave1 = Math.abs(Math.sin((idx + (hash & 0xff)) * 0.43));
      const wave2 = Math.abs(Math.cos((idx * 1.7 + ((hash >> 8) & 0xff)) * 0.29));
      const rawHeight = (24 + wave1 * 46 + wave2 * 28) * envelope * activeFactor;
      return Math.min(96, Math.max(16, Math.round(rawHeight)));
    });
  }, [song?.id, song?.name, song?.artist, volumes, mutes, solos, hasAnySolo]);

  // Busca letras no backend via LRCLIB
  useEffect(() => {
    if (!song?.name) return undefined;

    let cancelled = false;
    const trackName = encodeURIComponent(song.name);
    const artistName = encodeURIComponent(song.artist || '');
    const durParam = duration > 0 ? `&duration=${Math.round(duration)}` : '';

    fetch(
      `http://localhost:8000/api/music/lyrics?track_name=${trackName}&artist_name=${artistName}${durParam}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLyricsData(data);
        if (data?.synced_lyrics) {
          setParsedLyrics(parseLrc(data.synced_lyrics));
        }
      })
      .catch((err) => {
        console.warn('Erro ao buscar letra sincronizada:', err);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingLyrics(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [song?.name, song?.artist, duration]);

  // Identifica a linha ativa da letra sincronizada com o Tone.Transport
  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.length) return -1;
    let active = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (progress >= parsedLyrics[i].time - 0.2) {
        active = i;
      } else {
        break;
      }
    }
    return active;
  }, [progress, parsedLyrics]);

  // Auto-scroll da linha ativa no teleprompter de letras
  useEffect(() => {
    if (showLyrics && activeLyricIndex >= 0 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector(
        `[data-lyric-index="${activeLyricIndex}"]`
      );
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyricIndex, showLyrics]);

  // Pular o áudio para o timestamp exato da linha clicada
  const handleLyricSeek = (time) => {
    if (!isLoaded || duration <= 0) return;
    const target = Math.max(0, Math.min(duration, time));
    audioEngineRef.current?.seek(target);
    setProgress(target);
  };

  // Formatação de tempo (MM:SS)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    const min = Math.floor(timeInSeconds / 60);
    const sec = Math.floor(timeInSeconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Aplicação da matriz de Mute / Solo de estúdio
  const applyAudioRouting = useCallback((activeMutes, activeSolos) => {
    audioEngineRef.current?.setRouting(activeMutes, activeSolos);
  }, []);

  // Reseta todas as variáveis CSS de nível quando pausado
  const resetMeterCssVariables = useCallback(() => {
    const rootEl = mixerRootRef.current;
    if (!rootEl) return;
    STEM_KEYS.forEach((track) => {
      rootEl.style.setProperty(`--level-${track}`, '0');
    });
    rootEl.style.setProperty('--level-master-l', '0');
    rootEl.style.setProperty('--level-master-r', '0');
    rootEl.style.setProperty('--vu-angle-l', '-36deg');
    rootEl.style.setProperty('--vu-angle-r', '-36deg');
  }, []);

  // Inicialização da StudioAudioEngine (6 Stems Sincronizados + WSOLA Phase-Locked + Bit-Exact Bypass)
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

    const engine = new StudioAudioEngine();
    audioEngineRef.current = engine;

    engine
      .loadStems(baseUrl)
      .then((loadedDuration) => {
        if (engine.disposed) return;

        const {
          volumes: initVols,
          mutes: initMutes,
          solos: initSolos,
          masterVolume: initMasterVol,
          isMasterMuted: initMasterMuted,
          playbackSpeed: initSpeed,
          currentPitch: initPitch,
          initialMarker: initMarker,
        } = audioStateRef.current;

        STEM_KEYS.forEach((track) => {
          engine.setStemVolume(track, initVols[track]);
        });
        engine.setRouting(initMutes, initSolos);
        engine.setMasterVolume(initMasterVol, initMasterMuted);
        engine.setSpeed(initSpeed || 1.0);
        engine.setPitch(initPitch || 0);

        if (
          typeof initMarker?.start === 'number' &&
          typeof initMarker?.end === 'number'
        ) {
          engine.setLoop(true, initMarker.start, initMarker.end);
          engine.seek(initMarker.start);
        }

        setDuration(loadedDuration);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('Falha ao carregar stems na StudioAudioEngine:', err);
      });

    return () => {
      cancelAnimationFrame(progressInterval.current);
      countInTimersRef.current.forEach((t) => clearTimeout(t));
      engine.dispose();
      if (audioEngineRef.current === engine) {
        audioEngineRef.current = null;
      }
    };
  }, [song, navigate]);

  // Loop de 60fps via requestAnimationFrame: atualiza --level-{track} no DOM (Zero Re-render) e progresso
  useEffect(() => {
    if (!isPlaying) {
      resetMeterCssVariables();
      return undefined;
    }

    if (!isTabVisible) {
      resetMeterCssVariables();
      const bgTimer = setInterval(() => {
        const engine = audioEngineRef.current;
        if (engine && engine.clock.isPlaying) {
          const currentSec = engine.getCurrentSongTime();
          setProgress(currentSec);
          if (!isLooping && duration > 0 && currentSec >= duration) {
            engine.stop();
            setProgress(0);
            setIsPlaying(false);
          }
        }
      }, 100);
      return () => clearInterval(bgTimer);
    }

    const updateAudioTelemetry = (now) => {
      const engine = audioEngineRef.current;
      if (engine && engine.clock.isPlaying) {
        const currentSec = engine.getCurrentSongTime();

        // Atualiza o state React de progress a ~20fps (suficiente para MM:SS.d) evitando 60 re-renders/s
        if (now - lastProgressStateUpdateRef.current >= 48) {
          lastProgressStateUpdateRef.current = now;
          setProgress(currentSec);
        }

        // Atualiza variáveis CSS dos medidores a 60fps direto na GPU a partir dos AnalyserNodes reais
        const rootEl = mixerRootRef.current;
        if (rootEl) {
          const { stemLevels, masterL: rawMasterL, masterR: rawMasterR } =
            engine.getTelemetryLevels();
          const {
            masterVolume: curMasterVol,
            isMasterMuted: curMasterMuted,
          } = audioStateRef.current;
          const masterFactor = curMasterMuted ? 0 : curMasterVol / 100;

          let sumLeft = 0;
          let sumRight = 0;
          let maxStemLevel = 0;

          STEM_KEYS.forEach((track, idx) => {
            const level = stemLevels[track] || 0;
            rootEl.style.setProperty(`--level-${track}`, String(level));
            if (level > maxStemLevel) maxStemLevel = level;

            if (idx % 2 === 0) {
              sumLeft += level * 0.42;
              sumRight += level * 0.34;
            } else {
              sumLeft += level * 0.34;
              sumRight += level * 0.42;
            }
          });

          const masterL = Math.min(
            100,
            Math.round(
              Math.max(rawMasterL, maxStemLevel * 0.78, sumLeft * 0.5) * masterFactor
            )
          );
          const masterR = Math.min(
            100,
            Math.round(
              Math.max(rawMasterR, maxStemLevel * 0.74, sumRight * 0.5) * masterFactor
            )
          );

          // Mapeia [0..100] -> [-36deg..+32deg] para as agulhas balísticas do VU Meter
          const angleL = (-36 + (masterL / 100) * 68).toFixed(1);
          const angleR = (-36 + (masterR / 100) * 68).toFixed(1);

          rootEl.style.setProperty('--level-master-l', String(masterL));
          rootEl.style.setProperty('--level-master-r', String(masterR));
          rootEl.style.setProperty('--vu-angle-l', `${angleL}deg`);
          rootEl.style.setProperty('--vu-angle-r', `${angleR}deg`);
        }

        if (!isLooping && duration > 0 && currentSec >= duration) {
          engine.stop();
          setProgress(0);
          setIsPlaying(false);
          resetMeterCssVariables();
        } else {
          progressInterval.current = requestAnimationFrame(updateAudioTelemetry);
        }
      }
    };

    progressInterval.current = requestAnimationFrame(updateAudioTelemetry);
    return () => cancelAnimationFrame(progressInterval.current);
  }, [isPlaying, isTabVisible, duration, isLooping, resetMeterCssVariables]);

  // Síntese de clique para contagem de entrada (Metrônomo Pre-Roll de 4 tempos)
  const playClickSound = useCallback((freq = 800) => {
    try {
      const ctx = audioEngineRef.current?.rawContext;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (err) {
      console.warn('Falha no clique do metrônomo:', err);
    }
  }, []);

  const runCountIn = useCallback(
    (onFinished) => {
      setIsCountingIn(true);
      setCountInNumber(4);
      playClickSound(800);

      const t1 = setTimeout(() => {
        setCountInNumber(3);
        playClickSound(800);
      }, 500);

      const t2 = setTimeout(() => {
        setCountInNumber(2);
        playClickSound(800);
      }, 1000);

      const t3 = setTimeout(() => {
        setCountInNumber(1);
        playClickSound(1200); // 4º tempo mais agudo (GO!)
      }, 1500);

      const t4 = setTimeout(() => {
        setCountInNumber(null);
        setIsCountingIn(false);
        onFinished();
      }, 2000);

      countInTimersRef.current = [t1, t2, t3, t4];
    },
    [playClickSound]
  );

  // Alternar Play / Pause com suporte a Count-in
  const togglePlay = async () => {
    if (!audioEngineRef.current || !isLoaded) return;

    if (isPlaying || isCountingIn) {
      countInTimersRef.current.forEach((t) => clearTimeout(t));
      setCountInNumber(null);
      setIsCountingIn(false);
      audioEngineRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const rawCtx = audioEngineRef.current.rawContext;
    if (rawCtx && rawCtx.state !== 'running' && typeof rawCtx.resume === 'function') {
      await rawCtx.resume();
    }

    if (isCountInEnabled) {
      runCountIn(async () => {
        await audioEngineRef.current?.play();
        if (audioEngineRef.current?.clock.isPlaying) {
          setIsPlaying(true);
        }
      });
    } else {
      await audioEngineRef.current.play();
      if (audioEngineRef.current?.clock.isPlaying) {
        setIsPlaying(true);
      }
    }
  };

  // Salto de tempo (+ ou - segundos)
  const handleSeekDelta = (deltaSeconds) => {
    if (!isLoaded || duration <= 0 || !audioEngineRef.current) return;
    const currentPos = audioEngineRef.current.getCurrentSongTime();
    const target = Math.max(0, Math.min(duration, currentPos + deltaSeconds));
    audioEngineRef.current.seek(target);
    setProgress(target);
  };

  // Reiniciar faixa do início
  const handleRestart = () => {
    audioEngineRef.current?.seek(0);
    setProgress(0);
  };

  // Arrastar barra de progresso / scrubber
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setProgress(newTime);
    audioEngineRef.current?.seek(newTime);
  };

  // Funções de interação da Timeline Waveform Scrubber (Ideia 3)
  const computeWaveformTimeFromClientX = useCallback(
    (clientX) => {
      const el = waveformContainerRef.current;
      if (!el || duration <= 0) return null;
      const rect = el.getBoundingClientRect();
      if (!rect.width) return null;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return {
        ratio,
        time: ratio * duration,
      };
    },
    [duration]
  );

  const handleWaveformPointerMove = (e) => {
    const info = computeWaveformTimeFromClientX(e.clientX);
    if (!info) return;
    setHoverPercent(info.ratio * 100);
    setHoverTime(info.time);

    if (isScrubbingWaveform && isLoaded) {
      audioEngineRef.current?.seek(info.time);
      setProgress(info.time);
    }
  };

  const handleWaveformPointerDown = (e) => {
    if (!isLoaded || duration <= 0) return;
    if (e.target?.closest('[data-marker-pin="true"]')) return;
    const info = computeWaveformTimeFromClientX(e.clientX);
    if (!info) return;
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
    }
    setIsScrubbingWaveform(true);
    audioEngineRef.current?.seek(info.time);
    setProgress(info.time);
  };

  const handleWaveformPointerUp = (e) => {
    if (!isScrubbingWaveform) return;
    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignora
      }
    }
    setIsScrubbingWaveform(false);
  };

  const handleWaveformPointerLeave = () => {
    setHoverTime(null);
    setIsScrubbingWaveform(false);
  };

  // Mudança de volume de um stem individual (80% = 0.0 dB Nominal / Ganho Unitário 1.0)
  const handleVolumeChange = useCallback((track, value) => {
    const numericValue = Math.max(0, Math.min(100, Math.round(parseFloat(value) || 0)));
    setVolumes((prev) => ({ ...prev, [track]: numericValue }));
    audioEngineRef.current?.setStemVolume(track, numericValue);
  }, []);

  // Alternar Mute individual
  const toggleMute = useCallback(
    (track) => {
      setActiveMixPreset('custom');
      setMutes((prev) => {
        const nextMutes = { ...prev, [track]: !prev[track] };
        applyAudioRouting(nextMutes, solos);
        return nextMutes;
      });
    },
    [applyAudioRouting, solos]
  );

  // Alternar Solo individual
  const toggleSolo = useCallback(
    (track) => {
      setActiveMixPreset('custom');
      setSolos((prev) => {
        const nextSolos = { ...prev, [track]: !prev[track] };
        applyAudioRouting(mutes, nextSolos);
        return nextSolos;
      });
    },
    [applyAudioRouting, mutes]
  );

  // Controle de Master Volume
  const handleMasterVolumeChange = (value) => {
    const numericValue = Math.max(0, Math.min(100, Math.round(parseFloat(value) || 0)));
    const nextMuted = numericValue === 0;
    setMasterVolume(numericValue);
    setIsMasterMuted(nextMuted);
    audioEngineRef.current?.setMasterVolume(numericValue, nextMuted);
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

  // Transposição Harmônica em Semitons (-12 a +12) via WSOLA Phase-Locked
  const changePitch = (delta) => {
    const nextPitch = currentPitch + delta;
    if (nextPitch < -12 || nextPitch > 12) return;
    audioEngineRef.current?.setPitch(nextPitch);
    setCurrentPitch(nextPitch);
    setCurrentKey(getShiftedKey(originalKey, nextPitch));
  };

  const resetPitch = () => {
    audioEngineRef.current?.setPitch(0);
    setCurrentPitch(0);
    setCurrentKey(getShiftedKey(originalKey, 0));
  };

  // Controle de Velocidade com Preservação Harmônica de Tom (Sem Duplicação de Fontes)
  const handleSpeedChange = (speed) => {
    const clamped = Math.max(0.5, Math.min(1.25, parseFloat(speed)));
    setPlaybackSpeed(clamped);
    audioEngineRef.current?.setSpeed(clamped);
  };

  // --- STUDIO PRACTICE SUITE: CONTROLES DE LOOP A-B ---
  const handleSetLoopA = (time) => {
    const target = typeof time === 'number' ? time : progress;
    setLoopA(target);
    if (loopB !== null && loopB > target) {
      setIsLooping(true);
      audioEngineRef.current?.setLoop(true, target, loopB);
    }
  };

  const handleSetLoopB = (time) => {
    const target = typeof time === 'number' ? time : progress;
    setLoopB(target);
    if (loopA !== null && target > loopA) {
      setIsLooping(true);
      audioEngineRef.current?.setLoop(true, loopA, target);
    }
  };

  const toggleLooping = () => {
    if (loopA === null || loopB === null || loopB <= loopA) {
      const start = progress;
      const end = Math.min(duration || 100, progress + 10);
      setLoopA(start);
      setLoopB(end);
      setIsLooping(true);
      audioEngineRef.current?.setLoop(true, start, end);
      return;
    }

    const next = !isLooping;
    setIsLooping(next);
    audioEngineRef.current?.setLoop(next, loopA, loopB);
    if (next) {
      const currentPos = audioEngineRef.current?.getCurrentSongTime() ?? progress;
      if (currentPos < loopA || currentPos > loopB) {
        audioEngineRef.current?.seek(loopA);
        setProgress(loopA);
      }
    }
  };

  const handleClearLoop = () => {
    setLoopA(null);
    setLoopB(null);
    setIsLooping(false);
    audioEngineRef.current?.setLoop(false);
  };

  // --- STUDIO PRACTICE SUITE: MARCADORES DE TREINO PERSISTENTES ---
  useEffect(() => {
    if (!song?.id) return;
    const storageKey = `easycovers_markers_${song.id}`;

    fetch(`http://localhost:8000/songs/${song.id}/markers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.markers && Array.isArray(data.markers) && data.markers.length > 0) {
          setPracticeMarkers(data.markers);
          localStorage.setItem(storageKey, JSON.stringify(data.markers));
        }
      })
      .catch(() => {});
  }, [song?.id]);

  const handleApplyMarker = useCallback((marker) => {
    setLoopA(marker.start);
    setLoopB(marker.end);
    setIsLooping(true);
    audioEngineRef.current?.setLoop(true, marker.start, marker.end);
    audioEngineRef.current?.seek(marker.start);
    setProgress(marker.start);
  }, []);

  const handleSaveMarker = () => {
    if (loopA === null || loopB === null || loopB <= loopA) {
      alert('Defina os pontos A e B na timeline antes de salvar o trecho de treino.');
      return;
    }
    const name = newMarkerName.trim() || `Trecho ${practiceMarkers.length + 1}`;
    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4'];
    const randomColor = colors[practiceMarkers.length % colors.length];
    const newMarker = {
      id: 'pm_' + Date.now(),
      name,
      start: Math.min(loopA, loopB),
      end: Math.max(loopA, loopB),
      color: randomColor,
    };
    const updated = [...practiceMarkers, newMarker];
    setPracticeMarkers(updated);
    setNewMarkerName('');
    setIsSavingMarker(false);

    localStorage.setItem(`easycovers_markers_${song.id}`, JSON.stringify(updated));
    fetch(`http://localhost:8000/songs/${song.id}/markers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markers: updated }),
    }).catch((err) => console.warn('Erro ao salvar marcadores no backend:', err));
  };

  const handleDeleteMarker = (markerId, e) => {
    e.stopPropagation();
    const updated = practiceMarkers.filter((m) => m.id !== markerId);
    setPracticeMarkers(updated);
    localStorage.setItem(`easycovers_markers_${song.id}`, JSON.stringify(updated));
    fetch(`http://localhost:8000/songs/${song.id}/markers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markers: updated }),
    }).catch((err) => console.warn('Erro ao atualizar marcadores no backend:', err));
  };

  // =========================================================================
  // 5 PRESETS RÁPIDOS DE MIXAGEM (IDEIA 2)
  // =========================================================================
  const handleResetVolumes = useCallback(() => {
    const defaultVol = {
      vocals: 80,
      drums: 80,
      bass: 80,
      other: 80,
      guitar: 80,
      piano: 80,
    };
    const defaultMute = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };
    const defaultSolo = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };

    setActiveMixPreset('full');
    setVolumes(defaultVol);
    setMutes(defaultMute);
    setSolos(defaultSolo);

    STEM_KEYS.forEach((track) => handleVolumeChange(track, 80));
    applyAudioRouting(defaultMute, defaultSolo);
  }, [applyAudioRouting, handleVolumeChange]);

  const handleBackingTrackPreset = useCallback(() => {
    const instrument = (song?.instrument || '').toLowerCase();
    let targetStem = 'guitar';

    if (instrument.includes('guitar') || instrument.includes('violão')) targetStem = 'guitar';
    else if (instrument.includes('voz') || instrument.includes('vocal') || instrument.includes('canto'))
      targetStem = 'vocals';
    else if (instrument.includes('baixo')) targetStem = 'bass';
    else if (instrument.includes('bateria')) targetStem = 'drums';
    else if (instrument.includes('teclado') || instrument.includes('piano')) targetStem = 'piano';

    const nextMutes = {
      vocals: targetStem === 'vocals',
      drums: targetStem === 'drums',
      bass: targetStem === 'bass',
      other: targetStem === 'other',
      guitar: targetStem === 'guitar',
      piano: targetStem === 'piano',
    };
    const nextSolos = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };

    setActiveMixPreset('backing');
    setMutes(nextMutes);
    setSolos(nextSolos);
    applyAudioRouting(nextMutes, nextSolos);
  }, [song?.instrument, applyAudioRouting]);

  const handleKaraokePreset = useCallback(() => {
    const nextMutes = {
      vocals: true,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };
    const nextSolos = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };
    setActiveMixPreset('karaoke');
    setMutes(nextMutes);
    setSolos(nextSolos);
    applyAudioRouting(nextMutes, nextSolos);
  }, [applyAudioRouting]);

  const handleRhythmSectionPreset = useCallback(() => {
    const nextMutes = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };
    const nextSolos = {
      vocals: false,
      drums: true,
      bass: true,
      other: false,
      guitar: false,
      piano: false,
    };
    setActiveMixPreset('rhythm');
    setMutes(nextMutes);
    setSolos(nextSolos);
    applyAudioRouting(nextMutes, nextSolos);
  }, [applyAudioRouting]);

  const handleHarmonyPreset = useCallback(() => {
    const nextMutes = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };
    const nextSolos = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: true,
      piano: true,
    };
    setActiveMixPreset('harmony');
    setMutes(nextMutes);
    setSolos(nextSolos);
    applyAudioRouting(nextMutes, nextSolos);
  }, [applyAudioRouting]);

  // =========================================================================
  // ATALHOS DE TECLADO COMPLETOS DE CONSOLE (IDEIA 6: ESPAÇO, SETAS, M, R, [, ], L, 1..6, SHIFT+1..6)
  // =========================================================================
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = {
      togglePlay,
      handleSeekDelta,
      toggleMasterMute,
      handleRestart,
      handleSetLoopA,
      handleSetLoopB,
      toggleLooping,
      toggleMute,
      toggleSolo,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

      // Atalhos 1 a 6 para Mute (ou Shift + 1..6 para Solo)
      const digitMatch = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
      if (digitMatch) {
        e.preventDefault();
        const channelIndex = parseInt(digitMatch[1], 10) - 1;
        const targetTrack = STEM_KEYS[channelIndex];
        if (targetTrack) {
          if (e.shiftKey) {
            handlersRef.current.toggleSolo?.(targetTrack);
          } else {
            handlersRef.current.toggleMute?.(targetTrack);
          }
        }
        return;
      }

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
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        handlersRef.current.handleSetLoopA?.();
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        handlersRef.current.handleSetLoopB?.();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        handlersRef.current.toggleLooping?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const progressPercent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  // Objeto de contexto para iluminar o DashboardStudioBackground quando o áudio está tocando ou canal em foco
  const backgroundFocusSong = useMemo(() => {
    if (isPlaying || hasAnySolo || hoveredStem) {
      return {
        name: hoveredStem ? `${STEM_CONFIG[hoveredStem]?.label} • ${song?.name || ''}` : song?.name,
        genre: song?.genre || 'STUDIO 6-STEMS',
      };
    }
    return null;
  }, [isPlaying, hasAnySolo, hoveredStem, song?.name, song?.genre]);

  return (
    <div
      ref={mixerRootRef}
      className={`font-sans min-h-screen bg-repeat flex flex-col text-slate-800 dark:text-slate-100 selection:bg-[var(--color-brand-medium)] selection:text-white relative overflow-x-hidden ${
        !isTabVisible ? 'animations-paused' : ''
      }`}
      style={{
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: '320px 320px',
        backgroundColor: 'var(--color-brand-light)',
        '--level-vocals': 0,
        '--level-drums': 0,
        '--level-bass': 0,
        '--level-other': 0,
        '--level-guitar': 0,
        '--level-piano': 0,
        '--level-master-l': 0,
        '--level-master-r': 0,
        '--vu-angle-l': '-36deg',
        '--vu-angle-r': '-36deg',
      }}
    >
      {/* ========================================================================= */}
      {/* 0. SALA DE CONTROLE PARALLAX 3D REATIVA AO ÁUDIO E SOLOS                  */}
      {/* ========================================================================= */}
      <DashboardStudioBackground
        studioLiveMode={studioLiveMode}
        phantomPower={phantomPower}
        hoveredSong={backgroundFocusSong}
      />

      {/* ========================================================================= */}
      {/* HEADER STICKY STUDIO (LOGO + BADGE CONSOLE 6-STEMS + ENGINE 44.1KHZ)      */}
      {/* ========================================================================= */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            onClick={() => {
              setIsPlaying(false);
              audioEngineRef.current?.stop();
              navigate('/dashboard');
            }}
            className="flex items-center gap-3 cursor-pointer group"
            title="EasyCovers - Voltar à Biblioteca"
          >
            <img
              src="/assets/logo_symbol.png"
              alt="EasyCovers Logo"
              className="h-10 md:h-11 w-auto object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[var(--color-brand-deep)] tracking-tight leading-none">
                  EasyCovers
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-blue-500/10 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-500/20">
                  CONSOLE 6-STEMS
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline-block mt-0.5">
                Master DAW Control Room • Web Audio API
              </span>
            </div>
          </div>

          <ThemeToggle />
        </div>

        {/* Status da Engine 44.1 kHz & Botão Voltar */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs font-mono font-bold tabular-nums">
            {!isLoaded ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-amber-700 dark:text-amber-400">
                  DECODIFICANDO STEMS WAV...
                </span>
              </>
            ) : (
              <>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPlaying
                      ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-emerald-700 dark:text-emerald-400">
                  ENGINE 44.1 kHz • 32-BIT FLOAT
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              audioEngineRef.current?.stop();
              navigate('/dashboard');
            }}
            className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-200 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs studio-btn-transition active:scale-95 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            <span>Voltar à Biblioteca</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL DO ESTÚDIO DE MIXAGEM (Z-10 ACIMA DO PARALLAX 3D)          */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
        {/* ===================================================================== */}
        {/* 1. HERO MASTER DECK + MIXER MASTER RACK 2.5D/SVG (IDEIA 4)            */}
        {/* ===================================================================== */}
        <section className="rounded-3xl p-2 bg-gradient-to-b from-white/85 via-white/70 to-blue-100/50 dark:from-slate-800/90 dark:via-slate-900/90 dark:to-slate-950/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
            {/* Identidade da Faixa & Disco de Vinil 3D */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-1 min-w-0">
              <div className="relative flex items-center shrink-0 pr-5">
                {/* Disco de Vinil que projeta e gira quando o áudio está tocando */}
                <div
                  className={`hidden sm:flex absolute left-6 w-22 h-22 md:w-26 md:h-26 rounded-full bg-slate-950 border-4 border-slate-800 shadow-xl items-center justify-center transition-transform duration-500 ${
                    isPlaying
                      ? 'translate-x-7 md:translate-x-8 animate-[spin_4s_linear_infinite]'
                      : 'translate-x-2'
                  }`}
                  aria-hidden="true"
                >
                  <div className="w-16 h-16 rounded-full border border-slate-700/60 flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--color-brand-medium)] to-amber-500 border-2 border-white/25 flex items-center justify-center shadow-inner">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />
                    </div>
                  </div>
                </div>

                {/* Capa Oficial do Álbum / Gênero */}
                <div className="relative z-10 w-22 h-22 md:w-26 md:h-26 rounded-2xl overflow-hidden shadow-xl studio-img-outline bg-gradient-to-br from-blue-600 to-[var(--color-brand-deep)] shrink-0">
                  <img
                    src={song?.cover_image_url || getGenreImage(song?.genre)}
                    alt={`Capa de ${song?.name || 'Música'}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = getGenreImage(song?.genre);
                    }}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800/70 text-[10px] font-mono font-extrabold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400 mb-2">
                  <HeadphonesStudioIcon className="w-3.5 h-3.5" />
                  <span>SESSÃO MULTIFAIXA ATIVA • 6 CANAIS ISOLADOS</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate text-balance">
                  {song?.name || 'Música sem título'}
                </h2>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-semibold truncate mt-0.5">
                  Artista:{' '}
                  <span className="font-extrabold text-[var(--color-brand-deep)] dark:text-blue-300">
                    {song?.artist || 'Artista Desconhecido'}
                  </span>
                </p>

                {/* Badges Técnicas da Sessão */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200/90 dark:border-slate-700">
                    <img
                      src="/assets/icons/icon_genre_disc.png"
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>{song?.genre || 'Gênero Geral'}</span>
                  </span>

                  {song?.instrument && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-deep)] dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200/80 dark:border-blue-800/70">
                      <img
                        src="/assets/icons/icon_instrument_pick.png"
                        alt=""
                        className="w-3.5 h-3.5 object-contain"
                      />
                      <span>Foco: {song.instrument}</span>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 tabular-nums">
                    <span>TOM: {currentKey}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware Master Rack 2.5D/SVG (Válvulas, VU Meters L/R, OLED e 3 Knobs) */}
            <MixerMasterRack
              isPlaying={isPlaying}
              progress={progress}
              duration={duration}
              originalKey={originalKey}
              currentKey={currentKey}
              currentPitch={currentPitch}
              onChangePitch={changePitch}
              onResetPitch={resetPitch}
              playbackSpeed={playbackSpeed}
              onSpeedChange={handleSpeedChange}
              masterVolume={masterVolume}
              isMasterMuted={isMasterMuted}
              onMasterVolumeChange={handleMasterVolumeChange}
              onToggleMasterMute={toggleMasterMute}
              consoleMode={consoleMode}
              onToggleConsoleMode={setConsoleMode}
              studioLiveMode={studioLiveMode}
              onToggleStudioLive={() => setStudioLiveMode((v) => !v)}
              phantomPower={phantomPower}
              onTogglePhantomPower={() => setPhantomPower((p) => !p)}
            />
          </div>
        </section>

        {/* ===================================================================== */}
        {/* 2. DECK DE TRANSPORTE 3D + TIMELINE WAVEFORM SCRUBBER (IDEIAS 3 & 5)  */}
        {/* ===================================================================== */}
        <section className="relative rounded-3xl p-2 bg-gradient-to-b from-white/85 via-white/70 to-blue-100/50 dark:from-slate-800/90 dark:via-slate-900/90 dark:to-slate-950/90 border border-slate-200/90 dark:border-slate-700/80 shadow-xl backdrop-blur-xl">
          <div className="relative rounded-2xl bg-white/95 dark:bg-[#0B1325]/95 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 flex flex-col gap-5 overflow-hidden">
            {/* HUD DE METRÔNOMO DE ESTÚDIO 3D (COUNT-IN 4 TEMPOS — IDEIA 5) */}
            {countInNumber !== null && (
              <div className="absolute inset-0 bg-[#0B1325]/92 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-30 p-4 select-none">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-extrabold uppercase tracking-widest mb-3">
                  <MetronomeIcon className="w-4 h-4 text-amber-400" />
                  <span>STUDIO PRE-ROLL METRONOME • PREPARE-SE</span>
                </div>

                {/* 4 Pads Luminosos de Tempo (BEAT 1, BEAT 2, BEAT 3, BEAT 4 — GO!) */}
                <div className="grid grid-cols-4 gap-2.5 sm:gap-4 w-full max-w-lg mb-4">
                  {[
                    { beat: 1, num: 4, label: 'BEAT 1', freq: '800Hz' },
                    { beat: 2, num: 3, label: 'BEAT 2', freq: '800Hz' },
                    { beat: 3, num: 2, label: 'BEAT 3', freq: '800Hz' },
                    { beat: 4, num: 1, label: 'BEAT 4 • GO!', freq: '1.2kHz' },
                  ].map((item) => {
                    const isActiveBeat = countInNumber === item.num;
                    const isPassedBeat = countInNumber < item.num;
                    const isFinalBeat = item.beat === 4;

                    return (
                      <div
                        key={item.beat}
                        className={`rounded-xl p-3 border-2 flex flex-col items-center justify-center font-mono tabular-nums studio-card-transition ${
                          isActiveBeat
                            ? isFinalBeat
                              ? 'bg-emerald-500/25 border-emerald-400 text-white scale-105 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
                              : 'bg-amber-500/25 border-amber-400 text-white scale-105 shadow-[0_0_24px_rgba(245,158,11,0.5)]'
                            : isPassedBeat
                            ? 'bg-slate-900/90 border-amber-500/40 text-amber-300/70'
                            : 'bg-slate-900/60 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="text-[10px] font-black tracking-wider">
                          {item.label}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black my-1">
                          {item.beat}
                        </span>
                        <span className="text-[9px] opacity-75">{item.freq}</span>
                      </div>
                    );
                  })}
                </div>

                <span className="text-xs text-slate-300 font-semibold">
                  Posicione as mãos no instrumento — entrada automática no próximo compasso!
                </span>
              </div>
            )}

            {/* Linha Superior do Deck de Transporte: Controles Ópticos + Ações Rápidas */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Esquerda: Telemetria de Posição & Estado */}
              <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-start">
                <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 font-mono tabular-nums">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    TIMECODE ATUAL
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {formatTime(progress)}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      / {formatTime(duration)}
                    </span>
                  </div>
                </div>

                {duration > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 font-mono tabular-nums">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      RESTANTE
                    </span>
                    <span className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
                      -{formatTime(Math.max(0, duration - progress))}
                    </span>
                  </div>
                )}
              </div>

              {/* Centro: Transporte Principal (Restart, -5s, Play/Pause 3D, +5s) */}
              <div className="flex items-center gap-3 sm:gap-5">
                <button
                  type="button"
                  onClick={handleRestart}
                  disabled={!isLoaded}
                  title="Voltar ao início da faixa (Atalho: R)"
                  className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-800 disabled:opacity-40 studio-btn-transition active:scale-95 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V7.19c0-1.44-1.555-2.343-2.805-1.628L12 9.529v-2.34c0-1.44-1.555-2.343-2.805-1.628L2.25 9.53c-1.25.714-1.25 2.54 0 3.255l6.945 5.655z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => handleSeekDelta(-5)}
                  disabled={!isLoaded}
                  title="Retroceder 5 segundos (Seta Esquerda)"
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-mono font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 rounded-xl border border-slate-200/90 dark:border-slate-800 studio-btn-transition active:scale-95 cursor-pointer tabular-nums"
                >
                  <img
                    src="/assets/icons/icon_seek_backward.png"
                    alt=""
                    className="w-4 h-4 object-contain opacity-80"
                  />
                  <span>-5s</span>
                </button>

                {/* Botão Play / Pause 3D Óptico (Ideia 5) */}
                <PlayPauseButton
                  isPlaying={isPlaying}
                  isLoaded={isLoaded}
                  togglePlay={togglePlay}
                  size="large"
                />

                <button
                  type="button"
                  onClick={() => handleSeekDelta(5)}
                  disabled={!isLoaded}
                  title="Avançar 5 segundos (Seta Direita)"
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-mono font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 rounded-xl border border-slate-200/90 dark:border-slate-800 studio-btn-transition active:scale-95 cursor-pointer tabular-nums"
                >
                  <span>+5s</span>
                  <img
                    src="/assets/icons/icon_seek_forward.png"
                    alt=""
                    className="w-4 h-4 object-contain opacity-80"
                  />
                </button>
              </div>

              {/* Direita: Atalhos de Palco (Count-in 4 Tempos & Karaokê .LRC) */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCountInEnabled((prev) => !prev)}
                  aria-pressed={isCountInEnabled}
                  title="Ativar contagem de 4 cliques de metrônomo antes de iniciar o playback"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                    isCountInEnabled
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-800 hover:border-amber-400/60'
                  }`}
                >
                  <MetronomeIcon className="w-4 h-4" />
                  <span>Count-in 4x: {isCountInEnabled ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLyrics((prev) => !prev)}
                  aria-pressed={showLyrics}
                  title="Abrir Palco Karaokê 3D com letra sincronizada"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                    showLyrics
                      ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_16px_rgba(147,51,234,0.45)]'
                      : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                  }`}
                >
                  <MicLyricsIcon className="w-4 h-4" />
                  <span>Palco Karaokê</span>
                  {lyricsData?.has_synced && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* TIMELINE "WAVEFORM SCRUBBER" INTERATIVA COM LOOP A-B & PINS       */}
            {/* ================================================================= */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 px-1 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <WaveformIcon className="w-3.5 h-3.5 text-[var(--color-brand-medium)] dark:text-blue-400" />
                  <span>TIMELINE ACÚSTICA INTERATIVA • CLIQUE OU ARRASTE PARA SEEK</span>
                </span>
                <span>
                  {hoverTime !== null
                    ? `IR PARA: ${formatTime(hoverTime)}`
                    : isLooping && loopA !== null && loopB !== null
                    ? `LOOP A-B: ${formatTime(loopA)} → ${formatTime(loopB)}`
                    : `${Math.round(progressPercent)}% CONCLUÍDO`}
                </span>
              </div>

              <div
                ref={waveformContainerRef}
                onPointerMove={handleWaveformPointerMove}
                onPointerDown={handleWaveformPointerDown}
                onPointerUp={handleWaveformPointerUp}
                onPointerCancel={handleWaveformPointerUp}
                onPointerLeave={handleWaveformPointerLeave}
                className={`relative h-20 sm:h-24 w-full rounded-2xl bg-slate-950 border border-slate-800 px-3 py-3 flex items-center select-none overflow-visible touch-none ${
                  isLoaded ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                {/* Grade Técnica de Fundo do Scrubber */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-35 studio-grid-surface"
                  aria-hidden="true"
                />

                {/* Região Sombreada do Loop A-B sob a Onda */}
                {loopA !== null && loopB !== null && duration > 0 && (
                  <div
                    className={`pointer-events-none absolute inset-y-1 rounded-lg transition-colors ${
                      isLooping
                        ? 'bg-amber-500/20 border-x-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-500/15 border-x border-slate-500/50'
                    }`}
                    style={{
                      left: `${Math.max(
                        0,
                        Math.min(100, (Math.min(loopA, loopB) / duration) * 100)
                      )}%`,
                      width: `${Math.max(
                        0,
                        Math.min(100, (Math.abs(loopB - loopA) / duration) * 100)
                      )}%`,
                    }}
                  />
                )}

                {/* Flag Visual Ponto A */}
                {loopA !== null && duration > 0 && (
                  <div
                    className="pointer-events-none absolute -top-2.5 -translate-x-1/2 z-20 flex flex-col items-center"
                    style={{
                      left: `${Math.max(0, Math.min(100, (loopA / duration) * 100))}%`,
                    }}
                  >
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-black rounded bg-amber-500 text-slate-950 shadow-md tabular-nums">
                      A • {formatTime(loopA)}
                    </span>
                  </div>
                )}

                {/* Flag Visual Ponto B */}
                {loopB !== null && duration > 0 && (
                  <div
                    className="pointer-events-none absolute -top-2.5 -translate-x-1/2 z-20 flex flex-col items-center"
                    style={{
                      left: `${Math.max(0, Math.min(100, (loopB / duration) * 100))}%`,
                    }}
                  >
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-black rounded bg-amber-400 text-slate-950 shadow-md tabular-nums">
                      B • {formatTime(loopB)}
                    </span>
                  </div>
                )}

                {/* Pins Clicáveis de practiceMarkers sobre a Timeline */}
                {duration > 0 &&
                  practiceMarkers.map((marker) => {
                    const leftPct = Math.max(
                      1,
                      Math.min(99, (marker.start / duration) * 100)
                    );
                    const isMarkerActive =
                      isLooping && loopA === marker.start && loopB === marker.end;

                    return (
                      <button
                        key={marker.id}
                        type="button"
                        data-marker-pin="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyMarker(marker);
                        }}
                        style={{
                          left: `${leftPct}%`,
                          borderColor: marker.color || '#f59e0b',
                        }}
                        title={`Ativar Loop "${marker.name}" (${formatTime(
                          marker.start
                        )} - ${formatTime(marker.end)})`}
                        className={`absolute -bottom-2.5 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full text-[9px] font-mono font-black border shadow-md studio-btn-transition active:scale-95 cursor-pointer flex items-center gap-1 tabular-nums ${
                          isMarkerActive
                            ? 'bg-amber-400 text-slate-950 scale-105'
                            : 'bg-slate-900/95 text-slate-100 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: marker.color || '#f59e0b' }}
                        />
                        <span className="max-w-[90px] truncate">{marker.name}</span>
                      </button>
                    );
                  })}

                {/* Grade Densa de 72 Barras de Amplitude Acústica */}
                <div
                  className="relative z-10 w-full h-full flex items-center justify-between gap-[2px]"
                  aria-hidden="true"
                >
                  {waveformBars.map((barHeight, idx) => {
                    const barPct = ((idx + 0.5) / waveformBars.length) * 100;
                    const isPlayed = barPct <= progressPercent;
                    const isInLoop =
                      loopA !== null &&
                      loopB !== null &&
                      duration > 0 &&
                      barPct >= (Math.min(loopA, loopB) / duration) * 100 &&
                      barPct <= (Math.max(loopA, loopB) / duration) * 100;
                    const isHoveredBar =
                      hoverTime !== null && Math.abs(barPct - hoverPercent) < 1.2;

                    return (
                      <span
                        key={idx}
                        className={`flex-1 rounded-full transition-colors duration-100 ${
                          isHoveredBar
                            ? 'bg-white shadow-[0_0_8px_#ffffff]'
                            : isPlayed
                            ? isInLoop && isLooping
                              ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-200'
                              : 'bg-gradient-to-t from-blue-600 via-cyan-400 to-amber-300'
                            : isInLoop
                            ? 'bg-amber-500/45'
                            : 'bg-slate-700/75 hover:bg-slate-600'
                        }`}
                        style={{
                          height: `${barHeight}%`,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Agulha de Playhead Atual */}
                <div
                  className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-cyan-300 shadow-[0_0_10px_#67e8f9]"
                  style={{ left: `${progressPercent}%` }}
                  aria-hidden="true"
                >
                  <span className="absolute -top-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                </div>

                {/* Hover Timecode Guide (Cursor Vertical + Badge Flutuante MM:SS) */}
                {hoverTime !== null && isLoaded && (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-30 w-px bg-white/80"
                    style={{ left: `${hoverPercent}%` }}
                    aria-hidden="true"
                  >
                    <span className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900 text-white border border-slate-600 text-[10px] font-mono font-black shadow-lg whitespace-nowrap tabular-nums">
                      {formatTime(hoverTime)}
                    </span>
                  </div>
                )}

                {/* Input Range Acessível para Leitores de Tela e Navegação por Teclado */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={progress}
                  onChange={handleSeek}
                  disabled={!isLoaded}
                  aria-label="Linha do tempo da música"
                  className="sr-only"
                />
              </div>
            </div>
          </div>
        </section>

        {/* BANNER DINÂMICO SE VOCAL ESTIVER MUTADO E KARAOKÊ FECHADO */}
        {mutes.vocals &&
          !showLyrics &&
          (parsedLyrics.length > 0 || lyricsData?.plain_lyrics) && (
            <div className="bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-slate-900/90 border border-purple-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                  <MicLyricsIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-purple-200">
                    Canal de Vocais silenciado — Modo Vocalista detectado!
                  </h4>
                  <p className="text-xs text-purple-300/85">
                    Você é a voz principal agora. Deseja abrir o Teleprompter Karaokê 3D sincronizado?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLyrics(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl studio-btn-transition active:scale-95 shadow-md shrink-0 cursor-pointer"
              >
                Abrir Palco Karaokê 3D
              </button>
            </div>
          )}

        {/* ===================================================================== */}
        {/* 3. PALCO KARAOKÊ 3D ("SMOKED GLASS LYRIC TELEPROMPTER" — IDEIA 6)     */}
        {/* ===================================================================== */}
        {showLyrics && (
          <section className="rounded-3xl p-1.5 bg-gradient-to-b from-purple-500/40 via-indigo-500/30 to-slate-900 border border-purple-500/40 shadow-2xl">
            <div className="rounded-2xl bg-[#0B1325] text-white p-5 sm:p-7 flex flex-col gap-4 relative overflow-hidden">
              {/* Iluminação Ambiente Violeta/Safira */}
              <div
                className="pointer-events-none absolute -top-20 left-1/4 w-96 h-48 rounded-full bg-purple-600/25 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-20 right-1/4 w-96 h-48 rounded-full bg-blue-600/20 blur-3xl"
                aria-hidden="true"
              />

              {/* Cabeçalho do Teleprompter com Medidor de Onda Vocal Reativo */}
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/25 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner">
                    <MicLyricsIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                        Smoked Glass Lyric Teleprompter
                      </h3>
                      {lyricsData?.has_synced && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          LRC SYNC ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Clique em qualquer verso ou badge de tempo para saltar imediatamente na faixa.
                    </p>
                  </div>
                </div>

                {/* Medidor Vocal Reativo + Botão Minimizar */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800"
                    style={{ '--stem-level': 'var(--level-vocals, 0)' }}
                  >
                    <span className="text-[9px] font-mono font-bold text-purple-300 uppercase">
                      VOCAL BUS
                    </span>
                    <div className="w-20 h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-amber-300 studio-meter-fill-h" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLyrics(false)}
                    className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 studio-btn-transition active:scale-95 cursor-pointer"
                  >
                    Fechar ✕
                  </button>
                </div>
              </div>

              {/* Corpo das Letras com Auto-Scroll e Badges de Timestamp */}
              <div
                ref={lyricsContainerRef}
                className="relative z-10 max-h-80 md:max-h-96 overflow-y-auto px-3 sm:px-6 py-6 flex flex-col items-center gap-3 scroll-smooth"
              >
                {isLoadingLyrics ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                    <p className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">
                      Sincronizando timecodes LRCLIB...
                    </p>
                  </div>
                ) : parsedLyrics.length > 0 ? (
                  parsedLyrics.map((line, idx) => {
                    const isActive = idx === activeLyricIndex;
                    const isPast = idx < activeLyricIndex;

                    return (
                      <button
                        key={line.id || idx}
                        type="button"
                        data-lyric-index={idx}
                        onClick={() => handleLyricSeek(line.time)}
                        className={`group w-full max-w-2xl cursor-pointer text-center px-4 py-2.5 rounded-2xl select-none flex items-center justify-between gap-3 studio-card-transition ${
                          isActive
                            ? 'text-white font-black text-lg sm:text-2xl scale-[1.02] bg-gradient-to-r from-purple-600/35 via-indigo-600/30 to-purple-600/35 border border-purple-400/60 shadow-[0_8px_28px_rgba(147,51,234,0.35)]'
                            : isPast
                            ? 'text-slate-500 text-sm sm:text-base opacity-60 hover:opacity-95 hover:bg-slate-900/60'
                            : 'text-slate-300 text-sm sm:text-base opacity-85 hover:opacity-100 hover:bg-slate-900/60'
                        }`}
                      >
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums shrink-0 ${
                            isActive
                              ? 'bg-purple-500 text-white shadow-xs'
                              : 'bg-slate-900 text-slate-400 group-hover:text-purple-300 border border-slate-800'
                          }`}
                        >
                          {formatTime(line.time)}
                        </span>
                        <span className="flex-1 text-center text-pretty">
                          {line.text}
                        </span>
                        <span className="w-10 text-[10px] font-mono text-purple-300 opacity-0 group-hover:opacity-100 shrink-0">
                          SEEK →
                        </span>
                      </button>
                    );
                  })
                ) : lyricsData?.plain_lyrics ? (
                  <div className="whitespace-pre-line text-center text-slate-300 text-sm sm:text-base leading-relaxed py-4 max-w-2xl">
                    {lyricsData.plain_lyrics}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 gap-2">
                    <MicLyricsIcon className="w-7 h-7 text-slate-500" />
                    <p className="text-sm font-semibold">
                      {lyricsData?.instrumental
                        ? 'Esta faixa é instrumental (sem vocais registrados).'
                        : 'Nenhuma letra sincronizada encontrada para esta música.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* 4. BARRA TÁTIL DUAL-MODE (OPÇÃO A <-> OPÇÃO C) & 5 PRESETS DE MIXAGEM */}
        {/* ===================================================================== */}
        <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-200/90 dark:border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Chave Seletora Dual-Mode: Bancada DAW Vertical 3D (Opção A) vs Modo Palco Horizontal (Opção C) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-2">
              <MixerFadersIcon className="w-5 h-5 text-[var(--color-brand-medium)] dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white leading-none">
                  Console Multifaixa • 6 Stems
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Duplo clique no fader retorna a 80% (0.0 dB Nominal)
                </span>
              </div>
            </div>

            {/* Segmented Control Dual-Mode */}
            <div
              role="group"
              aria-label="Modo de visualização do console"
              className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 self-start sm:self-auto"
            >
              <button
                type="button"
                onClick={() => setConsoleMode('daw')}
                aria-pressed={consoleMode === 'daw'}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 studio-btn-transition cursor-pointer ${
                  consoleMode === 'daw'
                    ? 'bg-[var(--color-brand-medium)] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MixerFadersIcon className="w-3.5 h-3.5" />
                <span>Bancada DAW (3D)</span>
              </button>

              <button
                type="button"
                onClick={() => setConsoleMode('stage')}
                aria-pressed={consoleMode === 'stage'}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 studio-btn-transition cursor-pointer ${
                  consoleMode === 'stage'
                    ? 'bg-[var(--color-brand-medium)] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <WaveformIcon className="w-3.5 h-3.5" />
                <span>Modo Palco (Horizontal)</span>
              </button>
            </div>
          </div>

          {/* 5 Presets Rápidos de Mixagem (Ideia 2) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 mr-1">
              PRESETS:
            </span>

            <button
              type="button"
              onClick={handleResetVolumes}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                activeMixPreset === 'full'
                  ? 'bg-[var(--color-brand-medium)] text-white border-[var(--color-brand-medium)] shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/75 dark:hover:bg-slate-700'
              }`}
              title="Restaura todos os 6 canais para 80% (0.0 dB) e limpa mutes/solos"
            >
              Mix Completo (80%)
            </button>

            <button
              type="button"
              onClick={handleBackingTrackPreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                activeMixPreset === 'backing'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100'
              }`}
              title="Silencia automaticamente o seu instrumento principal para tocar junto"
            >
              Modo Backing Track
            </button>

            <button
              type="button"
              onClick={handleKaraokePreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                activeMixPreset === 'karaoke'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                  : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80 hover:bg-purple-100'
              }`}
              title="Silencia apenas o canal de Vocais"
            >
              Karaokê (Sem Voz)
            </button>

            <button
              type="button"
              onClick={handleRhythmSectionPreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                activeMixPreset === 'rhythm'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100'
              }`}
              title="Sola apenas Baixo e Bateria para treino de groove e tempo"
            >
              Só Cozinha (Bass + Drums)
            </button>

            <button
              type="button"
              onClick={handleHarmonyPreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border studio-btn-transition active:scale-95 cursor-pointer ${
                activeMixPreset === 'harmony'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
              }`}
              title="Sola apenas Guitarra e Teclado/Piano para estudo harmônico"
            >
              Harmonia (Guitar + Piano)
            </button>

            {hasAnySolo && (
              <button
                type="button"
                onClick={() => {
                  const noSolo = {
                    vocals: false,
                    drums: false,
                    bass: false,
                    other: false,
                    guitar: false,
                    piano: false,
                  };
                  setSolos(noSolo);
                  applyAudioRouting(mutes, noSolo);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs studio-btn-transition active:scale-95 cursor-pointer"
              >
                Limpar Solos ✕
              </button>
            )}
          </div>
        </section>

        {/* ===================================================================== */}
        {/* 5. CONSOLE DE 6 CANAIS (STUDIOCHANNELSTRIP DUAL-MODE: DAW / STAGE)    */}
        {/* ===================================================================== */}
        <section aria-label="Canais de mixagem de stems">
          <div
            className={
              consoleMode === 'daw'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 md:gap-4'
                : 'flex flex-col gap-3'
            }
          >
            {STEM_KEYS.map((track, idx) => {
              const config = STEM_CONFIG[track];
              const isMuted = mutes[track];
              const isSolo = solos[track];
              const effectivelyMuted = isTrackEffectivelyMuted(track);

              return (
                <StudioChannelStrip
                  key={track}
                  track={track}
                  channelNumber={idx + 1}
                  config={config}
                  volume={volumes[track]}
                  isMuted={isMuted}
                  isSolo={isSolo}
                  isEffectivelyMuted={effectivelyMuted}
                  isPlaying={isPlaying}
                  consoleMode={consoleMode}
                  progressPercent={progressPercent}
                  onVolumeChange={handleVolumeChange}
                  onToggleMute={toggleMute}
                  onToggleSolo={toggleSolo}
                  onHoverStart={() => setHoveredStem(track)}
                  onHoverEnd={() =>
                    setHoveredStem((prev) => (prev === track ? null : prev))
                  }
                />
              );
            })}
          </div>
        </section>

        {/* ===================================================================== */}
        {/* 6. STUDIO PRACTICE SUITE (LOOP A-B, VARISPEED & MARCADORES SALVOS)    */}
        {/* ===================================================================== */}
        <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-5 md:p-6 shadow-xl border border-slate-200/80 dark:border-slate-800 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-2xs">
                <LoopRepeatIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    Studio Practice Suite • Repetição A-B, Varispeed & Marcadores
                  </h3>
                  {isLooping && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      LOOP ATIVO
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Isole solos complexos com Loop A-B, reduza o andamento sem alterar o tom e salve pins na forma de onda.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Bloco 1: Controles de Loop A-B */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-slate-50/90 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Repetição de Trecho (Loop A-B)
                </span>

                <div className="flex items-center gap-2 text-xs font-mono font-bold tabular-nums">
                  <span
                    className={`px-2 py-0.5 rounded-md ${
                      loopA !== null
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'text-slate-400'
                    }`}
                  >
                    A: {loopA !== null ? formatTime(loopA) : '--:--'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                  <span
                    className={`px-2 py-0.5 rounded-md ${
                      loopB !== null
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'text-slate-400'
                    }`}
                  >
                    B: {loopB !== null ? formatTime(loopB) : '--:--'}
                  </span>
                  {loopA !== null && loopB !== null && loopB > loopA && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ({Math.round(loopB - loopA)}s)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetLoopA()}
                  disabled={!isLoaded}
                  className="flex-1 min-w-[115px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs studio-btn-transition active:scale-95 cursor-pointer"
                  title="Marcar início do loop na posição atual (Atalho: [ )"
                >
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] flex items-center justify-center font-black">
                    A
                  </span>
                  <span>
                    Marcar Início <kbd className="text-[10px] opacity-65 ml-0.5 font-mono">[</kbd>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetLoopB()}
                  disabled={!isLoaded}
                  className="flex-1 min-w-[115px] flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs studio-btn-transition active:scale-95 cursor-pointer"
                  title="Marcar fim do loop na posição atual (Atalho: ] )"
                >
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] flex items-center justify-center font-black">
                    B
                  </span>
                  <span>
                    Marcar Fim <kbd className="text-[10px] opacity-65 ml-0.5 font-mono">]</kbd>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleLooping}
                  disabled={!isLoaded}
                  className={`flex-1 min-w-[125px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold rounded-xl studio-btn-transition active:scale-95 shadow-2xs cursor-pointer ${
                    isLooping
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                  title="Ligar ou desligar repetição contínua (Atalho: L)"
                >
                  <LoopRepeatIcon className="w-4 h-4" />
                  <span>
                    {isLooping ? 'Loop Ativo' : 'Ativar Loop'}{' '}
                    <kbd className="text-[10px] opacity-65 ml-0.5 font-mono">L</kbd>
                  </span>
                </button>

                {(loopA !== null || loopB !== null) && (
                  <button
                    type="button"
                    onClick={handleClearLoop}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl studio-btn-transition cursor-pointer"
                    title="Limpar marcadores A e B"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Salvar Trecho Atual como Marcador na Timeline */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                {!isSavingMarker ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (loopA === null || loopB === null || loopB <= loopA) {
                        alert(
                          'Defina primeiro os pontos A e B para salvar o trecho como pin na timeline.'
                        );
                        return;
                      }
                      setIsSavingMarker(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <span>+ Salvar este trecho A-B como Pin permanente na forma de onda</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      placeholder="Nome do trecho (ex: Solo Principal, Riff Intro)"
                      value={newMarkerName}
                      onChange={(e) => setNewMarkerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMarker();
                        if (e.key === 'Escape') setIsSavingMarker(false);
                      }}
                      autoFocus
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-600 rounded-lg text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveMarker}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg shadow-2xs cursor-pointer"
                    >
                      Salvar Pin
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSavingMarker(false)}
                      className="px-2 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bloco 2: Controle de Velocidade / Varispeed */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50/90 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Velocidade (Varispeed Pitch-Locked)
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tabular-nums">
                  {Math.round(playbackSpeed * 100)}% ({playbackSpeed}x)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {[0.5, 0.75, 0.9, 1.0, 1.1, 1.25].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => handleSpeedChange(speed)}
                    className={`flex-1 py-1.5 text-xs font-mono font-black rounded-lg studio-btn-transition active:scale-95 border cursor-pointer tabular-nums ${
                      playbackSpeed === speed
                        ? 'bg-[var(--color-brand-medium)] text-white border-[var(--color-brand-medium)] shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {speed === 1.0 ? '1.0x' : `${speed}x`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className="text-[10px] font-bold text-slate-400">50%</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.25"
                  step="0.05"
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(e.target.value)}
                  aria-label="Velocidade de reprodução"
                  className="flex-1 h-2 bg-slate-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-[10px] font-bold text-slate-400">125%</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  Compensação harmônica ativa (Tom preservado em{' '}
                  <strong className="font-mono">{currentKey}</strong>)
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Marcadores de Treino Salvos */}
          {practiceMarkers.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                Pins de Treino Salvos na Timeline ({practiceMarkers.length}):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {practiceMarkers.map((marker) => {
                  const isCurrentActive =
                    loopA === marker.start && loopB === marker.end && isLooping;
                  return (
                    <div
                      key={marker.id}
                      onClick={() => handleApplyMarker(marker)}
                      className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border text-xs font-bold studio-btn-transition active:scale-95 cursor-pointer shadow-2xs tabular-nums ${
                        isCurrentActive
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20'
                          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                      title={`Ativar Loop: ${formatTime(marker.start)} até ${formatTime(
                        marker.end
                      )}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: marker.color || '#f59e0b' }}
                      />
                      <span>{marker.name}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          isCurrentActive ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        [{formatTime(marker.start)} - {formatTime(marker.end)}]
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMarker(marker.id, e)}
                        className="p-0.5 rounded hover:bg-black/10 text-xs opacity-65 hover:opacity-100 ml-1 cursor-pointer"
                        title="Remover este marcador"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ===================================================================== */}
        {/* 7. RODAPÉ DE ATALHOS DE CONSOLE (1..6 MUTE, SHIFT+1..6 SOLO, ETC.)    */}
        {/* ===================================================================== */}
        <footer className="py-3 px-4 rounded-2xl bg-white/85 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <img
              src="/assets/icons/icon_keyboard_shortcuts.png"
              alt=""
              className="w-4 h-4 object-contain"
            />
            <span className="font-extrabold text-slate-700 dark:text-slate-200">
              Atalhos de Console:
            </span>
            <kbd className="bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
              Espaço
            </kbd>
            <span>Play/Pause</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <kbd className="bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
              1–6
            </kbd>
            <span>Mute Canal 1–6</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <kbd className="bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
              Shift + 1–6
            </kbd>
            <span>Solo Canal 1–6</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <kbd className="bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
              [ / ] / L
            </kbd>
            <span>Loop A-B</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <kbd className="bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
              M / R
            </kbd>
            <span>Master Mute / Restart</span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            EasyCovers Audio Engine • Tone.Meter Real-Time GPU
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Mixer;
