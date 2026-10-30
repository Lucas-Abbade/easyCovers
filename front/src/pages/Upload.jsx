import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AudioProcessingScreen from '../components/AudioProcessingScreen';
import ThemeToggle from '../components/ThemeToggle';
import SpotifyOnboardingModal from '../components/SpotifyOnboardingModal';
import DashboardStudioBackground from '../components/DashboardStudioBackground';
import UploadStudioIntakeRack from '../components/UploadStudioIntakeRack';
import StudioTiltCard from '../components/StudioTiltCard';
import { SpotifyIcon } from '../components/Icons';
import { AVAILABLE_GENRES, getGenreImage } from '../utils/genreImages';
import {
  useScrollVariable,
  useDocumentVisibility,
} from '../utils/motionTokens';

const keyOptions = [
  "Unknown",
  "C", "Cm",
  "C#", "C#m",
  "D", "Dm",
  "D#", "D#m",
  "E", "Em",
  "F", "Fm",
  "F#", "F#m",
  "G", "Gm",
  "G#", "G#m",
  "A", "Am",
  "A#", "A#m",
  "B", "Bm",
];

// 6 Pads 3D de Instrumento ("3D Instrument Focus Pads")
const INSTRUMENT_PADS_3D = [
  {
    id: 'Guitarra',
    label: 'Guitarra',
    sub: 'LEAD / RHYTHM',
    img: '/assets/parallax/instrument_guitar.png',
    activeBorder: 'border-blue-500 dark:border-blue-400 bg-blue-50/90 dark:bg-blue-950/60 shadow-sm ring-1 ring-blue-500/30',
    ledColor: 'bg-blue-500 shadow-[0_0_8px_#3b82f6]',
    badgeColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'Violão',
    label: 'Violão',
    sub: 'ACOUSTIC',
    img: '/assets/parallax/instrument_guitar.png',
    activeBorder: 'border-amber-500 dark:border-amber-400 bg-amber-50/90 dark:bg-amber-950/60 shadow-sm ring-1 ring-amber-500/30',
    ledColor: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
    badgeColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'Baixo',
    label: 'Baixo',
    sub: 'SUB GROOVE',
    img: '/assets/parallax/instrument_bass.png',
    activeBorder: 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/60 shadow-sm ring-1 ring-emerald-500/30',
    ledColor: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
    badgeColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'Bateria',
    label: 'Bateria',
    sub: 'TRANSIENTS',
    img: '/assets/parallax/instrument_drums.png',
    activeBorder: 'border-orange-500 dark:border-orange-400 bg-orange-50/90 dark:bg-orange-950/60 shadow-sm ring-1 ring-orange-500/30',
    ledColor: 'bg-orange-500 shadow-[0_0_8px_#f97316]',
    badgeColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'Voz',
    label: 'Voz',
    sub: '+48V VOCAL',
    img: '/assets/parallax/studio_condenser_mic.png',
    activeBorder: 'border-purple-500 dark:border-purple-400 bg-purple-50/90 dark:bg-purple-950/60 shadow-sm ring-1 ring-purple-500/30',
    ledColor: 'bg-purple-500 shadow-[0_0_8px_#a855f7]',
    badgeColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'Teclado',
    label: 'Teclado',
    sub: 'SYNTH / KEYS',
    img: '/assets/parallax/instrument_mic_keys.png',
    activeBorder: 'border-pink-500 dark:border-pink-400 bg-pink-50/90 dark:bg-pink-950/60 shadow-sm ring-1 ring-pink-500/30',
    ledColor: 'bg-pink-500 shadow-[0_0_8px_#ec4899]',
    badgeColor: 'text-pink-600 dark:text-pink-400',
  },
];

