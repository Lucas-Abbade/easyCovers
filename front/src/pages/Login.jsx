import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScissorsIcon,
  MixerFadersIcon,
  PitchShiftIcon,
  CloudLibraryIcon,
  LockShieldIcon,
  SpotifyIcon,
  GuitarIcon,
  WaveformIcon,
  LoopRepeatIcon,
  MetronomeIcon,
  MicLyricsIcon,
  PlayOpticalIcon,
  PauseOpticalIcon,
  BoltAiIcon,
  SearchCatalogIcon,
  SparklesIcon,
  CheckCircleIcon,
} from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';
import LandingInteractiveMixer from '../components/LandingInteractiveMixer';
import {
  useReducedMotion,
  useInViewOnce,
  useAnimatedCounter,
} from '../utils/motionTokens';

// Dados estáticos de fallback caso o backend ainda esteja iniciando
const FALLBACK_SHOWCASE_TRACKS = [
  {
    id: 'showcase-1',
    title: 'Hotel California',
    artist: 'Eagles',
    album: 'Hotel California',
    genre: 'Rock',
    key: 'Bm',
    bpm: 75,
    duration: 391,
    cover: '/assets/genres/genre_rock.jpg',
    preview: '',
  },
  {
    id: 'showcase-2',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    album: 'Nevermind',
    genre: 'Grunge',
    key: 'Fm',
    bpm: 117,
    duration: 301,
    cover: '/assets/genres/genre_grunge.jpg',
    preview: '',
  },
  {
    id: 'showcase-3',
    title: 'Garota de Ipanema',
    artist: 'Tom Jobim & Vinícius',
    album: 'Getz/Gilberto',
    genre: 'Bossa Nova',
    key: 'F',
    bpm: 130,
    duration: 245,
    cover: '/assets/genres/genre_bossa_nova.jpg',
    preview: '',
  },
  {
    id: 'showcase-4',
    title: 'Master of Puppets',
    artist: 'Metallica',
    album: 'Master of Puppets',
    genre: 'Heavy Metal',
    key: 'Em',
    bpm: 212,
    duration: 515,
    cover: '/assets/genres/genre_heavy_metal.jpg',
    preview: '',
  },
  {
    id: 'showcase-5',
    title: 'Sultans of Swing',
    artist: 'Dire Straits',
    album: 'Dire Straits',
    genre: 'Blues Rock',
    key: 'Dm',
    bpm: 148,
    duration: 348,
    cover: '/assets/genres/genre_blues_rock.jpg',
    preview: '',
  },
  {
    id: 'showcase-6',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    genre: 'Rock Progressivo',
    key: 'F#m',
    bpm: 120,
    duration: 413,
    cover: '/assets/genres/genre_rock_progressivo.jpg',
    preview: '',
  },
];

const STEM_SHOWCASE_DETAILS = [
  {
    id: 'vocals',
    name: 'Vocais',
    icon: '/assets/icons/stem_vocals.png',
    freq: '85 Hz – 12 kHz',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    activeBorder: 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40',
    description:
      'Isole a voz principal com nitidez cristalina para estudar técnica vocal, criar versões acapella ou silencie em 1 clique para cantar no modo Karaokê.',
    useCase: 'Modo Karaokê & Harmonia Vocal',
  },
  {
    id: 'drums',
    name: 'Bateria',
    icon: '/assets/icons/stem_drums.png',
    freq: '20 Hz – 16 kHz',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    activeBorder: 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40',
    description:
      'Transientes preservados de bumbo, caixa e pratos. Ative Solo para transcrever viradas complexas ou Mute para gravar sua própria levada de bateria.',
    useCase: 'Transcrição de Viradas & Drumless Tracks',
  },
  {
    id: 'bass',
    name: 'Baixo',
    icon: '/assets/icons/stem_bass.png',
    freq: '32 Hz – 800 Hz',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    activeBorder: 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40',
    description:
      'Sub-graves e linhas de contrabaixo extraídas sem embolar com o bumbo da bateria. Ouça cada ghost note e slap com clareza cirúrgica.',
    useCase: 'Groove Lock & Linhas de Contrabaixo',
  },
  {
    id: 'guitar',
    name: 'Guitarra',
    icon: '/assets/icons/stem_guitar.png',
    freq: '80 Hz – 8 kHz',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    activeBorder: 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40',
    description:
      'Separação dedicada de guitarras base, solos e violões. Desacelere solos rápidos para 0.5x sem alterar a afinação e toque junto com a banda original.',
    useCase: 'Backing Track de Guitarra & Estudo de Solos',
  },
  {
    id: 'piano',
    name: 'Piano / Teclas',
    icon: '/assets/icons/stem_piano.png',
    freq: '27 Hz – 10 kHz',
    badgeClass: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30',
    activeBorder: 'border-pink-500 bg-pink-50/60 dark:bg-pink-950/40',
    description:
      'Voicings de piano acústico, Rhodes e pianos elétricos isolados da guitarra para você decifrar acordes estendidos e inversões sem esforço.',
    useCase: 'Harmonia & Voicings de Teclado',
  },
  {
    id: 'other',
    name: 'Outros / FX',
    icon: '/assets/icons/stem_other.png',
    freq: 'Full Spectrum',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    activeBorder: 'border-slate-500 bg-slate-100/80 dark:bg-slate-800/70',
    description:
      'Cordas orquestrais, metais, sintetizadores atmosféricos e efeitos de produção separados para manter sua backing track completa e fiel ao disco.',
    useCase: 'Ambiência, Synths & Arranjos Orquestrais',
  },
];

const MUSICIAN_PERSONAS = [
  {
    id: 'guitar',
    role: 'Guitarristas & Violonistas',
    headline: 'Tire solos nota por nota sem perder o timbre original',
    summary:
      'Silencie a faixa de guitarra original para assumir o palco com a banda completa, ou ative Solo + Velocidade 0.65x com Loop A-B para dominar passagens rápidas sem desafinar.',
    recipe: [
      { stem: 'Guitarra', state: 'MUTE (Você toca)', color: 'text-rose-600 dark:text-rose-400' },
      { stem: 'Bateria & Baixo', state: '100% (Cozinha firme)', color: 'text-emerald-600 dark:text-emerald-400' },
      { stem: 'Loop A-B', state: 'Ativo no Solo (02:14 – 02:42)', color: 'text-blue-600 dark:text-blue-400' },
    ],
  },
  {
    id: 'vocals',
    role: 'Cantores & Professores de Canto',
    headline: 'Ajuste qualquer música à sua tessitura vocal em 1 segundo',
    summary:
      'A música original está alta demais? Desça -2 ou -3 semitons em tempo real mantendo a qualidade dos instrumentos e acompanhe a letra sincronizada no Modo Karaokê.',
    recipe: [
      { stem: 'Vocais', state: 'MUTE ou 20% (Guia suave)', color: 'text-purple-600 dark:text-purple-400' },
      { stem: 'Pitch Shifter', state: '-2 Semitons (Tom adaptado)', color: 'text-emerald-600 dark:text-emerald-400' },
      { stem: 'Letras .LRC', state: 'Sincronizadas em Tempo Real', color: 'text-blue-600 dark:text-blue-400' },
    ],
  },
  {
    id: 'drums',
    role: 'Bateristas & Percussionistas',
    headline: 'Drumless tracks instantâneas com metrônomo Count-in',
    summary:
      'Transforme qualquer música da sua biblioteca ou do Spotify em uma faixa Drumless limpa. Ative a contagem regressiva 4-3-2-1 antes de entrar na música.',
    recipe: [
      { stem: 'Bateria', state: 'MUTE (Drumless Track)', color: 'text-amber-600 dark:text-amber-400' },
      { stem: 'Baixo', state: '+15% Boost (Referência de tempo)', color: 'text-emerald-600 dark:text-emerald-400' },
      { stem: 'Count-In', state: '4 Batidas Visuais e Sonoras', color: 'text-blue-600 dark:text-blue-400' },
    ],
  },
  {
    id: 'bass',
    role: 'Baixistas & Tecladistas',
    headline: 'Isolamento cirúrgico de graves e voicings harmônicos',
    summary:
      'Ouça apenas Baixo + Bateria juntos para estudar o pocket rítmico, ou isole o canal de Piano para identificar cada extensão de acorde em músicas de Jazz, MPB e Bossa Nova.',
    recipe: [
      { stem: 'Baixo + Bateria', state: 'SOLO DUPLO (Groove Lock)', color: 'text-emerald-600 dark:text-emerald-400' },
      { stem: 'Piano / Teclas', state: 'Isolado sem Guitarras', color: 'text-pink-600 dark:text-pink-400' },
      { stem: 'Marcadores', state: 'Salvos na Nuvem por Música', color: 'text-blue-600 dark:text-blue-400' },
    ],
  },
];

