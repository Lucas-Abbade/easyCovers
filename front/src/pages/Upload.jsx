import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AudioProcessingScreen from '../components/AudioProcessingScreen';
import ThemeToggle from '../components/ThemeToggle';
import SpotifyOnboardingModal from '../components/SpotifyOnboardingModal';
import { SpotifyIcon } from '../components/Icons';
import { AVAILABLE_GENRES } from '../utils/genreImages';

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

const Upload = ({ onAddSong, user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadForm, setUploadForm] = useState({ 
    name: '', 
    artist: '', 
    genre: '', 
    instrument: 'Guitarra', 
    original_key: 'Unknown' 
  });
  const [audioFile, setAudioFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");

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

  // Estados da nova tela de processamento unificada
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
    if (!track.preview) return;

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
    const initialTrack = {
      id: spTrack.id || `sp_${Date.now()}`,
      title: spTrack.title,
      artist: spTrack.artist,
      album: spTrack.album || '',
      duration: spTrack.duration || 0,
      cover: spTrack.cover || '',
      source: 'spotify',
    };

    setSelectedCatalogTrack(initialTrack);
    setSelectedCover(spTrack.cover || '');
    setUploadForm(prev => ({
      ...prev,
      name: spTrack.title || '',
      artist: spTrack.artist || '',
      genre: spTrack.suggested_genre || prev.genre || 'Rock',
      original_key: (spTrack.original_key && spTrack.original_key !== 'Unknown') ? spTrack.original_key : prev.original_key,
    }));
    setShowSpotifyPicker(false);

    // Enriquecimento automático de metadados/capa/duração pelo catálogo
    setIsFetchingTrackDetails(true);
    try {
      const q = `${spTrack.title} ${spTrack.artist}`;
      const res = await fetch(`http://localhost:8000/api/music/search?q=${encodeURIComponent(q)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        const match = (data.results || [])[0];
        if (match) {
          setSelectedCover(match.cover || spTrack.cover || '');
          setSelectedCatalogTrack(prev => prev ? {
            ...prev,
            id: match.id || prev.id,
            duration: match.duration || prev.duration,
            cover: match.cover || prev.cover,
            preview: match.preview || prev.preview,
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
    setSelectedCatalogTrack(null);
    setSelectedCover('');
    setUploadForm(prev => ({ ...prev, name: '', artist: '' }));
  };

  // 1. FLUXO PRINCIPAL: Separação Direta pelo Catálogo Deezer
  const handleCatalogUpload = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedCatalogTrack) {
      alert("Pesquise e selecione uma música no catálogo Deezer acima para continuar!");
      return;
    }

    if (!uploadForm.name.trim() || !uploadForm.artist.trim() || !uploadForm.genre) {
      alert("Por favor, verifique o nome da música, artista e selecione um gênero musical!");
      return;
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
      alert("Por favor, preencha o nome da música, artista e escolha um gênero!");
      return;
    }

    if (!audioFile) {
      alert("Por favor, selecione um arquivo de áudio (.mp3, .wav, .flac)!");
      return;
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

  // Se o estado for processando, concluído ou erro, renderiza a tela unificada de processamento!
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

  // Formulário padrão de envio (quando o estado é 'idle')
  return (
    <div 
      className="font-sans min-h-screen bg-repeat"
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-md border-b border-slate-200/80 dark:border-slate-800 px-6 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-30 transition-all">
        <div className="flex items-center gap-3 sm:gap-4">
          <div 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
            title="EasyCovers - Ir para o início"
          >
            <img 
              src="/assets/logo_symbol.png" 
              alt="EasyCovers Logo" 
              className="h-10 w-auto object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <h1 className="text-2xl font-extrabold text-[var(--color-brand-deep)]">
              EasyCovers
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="text-slate-600 dark:text-slate-300 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 font-bold flex items-center gap-2 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Voltar para Biblioteca
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

      <main className="max-w-3xl mx-auto p-6 sm:p-8 my-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-xl border-t-4 border-[var(--color-brand-medium)] border-x border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col items-center mb-6">
          <img 
            src="/assets/upload_illustration.jpg" 
            alt="Ilustração de envio de áudio" 
            className="w-40 h-auto object-contain mb-2 rounded-xl"
          />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-brand-deep)] text-center">
            Separe sua música!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-lg">
            Pesquise no catálogo ou importe direto das suas playlists do Spotify para separar em 6 faixas com IA.
          </p>
        </div>
        
        {/* =================================================================== */}
        {/* PASSO 1 (PRINCIPAL): BUSCA NO CATÁLOGO OU IMPORTAÇÃO DO SPOTIFY     */}
        {/* =================================================================== */}
        <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-blue-50/90 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-800/90 p-5 sm:p-6 rounded-2xl border-2 border-blue-200/90 dark:border-blue-900/60 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[var(--color-brand-medium)] text-white text-xs font-black flex items-center justify-center shadow-xs">
                1
              </span>
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[var(--color-brand-deep)] dark:text-blue-400">
                Escolha sua música no Catálogo ou Spotify
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSpotifyPicker}
                className="px-3 py-1.5 rounded-xl bg-[#1DB954] hover:bg-[#18a349] text-white text-xs font-extrabold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
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

              {selectedCatalogTrack && (
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/90 dark:bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <span>✓</span> Faixa pronta
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 mb-3.5">
            Digite o nome da música abaixo ou abra sua biblioteca do Spotify para selecionar um som das suas playlists.
          </p>

          {/* GAVETA EXPANSÍVEL: BIBLIOTECA SPOTIFY DO USUÁRIO */}
          {showSpotifyPicker && (
            <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#1DB954]/50 shadow-md animate-fade-in-scale">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSpotifyTab('playlists');
                      setSelectedSpotifyPl(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      spotifyTab === 'playlists'
                        ? 'bg-[#1DB954] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      spotifyTab === 'liked'
                        ? 'bg-[#1DB954] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
                />
                <button
                  type="button"
                  onClick={handleImportSpotifyLinkInUpload}
                  disabled={importingSpotifyUrl || !spotifyImportUrl.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1DB954] hover:bg-[#18a349] disabled:opacity-50 text-white text-xs font-extrabold transition shrink-0 cursor-pointer"
                >
                  {importingSpotifyUrl ? 'Importando...' : '+ Importar Playlist'}
                </button>
              </div>

              {loadingSpotify ? (
                <div className="py-6 text-center text-xs font-bold text-slate-500">
                  Carregando sua biblioteca do Spotify...
                </div>
              ) : spotifyTab === 'playlists' && !selectedSpotifyPl ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {spotifyPlaylists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => handleOpenSpotifyPlaylistInUpload(pl)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#1DB954] bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 cursor-pointer transition"
                    >
                      <img
                        src={pl.cover || '/assets/genres/genre_default.jpg'}
                        alt={pl.name}
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {pl.name}
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {pl.tracks_total} faixas
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#1DB954]">Abrir ➔</span>
                    </div>
                  ))}
                </div>
              ) : spotifyTab === 'liked' && spotifyLikedTracks.length === 0 ? (
                <div className="py-5 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  Sua lista de <strong>Músicas Curtidas</strong> está vazia. Abra qualquer uma das suas playlists ao lado ou clique no <strong>♥</strong> no seu Perfil para salvar suas favoritas aqui!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {(spotifyTab === 'liked' ? spotifyLikedTracks : spotifyTracks).map((tr) => (
                    <div
                      key={tr.id}
                      onClick={() => handleSelectSpotifyTrack(tr)}
                      className="p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-[#1DB954] hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 flex items-center justify-between gap-2 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={tr.cover || '/assets/genres/genre_default.jpg'}
                          alt={tr.title}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {tr.title}
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {tr.artist} {tr.duration ? `• ${formatDuration(tr.duration)}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#1DB954] text-white text-[11px] font-bold shrink-0">
                        Selecionar
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Barra de Busca */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={catalogSearchTerm}
                onChange={(e) => setCatalogSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchCatalog(e); }}
                placeholder="Ex: Creep Radiohead, Bohemian Rhapsody, Tempo Perdido..."
                className="w-full pl-10 pr-3 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition shadow-2xs"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <button
              type="button"
              onClick={handleSearchCatalog}
              disabled={isSearchingCatalog || !catalogSearchTerm.trim()}
              className="bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-xl transition shadow-sm flex items-center gap-1.5 shrink-0"
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
                <span>Buscar Música</span>
              )}
            </button>
          </div>

          {/* Erro de busca se houver */}
          {catalogError && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2.5 font-medium">
              {catalogError}
            </p>
          )}

          {/* Lista de Resultados de Busca do Catálogo */}
          {catalogResults.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {catalogResults.map((track) => {
                const isSelected = selectedCatalogTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => handleSelectCatalogTrack(track)}
                    className={`flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-100/90 dark:bg-blue-950/70 border-[var(--color-brand-medium)] dark:border-blue-500 shadow-sm ring-1 ring-[var(--color-brand-medium)]/30'
                        : 'bg-white/95 dark:bg-slate-900/85 border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-xs border border-slate-200/60 dark:border-slate-700">
                        <img
                          src={track.cover_small || track.cover}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {track.title}
                          </h5>
                          {track.duration > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                              {formatDuration(track.duration)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {track.artist} {track.album ? `• ${track.album}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Botão de Preview 30s */}
                      {track.preview && (
                        <button
                          type="button"
                          onClick={() => togglePreview(track)}
                          className={`p-2 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            activePreviewId === track.id
                              ? 'bg-blue-600 text-white animate-pulse'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title={activePreviewId === track.id ? "Pausar prévia" : "Ouvir prévia de 30 segundos"}
                        >
                          {activePreviewId === track.id ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">{activePreviewId === track.id ? 'Tocando' : '30s'}</span>
                        </button>
                      )}

                      {/* Botão Selecionar para Separar */}
                      <button
                        type="button"
                        onClick={() => handleSelectCatalogTrack(track)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition shadow-2xs ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--color-brand-medium)] text-white hover:bg-[var(--color-brand-dark)]'
                        }`}
                      >
                        {isSelected ? '✓ Selecionada' : 'Selecionar para Separar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Card de Destaque da Música Selecionada */}
          {selectedCatalogTrack && (
            <div className="mt-4 p-3.5 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border-2 border-emerald-400/80 dark:border-emerald-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={selectedCover || selectedCatalogTrack.cover}
                  alt="Capa selecionada"
                  className="w-14 h-14 rounded-xl object-cover shadow-sm border border-slate-200 dark:border-slate-800 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      {selectedCatalogTrack.source === 'spotify'
                        ? 'Faixa Importada do seu Spotify'
                        : 'Faixa Selecionada no Catálogo'}
                    </span>
                    {selectedCatalogTrack.duration > 0 && (
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        ⏱️ {formatDuration(selectedCatalogTrack.duration)}
                      </span>
                    )}
                    {isFetchingTrackDetails && (
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                        Identificando gênero...
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate mt-1">
                    {uploadForm.name || selectedCatalogTrack.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {uploadForm.artist || selectedCatalogTrack.artist} {selectedCatalogTrack.album ? `• ${selectedCatalogTrack.album}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearSelectedTrack}
                className="text-xs text-slate-500 hover:text-red-600 font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 transition shrink-0 self-end sm:self-center"
                title="Desmarcar música"
              >
                ✕ Trocar música
              </button>
            </div>
          )}
        </div>
        
        {/* =================================================================== */}
        {/* PASSO 2: DADOS MUSICAIS, MODO DE ÁUDIO E BOTÃO PRINCIPAL DE SEPARAR */}
        {/* =================================================================== */}
        <form onSubmit={handleCatalogUpload} className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--color-brand-medium)] text-white text-xs font-black flex items-center justify-center shadow-xs">
              2
            </span>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[var(--color-brand-deep)] dark:text-blue-400">
              Confirme os Detalhes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold mb-1.5">
                Nome da Música
              </label>
              <input 
                type="text" 
                placeholder="Ex: Comfortably Numb"
                value={uploadForm.name} 
                onChange={e => setUploadForm({...uploadForm, name: e.target.value})} 
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] transition text-sm" 
                required 
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold mb-1.5">
                Artista / Banda
              </label>
              <input 
                type="text" 
                placeholder="Ex: Pink Floyd"
                value={uploadForm.artist} 
                onChange={e => setUploadForm({...uploadForm, artist: e.target.value})} 
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] transition text-sm" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold mb-1.5">
                Gênero Musical
              </label>
              <select 
                value={uploadForm.genre} 
                onChange={e => setUploadForm({...uploadForm, genre: e.target.value})} 
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 transition text-sm"
                required
              >
                <option value="" disabled>Selecione um gênero</option>
                {AVAILABLE_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold mb-1.5">
                Seu Instrumento
              </label>
              <select 
                value={uploadForm.instrument} 
                onChange={e => setUploadForm({...uploadForm, instrument: e.target.value})} 
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 transition text-sm"
              >
                <option>Guitarra</option>
                <option>Violão</option>
                <option>Baixo</option>
                <option>Bateria</option>
                <option>Voz</option>
                <option>Teclado</option>
              </select>
            </div>              
            
            <div>
              <label className="block text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold mb-1.5">
                Tom Original
              </label>
              <select 
                value={uploadForm.original_key} 
                onChange={(e) => setUploadForm({...uploadForm, original_key: e.target.value})} 
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 transition text-sm"
              >
                {keyOptions.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>            
          </div>

          {/* BOTÃO HERO PRINCIPAL: SEPARAR MÚSICA SELECIONADA NO CATÁLOGO */}
          <button
            type="submit"
            disabled={!selectedCatalogTrack}
            className="w-full py-4 px-6 rounded-2xl font-extrabold text-base sm:text-lg text-white bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:opacity-95 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition shadow-lg flex items-center justify-center gap-3 mt-1"
          >
            <img src="/assets/icons/icon_scissors_white.png" alt="Separar" className="w-6 h-6 object-contain" />
            <span>
              {selectedCatalogTrack
                ? `Separar: "${uploadForm.name || selectedCatalogTrack.title}"`
                : "Selecione uma música na pesquisa acima para separar"}
            </span>
          </button>

          {/* =================================================================== */}
          {/* SEÇÃO SECUNDÁRIA RETRÁTIL: OUTRAS FORMAS DE ENVIO (YOUTUBE / LOCAL) */}
          {/* =================================================================== */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAlternativeMethods(prev => !prev)}
              className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-bold transition"
            >
              <span>Outras formas de envio (Link manual do YouTube ou Arquivo Local)</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className={`w-4 h-4 transition-transform duration-200 ${showAlternativeMethods ? 'rotate-180' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showAlternativeMethods && (
              <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col gap-5">
                {/* Opção Alternativa 1: Link Manual do YouTube */}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-brand-deep)] mb-1.5 flex items-center gap-2">
                    <img src="/assets/icons/icon_youtube.png" alt="YouTube" className="w-5 h-5 object-contain" />
                    Importar via Link Manual do YouTube
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Cole o link de um vídeo específico caso queira usar uma versão ao vivo ou cover específico.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="flex-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl outline-none focus:border-[var(--color-brand-medium)] transition text-sm"
                    />
                    <button 
                      type="button"
                      onClick={handleYoutubeUpload} 
                      disabled={!youtubeUrl.trim()}
                      className="flex items-center justify-center gap-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:bg-gray-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-bold transition shadow-sm shrink-0"
                    >
                      <img src="/assets/icons/icon_youtube_white.png" alt="YouTube" className="w-5 h-5 object-contain" />
                      Importar Link
                    </button>
                  </div>
                </div>

                {/* Separador Visual */}
                <div className="flex items-center text-slate-400 dark:text-slate-500 font-medium">
                  <div className="flex-1 border-b border-slate-200 dark:border-slate-700"></div>
                  <span className="px-3 text-[11px] font-bold uppercase tracking-wider">ou envie um arquivo do dispositivo</span>
                  <div className="flex-1 border-b border-slate-200 dark:border-slate-700"></div>
                </div>

                {/* Opção Alternativa 2: Upload de Arquivo Local */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <div className="flex-1 border-2 border-dashed border-[var(--color-brand-medium)]/70 p-4 text-center rounded-xl bg-white/70 dark:bg-slate-900/40 flex flex-col justify-center items-center">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-2.5 bg-[var(--color-brand-medium)] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--color-brand-dark)] transition shadow-sm">
                        <img src="/assets/icons/icon_upload_cloud_white.png" alt="Upload" className="w-5 h-5 object-contain" />
                        Selecionar Arquivo Local
                      </span>
                      <input 
                        type="file" 
                        accept="audio/*,.mp3,.wav,.flac,.m4a" 
                        onChange={(e) => setAudioFile(e.target.files[0])} 
                        className="hidden" 
                      />
                    </label>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      {audioFile ? (
                        <span className="font-bold text-[var(--color-brand-medium)] dark:text-blue-400">
                          ✓ Arquivo: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      ) : (
                        "Formatos suportados: .mp3, .wav, .flac, .m4a"
                      )}
                    </p>
                  </div>

                  <button 
                    type="button"
                    onClick={handleUploadSubmit}
                    disabled={!audioFile}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-bold transition shadow-md shrink-0 sm:w-44"
                  >
                    <img src="/assets/icons/icon_scissors_white.png" alt="Separar" className="w-5 h-5 object-contain" />
                    Separar Arquivo
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

export default Upload;