const Upload = ({ onAddSong, user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const uploadRootRef = useRef(null);
  useScrollVariable(uploadRootRef);
  const isTabVisible = useDocumentVisibility();

  const [uploadForm, setUploadForm] = useState({ 
    name: '', 
    artist: '', 
    genre: '', 
    instrument: 'Guitarra', 
    original_key: 'Unknown' 
  });
  const [audioFile, setAudioFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Estados interativos do Hardware 3D / Sala de Captação do Estúdio
  const [studioLiveMode, setStudioLiveMode] = useState(true);
  const [phantomPower, setPhantomPower] = useState(true);
  const [hoveredTrack, setHoveredTrack] = useState(null);

  // Estados da integração Principal com Catálogo Deezer / Spotify
  const [selectedCatalogTrack, setSelectedCatalogTrack] = useState(null);
  const [selectedCover, setSelectedCover] = useState('');
  const [isFetchingTrackDetails, setIsFetchingTrackDetails] = useState(false);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [activePreviewId, setActivePreviewId] = useState(null);
  const [showAlternativeMethods, setShowAlternativeMethods] = useState(false);
  const previewAudioRef = useRef(null);

  // Estados de importação direta da conta Spotify do usuário
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [showSpotifyPicker, setShowSpotifyPicker] = useState(false);
  const [showSpotifyConnectModal, setShowSpotifyConnectModal] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [selectedSpotifyPl, setSelectedSpotifyPl] = useState(null);
  const [spotifyTracks, setSpotifyTracks] = useState([]);
  const [spotifyLikedTracks, setSpotifyLikedTracks] = useState([]);
  const [spotifyTab, setSpotifyTab] = useState('playlists'); // 'playlists' | 'liked'
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [spotifyImportUrl, setSpotifyImportUrl] = useState('');
  const [importingSpotifyUrl, setImportingSpotifyUrl] = useState(false);

  // Estados da tela de processamento unificada
  const [processingState, setProcessingState] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSongInfo, setActiveSongInfo] = useState(null);
  const [processedSong, setProcessedSong] = useState(null);

  const progressIntervalRef = useRef(null);
  const lastSourceRef = useRef(null); // 'catalog' | 'file' | 'youtube'

  const formatDuration = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Limpeza de áudio preview ao desmontar
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Prevenção de fechamento acidental da aba durante o processamento
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (processingState === 'processing') {
        e.preventDefault();
        e.returnValue = "O processamento de áudio ainda está em andamento. Tem certeza que deseja sair?";
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [processingState]);

  // Limpa o timer de progresso
  const clearProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Inicia a progressão dinâmica e realista de etapas enquanto a requisição HTTP ocorre
  const startProgressSimulation = () => {
    clearProgressTimer();
    setProgress(3);
    setCurrentStage(1);

    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;

      setProgress((prev) => {
        let next = prev;

        // Etapa 1: Aquisição do áudio (0s a 6s) -> 3% a 22%
        if (elapsed < 6) {
          setCurrentStage(1);
          next = 3 + (elapsed / 6) * 19;
        }
        // Etapa 2: Normalização acústica EBU R128 (6s a 14s) -> 22% a 38%
        else if (elapsed < 14) {
          setCurrentStage(2);
          next = 22 + ((elapsed - 6) / 8) * 16;
        }
        // Etapa 3: Separação por IA HTDemucs (14s a 50s) -> 38% a 82%
        else if (elapsed < 50) {
          setCurrentStage(3);
          next = 38 + ((elapsed - 14) / 36) * 44;
        }
        // Etapa 4: Renderização de stems WAV (50s a 80s) -> 82% a 92%
        else if (elapsed < 80) {
          setCurrentStage(4);
          next = 82 + ((elapsed - 50) / 30) * 10;
        }
        // Aguardando resposta final do servidor (desaceleração assintótica até 94%)
        else {
          setCurrentStage(4);
          next = Math.min(94, prev + 0.1);
        }

        return Math.min(94, next);
      });
    }, 400);
  };

  // Finaliza a barra para 100% ao receber confirmação do servidor
  const completeProgressSuccessfully = useCallback((finalSong) => {
    clearProgressTimer();
    setCurrentStage(5);
    setProgress(100);
    setProcessingState('success');
    setProcessedSong(finalSong);

    // Registra a música no estado global do app
    if (onAddSong && finalSong) {
      onAddSong(finalSong);
    }
  }, [onAddSong]);

  // Manipula falhas de processamento
  const handleProcessingError = (detailMessage) => {
    clearProgressTimer();
    setProcessingState('error');
    setErrorMessage(detailMessage || "Ocorreu uma falha no processamento. Verifique sua conexão e tente novamente.");
  };

  // Funções do Catálogo Global (Deezer)
  const handleSearchCatalog = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!catalogSearchTerm.trim()) return;

    setIsSearchingCatalog(true);
    setCatalogError('');
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setActivePreviewId(null);
    }

    try {
      const response = await fetch(`http://localhost:8000/api/music/search?q=${encodeURIComponent(catalogSearchTerm.trim())}&limit=6`);
      if (response.ok) {
        const data = await response.json();
        setCatalogResults(data.results || []);
        if (!data.results || data.results.length === 0) {
          setCatalogError('Nenhuma música encontrada com este nome no catálogo.');
        }
      } else {
        setCatalogError('Não foi possível consultar o catálogo no momento.');
      }
    } catch (err) {
      console.error("Erro ao pesquisar catálogo:", err);
      setCatalogError('Erro de conexão com o catálogo de música.');
    } finally {
      setIsSearchingCatalog(false);
    }
  };

  const togglePreview = (track) => {
    if (!track?.preview) return;

    if (activePreviewId === track.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setActivePreviewId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(track.preview);
      audio.volume = 0.7;
      audio.onended = () => setActivePreviewId(null);
      audio.play().catch(err => console.warn("Erro ao tocar preview:", err));
      previewAudioRef.current = audio;
      setActivePreviewId(track.id);
    }
  };

  const handleSelectCatalogTrack = async (track) => {
    setSelectedCatalogTrack(track);
    setSelectedCover(track.cover || '');
    setUploadForm(prev => ({
      ...prev,
      name: track.title,
      artist: track.artist
    }));

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setActivePreviewId(null);
    }

    // Busca detalhes adicionais da faixa (gênero automático do álbum e preview atualizado)
    if (track.id) {
      setIsFetchingTrackDetails(true);
      try {
        const res = await fetch(`http://localhost:8000/api/music/track/${track.id}`);
        if (res.ok) {
          const details = await res.json();
          if (details.suggested_genre) {
            setUploadForm(prev => ({
              ...prev,
              genre: details.suggested_genre
            }));
          }
          setSelectedCatalogTrack(prev => prev && prev.id === track.id ? {
            ...prev,
            preview: details.preview || prev.preview,
            duration: details.duration || prev.duration
          } : prev);
        }
      } catch (err) {
        console.warn("Não foi possível obter detalhes extras da faixa:", err);
      } finally {
        setIsFetchingTrackDetails(false);
      }
    }
  };

  const handleSelectSpotifyTrack = useCallback(async (spTrack) => {
    if (!spTrack) return;

    const isAuthenticSpotifyCover = Boolean(
      spTrack.cover &&
      (spTrack.cover.includes('scdn.co') || spTrack.cover.includes('spotifycdn.com')) &&
      !spTrack.cover.includes('ab67706c') &&
      !spTrack.cover.includes('ab677570') &&
      !spTrack.cover.includes('mosaic.scdn.co')
    );
    const isPlaylistMosaic = Boolean(
      spTrack.cover &&
      (spTrack.cover.includes('ab67706c') ||
        spTrack.cover.includes('ab677570') ||
        spTrack.cover.includes('mosaic.scdn.co'))
    );
    let lockedSpotifyCover = isAuthenticSpotifyCover
      ? spTrack.cover
      : !isPlaylistMosaic
      ? spTrack.cover || ''
      : '';

    const initialTrack = {
      id: spTrack.id || `sp_${Date.now()}`,
      spotify_id: spTrack.id || '',
      title: spTrack.title,
      artist: spTrack.artist,
      album: spTrack.album || '',
      duration: spTrack.duration || 0,
      cover: lockedSpotifyCover,
      preview: spTrack.preview || '',
      source: 'spotify',
    };

    setSelectedCatalogTrack(initialTrack);
    setSelectedCover(lockedSpotifyCover);
    setUploadForm(prev => ({
      ...prev,
      name: spTrack.title || '',
      artist: spTrack.artist || '',
      genre: spTrack.suggested_genre || prev.genre || 'Rock',
      original_key: (spTrack.original_key && spTrack.original_key !== 'Unknown') ? spTrack.original_key : prev.original_key,
    }));
    setShowSpotifyPicker(false);

    // Enriquecimento de metadados (prévia de 30s e duração) preservando estritamente a capa original do álbum do Spotify
    setIsFetchingTrackDetails(true);
    try {
      // 1. Se a faixa tem ID oficial do Spotify mas estava sem capa oficial do CDN do Spotify, resolve via oEmbed no backend
      if (/^[A-Za-z0-9]{22}$/.test(String(spTrack.id || '')) && !isAuthenticSpotifyCover) {
        try {
          const covRes = await fetch(
            `http://localhost:8000/api/spotify/track-cover/${encodeURIComponent(spTrack.id)}?title=${encodeURIComponent(spTrack.title || '')}&artist=${encodeURIComponent(spTrack.artist || '')}`
          );
          if (covRes.ok) {
            const covData = await covRes.json();
            if (covData?.cover) {
              lockedSpotifyCover = covData.cover;
              setSelectedCover(lockedSpotifyCover);
              setSelectedCatalogTrack(prev => prev ? { ...prev, cover: lockedSpotifyCover } : prev);
              setSpotifyTracks(prev => prev.map(t => t.id === spTrack.id ? { ...t, cover: lockedSpotifyCover } : t));
              setSpotifyLikedTracks(prev => prev.map(t => t.id === spTrack.id ? { ...t, cover: lockedSpotifyCover } : t));
            }
          }
        } catch {
          // Mantém a capa atual caso o endpoint auxiliar não responda
        }
      }

      // 2. Busca prévia de 30s / duração complementar sem NUNCA sobrescrever a capa original do álbum do Spotify
      const q = `${spTrack.title} ${spTrack.artist}`;
      const res = await fetch(`http://localhost:8000/api/music/search?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const candidates = data.results || [];
        const spIsLive = /\b(live|ao vivo)\b/i.test(spTrack.title || '');
        const normArtist = (spTrack.artist || '').split(',')[0].trim().toLowerCase();
        const match =
          candidates.find(c => {
            const cArtist = (c.artist || '').toLowerCase();
            const cIsLive = /\b(live|ao vivo)\b/i.test(`${c.title || ''} ${c.album || ''}`);
            return (!normArtist || cArtist.includes(normArtist) || normArtist.includes(cArtist)) && cIsLive === spIsLive;
          }) ||
          candidates.find(c => {
            const cArtist = (c.artist || '').toLowerCase();
            return !normArtist || cArtist.includes(normArtist) || normArtist.includes(cArtist);
          }) ||
          candidates[0];

        if (match) {
          const preservedCover = lockedSpotifyCover || match.cover || '';
          setSelectedCover(preservedCover);
          setSelectedCatalogTrack(prev => prev ? {
            ...prev,
            deezer_id: match.id || prev.deezer_id,
            duration: prev.duration || match.duration || 0,
            album: prev.album || match.album || '',
            cover: lockedSpotifyCover || prev.cover || match.cover || '',
            preview: prev.preview || match.preview || '',
          } : prev);
        }
      }
    } catch (err) {
      console.warn("Aviso ao enriquecer metadados da faixa Spotify:", err);
    } finally {
      setIsFetchingTrackDetails(false);
    }
  }, []);

  // Carrega status de conexão Spotify do usuário e pré-seleciona música caso venha do Perfil em 1 clique
  useEffect(() => {
    if (location.state?.spotifyTrack) {
      handleSelectSpotifyTrack(location.state.spotifyTrack);
    }
  }, [location.state, handleSelectSpotifyTrack]);

  const loadSpotifyLibrary = useCallback(async () => {
    if (!user?.id) return;
    setLoadingSpotify(true);
    try {
      const [plRes, likedRes] = await Promise.all([
        fetch(`http://localhost:8000/api/spotify/playlists/${user.id}`),
        fetch(`http://localhost:8000/api/spotify/liked-tracks/${user.id}`),
      ]);
      if (plRes.ok) {
        const plData = await plRes.json();
        setSpotifyPlaylists(plData.playlists || []);
      }
      if (likedRes.ok) {
        const likedData = await likedRes.json();
        setSpotifyLikedTracks(likedData.tracks || []);
      }
    } catch (err) {
      console.error("Erro ao carregar biblioteca Spotify no Upload:", err);
    } finally {
      setLoadingSpotify(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`http://localhost:8000/profile/${user.id}`)
      .then(r => r.json())
      .then(d => {
        const isConn = Boolean(d?.spotify_connection?.connected);
        setSpotifyConnected(isConn);
        const params = new URLSearchParams(location.search);
        if (params.get('spotify') === 'connected') {
          setSpotifyConnected(true);
          setShowSpotifyPicker(true);
          loadSpotifyLibrary();
          window.history.replaceState({}, document.title, location.pathname);
        }
      })
      .catch(() => {});
  }, [user?.id, location.search, location.pathname, loadSpotifyLibrary]);

  const handleToggleSpotifyPicker = () => {
    if (!spotifyConnected) {
      setShowSpotifyConnectModal(true);
      return;
    }
    const next = !showSpotifyPicker;
    setShowSpotifyPicker(next);
    if (next && spotifyPlaylists.length === 0) {
      loadSpotifyLibrary();
    }
  };

  const handleOpenSpotifyPlaylistInUpload = async (pl) => {
    setSelectedSpotifyPl(pl);
    setLoadingSpotify(true);
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/playlists/${user.id}/${pl.id}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setSpotifyTracks(data.tracks || []);
      }
    } catch (err) {
      console.error("Erro ao abrir playlist no upload:", err);
    } finally {
      setLoadingSpotify(false);
    }
  };

  const handleImportSpotifyLinkInUpload = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!spotifyImportUrl.trim() || !user?.id) return;
    setImportingSpotifyUrl(true);
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/import-playlist/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url: spotifyImportUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        setSpotifyImportUrl('');
        setSpotifyConnected(true);
        await loadSpotifyLibrary();
        handleOpenSpotifyPlaylistInUpload(data.playlist);
      } else {
        alert(data.detail || 'Não foi possível importar este link do Spotify.');
      }
    } catch (err) {
      console.error("Erro ao importar link do Spotify no Upload:", err);
    } finally {
      setImportingSpotifyUrl(false);
    }
  };

  const handleClearSelectedTrack = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setActivePreviewId(null);
    }
    setSelectedCatalogTrack(null);
    setSelectedCover('');
    setUploadForm(prev => ({ ...prev, name: '', artist: '' }));
  };

  // Drag & Drop real para a Dropzone 3D Magnética
  const handleFileSelected = (file) => {
    if (!file) return;
    setAudioFile(file);
    const cleanFileName = file.name.replace(/\.[^/.]+$/, '');
    setUploadForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : cleanFileName,
      artist: prev.artist.trim() ? prev.artist : 'Arquivo Local',
      genre: prev.genre || 'Rock',
    }));
  };

  const handleDragOverFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleDragLeaveFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      handleFileSelected(droppedFile);
    }
  };

  // 1. FLUXO PRINCIPAL: Separação Direta pelo Catálogo Deezer
  const handleCatalogUpload = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedCatalogTrack) {
      alert("Pesquise e selecione uma música no catálogo Deezer ou Spotify para continuar!");
      return;
    }

    if (!uploadForm.name.trim() || !uploadForm.artist.trim() || !uploadForm.genre) {
      alert("Por favor, verifique o nome da música, artista e selecione um gênero musical!");
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setActivePreviewId(null);
    }

    lastSourceRef.current = 'catalog';
    setActiveSongInfo({
      name: uploadForm.name.trim(),
      artist: uploadForm.artist.trim(),
      genre: uploadForm.genre,
      instrument: uploadForm.instrument,
      original_key: uploadForm.original_key,
      sourceType: 'catalog',
      sourceDetail: selectedCatalogTrack.title,
      cover_image_url: selectedCover || selectedCatalogTrack.cover || null
    });

    setProcessingState('processing');
    startProgressSimulation('catalog');

    try {
      const response = await fetch("http://localhost:8000/upload-catalog/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deezer_track_id: selectedCatalogTrack.id,
          title: uploadForm.name.trim(),
          artist: uploadForm.artist.trim(),
          duration: selectedCatalogTrack.duration || 0,
          cover_image_url: selectedCover || selectedCatalogTrack.cover || undefined,
          genre: uploadForm.genre,
          instrument: uploadForm.instrument,
          original_key: uploadForm.original_key,
          user_id: user.id
        }),
      });

      if (response.ok) {
        const newSong = await response.json();
        const standardizedSong = {
          ...newSong,
          folder: newSong.folder_path || newSong.folder,
          folder_path: newSong.folder_path || newSong.folder,
          cover_image_url: newSong.cover_image_url || selectedCover || selectedCatalogTrack.cover || null
        };
        completeProgressSuccessfully(standardizedSong);
      } else {
        const errorData = await response.json().catch(() => ({}));
        handleProcessingError(errorData.detail || "Erro ao obter ou separar o áudio pelo catálogo.");
      }
    } catch (error) {
      console.error("Erro no processamento via catálogo:", error);
      handleProcessingError("Falha na conexão com o servidor ao processar música do catálogo.");
    }
  };

  // 2. Processamento Alternativo Manual: Upload de Arquivo Local (usa imagem do estilo musical)
  const handleUploadSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!uploadForm.name.trim() || !uploadForm.artist.trim() || !uploadForm.genre) {
      alert("Por favor, preencha o nome da música, artista e escolha um gênero no painel de calibração!");
      return;
    }

    if (!audioFile) {
      alert("Por favor, selecione um arquivo de áudio (.mp3, .wav, .flac)!");
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setActivePreviewId(null);
    }

    lastSourceRef.current = 'file';
    setActiveSongInfo({
      name: uploadForm.name,
      artist: uploadForm.artist,
      genre: uploadForm.genre,
      instrument: uploadForm.instrument,
      original_key: uploadForm.original_key,
      sourceType: 'file',
      sourceDetail: audioFile.name,
      cover_image_url: null
    });

    setProcessingState('processing');
    startProgressSimulation('file');

    const formData = new FormData();
    formData.append("file", audioFile);

    try {
      const searchParams = {
        name: uploadForm.name,
        artist: uploadForm.artist,
        genre: uploadForm.genre,
        instrument: uploadForm.instrument,
        original_key: uploadForm.original_key,
        user_id: user.id
      };
      const params = new URLSearchParams(searchParams).toString();

      const response = await fetch(`http://localhost:8000/processar-audio/?${params}`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const createdSong = {
          id: data.id,
          name: uploadForm.name,
          artist: uploadForm.artist,
          genre: uploadForm.genre,
          instrument: uploadForm.instrument,
          original_key: uploadForm.original_key,
          folder: data.folder,
          folder_path: data.folder,
          cover_image_url: null
        };
        completeProgressSuccessfully(createdSong);
      } else {
        const errorData = await response.json().catch(() => ({}));
        handleProcessingError(errorData.detail || "Não foi possível separar as faixas do arquivo de áudio.");
      }
    } catch (error) {
      console.error("Erro no envio:", error);
      handleProcessingError("Falha na conexão com o servidor EasyCovers. O backend Python está em execução?");
    }
  };

  // 3. Processamento Alternativo Manual: Link do YouTube (usa imagem do estilo musical)
  const handleYoutubeUpload = async () => {
    if (!youtubeUrl.trim()) {
      alert("Por favor, cole um link do YouTube!");
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setActivePreviewId(null);
    }

    lastSourceRef.current = 'youtube';
    const fallbackTitle = uploadForm.name.trim() || "Música do YouTube";
    const fallbackArtist = uploadForm.artist.trim() || "YouTube";

    setActiveSongInfo({
      name: fallbackTitle,
      artist: fallbackArtist,
      genre: uploadForm.genre || "Gênero Geral",
      instrument: uploadForm.instrument,
      original_key: uploadForm.original_key,
      sourceType: 'youtube',
      sourceDetail: youtubeUrl,
      cover_image_url: null
    });

    setProcessingState('processing');
    startProgressSimulation('youtube');

    try {
      const cleanUrl = youtubeUrl.trim().split('&')[0];
      const response = await fetch("http://localhost:8000/upload-youtube/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanUrl,
          user_id: user.id,
          custom_title: uploadForm.name.trim() || undefined,
          custom_artist: uploadForm.artist.trim() || undefined,
          custom_genre: uploadForm.genre || undefined,
          custom_instrument: uploadForm.instrument,
          custom_original_key: uploadForm.original_key
        }),
      });

      if (response.ok) {
        const newSong = await response.json();
        const standardizedSong = {
          ...newSong,
          folder: newSong.folder_path || newSong.folder,
          folder_path: newSong.folder_path || newSong.folder,
          cover_image_url: null
        };
        completeProgressSuccessfully(standardizedSong);
      } else {
        const errorData = await response.json().catch(() => ({}));
        handleProcessingError(errorData.detail || "Erro ao baixar ou processar o áudio do YouTube.");
      }
    } catch (error) {
      console.error("Erro no YouTube:", error);
      handleProcessingError("Falha na conexão com o servidor ao processar o YouTube.");
    }
  };

  // Ações de Conclusão / Redirecionamento
  const handleOpenMixer = () => {
    if (processedSong) {
      navigate('/mixer', { state: { song: processedSong } });
    } else {
      navigate('/dashboard');
    }
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleCancelAndEdit = () => {
    clearProgressTimer();
    setProcessingState('idle');
  };

  const handleRetry = () => {
    if (lastSourceRef.current === 'catalog') {
      handleCatalogUpload();
    } else if (lastSourceRef.current === 'youtube') {
      handleYoutubeUpload();
    } else {
      handleUploadSubmit();
    }
  };

  // Se o estado for processando, concluído ou erro, renderiza a tela unificada de processamento 3D!
  if (processingState !== 'idle') {
    return (
      <AudioProcessingScreen
        songInfo={activeSongInfo}
        currentStage={currentStage}
        progress={progress}
        status={processingState}
        errorMessage={errorMessage}
        onRetry={handleRetry}
        onCancel={handleCancelAndEdit}
        onOpenMixer={handleOpenMixer}
        onGoToDashboard={handleGoToDashboard}
      />
    );
  }

  // Objeto unificado para alimentar a telemetria do background 3D
  const backgroundFocusSignal = hoveredTrack
    ? {
        name: hoveredTrack.title || hoveredTrack.name,
        genre: uploadForm.genre || 'STUDIO INTAKE',
      }
    : selectedCatalogTrack
    ? {
        name: uploadForm.name || selectedCatalogTrack.title,
        genre: uploadForm.genre || 'MASTER DECK',
      }
    : activePreviewId
    ? {
        name: 'PREVIEW 30S ACTIVE',
        genre: uploadForm.instrument || 'AUDITION',
      }
    : null;

  return (
    <div 
      ref={uploadRootRef}
      className={`font-sans min-h-screen bg-repeat text-slate-800 dark:text-slate-100 selection:bg-[var(--color-brand-medium)] selection:text-white relative overflow-x-hidden ${
        !isTabVisible ? 'animations-paused' : ''
      }`}
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      {/* ========================================================================= */}
      {/* 0. CAMADA PARALLAX 3D DE SALA DE CONTROLE REATIVA AO PREVIEW / CAPTAÇÃO   */}
      {/* ========================================================================= */}
      <DashboardStudioBackground
        studioLiveMode={studioLiveMode || Boolean(activePreviewId)}
        phantomPower={phantomPower}
        hoveredSong={backgroundFocusSignal}
      />

      {/* ========================================================================= */}
      {/* 1. CABEÇALHO STICKY COM GLASSMORPHISM E IDENTIDADE STUDIO                 */}
      {/* ========================================================================= */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4">
          <div 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
            title="EasyCovers - Ir para a Biblioteca"
          >
            <img 
              src="/assets/logo_symbol.png" 
              alt="EasyCovers Logo" 
              className="h-10 w-auto object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[var(--color-brand-deep)] tracking-tight">
                  EasyCovers
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 tracking-wider">
                  Intake Console
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden md:block">
                Bancada de Captação & Isolamento Neural 6-Stems
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <button 
          type="button"
          onClick={() => navigate('/dashboard')} 
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-2 studio-btn-transition active:scale-95 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Voltar para Biblioteca</span>
        </button>
      </header>

      <SpotifyOnboardingModal
        isOpen={showSpotifyConnectModal}
        onClose={() => setShowSpotifyConnectModal(false)}
        userId={user?.id}
        returnTo="/upload"
        onConnectedSuccess={() => {
          setSpotifyConnected(true);
          setShowSpotifyConnectModal(false);
          setShowSpotifyPicker(true);
          loadSpotifyLibrary();
        }}
      />

      {/* ========================================================================= */}
      {/* 2. CONTAINER PRINCIPAL (OPÇÃO A: HERO RACK + GRID 2 COLUNAS MAX-W-6XL)    */}
      {/* ========================================================================= */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* HERO DE CAPTAÇÃO + HARDWARE INTERATIVO DE ESTÚDIO (RACK 2.5D/SVG) */}
        <section className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-lg border border-white/70 dark:border-slate-800/90 mb-8 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-12 w-56 h-56 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Coluna Esquerda do Hero: Identidade da Bancada de Captação */}
          <div className="flex-1 min-w-0 z-10 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activePreviewId
                        ? 'bg-cyan-400 animate-ping'
                        : selectedCatalogTrack || audioFile
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-[var(--color-brand-medium)]'
                    }`}
                  />
                  Sala de Captação • Console de Entrada IA
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                  44.1 kHz / 24-Bit WAV 
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] tracking-tight text-balance">
                Separe sua Música em 6 Faixas de Estúdio
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-1.5 max-w-xl font-normal leading-relaxed text-pretty">
                Pesquise no catálogo global, conecte suas playlists do Spotify ou envie um arquivo master para isolar Voz, Guitarra, Baixo, Bateria, Teclado e Outros com precisão cirúrgica.
              </p>
            </div>

            {/* Indicadores Rápidos de Roteamento Acústico */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>1. Captação Sonora</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">➔</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>2. Foco: {uploadForm.instrument}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">➔</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  <span>6 Stems Lossless</span>
                </span>
              </div>

              {activePreviewId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-extrabold text-[11px] bg-blue-600 text-white shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  MONITORANDO PRÉVIA 30S
                </span>
              )}
            </div>
          </div>

          {/* Coluna Direita do Hero: Rack Hardware 2.5D de Captação */}
          <div className="z-10 flex justify-center lg:justify-end">
            <UploadStudioIntakeRack
              selectedTrack={selectedCatalogTrack}
              hoveredTrack={hoveredTrack}
              isPreviewPlaying={Boolean(activePreviewId)}
              audioFile={audioFile}
              youtubeUrl={youtubeUrl}
              uploadForm={uploadForm}
              keyOptions={keyOptions}
              studioLiveMode={studioLiveMode}
              onToggleStudioLive={() => setStudioLiveMode((v) => !v)}
              phantomPower={phantomPower}
              onTogglePhantomPower={() => setPhantomPower((v) => !v)}
              onSelectInstrument={(inst) =>
                setUploadForm((prev) => ({ ...prev, instrument: inst }))
              }
              onSelectKey={(k) =>
                setUploadForm((prev) => ({ ...prev, original_key: k }))
              }
            />
          </div>
        </section>

        {/* ===================================================================== */}
        {/* GRID ASSIMÉTRICO DE 2 COLUNAS: CAPTAÇÃO (ESQ) + MASTER DECK (DIR)     */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ================================================================= */}
          {/* COLUNA ESQUERDA (lg:col-span-7): ESTÁGIO 1 — CAPTAÇÃO SONORA      */}
          {/* ================================================================= */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* MÓDULO 1A: BUSCA NO CATÁLOGO DEEZER & INTEGRAÇÃO SPOTIFY */}
            <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md relative overflow-hidden">
              {/* Faixa superior de identificação de canal */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white text-xs font-black flex items-center justify-center shadow-xs tabular-nums">
                    01
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-[var(--color-brand-deep)] tracking-tight">
                      Catálogo Musical ou Biblioteca Spotify
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSpotifyPicker}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1DB954] hover:bg-[#18a349] text-white text-xs font-extrabold shadow-xs studio-btn-transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <SpotifyIcon className="w-3.5 h-3.5 text-white" color="#FFFFFF" />
                    <span>
                      {showSpotifyPicker
                        ? 'Fechar Biblioteca Spotify'
                        : spotifyConnected
                        ? 'Importar do meu Spotify'
                        : 'Vincular Spotify & Importar'}
                    </span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 text-pretty">
                Pesquise qualquer música com prévia de 30 segundos na sala de controle ou selecione direto das suas playlists do Spotify.
              </p>

              {/* GAVETA EXPANSÍVEL: BIBLIOTECA SPOTIFY DO USUÁRIO */}
              {showSpotifyPicker && (
                <div className="mb-5 p-4 rounded-2xl bg-slate-50/95 dark:bg-slate-950/90 border-2 border-[#1DB954]/50 shadow-md animate-fade-in-scale">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSpotifyTab('playlists');
                          setSelectedSpotifyPl(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold studio-btn-transition active:scale-95 cursor-pointer tabular-nums ${
                          spotifyTab === 'playlists'
                            ? 'bg-[#1DB954] text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Suas Playlists ({spotifyPlaylists.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSpotifyTab('liked');
                          setSelectedSpotifyPl(null);
                          loadSpotifyLibrary();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold studio-btn-transition active:scale-95 cursor-pointer ${
                          spotifyTab === 'liked'
                            ? 'bg-[#1DB954] text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        ♥ Músicas Curtidas
                      </button>
                    </div>

                    {selectedSpotifyPl && (
                      <button
                        type="button"
                        onClick={() => setSelectedSpotifyPl(null)}
                        className="text-xs font-bold text-[#1DB954] hover:underline cursor-pointer"
                      >
                        ← Voltar para playlists
                      </button>
                    )}
                  </div>

                  {/* Barra para importar qualquer playlist pública do Spotify pelo link direto no Upload */}
                  <div className="mb-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={spotifyImportUrl}
                      onChange={(e) => setSpotifyImportUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleImportSpotifyLinkInUpload(e);
                        }
                      }}
                      placeholder="Ou cole o link de uma Playlist/Música do Spotify (https://open.spotify.com/...)"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
                    />
                    <button
                      type="button"
                      onClick={handleImportSpotifyLinkInUpload}
                      disabled={importingSpotifyUrl || !spotifyImportUrl.trim()}
                      className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#18a349] disabled:opacity-50 text-white text-xs font-extrabold studio-btn-transition active:scale-95 shrink-0 cursor-pointer"
                    >
                      {importingSpotifyUrl ? 'Importando...' : '+ Importar Playlist'}
                    </button>
                  </div>

                  {loadingSpotify ? (
                    <div className="py-6 text-center text-xs font-bold text-slate-500">
                      Carregando sua biblioteca do Spotify...
                    </div>
                  ) : spotifyTab === 'playlists' && !selectedSpotifyPl ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {spotifyPlaylists.map((pl) => (
                        <StudioTiltCard
                          key={pl.id}
                          maxTilt={2.2}
                          hoverScale={1.01}
                        >
                          <div
                            onClick={() => handleOpenSpotifyPlaylistInUpload(pl)}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#1DB954] bg-white dark:bg-slate-900 flex items-center gap-3 cursor-pointer studio-card-transition"
                          >
                            <img
                              src={pl.cover || '/assets/genres/genre_default.jpg'}
                              alt={pl.name}
                              className="w-11 h-11 rounded-lg object-cover shrink-0 studio-img-outline"
                            />
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                {pl.name}
                              </h5>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {pl.tracks_total} faixas
                              </p>
                            </div>
                            <span className="text-xs font-bold text-[#1DB954]">Abrir ➔</span>
                          </div>
                        </StudioTiltCard>
                      ))}
                    </div>
                  ) : spotifyTab === 'liked' && spotifyLikedTracks.length === 0 ? (
                    <div className="py-5 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      Sua lista de <strong>Músicas Curtidas</strong> está vazia. Abra qualquer uma das suas playlists ao lado ou clique no <strong>♥</strong> no seu Perfil para salvar suas favoritas aqui!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {(spotifyTab === 'liked' ? spotifyLikedTracks : spotifyTracks).map((tr) => (
                        <StudioTiltCard
                          key={tr.id}
                          maxTilt={1.6}
                          hoverScale={1.005}
                          onHoverStart={() => setHoveredTrack(tr)}
                          onHoverEnd={() =>
                            setHoveredTrack((prev) => (prev?.id === tr.id ? null : prev))
                          }
                        >
                          <div
                            onClick={() => handleSelectSpotifyTrack(tr)}
                            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-[#1DB954] bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 flex items-center justify-between gap-2 cursor-pointer studio-card-transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={tr.cover || '/assets/genres/genre_default.jpg'}
                                alt={tr.title}
                                className="w-10 h-10 rounded-lg object-cover shrink-0 studio-img-outline"
                              />
                              <div className="min-w-0">
                                <h5 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                  {tr.title}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                  {tr.artist} {tr.duration ? `• ${formatDuration(tr.duration)}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-lg bg-[#1DB954] text-white text-[11px] font-bold shrink-0">
                              Carregar no Deck
                            </span>
                          </div>
                        </StudioTiltCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Barra de Busca no Catálogo Deezer */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={catalogSearchTerm}
                    onChange={(e) => setCatalogSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchCatalog(e); }}
                    placeholder="Ex: Creep Radiohead, Bohemian Rhapsody, Tempo Perdido..."
                    className="w-full pl-10 pr-9 py-3 bg-slate-50 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 studio-btn-transition"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  {catalogSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
                      title="Limpar busca"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSearchCatalog}
                  disabled={isSearchingCatalog || !catalogSearchTerm.trim()}
                  className="min-h-[44px] bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-extrabold px-5 py-3 rounded-xl studio-btn-transition active:scale-95 shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {isSearchingCatalog ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <span>Buscar no Catálogo</span>
                  )}
                </button>
              </div>

              {/* Erro de busca se houver */}
              {catalogError && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 font-semibold flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{catalogError}</span>
                </p>
              )}

              {/* Lista de Resultados de Busca do Catálogo em Cartões 3D (StudioTiltCard) */}
              {catalogResults.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {catalogResults.map((track) => {
                    const isSelected = selectedCatalogTrack?.id === track.id;
                    const isPlayingThis = activePreviewId === track.id;

                    return (
                      <StudioTiltCard
                        key={track.id}
                        maxTilt={1.6}
                        hoverScale={1.005}
                        onHoverStart={() => setHoveredTrack(track)}
                        onHoverEnd={() =>
                          setHoveredTrack((prev) => (prev?.id === track.id ? null : prev))
                        }
                      >
                        <div
                          onClick={() => handleSelectCatalogTrack(track)}
                          className={`relative overflow-hidden flex items-center justify-between gap-3 p-3 rounded-2xl border studio-card-transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/95 dark:bg-blue-950/70 border-[var(--color-brand-medium)] dark:border-blue-500 shadow-sm ring-1 ring-[var(--color-brand-medium)]/30'
                              : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/90 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* LED lateral do canal */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                              isSelected
                                ? 'bg-emerald-500'
                                : isPlayingThis
                                ? 'bg-blue-500'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />

                          <div className="flex items-center gap-3 min-w-0 pl-1.5">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-xs border border-slate-200/60 dark:border-slate-700 studio-img-outline">
                              <img
                                src={track.cover_small || track.cover}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                              {isPlayingThis && (
                                <div className="absolute inset-0 bg-blue-950/65 flex items-end justify-center gap-0.5 pb-2">
                                  <span className="w-1 bg-cyan-400 rounded-full eq-bar-1" />
                                  <span className="w-1 bg-cyan-400 rounded-full eq-bar-2" />
                                  <span className="w-1 bg-cyan-400 rounded-full eq-bar-3" />
                                  <span className="w-1 bg-cyan-400 rounded-full eq-bar-4" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                                  {track.title}
                                </h5>
                                {track.duration > 0 && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700 shrink-0 tabular-nums">
                                    {formatDuration(track.duration)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                                {track.artist} {track.album ? `• ${track.album}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Botão de Preview 30s que aciona os VU Meters do Hero */}
                            {track.preview && (
                              <button
                                type="button"
                                onClick={() => togglePreview(track)}
                                className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-extrabold studio-btn-transition active:scale-95 flex items-center gap-1.5 cursor-pointer tabular-nums ${
                                  isPlayingThis
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                }`}
                                title={isPlayingThis ? "Pausar prévia no monitor" : "Ouvir prévia de 30 segundos na sala de controle"}
                              >
                                {isPlayingThis ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                                  </svg>
                                )}
                                <span className="hidden sm:inline">{isPlayingThis ? 'Monitor' : '30s'}</span>
                              </button>
                            )}

                            {/* Botão Selecionar para o Master Deck */}
                            <button
                              type="button"
                              onClick={() => handleSelectCatalogTrack(track)}
                              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold studio-btn-transition active:scale-95 shadow-2xs cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[var(--color-brand-medium)] text-white hover:bg-[var(--color-brand-dark)]'
                              }`}
                            >
                              {isSelected ? '✓ No Deck' : 'Selecionar'}
                            </button>
                          </div>
                        </div>
                      </StudioTiltCard>
                    );
                  })}
                </div>
              ) : (
                /* Sugestões rápidas quando nenhuma busca foi realizada ainda */
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Testar captação rápida:
                  </span>
                  {['Comfortably Numb', 'Hotel California', 'Sultans of Swing', 'Everlong'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setCatalogSearchTerm(sample);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-600 dark:text-slate-300 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 border border-slate-200/70 dark:border-slate-700 studio-btn-transition active:scale-95 cursor-pointer"
                    >
                      🔎 {sample}
                    </button>
                  ))}
                </div>
              )}
            </section>
            
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block text-center">
                    OU
              </span>
            {/* ================================================================= */}
            {/* MÓDULO 1B (IDEIA 4): ENTRADAS AUXILIARES — YOUTUBE & DROPZONE 3D  */}
            {/* ================================================================= */}
            <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-slate-800 dark:bg-slate-800 text-amber-400 text-xs font-mono font-black flex items-center justify-center border border-slate-700">
                    AUX
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[var(--color-brand-deep)] tracking-tight">
                      Arquivo Master Local ou Link do YouTube
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAlternativeMethods((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold studio-btn-transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{showAlternativeMethods ? 'Modo Compacto' : 'Expandir Painel Auxiliar'}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${showAlternativeMethods ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* DROPZONE 3D MAGNÉTICA (Sempre acessível para Drag & Drop rápido) */}
              <StudioTiltCard maxTilt={2.2} hoverScale={1.006}>
                <div
                  onDragOver={handleDragOverFile}
                  onDragLeave={handleDragLeaveFile}
                  onDrop={handleDropFile}
                  className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed studio-dropzone-glow flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    isDraggingFile
                      ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/60 shadow-lg scale-[1.01]'
                      : audioFile
                      ? 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:border-[var(--color-brand-medium)]/70'
                  }`}
                >
                  <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 shadow-md relative overflow-hidden">
                      <img
                        src="/assets/parallax/studio_analog_mixer.png"
                        alt=""
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400">
                          {isDraggingFile
                            ? 'SOLTE O ARQUIVO NA MESA'
                            : audioFile
                            ? 'MASTER FILE CARREGADO'
                            : 'MAGNETIC DROPZONE 3D'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate mt-0.5">
                        {audioFile
                          ? `${audioFile.name} (${(audioFile.size / (1024 * 1024)).toFixed(1)} MB)`
                          : 'Arraste um arquivo .MP3, .WAV, .FLAC ou .M4A aqui'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {audioFile
                          ? 'Arquivo pronto! Confirme o gênero ao lado e clique em Separar Arquivo.'
                          : 'Ou selecione do seu computador para isolamento direto sem compressão.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center">
                    <label className="cursor-pointer flex-1 sm:flex-initial">
                      <span className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-xs font-extrabold studio-btn-transition active:scale-95 flex items-center justify-center gap-2 shadow-2xs">
                        <img src="/assets/icons/icon_upload_cloud.png" alt="Upload" className="w-4 h-4 object-contain" />
                        <span>{audioFile ? 'Trocar Arquivo' : 'Escolher Arquivo'}</span>
                      </span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.flac,.m4a"
                        onChange={(e) => handleFileSelected(e.target.files?.[0])}
                        className="hidden"
                      />
                    </label>

                    {audioFile && (
                      <button
                        type="button"
                        onClick={handleUploadSubmit}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold studio-btn-transition active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <img src="/assets/icons/icon_scissors_white.png" alt="Separar" className="w-4 h-4 object-contain" />
                        <span>Separar Arquivo</span>
                      </button>
                    )}
                  </div>
                </div>
              </StudioTiltCard>

              {/* Entrada de Link Manual do YouTube (visível ao expandir ou se já tiver URL digitada) */}
              {(showAlternativeMethods || youtubeUrl) && (
                <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 animate-fade-in-scale">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <img src="/assets/icons/icon_youtube.png" alt="YouTube" className="w-4 h-4 object-contain" />
                    <span>Importar via Link Manual do YouTube (Ao Vivo / Covers)</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleYoutubeUpload}
                      disabled={!youtubeUrl.trim()}
                      className="min-h-[42px] flex items-center justify-center gap-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold studio-btn-transition active:scale-95 shadow-sm shrink-0 cursor-pointer"
                    >
                      <img src="/assets/icons/icon_youtube_white.png" alt="YouTube" className="w-4 h-4 object-contain" />
                      <span>Importar Link</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ================================================================= */}
          {/* COLUNA DIREITA (lg:col-span-5): MASTER DECK 3D & CALIBRAÇÃO       */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* MÓDULO 2A (IDEIA 4): MASTER TAPE / CARTRIDGE DECK 3D DA FAIXA */}
            <StudioTiltCard maxTilt={2.5} hoverScale={1.008}>
              {/* Concentric Radius: Outer rounded-2xl (16px) p-1.5 -> Inner rounded-xl (12px) */}
              <div className="rounded-2xl p-1.5 bg-gradient-to-b from-slate-200/90 via-slate-300/75 to-blue-200/60 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 border border-slate-300/90 dark:border-slate-700/90 shadow-lg">
                <div className="rounded-xl bg-[#0B1325] text-slate-100 p-4 border border-slate-800 relative overflow-hidden">
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800 text-[10px] font-mono font-extrabold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selectedCatalogTrack || audioFile
                            ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                            : 'bg-amber-400'
                        }`}
                      />
                      <span>SLOT DE MUSICA</span>
                    </span>
                    <span className="text-blue-400 tabular-nums">
                      {selectedCatalogTrack
                        ? selectedCatalogTrack.source === 'spotify'
                          ? 'SPOTIFY LOCKED'
                          : 'DEEZER LOCKED'
                        : audioFile
                        ? 'LOCAL PCM'
                        : 'STANDBY'}
                    </span>
                  </div>

                  {selectedCatalogTrack ? (
                    <div className="flex items-center justify-between gap-3.5">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700 shadow-md studio-img-outline">
                          <img
                            src={
                              selectedCover ||
                              selectedCatalogTrack.cover ||
                              getGenreImage(uploadForm.genre)
                            }
                            alt={uploadForm.name || selectedCatalogTrack.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/70">
                              ✓ FAIXA PRONTA NO DECK
                            </span>
                            {selectedCatalogTrack.duration > 0 && (
                              <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums">
                                ⏱️ {formatDuration(selectedCatalogTrack.duration)}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-white truncate mt-1">
                            {uploadForm.name || selectedCatalogTrack.title}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">
                            {uploadForm.artist || selectedCatalogTrack.artist}
                            {isFetchingTrackDetails ? ' • Identificando gênero...' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {selectedCatalogTrack.preview && (
                          <button
                            type="button"
                            onClick={() => togglePreview(selectedCatalogTrack)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-extrabold studio-btn-transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                              activePreviewId === selectedCatalogTrack.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                            }`}
                          >
                            <span>{activePreviewId === selectedCatalogTrack.id ? '⏸ Parar' : '▶ 30s'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleClearSelectedTrack}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-rose-950/50 border border-slate-800 studio-btn-transition active:scale-95 cursor-pointer"
                          title="Ejetar faixa do deck"
                        >
                          ✕ Ejetar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-xl bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center shrink-0">
                        <img
                          src={getGenreImage(uploadForm.genre)}
                          alt="Capa do estilo"
                          className="w-full h-full object-cover rounded-xl opacity-55"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                          Aguardando Faixa no Slot Master
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                          Selecione uma música na busca ao lado ou importe do seu Spotify para armar o processamento de 6 stems.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </StudioTiltCard>

            {/* MÓDULO 2B (IDEIA 3): FORMULÁRIO DE CALIBRAÇÃO & 6 PADS 3D DE INSTRUMENTO */}
            <form
              onSubmit={handleCatalogUpload}
              className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md flex flex-col gap-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white text-xs font-black flex items-center justify-center shadow-xs tabular-nums">
                    02
                  </span>
                  <div> 
                    <h3 className="text-base sm:text-lg font-black text-[var(--color-brand-deep)] tracking-tight">
                      Calibração Musical & Foco 3D
                    </h3>
                  </div>
                </div>
              </div>

              {/* Campos: Nome da Música & Artista */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 text-xs font-extrabold mb-1.5">
                    Nome da Música
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Comfortably Numb"
                    value={uploadForm.name} 
                    onChange={e => setUploadForm({...uploadForm, name: e.target.value})} 
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] text-xs sm:text-sm font-medium" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-200 text-xs font-extrabold mb-1.5">
                    Artista / Banda
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Pink Floyd"
                    value={uploadForm.artist} 
                    onChange={e => setUploadForm({...uploadForm, artist: e.target.value})} 
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] text-xs sm:text-sm font-medium" 
                    required 
                  />
                </div>
              </div>

              {/* IDEIA 3: SELETOR VISUAL 3D DE INSTRUMENTO ("3D INSTRUMENT FOCUS PADS") */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-700 dark:text-slate-200 text-xs font-extrabold">
                    Seu Instrumento de Foco (3D Studio Pads)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[var(--color-brand-medium)] dark:text-blue-400">
                    Canal: {uploadForm.instrument}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {INSTRUMENT_PADS_3D.map((pad) => {
                    const isSelectedPad = uploadForm.instrument === pad.id;
                    return (
                      <StudioTiltCard
                        key={pad.id}
                        maxTilt={4.5}
                        hoverScale={1.02}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setUploadForm((prev) => ({ ...prev, instrument: pad.id }))
                          }
                          aria-pressed={isSelectedPad}
                          className={`w-full p-2.5 rounded-2xl border text-left flex flex-col justify-between gap-1.5 studio-btn-transition active:scale-95 cursor-pointer relative overflow-hidden ${
                            isSelectedPad
                              ? pad.activeBorder
                              : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/90 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelectedPad
                                  ? pad.ledColor
                                  : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            />
                            <img
                              src={pad.img}
                              alt=""
                              className="w-9 h-9 object-contain drop-shadow-sm"
                            />
                          </div>
                          <div>
                            <span className="block text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
                              {pad.label}
                            </span>
                            <span className={`block text-[9px] font-mono font-bold mt-0.5 ${pad.badgeColor}`}>
                              {pad.sub}
                            </span>
                          </div>
                        </button>
                      </StudioTiltCard>
                    );
                  })}
                </div>
              </div>

              {/* Gênero Musical (com Preview de Ambientação) + Tom Original */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                <div className="sm:col-span-7">
                  <label className="block text-slate-700 dark:text-slate-200 text-xs font-extrabold mb-1.5">
                    Gênero Musical
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 studio-img-outline">
                      <img
                        src={getGenreImage(uploadForm.genre)}
                        alt={uploadForm.genre || 'Gênero'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <select 
                      value={uploadForm.genre} 
                      onChange={e => setUploadForm({...uploadForm, genre: e.target.value})} 
                      className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold cursor-pointer"
                      required
                    >
                      <option value="" disabled>Selecione um gênero</option>
                      {AVAILABLE_GENRES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-slate-700 dark:text-slate-200 text-xs font-extrabold mb-1.5">
                    Tom Original
                  </label>
                  <select 
                    value={uploadForm.original_key} 
                    onChange={(e) => setUploadForm({...uploadForm, original_key: e.target.value})} 
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-mono font-bold tabular-nums cursor-pointer"
                  >
                    {keyOptions.map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BOTÃO MASTER DE SEPARAÇÃO IA */}
              <button
                type="submit"
                disabled={!selectedCatalogTrack}
                className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed studio-btn-transition active:scale-95 shadow-lg flex items-center justify-center gap-3 mt-1 cursor-pointer"
              >
                <img src="/assets/icons/icon_scissors_white.png" alt="Separar" className="w-5 h-5 object-contain" />
                <span className="truncate">
                  {selectedCatalogTrack
                    ? `Separar 6 Stems: "${uploadForm.name || selectedCatalogTrack.title}"`
                    : "Selecione uma música no catálogo para separar"}
                </span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Upload;