const CHORD_PROGRESSION_BASE = [0, 8, 3, 10]; // Am, F, C, G relativos a A=0
const CHORD_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const CHORD_QUALITIES = ['m', 'maj7', '', '7'];

const Login = ({ onLogin, initialShowAuth = false }) => {
  // Controle de fluxo da página (Landing Page Completa vs. Modal/View de Autenticação)
  const [showAuthForm, setShowAuthForm] = useState(Boolean(initialShowAuth));
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedShowcaseTrack, setSelectedShowcaseTrack] = useState(null);

  // Estados dos campos de formulário de Auth
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados visuais e de interação do Auth
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [googleSdkError, setGoogleSdkError] = useState(false);
  const [originWarning, setOriginWarning] = useState('');

  // Estados para Verificação de E-mail (OTP 6 dígitos)
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const otpRefs = useRef([]);

  // Estados interativos das seções da Landing Page
  const [platformStats, setPlatformStats] = useState({
    total_songs_processed: 1248,
    total_musicians: 386,
    total_stems_isolated: 7488,
    supported_stems_count: 6,
    genres_available: 16,
    engine_name: 'Demucs v4 HT-6s',
  });
  const [showcaseTracks, setShowcaseTracks] = useState(FALLBACK_SHOWCASE_TRACKS);
  const [recentCommunitySongs, setRecentCommunitySongs] = useState([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const previewAudioRef = useRef(null);

  // Estados de micro-interação do Bento Grid e Personas
  const [selectedStemInfo, setSelectedStemInfo] = useState('vocals');
  const [demoPitchSemitones, setDemoPitchSemitones] = useState(0);
  const [demoPlaybackSpeed, setDemoPlaybackSpeed] = useState(0.75);
  const [activePersona, setActivePersona] = useState('guitar');

  // Scroll-reveal hooks (once: true — Regra 7 de motion-patterns)
  const prefersReducedMotion = useReducedMotion();
  const [statsRef, statsInView] = useInViewOnce(0.15);
  const [bentoRef, bentoInView] = useInViewOnce(0.1);
  const [catalogRef, catalogInView] = useInViewOnce(0.1);
  const [personasRef, personasInView] = useInViewOnce(0.1);

  // Contadores animados em tabular-nums
  const animatedSongsCount = useAnimatedCounter(
    platformStats.total_songs_processed,
    statsInView
  );
  const animatedStemsCount = useAnimatedCounter(
    platformStats.total_stems_isolated,
    statsInView
  );
  const animatedMusiciansCount = useAnimatedCounter(
    platformStats.total_musicians,
    statsInView
  );

  const navigate = useNavigate();
  const GOOGLE_CLIENT_ID =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '306538057431-96v86vvcrqvi556j85o2gad7mr5irf45.apps.googleusercontent.com';
  const googleInitialized = useRef(false);
  const googleCallbackRef = useRef(null);

  // Busca telemetria e catálogo curado do backend FastAPI (/api/v1/public/*)
  useEffect(() => {
    let isMounted = true;

    fetch('http://localhost:8000/api/v1/public/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.total_songs_processed) {
          setPlatformStats(data);
        }
      })
      .catch(() => {
        // Usa valores de fallback silenciosamente caso backend esteja offline
      });

    fetch('http://localhost:8000/api/v1/public/showcase')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          if (
            Array.isArray(data.featured_tracks) &&
            data.featured_tracks.length > 0
          ) {
            setShowcaseTracks(data.featured_tracks);
          }
          if (Array.isArray(data.recent_community_songs)) {
            setRecentCommunitySongs(data.recent_community_songs);
          }
        }
      })
      .catch(() => {
        // Mantém FALLBACK_SHOWCASE_TRACKS
      });

    return () => {
      isMounted = false;
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Fecha o modal de Auth com a tecla Escape (frontend-a11y)
  useEffect(() => {
    if (!showAuthForm) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading && !isVerifying) {
        setShowAuthForm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAuthForm, isLoading, isVerifying]);

  // Efeito para contagem regressiva do reenvio de código (60s cooldown)
  useEffect(() => {
    if (!showVerification || resendCooldown <= 0) return undefined;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [showVerification, resendCooldown]);

  // Foco automático no primeiro input ao abrir a tela de verificação
  useEffect(() => {
    if (showVerification) {
      const timer = setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showVerification]);

  // Extrai mensagem de erro legível (evita crash do React caso o FastAPI retorne array 422 em data.detail)
  const extractErrorDetail = (data, fallbackMsg) => {
    if (!data) return fallbackMsg;
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      if (typeof first === 'string') return first;
      if (first?.msg) return `Dados inválidos: ${first.msg}`;
    }
    return fallbackMsg;
  };

  // Garante que o acesso local ocorra em localhost:5173 (origem autorizada no Google Cloud OAuth)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { hostname, port, protocol, pathname, search, hash } = window.location;
    if (hostname === '127.0.0.1') {
      const targetPort = port ? `:${port}` : '';
      window.location.replace(
        `${protocol}//localhost${targetPort}${pathname}${search}${hash}`
      );
      return;
    }
    if (hostname === 'localhost' && port && port !== '5173') {
      setOriginWarning(
        `Atenção: você está acessando pela porta ${port}. O login com Google requer http://localhost:5173.`
      );
    }
  }, []);

  // Callback de autenticação via Google OAuth
  const handleGoogleResponse = useCallback(
    async (response) => {
      const id_token = response?.credential;
      if (!id_token) {
        setErrorMessage(
          'Não foi possível obter a credencial do Google. Tente novamente.'
        );
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const res = await fetch('http://localhost:8000/auth/google/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data && data.id) {
          const userData = {
            id: data.id,
            email: data.email,
            username: data.username,
            full_name: data.full_name || '',
            profile_picture_url: data.profile_picture_url || '',
            is_profile_completed: Boolean(data.is_profile_completed),
          };
          onLogin(userData);
          if (!userData.is_profile_completed) {
            navigate('/edit-profile', { state: { isNewUser: true } });
          } else {
            navigate('/dashboard');
          }
        } else {
          setErrorMessage(
            extractErrorDetail(
              data,
              'Falha na autenticação com o Google. Tente novamente.'
            )
          );
        }
      } catch (err) {
        console.error('Erro no login com Google:', err);
        setErrorMessage(
          'Não foi possível conectar ao servidor (porta 8000). Verifique se o backend está em execução.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, onLogin]
  );

  // Mantém a referência do callback sempre atualizada para evitar stale closures no SDK do Google
  useEffect(() => {
    googleCallbackRef.current = handleGoogleResponse;
  }, [handleGoogleResponse]);

  // Função para renderizar o botão do Google com largura numérica válida em pixels (200..400)
  const renderGoogleButton = useCallback(() => {
    if (!window.google?.accounts?.id) return;
    const el = document.getElementById('googleSignInDiv');
    if (!el) return;

    try {
      const containerWidth =
        el.clientWidth || el.parentElement?.clientWidth || 360;
      const validPixelWidth = Math.min(
        Math.max(Math.round(containerWidth), 200),
        400
      );

      el.innerHTML = '';
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: validPixelWidth,
        text: isRegistering ? 'signup_with' : 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
      });
      setGoogleSdkError(false);
    } catch (err) {
      console.error('Erro ao renderizar botão do Google:', err);
      setGoogleSdkError(true);
    }
  }, [isRegistering]);

  // Inicialização resiliente do SDK do Google Identity Services
  const initAndRenderGoogle = useCallback(() => {
    if (!window.google?.accounts?.id) return;

    try {
      if (!googleInitialized.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => googleCallbackRef.current?.(resp),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleInitialized.current = true;
      }
      setGoogleSdkError(false);
      if (showAuthForm) {
        renderGoogleButton();
      }
    } catch (err) {
      console.error('Erro ao inicializar Google Identity Services:', err);
      setGoogleSdkError(true);
    }
  }, [GOOGLE_CLIENT_ID, renderGoogleButton, showAuthForm]);

  useEffect(() => {
    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId);

    const handleScriptLoad = () => {
      initAndRenderGoogle();
    };

    const handleScriptError = () => {
      setGoogleSdkError(true);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', handleScriptLoad);
      script.addEventListener('error', handleScriptError);
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initAndRenderGoogle();
    } else {
      script.addEventListener('load', handleScriptLoad);
      script.addEventListener('error', handleScriptError);
    }

    return () => {
      if (script) {
        script.removeEventListener('load', handleScriptLoad);
        script.removeEventListener('error', handleScriptError);
      }
    };
  }, [initAndRenderGoogle]);

  // Re-renderiza o botão do Google quando o usuário abre o formulário ou troca o modo (Entrar / Cadastrar)
  useEffect(() => {
    if (showAuthForm && window.google?.accounts?.id) {
      const timer = setTimeout(() => {
        initAndRenderGoogle();
      }, 40);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showAuthForm, isRegistering, initAndRenderGoogle]);

  // Abre o modal de autenticação configurando modo (Login vs Cadastro) e parando eventuais previews de áudio
  const openAuthModal = (registerMode = false, trackContext = null) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreviewId(null);
    }
    setSelectedShowcaseTrack(trackContext);
    setIsRegistering(Boolean(registerMode));
    setErrorMessage('');
    setShowAuthForm(true);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  // Busca ao vivo no catálogo Deezer via backend (/api/music/search)
  const handleCatalogSearch = async (e) => {
    if (e) e.preventDefault();
    const q = catalogSearchQuery.trim();
    if (!q) return;

    setIsSearchingCatalog(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/music/search?q=${encodeURIComponent(q)}&limit=6`
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data && Array.isArray(data.results) && data.results.length > 0) {
        const mapped = data.results.map((item, idx) => ({
          id: item.id || `search-${idx}`,
          title: item.title,
          artist: item.artist,
          album: item.album || '',
          genre: 'Estúdio HD',
          key: ['Am', 'C', 'Em', 'G', 'Dm', 'F#m'][idx % 6],
          bpm: [112, 124, 96, 132, 105, 118][idx % 6],
          duration: item.duration || 210,
          cover: item.cover || '/assets/genres/genre_rock.jpg',
          preview: item.preview || '',
        }));
        setShowcaseTracks(mapped);
      }
    } catch {
      // Silencioso caso backend esteja offline
    } finally {
      setIsSearchingCatalog(false);
    }
  };

  // Toca/pausa preview de 30s das músicas do catálogo na Landing Page
  const handleToggleTrackPreview = (track) => {
    if (!track.preview) {
      openAuthModal(true, track);
      return;
    }

    if (playingPreviewId === track.id) {
      previewAudioRef.current?.pause();
      setPlayingPreviewId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const audio = new Audio(track.preview);
    audio.volume = 0.85;
    audio.onended = () => setPlayingPreviewId(null);
    audio.onerror = () => setPlayingPreviewId(null);
    previewAudioRef.current = audio;
    setPlayingPreviewId(track.id);
    audio.play().catch(() => {
      setPlayingPreviewId(null);
    });
  };

  // Submissão do formulário de autenticação (Login ou Cadastro)
  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    if (isRegistering) {
      if (!trimmedUsername || !normalizedEmail || !password || !confirmPassword) {
        setErrorMessage('Por favor, preencha todos os campos.');
        return;
      }
      if (trimmedUsername.length < 3) {
        setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas não coincidem.');
        return;
      }

      const hasUpperCase = /[A-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (password.length < 8 || !hasUpperCase || !hasNumber) {
        setErrorMessage(
          'A senha deve ter no mínimo 8 caracteres, contendo pelo menos 1 letra maiúscula e 1 número.'
        );
        return;
      }
    } else if (!normalizedEmail || !password) {
      setErrorMessage('Informe seu e-mail e senha para acessar.');
      return;
    }

    const endpoint = isRegistering ? 'register' : 'login';
    const payload = isRegistering
      ? { username: trimmedUsername, email: normalizedEmail, password }
      : { email: normalizedEmail, password };

    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/${endpoint}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        if (isRegistering && data && data.status === 'pending_verification') {
          setVerificationEmail(normalizedEmail);
          setShowVerification(true);
          setResendCooldown(data.resend_cooldown || 60);
          setOtpDigits(['', '', '', '', '', '']);
          setSuccessMessage(
            'Código enviado! Verifique sua caixa de entrada (ou o terminal em modo de teste).'
          );
          setErrorMessage('');
          return;
        }

        if (data && data.id) {
          const userData = {
            id: data.id,
            email: data.email,
            username: data.username,
            full_name: data.full_name || '',
            profile_picture_url: data.profile_picture_url || '',
            is_profile_completed: Boolean(data.is_profile_completed),
            is_email_verified: Boolean(data.is_email_verified),
          };
          onLogin(userData);
          setUsername('');
          setPassword('');
          setConfirmPassword('');
          if (!userData.is_profile_completed) {
            navigate('/edit-profile', { state: { isNewUser: true } });
          } else {
            navigate('/dashboard');
          }
        } else {
          setErrorMessage(
            extractErrorDetail(data, 'Não foi possível realizar a autenticação.')
          );
        }
      } else {
        if (
          response.status === 403 &&
          data?.detail &&
          typeof data.detail === 'string' &&
          data.detail.toLowerCase().includes('não foi verificado')
        ) {
          setVerificationEmail(normalizedEmail);
          setShowVerification(true);
          setResendCooldown(60);
          setOtpDigits(['', '', '', '', '', '']);
          setErrorMessage(
            'Seu e-mail ainda não foi verificado. Enviamos um código para validação.'
          );
          return;
        }

        setErrorMessage(
          extractErrorDetail(data, 'Não foi possível realizar a autenticação.')
        );
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        'Erro ao conectar com o servidor (porta 8000). Verifique se o backend está rodando e tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Funções de manipulação do código OTP (6 dígitos)
  const handleOtpChange = (value, index) => {
    const cleanDigit = value.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleanDigit;
    setOtpDigits(updated);
    setErrorMessage('');

    if (cleanDigit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = [...otpDigits];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      updated[i] = pasted[i];
    }
    setOtpDigits(updated);
    setErrorMessage('');

    const nextIndex = Math.min(pasted.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('').trim();
    if (code.length < 6) {
      setErrorMessage(
        'Por favor, preencha todos os 6 dígitos do código de verificação.'
      );
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:8000/verify-email/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data && data.id) {
        const userData = {
          id: data.id,
          email: data.email,
          username: data.username,
          full_name: data.full_name || '',
          profile_picture_url: data.profile_picture_url || '',
          is_profile_completed: Boolean(data.is_profile_completed),
          is_email_verified: true,
        };
        onLogin(userData);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setOtpDigits(['', '', '', '', '', '']);
        setShowVerification(false);

        if (!userData.is_profile_completed) {
          navigate('/edit-profile', { state: { isNewUser: true } });
        } else {
          navigate('/dashboard');
        }
      } else {
        setErrorMessage(
          extractErrorDetail(
            data,
            'Código inválido ou expirado. Tente novamente.'
          )
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(
        'Erro ao conectar com o servidor. Verifique se o backend está em execução.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:8000/resend-verification/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        setSuccessMessage(
          'Novo código enviado com sucesso! Verifique sua caixa de entrada.'
        );
        setResendCooldown(data?.resend_cooldown || 60);
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      } else {
        setErrorMessage(
          extractErrorDetail(
            data,
            'Não foi possível reenviar o código. Aguarde alguns instantes.'
          )
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao conectar com o servidor para reenviar código.');
    } finally {
      setIsResending(false);
    }
  };

  // Alterna entre modo Login e Cadastro
  const toggleMode = (registering) => {
    setIsRegistering(registering);
    setPassword('');
    setConfirmPassword('');
    setErrorMessage('');
  };

  // Indicadores em tempo real para requisitos de senha no cadastro
  const passLengthMet = password.length >= 8;
  const passUpperMet = /[A-Z]/.test(password);
  const passNumberMet = /\d/.test(password);
  const passMatchMet =
    password && confirmPassword && password === confirmPassword;

  // Estado derivado puro para o card de inspeção de Stems e Pitch Shift do Bento Grid
  const currentStemDetail = useMemo(
    () =>
      STEM_SHOWCASE_DETAILS.find((s) => s.id === selectedStemInfo) ||
      STEM_SHOWCASE_DETAILS[0],
    [selectedStemInfo]
  );

  const transposedChords = useMemo(
    () =>
      CHORD_PROGRESSION_BASE.map((baseIdx, i) => {
        const shifted = (baseIdx + demoPitchSemitones + 120) % 12;
        return `${CHORD_NAMES[shifted]}${CHORD_QUALITIES[i]}`;
      }),
    [demoPitchSemitones]
  );

  const currentPersonaDetail = useMemo(
    () =>
      MUSICIAN_PERSONAS.find((p) => p.id === activePersona) ||
      MUSICIAN_PERSONAS[0],
    [activePersona]
  );

  return (
    <div className="font-sans min-h-screen bg-[#EEF6FF] dark:bg-[#060B18] text-slate-900 dark:text-slate-100 selection:bg-[var(--color-brand-medium)] selection:text-white relative overflow-x-hidden">
      {/* Superfície de Grid Técnico Acústico + Iluminação Radial */}
      <div
        className="fixed inset-0 studio-grid-surface pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="fixed -top-48 left-1/4 w-[38rem] h-[38rem] bg-blue-500/15 dark:bg-blue-600/12 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/3 -right-48 w-[34rem] h-[34rem] bg-purple-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* 1. CABEÇALHO GLOBAL FIXO (STICKY GLASS NAVBAR)                            */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#081022]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Identidade da Marca */}
          <button
            type="button"
            onClick={() => {
              setShowAuthForm(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 cursor-pointer group text-left"
          >
            <img
              src="/assets/logo_symbol.png"
              alt="EasyCovers Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-xs studio-btn-transition group-hover:scale-105"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-[var(--color-brand-deep)] dark:text-white tracking-tight">
                  EasyCovers
                </span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60 tracking-wider">
                  Studio AI
                </span>
              </div>
              <span className="hidden sm:block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Estação Multitrack para Músicos
              </span>
            </div>
          </button>

          {/* Links de Navegação Rápida (Visíveis na Landing Page) */}
          {!showAuthForm && (
            <nav
              aria-label="Seções da página inicial"
              className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              <a
                href="#mixer-live"
                className="hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 studio-btn-transition py-2"
              >
                Mixer ao Vivo
              </a>
              <a
                href="#bento-features"
                className="hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 studio-btn-transition py-2"
              >
                Engenharia 6-Stems
              </a>
              <a
                href="#catalog-showcase"
                className="hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 studio-btn-transition py-2"
              >
                Explorar Catálogo
              </a>
              <a
                href="#workflow"
                className="hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 studio-btn-transition py-2"
              >
                Como Funciona
              </a>
              <a
                href="#personas"
                className="hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 studio-btn-transition py-2"
              >
                Para seu Instrumento
              </a>
            </nav>
          )}

          {/* Controles da Direita: ThemeToggle + Entrar / Começar */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />
            <span
              className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800"
              aria-hidden="true"
            />
            {showAuthForm ? (
              <button
                type="button"
                onClick={() => setShowAuthForm(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 studio-btn-transition active:scale-95 cursor-pointer"
              >
                ← Voltar à Página Inicial
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuthModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 studio-btn-transition active:scale-95 cursor-pointer"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-[var(--color-brand-dark)] hover:to-[#0E1F4C] dark:hover:to-indigo-900 shadow-md shadow-blue-500/20 studio-btn-transition active:scale-95 cursor-pointer"
                >
                  Criar Conta Grátis
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MODO 1: LANDING PAGE DE ALTO NÍVEL (!showAuthForm)                        */}
      {/* ========================================================================= */}
      {!showAuthForm ? (
        <main className="relative z-10">
          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 1: HERO ASSIMÉTRICO + SANDBOX DE MIXAGEM AO VIVO              */}
          {/* ------------------------------------------------------------------- */}
          <section
            id="mixer-live"
            aria-labelledby="hero-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-16 pb-14"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Coluna Esquerda: Proposta de Valor & CTAs (5 colunas no desktop) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-blue-200/80 dark:border-blue-800/70 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-brand-medium)] animate-ping"></span>
                  <span className="text-xs font-black text-[var(--color-brand-medium)] dark:text-blue-400 tracking-wide">
                    DEMUCS v4 HT-6S • MOTOR NEURAL DE ESTÚDIO
                  </span>
                </div>

                <h1
                  id="hero-heading"
                  className="text-3xl sm:text-5xl font-black text-[var(--color-brand-deep)] dark:text-white tracking-tight leading-[1.08] text-balance"
                >
                  Desconstrua qualquer música em{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-medium)] via-indigo-500 to-purple-500 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                    6 faixas isoladas
                  </span>{' '}
                  e domine seu instrumento.
                </h1>

                <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed text-pretty">
                  Transforme gravações, MP3s ou playlists do Spotify em uma estação
                  multitrack interativa. Isole <strong>Voz, Bateria, Baixo, Guitarra, Piano e FX</strong>,
                  mude o tom em semitons sem alterar a velocidade e treine com Loop A-B.
                </p>

                {/* Chips Cromáticos dos 6 Stems */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                    ● Vocais
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    ● Bateria
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                    ● Baixo
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                    ● Guitarra
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-700 dark:text-pink-300 border border-pink-500/25">
                    ● Piano
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/25">
                    ● Outros / FX
                  </span>
                </div>

                {/* CTAs de Ação */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openAuthModal(true)}
                    className="px-6 py-4 rounded-2xl bg-gradient-to-r from-[var(--color-brand-medium)] via-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-[var(--color-brand-dark)] hover:to-[#0E1F4C] dark:hover:to-indigo-900 text-white text-sm sm:text-base font-black shadow-xl shadow-blue-500/25 studio-btn-transition active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer group"
                  >
                    <span>Abrir Meu Estúdio Grátis</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>

                  <a
                    href="#catalog-showcase"
                    className="px-5 py-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 text-sm font-black shadow-xs studio-btn-transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <SearchCatalogIcon className="w-4 h-4 text-[var(--color-brand-medium)] dark:text-blue-400" />
                    <span>Explorar Catálogo</span>
                  </a>
                </div>

                {/* Garantias Rápidas */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    Login rápido com Google ou E-mail
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    Sincronizado com Spotify & Letras LRC
                  </span>
                </div>
              </div>

              {/* Coluna Direita: Sandbox Interativo de Stems em Tempo Real (7 colunas no desktop) */}
              <div className="lg:col-span-7">
                <LandingInteractiveMixer onOpenStudio={() => openAuthModal(true)} />
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 2: BARRA DE TELEMETRIA E ESTATÍSTICAS EM TABULAR NUMS         */}
          {/* ------------------------------------------------------------------- */}
          <section
            ref={statsRef}
            aria-label="Estatísticas em tempo real da plataforma"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
          >
            <div className="rounded-3xl p-2 bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-lg backdrop-blur-md">
              <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/80 px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
                <div className="pt-2 sm:pt-0 sm:px-4 first:pl-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Músicas Processadas
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] dark:text-white mt-1 tabular-nums">
                    {animatedSongsCount.toLocaleString('pt-BR')}+
                  </div>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    ● Biblioteca ativa na nuvem
                  </span>
                </div>

                <div className="pt-4 sm:pt-0 sm:px-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Stems Isolados por IA
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--color-brand-medium)] dark:text-blue-400 mt-1 tabular-nums">
                    {animatedStemsCount.toLocaleString('pt-BR')}+
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    6 canais dedicados por faixa
                  </span>
                </div>

                <div className="pt-4 lg:pt-0 sm:px-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Músicos & Criadores
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] dark:text-white mt-1 tabular-nums">
                    {animatedMusiciansCount.toLocaleString('pt-BR')}+
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Estudando e criando covers
                  </span>
                </div>

                <div className="pt-4 lg:pt-0 sm:px-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Motor de Separação
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                    {platformStats.engine_name}
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    44.1 kHz Stereo • Zero Fase
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 3: BENTO GRID ASSIMÉTRICO DE ENGENHARIA MUSICAL               */}
          {/* ------------------------------------------------------------------- */}
          <section
            id="bento-features"
            ref={bentoRef}
            aria-labelledby="bento-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
          >
            <div className="max-w-3xl mb-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/70 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60 mb-3">
                <BoltAiIcon className="w-3.5 h-3.5" />
                ARQUITETURA DE ESTÚDIO PROFISSIONAL
              </span>
              <h2
                id="bento-heading"
                className="text-2xl sm:text-4xl font-black text-[var(--color-brand-deep)] dark:text-white tracking-tight text-balance"
              >
                Tudo o que uma DAW profissional faz. Direto no seu navegador.
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-2.5 text-pretty">
                Cada ferramenta do EasyCovers foi desenhada especificamente para o fluxo
                de ensaio, transcrição de ouvido e criação de backing tracks.
              </p>
            </div>

            <div
              className={`grid grid-cols-1 lg:grid-cols-12 gap-6 studio-card-transition ${
                bentoInView || prefersReducedMotion
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              {/* BENTO CARD 1 (7 Colunas): Inspetor Interativo dos 6 Stems */}
              <div className="lg:col-span-7 rounded-3xl p-2 bg-white/75 dark:bg-slate-900/75 border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col">
                <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/90 p-5 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-purple-600 dark:text-purple-400">
                        <ScissorsIcon className="w-4 h-4" />
                        ISOLAMENTO NEURAL DE 6 CANAIS
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        HT-Demucs 6s
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
                      Clique em um instrumento para inspecionar o isolamento:
                    </h3>

                    {/* Seletor Interativo das 6 Faixas */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 my-5">
                      {STEM_SHOWCASE_DETAILS.map((stem) => {
                        const isSelected = selectedStemInfo === stem.id;
                        return (
                          <button
                            key={stem.id}
                            type="button"
                            onClick={() => setSelectedStemInfo(stem.id)}
                            className={`p-2.5 rounded-xl border text-center studio-btn-transition active:scale-95 cursor-pointer flex flex-col items-center gap-1.5 ${
                              isSelected
                                ? `${stem.activeBorder} shadow-sm`
                                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <img
                              src={stem.icon}
                              alt=""
                              aria-hidden="true"
                              className="w-7 h-7 object-contain"
                            />
                            <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                              {stem.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Painel de Detalhes do Stem Selecionado */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        Canal: {currentStemDetail.name}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border tabular-nums ${currentStemDetail.badgeClass}`}
                      >
                        Faixa Espectral: {currentStemDetail.freq}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-pretty">
                      {currentStemDetail.description}
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Aplicação principal:</span>
                      <span className="text-[var(--color-brand-medium)] dark:text-blue-400">
                        {currentStemDetail.useCase}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BENTO CARD 2 (5 Colunas): Simulador de Transposição Harmônica (Pitch Shift) */}
              <div className="lg:col-span-5 rounded-3xl p-2 bg-white/75 dark:bg-slate-900/75 border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col">
                <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/90 p-5 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                        <PitchShiftIcon className="w-4 h-4" />
                        TRANSPOSIÇÃO HARMÔNICA EM TEMPO REAL
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        Tone.js DSP
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
                      Mude a tonalidade sem alterar o BPM da música.
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed text-pretty">
                      Adapte músicas ao seu alcance vocal ou evite afinações alternativas
                      (como Eb) na guitarra transpondo direto no mixer.
                    </p>
                  </div>

                  {/* Simulador Interativo de Acordes / Tom */}
                  <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Teste a transposição de acordes:
                      </span>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <button
                          type="button"
                          onClick={() =>
                            setDemoPitchSemitones((s) => Math.max(-6, s - 1))
                          }
                          aria-label="Reduzir semitom na demonstração"
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-xs hover:border-emerald-500 studio-btn-transition active:scale-95 cursor-pointer"
                        >
                          −1
                        </button>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-xs font-black">
                          {demoPitchSemitones > 0
                            ? `+${demoPitchSemitones}`
                            : demoPitchSemitones}{' '}
                          st
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDemoPitchSemitones((s) => Math.min(6, s + 1))
                          }
                          aria-label="Aumentar semitom na demonstração"
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-xs hover:border-emerald-500 studio-btn-transition active:scale-95 cursor-pointer"
                        >
                          +1
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 tabular-nums">
                      {transposedChords.map((chord, idx) => (
                        <div
                          key={idx}
                          className="py-2.5 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center shadow-2xs"
                        >
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500">
                            Compasso {idx + 1}
                          </span>
                          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                            {chord}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* BENTO CARD 3 (5 Colunas): Studio Practice Suite (Loop A-B, Speed & Metrônomo) */}
              <div className="lg:col-span-5 rounded-3xl p-2 bg-white/75 dark:bg-slate-900/75 border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col">
                <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/90 p-5 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
                        <MetronomeIcon className="w-4 h-4" />
                        STUDIO PRACTICE SUITE
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        Loop A-B & Speed
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
                      Desacelere solos difíceis e marque seções da música.
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed text-pretty">
                      Crie marcadores personalizados (<em>Intro, Verso, Solo, Refrão</em>),
                      ative o Loop A-B infinito e reduza o andamento para praticar com precisão.
                    </p>
                  </div>

                  {/* Controles Demonstrativos de Velocidade e Marcadores */}
                  <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Velocidade de Estudo:
                      </span>
                      <div className="flex items-center gap-1 tabular-nums">
                        {[0.5, 0.75, 1.0, 1.25].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => setDemoPlaybackSpeed(spd)}
                            className={`px-2 py-1 rounded-lg text-xs font-black studio-btn-transition cursor-pointer ${
                              demoPlaybackSpeed === spd
                                ? 'bg-[var(--color-brand-medium)] text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25 tabular-nums">
                        ⚑ 00:18 Intro Riff
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 tabular-nums">
                        ↻ 02:14 Solo Principal ({demoPlaybackSpeed}x)
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25 tabular-nums">
                        ⚑ 03:05 Final
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BENTO CARD 4 (7 Colunas): Karaokê Sincronizado (.LRC) + Hub Spotify */}
              <div className="lg:col-span-7 rounded-3xl p-2 bg-white/75 dark:bg-slate-900/75 border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col">
                <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/90 p-5 sm:p-7 flex-1 flex flex-col justify-between">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--color-brand-medium)] dark:text-blue-400">
                      <MicLyricsIcon className="w-4 h-4" />
                      LETRAS SINCRONIZADAS (.LRC) & INTEGRAÇÃO SPOTIFY
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#1DB954]/15 text-[#15883e] dark:text-[#1ed760] border border-[#1DB954]/30">
                      <SpotifyIcon className="w-3.5 h-3.5" />
                      Spotify OAuth 2.0
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center my-2">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
                        Letras em tempo real e importação direta das suas playlists.
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed text-pretty">
                        Conecte sua conta Spotify para visualizar suas playlists e músicas
                        curtidas dentro do perfil, e acompanhe a letra sincronizada linha por
                        linha no Mixer.
                      </p>
                    </div>

                    {/* Preview Visual de Karaokê Sincronizado */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-2 font-sans shadow-inner">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                        <span>LRCLIB SYNC</span>
                        <span>[01:42.80]</span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold truncate">
                        ♪ On a dark desert highway, cool wind in my hair...
                      </p>
                      <p className="text-sm font-black text-blue-400 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/30">
                        ♪ Welcome to the Hotel California...
                      </p>
                      <p className="text-xs text-slate-400 font-semibold truncate">
                        ♪ Such a lovely place, such a lovely face...
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 4: EXPLORADOR DE CATÁLOGO AO VIVO ( PREVIEWS DE 30S )          */}
          {/* ------------------------------------------------------------------- */}
          <section
            id="catalog-showcase"
            ref={catalogRef}
            aria-labelledby="catalog-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14"
          >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 mb-3">
                  <WaveformIcon className="w-3.5 h-3.5" />
                  CATÁLOGO INTEGRADO AO BACKEND
                </span>
                <h2
                  id="catalog-heading"
                  className="text-2xl sm:text-4xl font-black text-[var(--color-brand-deep)] dark:text-white tracking-tight text-balance"
                >
                  Ouça prévias reais e envie qualquer música para o Studio
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-1.5 text-pretty">
                  Pesquise no catálogo global para ouvir prévias de 30 segundos ou escolha um
                  clássico abaixo para iniciar a separação de stems.
                </p>
              </div>

              {/* Barra de Busca em Tempo Real conectada a /api/music/search */}
              <form
                onSubmit={handleCatalogSearch}
                className="flex items-center gap-2 w-full lg:w-96"
              >
                <div className="relative flex-1">
                  <label htmlFor="landing-catalog-search" className="sr-only">
                    Buscar música ou artista no catálogo
                  </label>
                  <input
                    id="landing-catalog-search"
                    type="text"
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                    placeholder="Buscar música ou artista (ex: Queen)..."
                    className="w-full pl-3.5 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingCatalog}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-black studio-btn-transition active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isSearchingCatalog ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
            </div>

            {/* Grid de Faixas do Showcase */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 studio-card-transition ${
                catalogInView || prefersReducedMotion
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              {showcaseTracks.map((track) => {
                const isPreviewPlaying = playingPreviewId === track.id;
                return (
                  <div
                    key={track.id}
                    className="rounded-3xl p-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-xl studio-card-transition group"
                  >
                    <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/80 p-4 flex flex-col justify-between h-full">
                      <div className="flex items-start gap-3.5">
                        {/* Capa do Álbum com Outline Neutro de 1px (make-interfaces-feel-better) */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 studio-img-outline bg-slate-100 dark:bg-slate-800">
                          <img
                            src={track.cover || '/assets/genres/genre_rock.jpg'}
                            alt={`Capa de ${track.title} por ${track.artist}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {track.preview && (
                            <button
                              type="button"
                              onClick={() => handleToggleTrackPreview(track)}
                              aria-label={
                                isPreviewPlaying
                                  ? `Pausar prévia de ${track.title}`
                                  : `Ouvir prévia de 30 segundos de ${track.title}`
                              }
                              className="absolute inset-0 bg-slate-950/55 hover:bg-slate-950/70 flex items-center justify-center text-white studio-btn-transition cursor-pointer"
                            >
                              {isPreviewPlaying ? (
                                <PauseOpticalIcon className="w-6 h-6 text-amber-400" />
                              ) : (
                                <PlayOpticalIcon className="w-6 h-6 translate-x-[1px]" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400">
                            {track.genre}
                          </span>
                          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                            {track.title}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {track.artist}
                          </p>

                          {/* Metadados Técnicos em Tabular Nums */}
                          <div className="flex items-center gap-1.5 mt-2 tabular-nums">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Tom: {track.key}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {track.bpm} BPM
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              6 Stems
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        {track.preview ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTrackPreview(track)}
                            className={`text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                              isPreviewPlaying
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-400 hover:text-[var(--color-brand-medium)]'
                            }`}
                          >
                            {isPreviewPlaying ? '■ Pausar Prévia' : '▶ Ouvir Prévia 30s'}
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            Pronto para separação IA
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openAuthModal(true, track)}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/70 hover:bg-[var(--color-brand-medium)] hover:text-white text-[var(--color-brand-medium)] dark:text-blue-400 text-xs font-black studio-btn-transition active:scale-95 cursor-pointer"
                        >
                          Isolar Stems →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Feed Real da Comunidade (Músicas recém-processadas no Banco SQLite) */}
            {recentCommunitySongs.length > 0 && (
              <div className="mt-8 rounded-3xl p-2 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                <div className="rounded-2xl bg-slate-50/90 dark:bg-[#0B1325]/90 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Processadas Recentemente no Studio:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {recentCommunitySongs.slice(0, 4).map((song) => (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() =>
                          openAuthModal(true, {
                            title: song.name,
                            artist: song.artist,
                            cover:
                              song.cover_image_url ||
                              '/assets/genres/genre_rock.jpg',
                          })
                        }
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 hover:border-[var(--color-brand-medium)] text-xs studio-btn-transition cursor-pointer"
                      >
                        <img
                          src={
                            song.cover_image_url ||
                            '/assets/genres/genre_rock.jpg'
                          }
                          alt=""
                          aria-hidden="true"
                          className="w-5 h-5 rounded object-cover studio-img-outline"
                        />
                        <span className="font-black text-slate-800 dark:text-slate-100 truncate max-w-[160px]">
                          {song.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-[var(--color-brand-medium)] dark:text-blue-400">
                          {song.instrument || song.genre || '6 Stems'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 4.5: PIPELINE EM 3 ETAPAS (UPLOAD -> DEMUCS IA -> DAW MIXER)   */}
          {/* ------------------------------------------------------------------- */}
          <section
            id="workflow"
            aria-labelledby="workflow-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
          >
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25 mb-2">
                FLUXO DE ESTÚDIO SIMPLIFICADO
              </span>
              <h2
                id="workflow-heading"
                className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] dark:text-white tracking-tight text-balance"
              >
                Da música original à backing track perfeita em 3 passos
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  step: '01',
                  title: 'Envie seu Áudio ou Conecte ao Spotify',
                  desc: 'Faça upload de qualquer arquivo MP3, WAV ou FLAC, ou importe os metadados e capas HD diretamente do catálogo integrado.',
                  badge: 'Upload & Catálogo HD',
                  icon: <CloudLibraryIcon className="w-5 h-5" />,
                },
                {
                  step: '02',
                  title: 'Desconstrução Neural em 6 Faixas',
                  desc: 'O motor Demucs v4 HT-6s separa Vocais, Bateria, Baixo, Guitarra, Piano e Outros preservando a fase e a qualidade de estúdio.',
                  badge: 'Demucs v4 HT-6s',
                  icon: <ScissorsIcon className="w-5 h-5" />,
                },
                {
                  step: '03',
                  title: 'Mixe, Transponha e Pratique ao Vivo',
                  desc: 'Abra o Mixer Multitrack para solar seu instrumento, mudar o tom em semitons, criar Loops A-B e acompanhar a letra sincronizada.',
                  badge: 'DAW Studio no Browser',
                  icon: <MixerFadersIcon className="w-5 h-5" />,
                },
              ].map(({ step, title, desc, badge, icon }) => (
                <div
                  key={step}
                  className="rounded-3xl p-2 bg-white/75 dark:bg-slate-900/75 border border-slate-200/90 dark:border-slate-800 shadow-lg"
                >
                  <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/80 p-6 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center">
                          {icon}
                        </div>
                        <span className="text-2xl font-black text-slate-200 dark:text-slate-800 tabular-nums">
                          {step}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight text-balance">
                        {title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed text-pretty">
                        {desc}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[11px] font-extrabold text-[var(--color-brand-medium)] dark:text-blue-400">
                        ● {badge}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 5: SELETOR POR INSTRUMENTO (PERSONAS) & FLUXO EM 3 ETAPAS      */}
          {/* ------------------------------------------------------------------- */}
          <section
            id="personas"
            ref={personasRef}
            aria-labelledby="personas-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
          >
            <div
              className={`rounded-3xl p-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xl studio-card-transition ${
                personasInView || prefersReducedMotion
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800/80 p-6 sm:p-10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--color-brand-medium)] dark:text-blue-400 uppercase tracking-wider">
                      <GuitarIcon className="w-4 h-4" />
                      FEITO PARA A SUA ROTINA DE PRÁTICA
                    </span>
                    <h2
                      id="personas-heading"
                      className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] dark:text-white tracking-tight mt-1 text-balance"
                    >
                      Como cada músico utiliza o EasyCovers Studio
                    </h2>
                  </div>

                  {/* Abas de Seleção de Instrumento / Persona */}
                  <div
                    role="tablist"
                    aria-label="Perfis de músicos"
                    className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl"
                  >
                    {MUSICIAN_PERSONAS.map((persona) => {
                      const active = activePersona === persona.id;
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setActivePersona(persona.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-black studio-btn-transition cursor-pointer ${
                            active
                              ? 'bg-white dark:bg-slate-800 text-[var(--color-brand-medium)] dark:text-blue-400 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {persona.role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conteúdo da Persona Ativa */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-7">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
                      {currentPersonaDetail.headline}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed text-pretty">
                      {currentPersonaDetail.summary}
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => openAuthModal(true)}
                        className="px-5 py-3 rounded-xl bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white text-xs sm:text-sm font-black studio-btn-transition active:scale-95 cursor-pointer"
                      >
                        Configurar Meu Perfil de Músico →
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Setup Recomendado no Mixer:
                    </span>
                    {currentPersonaDetail.recipe.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/80 text-xs"
                      >
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {item.stem}
                        </span>
                        <span className={`font-black ${item.color}`}>
                          {item.state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------------- */}
          {/* SEÇÃO 6: CTA FINAL DE CONVERSÃO & RODAPÉ COMPLETO                   */}
          {/* ------------------------------------------------------------------- */}
          <section
            aria-labelledby="final-cta-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16"
          >
            <div className="rounded-3xl p-2 bg-gradient-to-r from-[var(--color-brand-medium)] via-indigo-600 to-blue-900 dark:from-blue-600 dark:via-indigo-600 dark:to-purple-900 shadow-2xl">
              <div className="rounded-2xl bg-[#0B1536]/95 dark:bg-[#070D1D]/95 px-6 py-10 sm:p-12 text-center text-white relative overflow-hidden">
                <div className="max-w-2xl mx-auto space-y-5 relative z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/10 text-blue-200 border border-white/15">
                    <SparklesIcon className="w-3.5 h-3.5" />
                    PRONTO PARA ENSAIAR EM ALTO NÍVEL?
                  </span>
                  <h2
                    id="final-cta-heading"
                    className="text-2xl sm:text-4xl font-black tracking-tight text-balance"
                  >
                    Sua banda completa disponível 24h por dia no navegador.
                  </h2>
                  <p className="text-blue-100/85 text-sm sm:text-base text-pretty">
                    Crie sua conta gratuita agora, faça upload das suas músicas favoritas e
                    comece a isolar instrumentos em segundos.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal(true)}
                      className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white hover:bg-blue-50 text-[#0E1F4C] dark:bg-gradient-to-r dark:from-blue-600 dark:via-[var(--color-brand-medium)] dark:to-indigo-600 dark:hover:from-blue-500 dark:hover:to-indigo-500 dark:text-white dark:border dark:border-blue-400/30 text-sm sm:text-base font-black shadow-lg dark:shadow-xl dark:shadow-blue-500/30 studio-btn-transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 group"
                    >
                      <span>Criar Conta Gratuita Agora</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthModal(false)}
                      className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm sm:text-base font-bold studio-btn-transition active:scale-95 cursor-pointer"
                    >
                      Já tenho conta • Entrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Rodapé Semântico */}
          <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#050914]/90 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/logo_symbol.png"
                  alt=""
                  aria-hidden="true"
                  className="w-6 h-6 object-contain"
                />
                <span className="font-black text-slate-800 dark:text-slate-200">
                  EasyCovers Studio
                </span>
                <span>•</span>
                <span>Inteligência Artificial para Músicos</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Motor Demucs HT-6s Online
                </span>
                <span>© {new Date().getFullYear()} EasyCovers</span>
              </div>
            </div>
          </footer>
        </main>
      ) : (
        /* ========================================================================= */
        /* MODO 2: FORMULÁRIO DE LOGIN, CADASTRO E VERIFICAÇÃO OTP DE 6 DÍGITOS       */
        /* ========================================================================= */
        <main className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 md:p-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            className="w-full max-w-md rounded-3xl p-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-2xl backdrop-blur-xl animate-fade-in-scale"
          >
            <div className="rounded-2xl bg-white dark:bg-[#0B1325] border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
              {showVerification ? (
                /* ========================================================================= */
                /* ETAPA 2.1: TELA DE VERIFICAÇÃO DE E-MAIL (OTP 6 DÍGITOS)                  */
                /* ========================================================================= */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerification(false);
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        className="w-3.5 h-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                        />
                      </svg>
                      <span>Voltar / Corrigir dados</span>
                    </button>

                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Etapa 2 de 2
                    </span>
                  </div>

                  <div className="text-center mb-5">
                    <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-[var(--color-brand-medium)] dark:text-blue-400 shadow-xs">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.8"
                        stroke="currentColor"
                        className="w-7 h-7"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                        />
                      </svg>
                    </div>
                    <h2
                      id="auth-dialog-title"
                      className="text-2xl font-black text-[var(--color-brand-deep)] dark:text-slate-100 tracking-tight"
                    >
                      Verifique seu e-mail
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 font-medium leading-relaxed">
                      Enviamos um código de segurança de 6 dígitos para:
                    </p>
                    <div className="mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-lg inline-block border border-slate-200/80 dark:border-slate-700 break-all">
                      {verificationEmail}
                    </div>
                  </div>

                  {successMessage && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-medium flex items-start gap-2 animate-fade-in-scale"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="flex-1 leading-relaxed">{successMessage}</span>
                      <button
                        type="button"
                        onClick={() => setSuccessMessage('')}
                        className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-200"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {errorMessage && (
                    <div
                      role="alert"
                      className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium flex items-start gap-2 animate-fade-in-scale"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="flex-1 leading-relaxed">{errorMessage}</span>
                      <button
                        type="button"
                        onClick={() => setErrorMessage('')}
                        className="text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
                    <div className="flex justify-center gap-2 sm:gap-2.5 my-3">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          aria-label={`Dígito ${idx + 1} do código de verificação`}
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(e.target.value, idx)}
                          onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                          onPaste={handleOtpPaste}
                          className="w-10 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-black rounded-xl bg-slate-50/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-850 focus:border-[var(--color-brand-medium)] dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none transition-all shadow-xs tabular-nums"
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs my-1 px-1 tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">
                        Não recebeu o código?
                      </span>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isResending}
                        onClick={handleResendCode}
                        className={`font-black transition-colors ${
                          resendCooldown > 0 || isResending
                            ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                            : 'text-[var(--color-brand-medium)] dark:text-blue-400 hover:text-[var(--color-brand-dark)] dark:hover:text-blue-300 hover:underline cursor-pointer'
                        }`}
                      >
                        {isResending
                          ? 'Enviando...'
                          : resendCooldown > 0
                          ? `Reenviar em 00:${
                              resendCooldown < 10 ? '0' : ''
                            }${resendCooldown}`
                          : 'Reenviar código'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifying || otpDigits.join('').length < 6}
                      className="w-full mt-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white py-3 px-4 rounded-xl text-sm font-black studio-btn-transition shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isVerifying ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Confirmando...</span>
                        </>
                      ) : (
                        <span>Confirmar e Entrar</span>
                      )}
                    </button>
                  </form>

                  <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    Não encontrou na caixa de entrada? Verifique também a pasta de{' '}
                    <strong>spam</strong> ou <strong>lixo eletrônico</strong>.
                  </p>
                </div>
              ) : (
                /* ========================================================================= */
                /* ETAPA 2.2: FORMULÁRIO DE LOGIN E CADASTRO PADRÃO                          */
                /* ========================================================================= */
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAuthForm(false);
                        setErrorMessage('');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        className="w-3.5 h-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                        />
                      </svg>
                      <span>Voltar para a Landing Page</span>
                    </button>

                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      EasyCovers Auth
                    </span>
                  </div>

                  {/* Contexto da faixa escolhida na Landing Page (se houver) */}
                  {selectedShowcaseTrack && (
                    <div className="mb-4 p-2.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/70 flex items-center gap-3">
                      <img
                        src={
                          selectedShowcaseTrack.cover ||
                          '/assets/genres/genre_rock.jpg'
                        }
                        alt=""
                        aria-hidden="true"
                        className="w-10 h-10 rounded-lg object-cover shrink-0 studio-img-outline"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-extrabold uppercase text-[var(--color-brand-medium)] dark:text-blue-400">
                          Faixa selecionada para estúdio:
                        </span>
                        <span className="block text-xs font-black text-slate-900 dark:text-white truncate">
                          {selectedShowcaseTrack.title} — {selectedShowcaseTrack.artist}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Cabeçalho do Card */}
                  <div className="text-center mb-5">
                    <img
                      src="/assets/logo_symbol.png"
                      alt="EasyCovers Logo"
                      className="mx-auto w-14 h-14 object-contain drop-shadow-sm mb-2"
                    />
                    <h2
                      id="auth-dialog-title"
                      className="text-2xl font-black text-[var(--color-brand-deep)] dark:text-slate-100 tracking-tight"
                    >
                      {isRegistering
                        ? 'Crie sua conta gratuita'
                        : 'Bem-vindo de volta'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">
                      {isRegistering
                        ? 'Junte-se à comunidade de músicos e comece a isolar suas faixas'
                        : 'Acesse seu estúdio multitrack e continue de onde parou'}
                    </p>
                  </div>

                  {/* Seletor de Modo (Abas de Login / Cadastro) */}
                  <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center mb-5">
                    <button
                      type="button"
                      onClick={() => toggleMode(false)}
                      className={`flex-1 py-2 text-xs font-black rounded-lg studio-btn-transition cursor-pointer ${
                        !isRegistering
                          ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-deep)] dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMode(true)}
                      className={`flex-1 py-2 text-xs font-black rounded-lg studio-btn-transition cursor-pointer ${
                        isRegistering
                          ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-deep)] dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      Cadastrar
                    </button>
                  </div>

                  {/* Alerta de Erro Inline */}
                  {errorMessage && (
                    <div
                      role="alert"
                      className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium flex items-start gap-2 animate-fade-in-scale"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="flex-1 leading-relaxed">{errorMessage}</span>
                      <button
                        type="button"
                        onClick={() => setErrorMessage('')}
                        className="text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        aria-label="Fechar mensagem de erro"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Formulário Principal */}
                  <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
                    {isRegistering && (
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="auth-username"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1"
                        >
                          Nome de Usuário
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.8"
                              stroke="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                              />
                            </svg>
                          </span>
                          <input
                            id="auth-username"
                            type="text"
                            placeholder="ex: lucas_guitar"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-850 focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="auth-email"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1"
                      >
                        E-mail
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.8"
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                            />
                          </svg>
                        </span>
                        <input
                          id="auth-email"
                          type="email"
                          placeholder="seu.email@exemplo.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-850 focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="auth-password"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1"
                      >
                        Senha
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.8"
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                            />
                          </svg>
                        </span>
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder={
                            isRegistering
                              ? 'Crie uma senha forte'
                              : 'Insira sua senha'
                          }
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-850 focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                          aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showPassword ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.8"
                              stroke="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.8"
                              stroke="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {isRegistering && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor="auth-confirm-password"
                            className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1"
                          >
                            Confirmar Senha
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.8"
                                stroke="currentColor"
                                className="w-4 h-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                              </svg>
                            </span>
                            <input
                              id="auth-confirm-password"
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Repita sua senha"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-850 focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                              required
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                              aria-label={
                                showConfirmPassword
                                  ? 'Ocultar confirmação'
                                  : 'Ver confirmação'
                              }
                            >
                              {showConfirmPassword ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="1.8"
                                  stroke="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="1.8"
                                  stroke="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-[11px] flex flex-col gap-1 text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                            Critérios de segurança da senha:
                          </span>
                          <div className="grid grid-cols-2 gap-1">
                            <span
                              className={`flex items-center gap-1 ${
                                passLengthMet
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : ''
                              }`}
                            >
                              {passLengthMet ? '✓' : '•'} 8+ caracteres
                            </span>
                            <span
                              className={`flex items-center gap-1 ${
                                passUpperMet
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : ''
                              }`}
                            >
                              {passUpperMet ? '✓' : '•'} Letra maiúscula
                            </span>
                            <span
                              className={`flex items-center gap-1 ${
                                passNumberMet
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : ''
                              }`}
                            >
                              {passNumberMet ? '✓' : '•'} Pelo menos 1 número
                            </span>
                            <span
                              className={`flex items-center gap-1 ${
                                passMatchMet
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : ''
                              }`}
                            >
                              {passMatchMet ? '✓' : '•'} Senhas coincidem
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white py-3 px-4 rounded-xl text-sm font-black studio-btn-transition shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <span>
                          {isRegistering
                            ? 'Criar Minha Conta'
                            : 'Entrar no Studio'}
                        </span>
                      )}
                    </button>
                  </form>

                  {/* Divisor Visual */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-[#0B1325] px-2 text-slate-400 dark:text-slate-500 font-bold tracking-wider text-[10px]">
                        ou continue com
                      </span>
                    </div>
                  </div>

                  {/* Botão Oficial do Google Sign-In SDK */}
                  <div className="flex flex-col gap-2 items-center">
                    {originWarning && (
                      <div className="w-full p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-xl text-[11px] font-medium text-center leading-relaxed">
                        {originWarning}{' '}
                        <a
                          href="http://localhost:5173"
                          className="underline font-bold hover:text-amber-900 dark:hover:text-amber-200"
                        >
                          Abrir em localhost:5173
                        </a>
                      </div>
                    )}

                    <div
                      id="googleSignInDiv"
                      className="w-full min-h-[44px] flex justify-center items-center"
                    ></div>

                    {googleSdkError && (
                      <div className="w-full p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex flex-col items-center gap-2 text-center">
                        <span>
                          Não foi possível carregar o botão do Google. Verifique sua
                          conexão ou se algum bloqueador de anúncios está bloqueando{' '}
                          <strong>accounts.google.com</strong>.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setGoogleSdkError(false);
                            const existing =
                              document.getElementById('google-gsi-script');
                            if (existing) existing.remove();
                            googleInitialized.current = false;
                            const s = document.createElement('script');
                            s.id = 'google-gsi-script';
                            s.src = 'https://accounts.google.com/gsi/client';
                            s.async = true;
                            s.defer = true;
                            s.onload = () => initAndRenderGoogle();
                            s.onerror = () => setGoogleSdkError(true);
                            document.body.appendChild(s);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Tentar carregar Google novamente
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Alternador de Modo no Rodapé */}
                  <div className="text-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => toggleMode(!isRegistering)}
                      className="text-xs text-[var(--color-brand-medium)] dark:text-blue-400 hover:text-[var(--color-brand-dark)] dark:hover:text-blue-300 hover:underline font-bold transition-colors cursor-pointer"
                    >
                      {isRegistering
                        ? 'Já tem uma conta no EasyCovers? Faça login'
                        : 'Não tem uma conta? Cadastre-se gratuitamente'}
                    </button>
                  </div>

                  <footer className="mt-3 text-center text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                    Ao continuar, você concorda com nossos Termos de Uso e Política
                    de Privacidade.
                  </footer>
                </>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default Login;
