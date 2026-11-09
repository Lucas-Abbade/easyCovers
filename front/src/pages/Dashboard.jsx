import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuitarIcon, MusicNoteIcon, PlaylistIcon } from '../components/Icons';
import { getGenreImage, AVAILABLE_GENRES } from '../utils/genreImages';
import ThemeToggle from '../components/ThemeToggle';
import DashboardStudioBackground from '../components/DashboardStudioBackground';
import DashboardHeroStudioRack from '../components/DashboardHeroStudioRack';
import StudioTiltCard from '../components/StudioTiltCard';
import {
  useScrollVariable,
  useDocumentVisibility,
} from '../utils/motionTokens';

// Formatação de tempo mm:ss para marcadores de treino
const formatMarkerTime = (secs) => {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Recupera marcadores de treino (híbrido: localStorage para atualização imediata ou banco)
const getSongPracticeMarkers = (song) => {
  if (!song?.id) return [];
  try {
    const local = localStorage.getItem(`easycovers_markers_${song.id}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    if (song.practice_markers) {
      const parsed = typeof song.practice_markers === 'string'
        ? JSON.parse(song.practice_markers)
        : song.practice_markers;
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignora erro de parse
  }
  return [];
};

const STUDIO_GEAR_SHOWCASE = [
  {
    id: 'tube-amp',
    name: 'Amplificador Valvulado',
    spec: '12AX7 / EL34 • Bias Quente',
    img: '/assets/parallax/studio_tube_amp.png',
    borderClass: 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/30',
    badgeClass: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'condenser-mic',
    name: 'Microfone Condensador',
    spec: '+48V Phantom • Shockmount',
    img: '/assets/parallax/studio_condenser_mic.png',
    borderClass: 'border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/30',
    badgeClass: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'analog-mixer',
    name: 'Console Mixer 6-Stems',
    spec: 'Faders Motorizados & VU',
    img: '/assets/parallax/studio_analog_mixer.png',
    borderClass: 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30',
    badgeClass: 'text-blue-700 dark:text-blue-300',
  },
  {
    id: 'ref-monitors',
    name: 'Monitores de Referência',
    spec: 'Cones Kevlar • Resposta Plana',
    img: '/assets/parallax/studio_reference_monitors.png',
    borderClass: 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30',
    badgeClass: 'text-emerald-700 dark:text-emerald-300',
  },
];

const Dashboard = ({ email, user, songs = [], playlists = [], onPlaylistsChange, onDeleteSong, onLogout }) => {
  const navigate = useNavigate();
  const dashboardRootRef = useRef(null);
  useScrollVariable(dashboardRootRef);
  const isTabVisible = useDocumentVisibility();

  // Aba ativa principal do Dashboard: 'songs' (Músicas) | 'playlists' (Playlists)
  const [activeTab, setActiveTab] = useState('songs');

  // Estados para busca, filtros e ordenação da aba Músicas (mantidos no estado original)
  const [searchName, setSearchName] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [sortBy, setSortBy] = useState('date_desc'); // Padrão: Mais recentes
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  // Estados para busca, filtros, ordenação e exibição da aba Playlists
  const [playlistSearchName, setPlaylistSearchName] = useState('');
  const [playlistSearchTrack, setPlaylistSearchTrack] = useState('');
  const [playlistFilterGenre, setPlaylistFilterGenre] = useState('');
  const [playlistSortBy, setPlaylistSortBy] = useState('date_desc');
  const [playlistViewMode, setPlaylistViewMode] = useState('grid'); // 'list' | 'grid'

  // Estados dos Modais de Playlist (Criar/Editar e Adicionar/Gerenciar Músicas)
  const [isPlaylistFormOpen, setIsPlaylistFormOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [playlistFormName, setPlaylistFormName] = useState('');
  const [playlistFormDescription, setPlaylistFormDescription] = useState('');
  const [playlistFormImageFile, setPlaylistFormImageFile] = useState(null);
  const [playlistFormImagePreview, setPlaylistFormImagePreview] = useState('');
  const [playlistFormRemoveCover, setPlaylistFormRemoveCover] = useState(false);
  const [playlistFormLoading, setPlaylistFormLoading] = useState(false);
  const [playlistFormError, setPlaylistFormError] = useState('');

  // Playlist aberta na tela do Dashboard + Modal de escolher músicas da biblioteca
  const [managingPlaylistId, setManagingPlaylistId] = useState(null);
  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [manageSongSearch, setManageSongSearch] = useState('');
  const [selectedSongIdsToAdd, setSelectedSongIdsToAdd] = useState([]);
  const [manageSongsLoading, setManageSongsLoading] = useState(false);

  // Estados interativos do Hardware 3D / Sala de Controle do Estúdio
  const [studioLiveMode, setStudioLiveMode] = useState(true);
  const [phantomPower, setPhantomPower] = useState(true);
  const [hoveredSong, setHoveredSong] = useState(null);

  // Lista de gêneros predefinidos sincronizada com o catálogo
  const generosDisponiveis = AVAILABLE_GENRES;

  // Processamento reativo com useMemo para filtragem e ordenação de alta performance
  const processedSongs = useMemo(() => {
    let result = [...songs];

    if (searchName.trim()) {
      const term = searchName.trim().toLowerCase();
      result = result.filter(song => 
        (song.name || '').toLowerCase().includes(term)
      );
    }

    if (searchArtist.trim()) {
      const term = searchArtist.trim().toLowerCase();
      result = result.filter(song => 
        (song.artist || '').toLowerCase().includes(term)
      );
    }

    if (filterGenre) {
      result = result.filter(song => song.genre === filterGenre);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'artist_asc':
          return (a.artist || '').localeCompare(b.artist || '');
        case 'genre_asc':
          return (a.genre || '').localeCompare(b.genre || '');
        case 'date_asc':
          return (a.id || 0) - (b.id || 0);
        case 'date_desc':
        default:
          return (b.id || 0) - (a.id || 0);
      }
    });

    return result;
  }, [songs, searchName, searchArtist, filterGenre, sortBy]);

  // Contadores analíticos para o Hero
  const metrics = useMemo(() => {
    const total = songs.length;
    const genresSet = new Set(songs.map(s => s.genre).filter(Boolean));
    const instrumentsSet = new Set(songs.map(s => s.instrument).filter(Boolean));
    return {
      total,
      genreCount: genresSet.size,
      instrumentCount: instrumentsSet.size
    };
  }, [songs]);

  // Checa se há qualquer filtro ativo
  const isFiltered = Boolean(searchName || searchArtist || filterGenre || sortBy !== 'date_desc');

  const handleClearFilters = () => {
    setSearchName('');
    setSearchArtist('');
    setFilterGenre('');
    setSortBy('date_desc');
  };

  // Processamento reativo com useMemo para filtragem e ordenação da aba Playlists
  const processedPlaylists = useMemo(() => {
    let result = [...playlists];

    if (playlistSearchName.trim()) {
      const term = playlistSearchName.trim().toLowerCase();
      result = result.filter(pl =>
        (pl.name || '').toLowerCase().includes(term) ||
        (pl.description || '').toLowerCase().includes(term)
      );
    }

    if (playlistSearchTrack.trim()) {
      const term = playlistSearchTrack.trim().toLowerCase();
      result = result.filter(pl =>
        Array.isArray(pl.songs) &&
        pl.songs.some(
          s =>
            (s.name || '').toLowerCase().includes(term) ||
            (s.artist || '').toLowerCase().includes(term)
        )
      );
    }

    if (playlistFilterGenre) {
      if (playlistFilterGenre === '__WITH_SONGS__') {
        result = result.filter(pl => Array.isArray(pl.songs) && pl.songs.length > 0);
      } else if (playlistFilterGenre === '__EMPTY__') {
        result = result.filter(pl => !Array.isArray(pl.songs) || pl.songs.length === 0);
      } else {
        result = result.filter(
          pl =>
            Array.isArray(pl.songs) &&
            pl.songs.some(s => s.genre === playlistFilterGenre)
        );
      }
    }

    result.sort((a, b) => {
      switch (playlistSortBy) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'songs_desc':
          return ((b.songs || []).length) - ((a.songs || []).length);
        case 'date_asc':
          return (a.id || 0) - (b.id || 0);
        case 'date_desc':
        default:
          return (b.id || 0) - (a.id || 0);
      }
    });

    return result;
  }, [playlists, playlistSearchName, playlistSearchTrack, playlistFilterGenre, playlistSortBy]);

  const isPlaylistFiltered = Boolean(
    playlistSearchName ||
    playlistSearchTrack ||
    playlistFilterGenre ||
    playlistSortBy !== 'date_desc'
  );

  const handleClearPlaylistFilters = () => {
    setPlaylistSearchName('');
    setPlaylistSearchTrack('');
    setPlaylistFilterGenre('');
    setPlaylistSortBy('date_desc');
  };

  // Playlist atualmente aberta na área de conteúdo do Dashboard
  const managingPlaylist = useMemo(() => {
    if (!managingPlaylistId) return null;
    return playlists.find(p => p.id === managingPlaylistId) || null;
  }, [playlists, managingPlaylistId]);

  // Músicas da playlist aberta filtradas pela barra de pesquisa e filtros superior
  const displayedPlaylistSongs = useMemo(() => {
    if (!managingPlaylist || !Array.isArray(managingPlaylist.songs)) return [];
    let list = [...managingPlaylist.songs];

    const termName = playlistSearchName.trim().toLowerCase();
    const termTrack = playlistSearchTrack.trim().toLowerCase();

    if (termName) {
      list = list.filter(
        s =>
          (s.name || '').toLowerCase().includes(termName) ||
          (s.artist || '').toLowerCase().includes(termName)
      );
    }

    if (termTrack) {
      list = list.filter(
        s =>
          (s.name || '').toLowerCase().includes(termTrack) ||
          (s.artist || '').toLowerCase().includes(termTrack)
      );
    }

    if (
      playlistFilterGenre &&
      playlistFilterGenre !== '__WITH_SONGS__' &&
      playlistFilterGenre !== '__EMPTY__'
    ) {
      list = list.filter(s => s.genre === playlistFilterGenre);
    }

    return list;
  }, [managingPlaylist, playlistSearchName, playlistSearchTrack, playlistFilterGenre]);

  // Músicas filtradas dentro do modal de adicionar músicas à playlist
  const availableSongsForModal = useMemo(() => {
    if (!managingPlaylist) return [];
    let list = [...songs];
    if (manageSongSearch.trim()) {
      const term = manageSongSearch.trim().toLowerCase();
      list = list.filter(
        s =>
          (s.name || '').toLowerCase().includes(term) ||
          (s.artist || '').toLowerCase().includes(term) ||
          (s.genre || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [songs, managingPlaylist, manageSongSearch]);

  // Funções para abrir modal de Criar / Editar Playlist
  const handleOpenCreatePlaylist = () => {
    setEditingPlaylist(null);
    setPlaylistFormName('');
    setPlaylistFormDescription('');
    setPlaylistFormImageFile(null);
    setPlaylistFormImagePreview('');
    setPlaylistFormRemoveCover(false);
    setPlaylistFormError('');
    setIsPlaylistFormOpen(true);
  };

  const handleOpenEditPlaylist = (playlist) => {
    setEditingPlaylist(playlist);
    setPlaylistFormName(playlist.name || '');
    setPlaylistFormDescription(playlist.description || '');
    setPlaylistFormImageFile(null);
    setPlaylistFormImagePreview(playlist.cover_image_url || '');
    setPlaylistFormRemoveCover(false);
    setPlaylistFormError('');
    setIsPlaylistFormOpen(true);
  };

  const handlePlaylistImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlaylistFormImageFile(file);
    setPlaylistFormRemoveCover(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPlaylistFormImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePlaylist = async (e) => {
    e.preventDefault();
    if (!playlistFormName.trim()) {
      setPlaylistFormError('Informe um nome para a playlist.');
      return;
    }
    if (!user?.id) return;

    setPlaylistFormLoading(true);
    setPlaylistFormError('');

    try {
      const formData = new FormData();
      formData.append('name', playlistFormName.trim());
      formData.append('description', playlistFormDescription.trim());
      if (playlistFormImageFile) {
        formData.append('cover_image', playlistFormImageFile);
      }
      if (editingPlaylist && playlistFormRemoveCover) {
        formData.append('remove_cover', 'true');
      }

      const url = editingPlaylist
        ? `http://localhost:8000/playlists/${editingPlaylist.id}`
        : `http://localhost:8000/playlists/${user.id}`;
      const method = editingPlaylist ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setPlaylistFormError(data.detail || 'Erro ao salvar playlist.');
        setPlaylistFormLoading(false);
        return;
      }

      const savedPlaylist = data.playlist;
      if (onPlaylistsChange) {
        onPlaylistsChange(prev => {
          if (editingPlaylist) {
            return prev.map(p => (p.id === savedPlaylist.id ? savedPlaylist : p));
          }
          return [savedPlaylist, ...prev];
        });
      }

      setIsPlaylistFormOpen(false);
      setActiveTab('playlists');

      // Se acabou de criar uma nova playlist, já abre a tela da playlist no Dashboard
      if (!editingPlaylist && savedPlaylist?.id) {
        setManagingPlaylistId(savedPlaylist.id);
        setManageSongSearch('');
        setSelectedSongIdsToAdd([]);
        setIsAddSongsModalOpen(false);
      }
    } catch (err) {
      console.error('Erro ao salvar playlist:', err);
      setPlaylistFormError('Não foi possível conectar ao servidor.');
    } finally {
      setPlaylistFormLoading(false);
    }
  };

  const handleDeletePlaylist = async (playlist) => {
    const confirmacao = window.confirm(
      `Tem certeza que deseja excluir a playlist "${playlist.name}"? (Suas músicas continuarão salvas na biblioteca)`
    );
    if (!confirmacao) return;

    try {
      const res = await fetch(`http://localhost:8000/playlists/${playlist.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (onPlaylistsChange) {
          onPlaylistsChange(prev => prev.filter(p => p.id !== playlist.id));
        }
        if (managingPlaylistId === playlist.id) {
          setManagingPlaylistId(null);
        }
      } else {
        const errData = await res.json();
        alert(`Erro ao excluir playlist: ${errData.detail || 'Tente novamente.'}`);
      }
    } catch (err) {
      console.error('Erro ao excluir playlist:', err);
      alert('Erro ao conectar com o servidor para excluir a playlist.');
    }
  };

  const handleOpenManageSongs = (playlist) => {
    setManagingPlaylistId(playlist.id);
    setManageSongSearch('');
    setSelectedSongIdsToAdd([]);
    setIsAddSongsModalOpen(false);
  };

  const handleToggleSongToAdd = (songId) => {
    setSelectedSongIdsToAdd(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleAddSongsToPlaylist = async (songIdsToAdd) => {
    if (!managingPlaylist || !songIdsToAdd || songIdsToAdd.length === 0) return;
    setManageSongsLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/playlists/${managingPlaylist.id}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: songIdsToAdd }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onPlaylistsChange && data.playlist) {
          onPlaylistsChange(prev =>
            prev.map(p => (p.id === data.playlist.id ? data.playlist : p))
          );
        }
        setSelectedSongIdsToAdd(prev => prev.filter(id => !songIdsToAdd.includes(id)));
      }
    } catch (err) {
      console.error('Erro ao adicionar músicas à playlist:', err);
    } finally {
      setManageSongsLoading(false);
    }
  };

  const handleRemoveSongFromPlaylist = async (playlistId, songId) => {
    setManageSongsLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/playlists/${playlistId}/songs/${songId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        if (onPlaylistsChange && data.playlist) {
          onPlaylistsChange(prev =>
            prev.map(p => (p.id === data.playlist.id ? data.playlist : p))
          );
        }
      }
    } catch (err) {
      console.error('Erro ao remover música da playlist:', err);
    } finally {
      setManageSongsLoading(false);
    }
  };

  // Obter iniciais do usuário para o avatar do cabeçalho
  const userInitials = useMemo(() => {
    if (!email) return 'EC';
    const namePart = email.split('@')[0];
    return namePart.slice(0, 2).toUpperCase();
  }, [email]);

  return (
    <div 
      ref={dashboardRootRef}
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
      {/* 0. CAMADA PARALLAX 3D DE SALA DE CONTROLE (AMP, MIC, MIXER & MONITORES)   */}
      {/* ========================================================================= */}
      <DashboardStudioBackground
        studioLiveMode={studioLiveMode}
        phantomPower={phantomPower}
        hoveredSong={hoveredSong}
      />

      {/* ========================================================================= */}
      {/* 1. CABEÇALHO GLOBAL COM GLASSMORHPISM E PERFIL                           */}
      {/* ========================================================================= */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40 transition-all">
        {/* Identidade da Marca e Alternador de Tema no Canto Superior Esquerdo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
            title="EasyCovers - Ir para o início"
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
                  Studio
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden md:block">
                Inteligência Artificial para Músicos
              </span>
            </div>
          </div>

          {/* Botão de Alternância On/Off de Modo Escuro / Claro */}
          <ThemeToggle />
        </div>

        {/* Ações de Usuário e Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate('/profile')} 
            className="flex items-center gap-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-1.5 px-3.5 sm:px-4 rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 group"
            title="Acessar dados do seu perfil"
          >
            {user?.profile_picture_url ? (
              <img 
                src={user.profile_picture_url} 
                alt="Foto de Perfil" 
                className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-xs" 
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white text-xs font-black flex items-center justify-center shadow-xs">
                {userInitials}
              </div>
            )}
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-[var(--color-brand-deep)] max-w-[120px] sm:max-w-[160px] truncate hidden sm:inline">
              {user?.username || (email ? email.split('@')[0] : 'Meu Perfil')}
            </span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold text-sm rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/40 flex items-center gap-1.5 active:scale-95"
              title="Encerrar sessão"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span className="hidden md:inline">Sair</span>
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. ÁREA PRINCIPAL                                                         */}
      {/* ========================================================================= */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        
        {/* HERO DA BIBLIOTECA + HARDWARE INTERATIVO DE ESTÚDIO (RACK 2.5D/SVG) */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-lg border border-white/70 dark:border-slate-800/90 mb-8 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-12 w-56 h-56 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Coluna Esquerda do Hero: Identidade da Biblioteca + Botão Primário de Upload */}
          <div className="flex-1 min-w-0 z-10 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      studioLiveMode
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-[var(--color-brand-medium)]'
                    }`}
                  />
                  Sala de Controle • Painel do Músico
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] tracking-tight text-balance">
                Sua Biblioteca de Músicas
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-1.5 max-w-xl font-normal leading-relaxed text-pretty">
                Isole stems acústicos com inteligência artificial, transponha afinações e controle o volume de cada instrumento na sua bancada de estúdio.
              </p>
            </div>

            {/* Ação Principal de Upload + Micro-estatísticas */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button 
                onClick={() => navigate('/upload')} 
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-6 py-3.5 rounded-xl studio-btn-transition shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group cursor-pointer shrink-0"
              >
                <img 
                  src="/assets/icons/icon_upload_cloud_white.png" 
                  alt="Upload" 
                  className="w-6 h-6 object-contain transition-transform duration-200 group-hover:-translate-y-0.5" 
                />
                <span className="text-base tracking-wide">Adicionar Música</span>
              </button>

              {songs.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-800 dark:text-slate-100 text-sm">{metrics.total}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">música{metrics.total !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-800 dark:text-slate-100 text-sm">{metrics.genreCount}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">gênero{metrics.genreCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    6 STEMS PRONTOS
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita do Hero: Rack de Hardware Interativo (Tube Amp + VU Meters + Monitores + Knobs) */}
          <div className="z-10 flex justify-center lg:justify-end">
            <DashboardHeroStudioRack
              metrics={metrics}
              hoveredSong={hoveredSong}
              studioLiveMode={studioLiveMode}
              onToggleStudioLive={() => setStudioLiveMode((v) => !v)}
              phantomPower={phantomPower}
              onTogglePhantomPower={() => setPhantomPower((v) => !v)}
              filterGenre={activeTab === 'songs' ? filterGenre : playlistFilterGenre}
              availableGenres={generosDisponiveis}
              onSelectGenre={(genre) => {
                if (activeTab === 'songs') setFilterGenre(genre);
                else setPlaylistFilterGenre(genre);
              }}
              viewMode={activeTab === 'songs' ? viewMode : playlistViewMode}
              onToggleViewMode={(nextMode) => {
                if (activeTab === 'songs') setViewMode(nextMode);
                else setPlaylistViewMode(nextMode);
              }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2.5 ABAS PRINCIPAIS DA BIBLIOTECA: MÚSICAS E PLAYLISTS                    */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div
            role="tablist"
            aria-label="Visualização da Biblioteca"
            className="inline-flex items-center p-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xs self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'songs'}
              onClick={() => setActiveTab('songs')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                activeTab === 'songs'
                  ? 'bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <MusicNoteIcon className="w-4 h-4" />
              <span>Músicas</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-black tabular-nums ${
                  activeTab === 'songs'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {songs.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'playlists'}
              onClick={() => setActiveTab('playlists')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                activeTab === 'playlists'
                  ? 'bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <PlaylistIcon className="w-4 h-4" />
              <span>Playlists</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-black tabular-nums ${
                  activeTab === 'playlists'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {playlists.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCreatePlaylist}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 text-[var(--color-brand-medium)] dark:text-blue-400 font-extrabold px-5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/70 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-sm">Criar Playlist</span>
          </button>
        </div>

        {activeTab === 'songs' ? (
          <>
        {/* ========================================================================= */}
        {/* 3. BARRA DE FERRAMENTAS AVANÇADA (BUSCA, FILTROS E ORDENAÇÃO)            */}
        {/* ========================================================================= */}
        {songs.length > 0 && (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 dark:border-slate-800 mb-6 flex flex-col gap-4">
            
            {/* Linha Principal de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              
              {/* Campo: Busca por Música */}
              <div className="lg:col-span-4 relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar por nome da música..." 
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full pl-11 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all"
                />
                {searchName && (
                  <button 
                    onClick={() => setSearchName('')}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs rounded-md"
                    title="Limpar campo"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Campo: Busca por Artista */}
              <div className="lg:col-span-3 relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar por artista..." 
                  value={searchArtist}
                  onChange={(e) => setSearchArtist(e.target.value)}
                  className="w-full pl-11 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all"
                />
                {searchArtist && (
                  <button 
                    onClick={() => setSearchArtist('')}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs rounded-md"
                    title="Limpar campo"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Select: Gênero Musical */}
              <div className="lg:col-span-2 relative">
                <select 
                  value={filterGenre} 
                  onChange={(e) => setFilterGenre(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Todos os Gêneros</option>
                  {generosDisponiveis.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Select: Ordenação */}
              <div className="lg:col-span-2 relative">
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all cursor-pointer appearance-none"
                >
                  <option value="date_desc">Mais recentes</option>
                  <option value="date_asc">Mais antigos</option>
                  <option value="name_asc">Nome (A-Z)</option>
                  <option value="artist_asc">Artista (A-Z)</option>
                  <option value="genre_asc">Gênero (A-Z)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Alternador de Visualização: Lista ou Grade */}
              <div className="lg:col-span-1 flex items-center justify-end gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex-1 flex items-center justify-center p-1.5 rounded-lg transition-all ${
                    viewMode === 'list' 
                      ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-medium)] dark:text-blue-400 shadow-xs font-bold' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title="Exibição em Lista detalhada"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 flex items-center justify-center p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-medium)] dark:text-blue-400 shadow-xs font-bold' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title="Exibição em Grade de cartões 3D"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                </button>
              </div>

            </div>

            {/* Linha Secundária: Resumo dos Resultados e Chips de Filtros Ativos */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                <span>
                  Exibindo <strong className="text-slate-800 dark:text-slate-200 font-bold">{processedSongs.length}</strong> de <strong className="text-slate-800 dark:text-slate-200 font-bold">{songs.length}</strong> faixa{songs.length !== 1 ? 's' : ''}
                </span>
                {isFiltered && (
                  <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                    Filtros ativos
                  </span>
                )}
              </div>

              {isFiltered && (
                <div className="flex flex-wrap items-center gap-2">
                  {searchName && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                      Música: "{searchName}"
                      <button onClick={() => setSearchName('')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  {searchArtist && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                      Artista: "{searchArtist}"
                      <button onClick={() => setSearchArtist('')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  {filterGenre && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                      Gênero: {filterGenre}
                      <button onClick={() => setFilterGenre('')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  {sortBy !== 'date_desc' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                      Ordem modificada
                      <button onClick={() => setSortBy('date_desc')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  <button 
                    onClick={handleClearFilters}
                    className="text-red-600 hover:text-red-700 hover:underline font-bold px-1 transition"
                  >
                    Limpar todos
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. LISTA / GRADE DE MÚSICAS COM INCLINAÇÃO 3D (TILT) OU ESTADOS VAZIOS    */}
        {/* ========================================================================= */}

        {/* ESTADO VAZIO 1: Nenhuma música cadastrada no perfil (Vitrine 3D do Estúdio Pronta) */}
        {songs.length === 0 ? (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-10 shadow-md border border-slate-200/90 dark:border-slate-800 text-center flex flex-col items-center max-w-3xl mx-auto my-6">
            <div className="w-36 h-36 sm:w-44 sm:h-44 mb-4 relative">
              <img 
                src="/assets/empty_state.jpg" 
                alt="Biblioteca Vazia" 
                className="w-full h-full object-contain drop-shadow-sm rounded-2xl"
              />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">
              Sua bancada de estúdio está pronta para gravar
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-lg mb-6 font-normal">
              As válvulas já estão aquecidas! Envie um arquivo de áudio ou cole um link do YouTube para isolar 6 faixas com IA e acionar os medidores da mesa.
            </p>

            {/* Vitrine 3D dos 4 Equipamentos da Sala de Controle */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mb-7">
              {STUDIO_GEAR_SHOWCASE.map((gear) => (
                <StudioTiltCard
                  key={gear.id}
                  maxTilt={6}
                  hoverScale={1.03}
                  className={`p-3 rounded-2xl border flex flex-col items-center text-center relative overflow-hidden ${gear.borderClass}`}
                >
                  <img
                    src={gear.img}
                    alt={gear.name}
                    className="w-20 h-20 object-contain drop-shadow-md mb-2"
                    loading="lazy"
                  />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">
                    {gear.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold mt-0.5 ${gear.badgeClass}`}>
                    {gear.spec}
                  </span>
                </StudioTiltCard>
              ))}
            </div>

            {/* Mini-passo a passo para novos usuários */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left mb-8">
              <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <span className="text-xs font-black text-[var(--color-brand-medium)] block mb-1">1. ENVIAR</span>
                <p className="text-xs text-slate-600 dark:text-slate-300">Envie áudio em MP3/WAV ou insira o link do YouTube.</p>
              </div>
              <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <span className="text-xs font-black text-[var(--color-brand-medium)] block mb-1">2. IA PROCESSA</span>
                <p className="text-xs text-slate-600 dark:text-slate-300">Separação de 6 instrumentos (Voz, Bateria, Baixo, etc.).</p>
              </div>
              <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <span className="text-xs font-black text-[var(--color-brand-medium)] block mb-1">3. MIXER</span>
                <p className="text-xs text-slate-600 dark:text-slate-300">Mute seu instrumento e toque com a backing track perfeita.</p>
              </div>
            </div>

            <button 
              onClick={() => navigate('/upload')} 
              className="flex items-center gap-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-extrabold px-8 py-3.5 rounded-xl studio-btn-transition shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <img src="/assets/icons/icon_upload_cloud_white.png" alt="Adicionar" className="w-5 h-5 object-contain" />
              <span>Adicionar Primeira Música</span>
            </button>
          </div>
        ) : processedSongs.length === 0 ? (
          /* ESTADO VAZIO 2: Pesquisa ou filtro sem resultados */
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-10 shadow-xs border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1.5">
              Nenhuma música encontrada
            </h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5">
              Não encontramos nenhuma faixa compatível com os filtros atuais. Verifique se o nome ou artista foi digitado corretamente.
            </p>
            <button 
              onClick={handleClearFilters}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-sm rounded-xl transition active:scale-95"
            >
              Redefinir Filtros de Busca
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* ======================================================================= */
          /* MODO LISTA: Cartões horizontais estilo Channel Strip DAW com 3D Tilt    */
          /* ======================================================================= */
          <div className="flex flex-col gap-3.5">
            {processedSongs.map(song => {
              const isHovered = hoveredSong?.id === song.id;
              return (
                <StudioTiltCard
                  key={song.id}
                  maxTilt={1.5}
                  hoverScale={1.004}
                  onHoverStart={() => setHoveredSong(song)}
                  onHoverEnd={() =>
                    setHoveredSong((prev) => (prev?.id === song.id ? null : prev))
                  }
                  className="group bg-white/95 dark:bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden"
                >
                  {/* Faixa decorativa lateral esquerda estilo LED de Canal */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[var(--color-brand-medium)] via-indigo-500 to-amber-500 opacity-90 group-hover:w-2 transition-all duration-200"></div>

                  {/* Bloco 1: Capa/Vinil e Metadados Principais */}
                  <div className="flex items-center gap-4 flex-1 w-full min-w-0 pl-1 sm:pl-2 relative z-10">
                    {/* Capa de Ambientação do Gênero */}
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-900 shrink-0 shadow-sm border border-slate-200/80 dark:border-slate-800 group-hover:scale-105 group-hover:shadow-md transition-all duration-300 studio-img-outline">
                      <img 
                        src={song.cover_image_url || getGenreImage(song.genre)} 
                        alt={song.name || song.genre || "Capa da música"} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                    </div>

                    {/* Informações de Título e Artista */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-brand-deep)] truncate tracking-tight">
                          {song.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold truncate">
                        <span className="text-slate-400 dark:text-slate-500 font-normal">por</span>
                        <span className="truncate text-slate-700 dark:text-slate-300 font-bold">{song.artist || "Artista Desconhecido"}</span>
                      </div>

                      {/* Trechos de Estudo Salvos (Studio Practice Suite) */}
                      {(() => {
                        const markers = getSongPracticeMarkers(song);
                        if (markers.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                              <span>🎸</span> Treinos:
                            </span>
                            {markers.slice(0, 3).map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/mixer', { state: { song, initialMarker: m } });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 transition active:scale-95 cursor-pointer shadow-2xs"
                                title={`Abrir Mixer direto no trecho: ${m.name} (${formatMarkerTime(m.start)} - ${formatMarkerTime(m.end)})`}
                              >
                                <span>{m.name}</span>
                                <span className="text-[10px] opacity-70 tabular-nums">[{formatMarkerTime(m.start)}]</span>
                              </button>
                            ))}
                            {markers.length > 3 && (
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                +{markers.length - 3}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Chips rápidos mobile */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 md:hidden">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          {song.genre || "Geral"}
                        </span>
                        {song.instrument && (
                          <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            {song.instrument}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Badges e Tags Musicais + Mini Equalizador Reativo (Desktop / Tablet) */}
                  <div className="hidden md:flex flex-wrap items-center gap-2 shrink-0 relative z-10">
                    {/* Mini Equalizador Acústico quando em foco */}
                    {isHovered && (
                      <div
                        className="flex items-end gap-0.5 h-5 px-2 py-1 rounded-lg bg-slate-900 dark:bg-slate-950 border border-blue-500/40"
                        aria-hidden="true"
                        title="Sinal enviado para o VU Meter do Rack"
                      >
                        <span className="w-1 bg-amber-400 rounded-full eq-bar-1" />
                        <span className="w-1 bg-blue-400 rounded-full eq-bar-2" />
                        <span className="w-1 bg-emerald-400 rounded-full eq-bar-3" />
                        <span className="w-1 bg-purple-400 rounded-full eq-bar-4" />
                      </div>
                    )}

                    {/* Badge de Gênero */}
                    <span className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                      {song.genre || "Geral"}
                    </span>

                    {/* Badge de Instrumento */}
                    {song.instrument && (
                      <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-xs px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider border border-blue-200/80 dark:border-blue-900/50 inline-flex items-center gap-1.5">
                        <GuitarIcon className="w-3.5 h-3.5" />
                        <span>{song.instrument}</span>
                      </span>
                    )}

                    {/* Badge de Tom Original (se existir no objeto song) */}
                    {song.original_key && song.original_key !== 'Unknown' && (
                      <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs px-2.5 py-1.5 rounded-xl font-extrabold uppercase tracking-wider border border-amber-200 dark:border-amber-800/60">
                        Tom: {song.original_key}
                      </span>
                    )}

                    {/* Status 6 Stems IA */}
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-extrabold border border-emerald-200 dark:border-emerald-800/60" title="Faixas separadas prontas no mixer">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      6 Stems
                    </span>
                  </div>

                  {/* Bloco 3: Ações (Abrir Mixer e Excluir) */}
                  <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 relative z-10">
                    {/* Botão Primário: Tocar / Abrir Mixer */}
                    <button 
                      onClick={() => navigate('/mixer', { state: { song } })} 
                      className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-6 py-2.5 rounded-xl studio-btn-transition shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                      title={`Abrir mixer de stems para ${song.name}`}
                    >
                      <img 
                        src="/assets/icons/icon_play_white.png" 
                        alt="Tocar" 
                        className="w-5 h-5 object-contain" 
                      />
                      <span className="text-sm tracking-wide">Abrir Mixer</span>
                    </button>

                    {/* Botão Secundário: Excluir com confirmação */}
                    <button 
                      onClick={() => onDeleteSong(song.id)} 
                      className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/40 cursor-pointer active:scale-95"
                      title={`Excluir "${song.name}" da biblioteca`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>

                </StudioTiltCard>
              );
            })}
          </div>
        ) : (
          /* ======================================================================= */
          /* MODO GRADE: Cartões 3D com Perspective Tilt e Rim-Light Glare           */
          /* ======================================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedSongs.map(song => {
              const isHovered = hoveredSong?.id === song.id;
              return (
                <StudioTiltCard
                  key={song.id}
                  maxTilt={4.2}
                  hoverScale={1.015}
                  onHoverStart={() => setHoveredSong(song)}
                  onHoverEnd={() =>
                    setHoveredSong((prev) => (prev?.id === song.id ? null : prev))
                  }
                  className="group bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Capa de Ambientação Superior */}
                  <div className="relative w-full h-44 sm:h-48 overflow-hidden bg-slate-900">
                    <img 
                      src={song.cover_image_url || getGenreImage(song.genre)} 
                      alt={song.name || song.genre || "Capa da música"} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    {/* Gradiente de sobreposição para contraste e elegância */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-black/20 to-black/30 pointer-events-none" />

                    {/* Badge de status do stem e tom sobre a capa */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      <span className="inline-flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-emerald-400 text-[11px] px-2.5 py-1 rounded-lg font-extrabold border border-emerald-500/30 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        6 Stems IA
                      </span>
                      {song.original_key && song.original_key !== 'Unknown' && (
                        <span className="bg-slate-900/80 backdrop-blur-md text-amber-300 text-[11px] px-2 py-0.5 rounded-md font-extrabold border border-amber-400/30 shadow-xs">
                          Tom: {song.original_key}
                        </span>
                      )}
                    </div>

                    {/* Badge de Gênero + Equalizador sobre a capa */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-200 text-[11px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider shadow-xs border border-white/60 dark:border-slate-700">
                        {song.genre || "Geral"}
                      </span>

                      {isHovered && (
                        <div
                          className="flex items-end gap-0.5 h-5 px-2 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-blue-400/40"
                          aria-hidden="true"
                        >
                          <span className="w-1 bg-amber-400 rounded-full eq-bar-1" />
                          <span className="w-1 bg-blue-400 rounded-full eq-bar-2" />
                          <span className="w-1 bg-emerald-400 rounded-full eq-bar-3" />
                          <span className="w-1 bg-purple-400 rounded-full eq-bar-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conteúdo Interno do Card */}
                  <div className="p-5 flex flex-col flex-1 justify-between relative z-10">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-brand-deep)] truncate tracking-tight mb-1" title={song.name}>
                        {song.name}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold truncate mb-3" title={song.artist}>
                        {song.artist || "Artista Desconhecido"}
                      </p>

                      {/* Badge de Instrumento */}
                      {song.instrument && (
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-[11px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border border-blue-200/80 dark:border-blue-900/50 inline-flex items-center gap-1">
                            <GuitarIcon className="w-3 h-3" />
                            <span>{song.instrument}</span>
                          </span>
                        </div>
                      )}

                      {/* Trechos de Estudo Salvos (Grid View) */}
                      {(() => {
                        const markers = getSongPracticeMarkers(song);
                        if (markers.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                              <span>🎸</span> Treinos:
                            </span>
                            {markers.slice(0, 2).map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/mixer', { state: { song, initialMarker: m } });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 transition active:scale-95 cursor-pointer shadow-2xs"
                                title={`Abrir Mixer no trecho: ${m.name} (${formatMarkerTime(m.start)} - ${formatMarkerTime(m.end)})`}
                              >
                                <span className="truncate max-w-[85px]">{m.name}</span>
                                <span className="text-[9px] opacity-70 tabular-nums">[{formatMarkerTime(m.start)}]</span>
                              </button>
                            ))}
                            {markers.length > 2 && (
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                +{markers.length - 2}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Rodapé do Card: Ações */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 mt-4">
                      <button 
                        onClick={() => navigate('/mixer', { state: { song } })} 
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold py-2.5 px-4 rounded-xl studio-btn-transition shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                      >
                        <img src="/assets/icons/icon_play_white.png" alt="Tocar" className="w-4 h-4 object-contain" />
                        <span className="text-sm">Abrir Mixer</span>
                      </button>

                      <button 
                        onClick={() => onDeleteSong(song.id)} 
                        className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition border border-transparent hover:border-red-100 dark:hover:border-red-900/40 active:scale-95 cursor-pointer"
                        title="Excluir música"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                </StudioTiltCard>
              );
            })}
          </div>
        )}
          </>
        ) : (
          /* ======================================================================= */
          /* ABA DE PLAYLISTS: BUSCA, FILTROS, ALTERNADOR DE EXIBIÇÃO E CARTÕES      */
          /* ======================================================================= */
          <>
            {playlists.length > 0 && (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 dark:border-slate-800 mb-6 flex flex-col gap-4">
                {/* Linha Principal de Filtros da Aba de Playlists */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                  {/* Campo: Busca por Nome ou Descrição da Playlist */}
                  <div className="lg:col-span-4 relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar playlist por nome ou descrição..."
                      value={playlistSearchName}
                      onChange={(e) => setPlaylistSearchName(e.target.value)}
                      className="w-full pl-11 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all"
                    />
                    {playlistSearchName && (
                      <button
                        type="button"
                        onClick={() => setPlaylistSearchName('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs rounded-md"
                        title="Limpar campo"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Campo: Busca por Música ou Artista dentro da Playlist */}
                  <div className="lg:col-span-3 relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                      <MusicNoteIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Filtrar por música ou artista..."
                      value={playlistSearchTrack}
                      onChange={(e) => setPlaylistSearchTrack(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all"
                    />
                    {playlistSearchTrack && (
                      <button
                        type="button"
                        onClick={() => setPlaylistSearchTrack('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs rounded-md"
                        title="Limpar campo"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Select: Filtro de Gênero ou Status da Playlist */}
                  <div className="lg:col-span-2 relative">
                    <select
                      value={playlistFilterGenre}
                      onChange={(e) => setPlaylistFilterGenre(e.target.value)}
                      className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all cursor-pointer appearance-none"
                    >
                      <option value="">Todos os Filtros</option>
                      <option value="__WITH_SONGS__">Com músicas</option>
                      <option value="__EMPTY__">Playlists vazias</option>
                      {generosDisponiveis.map(g => (
                        <option key={g} value={g}>Gênero: {g}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>

                  {/* Select: Ordenação de Playlists */}
                  <div className="lg:col-span-2 relative">
                    <select
                      value={playlistSortBy}
                      onChange={(e) => setPlaylistSortBy(e.target.value)}
                      className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all cursor-pointer appearance-none"
                    >
                      <option value="date_desc">Mais recentes</option>
                      <option value="date_asc">Mais antigas</option>
                      <option value="name_asc">Nome (A-Z)</option>
                      <option value="songs_desc">Mais músicas</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>

                  {/* Alternador de Visualização de Playlists: Lista ou Grade */}
                  <div className="lg:col-span-1 flex items-center justify-end gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setPlaylistViewMode('list')}
                      className={`flex-1 flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer ${
                        playlistViewMode === 'list'
                          ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-medium)] dark:text-blue-400 shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Exibição de Playlists em Lista"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaylistViewMode('grid')}
                      className={`flex-1 flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer ${
                        playlistViewMode === 'grid'
                          ? 'bg-white dark:bg-slate-700 text-[var(--color-brand-medium)] dark:text-blue-400 shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Exibição de Playlists em Grade 3D"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Linha Secundária: Resumo de Playlists e Chips de Filtros Ativos */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                    <span>
                      Exibindo <strong className="text-slate-800 dark:text-slate-200 font-bold">{processedPlaylists.length}</strong> de <strong className="text-slate-800 dark:text-slate-200 font-bold">{playlists.length}</strong> playlist{playlists.length !== 1 ? 's' : ''}
                    </span>
                    {isPlaylistFiltered && (
                      <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                        Filtros ativos
                      </span>
                    )}
                  </div>

                  {isPlaylistFiltered && (
                    <div className="flex flex-wrap items-center gap-2">
                      {playlistSearchName && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                          Playlist: "{playlistSearchName}"
                          <button type="button" onClick={() => setPlaylistSearchName('')} className="hover:text-red-500 ml-1">✕</button>
                        </span>
                      )}
                      {playlistSearchTrack && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                          Faixa/Artista: "{playlistSearchTrack}"
                          <button type="button" onClick={() => setPlaylistSearchTrack('')} className="hover:text-red-500 ml-1">✕</button>
                        </span>
                      )}
                      {playlistFilterGenre && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                          Filtro: {playlistFilterGenre === '__WITH_SONGS__' ? 'Com músicas' : playlistFilterGenre === '__EMPTY__' ? 'Vazias' : playlistFilterGenre}
                          <button type="button" onClick={() => setPlaylistFilterGenre('')} className="hover:text-red-500 ml-1">✕</button>
                        </span>
                      )}
                      {playlistSortBy !== 'date_desc' && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                          Ordem modificada
                          <button type="button" onClick={() => setPlaylistSortBy('date_desc')} className="hover:text-red-500 ml-1">✕</button>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleClearPlaylistFilters}
                        className="text-red-600 hover:text-red-700 hover:underline font-bold px-1 transition"
                      >
                        Limpar todos
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TELA DE PLAYLIST ABERTA (PREENCHE A ÁREA DE CONTEÚDO DO DASHBOARD) OU LISTAGEM DE PLAYLISTS */}
            {managingPlaylist ? (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-5 sm:p-8 shadow-md border border-slate-200/90 dark:border-slate-800 flex flex-col gap-6">
                {/* Cabeçalho da Playlist Aberta: Foto, Título e Descrição */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pb-6 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0 flex-1">
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-900 shrink-0 shadow-md border border-slate-200 dark:border-slate-700">
                      <img
                        src={
                          managingPlaylist.cover_image_url ||
                          (managingPlaylist.songs?.[0]
                            ? managingPlaylist.songs[0].cover_image_url || getGenreImage(managingPlaylist.songs[0].genre)
                            : getGenreImage('Rock'))
                        }
                        alt={managingPlaylist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                          <PlaylistIcon className="w-3.5 h-3.5" />
                          Playlist
                        </span>
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                          {(managingPlaylist.songs || []).length} música{(managingPlaylist.songs || []).length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight break-words">
                        {managingPlaylist.name}
                      </h3>

                      <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-1.5 leading-relaxed max-w-3xl">
                        {managingPlaylist.description || 'Sem descrição adicionada.'}
                      </p>
                    </div>
                  </div>

                  {/* Ação opcional de editar dados da playlist */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditPlaylist(managingPlaylist)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer self-start"
                    title="Editar nome, foto ou descrição da playlist"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                    <span>Editar Playlist</span>
                  </button>
                </div>

                {/* Lista de Músicas contidas na Playlist */}
                <div className="flex flex-col gap-3.5">
                  {(managingPlaylist.songs || []).length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 text-center flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[var(--color-brand-medium)] dark:text-blue-400 flex items-center justify-center mb-3 border border-blue-200/60 dark:border-blue-800/60">
                        <MusicNoteIcon className="w-7 h-7" />
                      </div>
                      <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">
                        Esta playlist ainda não possui músicas
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        Clique no botão azul <strong>"Adicionar Músicas"</strong> abaixo para escolher as faixas da sua biblioteca.
                      </p>
                    </div>
                  ) : displayedPlaylistSongs.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center flex flex-col items-center">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Nenhuma música desta playlist corresponde à pesquisa ou filtro acima.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearPlaylistFilters}
                        className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  ) : (
                    displayedPlaylistSongs.map(song => (
                      <div
                        key={song.id}
                        className="group bg-slate-50/90 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-2xs border border-slate-200/90 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[var(--color-brand-medium)] via-indigo-500 to-amber-500 opacity-90" />

                        {/* Dados da Música na Linha */}
                        <div className="flex items-center gap-4 flex-1 w-full min-w-0 pl-1 sm:pl-2">
                          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-900 shrink-0 shadow-xs border border-slate-200/80 dark:border-slate-700">
                            <img
                              src={song.cover_image_url || getGenreImage(song.genre)}
                              alt={song.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate tracking-tight">
                              {song.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                              <span className="truncate text-slate-700 dark:text-slate-300 font-bold">
                                {song.artist || 'Artista Desconhecido'}
                              </span>
                              <span>•</span>
                              <span className="bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                {song.genre || 'Geral'}
                              </span>
                              {song.instrument && (
                                <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                  <GuitarIcon className="w-3 h-3" />
                                  <span>{song.instrument}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ações da Linha: Botão de Mixer Grande + Ícone de Lixeira para Remover */}
                        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => navigate('/mixer', { state: { song } })}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-6 py-3 rounded-xl studio-btn-transition shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                            title={`Abrir mixer de stems para ${song.name}`}
                          >
                            <img
                              src="/assets/icons/icon_play_white.png"
                              alt="Tocar"
                              className="w-5 h-5 object-contain"
                            />
                            <span className="text-sm tracking-wide">Abrir Mixer</span>
                          </button>

                          <button
                            type="button"
                            disabled={manageSongsLoading}
                            onClick={() => handleRemoveSongFromPlaylist(managingPlaylist.id, song.id)}
                            className="p-3 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/40 cursor-pointer active:scale-95 disabled:opacity-50"
                            title={`Remover "${song.name}" da playlist`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Rodapé do Card da Playlist: Botão Azul "Adicionar Músicas" na Esquerda e Botão Branco "Concluir" na Direita */}
                <div className="pt-5 mt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setManageSongSearch('');
                      setSelectedSongIdsToAdd([]);
                      setIsAddSongsModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-6 py-3 rounded-xl studio-btn-transition shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Adicionar Músicas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSongsModalOpen(false);
                      setManagingPlaylistId(null);
                    }}
                    className="flex items-center justify-center px-7 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold border border-slate-200 shadow-xs hover:shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : playlists.length === 0 ? (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-10 shadow-md border border-slate-200/90 dark:border-slate-800 text-center flex flex-col items-center max-w-2xl mx-auto my-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-[var(--color-brand-medium)] dark:text-blue-400 mb-5 shadow-inner">
                  <PlaylistIcon className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                  Organize seu Repertório em Playlists
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-lg mb-6 font-normal">
                  Crie playlists personalizadas com nome, foto de capa e descrição para agrupar suas músicas de estudo, setlists de shows ou treinos por estilo.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreatePlaylist}
                  className="flex items-center gap-2.5 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-8 py-3.5 rounded-xl studio-btn-transition shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Criar Primeira Playlist</span>
                </button>
              </div>
            ) : processedPlaylists.length === 0 ? (
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-10 shadow-xs border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center max-w-xl mx-auto my-8">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1.5">
                  Nenhuma playlist encontrada
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5">
                  Não encontramos nenhuma playlist compatível com os filtros atuais.
                </p>
                <button
                  type="button"
                  onClick={handleClearPlaylistFilters}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-sm rounded-xl transition active:scale-95 cursor-pointer"
                >
                  Redefinir Filtros de Playlists
                </button>
              </div>
            ) : playlistViewMode === 'list' ? (
              /* MODO LISTA DE PLAYLISTS */
              <div className="flex flex-col gap-3.5">
                {processedPlaylists.map(playlist => {
                  const playlistSongs = Array.isArray(playlist.songs) ? playlist.songs : [];
                  const playlistGenres = Array.from(new Set(playlistSongs.map(s => s.genre).filter(Boolean)));
                  const coverSrc =
                    playlist.cover_image_url ||
                    (playlistSongs[0] ? (playlistSongs[0].cover_image_url || getGenreImage(playlistSongs[0].genre)) : getGenreImage('Rock'));

                  return (
                    <StudioTiltCard
                      key={playlist.id}
                      maxTilt={1.5}
                      hoverScale={1.004}
                      className="group bg-white/95 dark:bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-emerald-500 opacity-90 group-hover:w-2 transition-all duration-200" />

                      {/* Bloco 1: Capa + Título + Descrição + Prévia das Músicas */}
                      <div className="flex items-start sm:items-center gap-4 flex-1 w-full min-w-0 pl-1 sm:pl-2 relative z-10">
                        <div
                          onClick={() => handleOpenManageSongs(playlist)}
                          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-900 shrink-0 shadow-sm border border-slate-200/80 dark:border-slate-800 group-hover:scale-105 transition-all duration-300 cursor-pointer"
                        >
                          <img
                            src={coverSrc}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          <span className="absolute bottom-1.5 right-1.5 bg-slate-900/85 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums">
                            {playlistSongs.length}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <h3
                              onClick={() => handleOpenManageSongs(playlist)}
                              className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-brand-deep)] truncate tracking-tight cursor-pointer"
                            >
                              {playlist.name}
                            </h3>
                            <span className="bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 text-[11px] px-2.5 py-0.5 rounded-lg font-extrabold border border-blue-200/60 dark:border-blue-800/60 tabular-nums">
                              {playlistSongs.length} música{playlistSongs.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-1">
                            {playlist.description || 'Sem descrição adicionada.'}
                          </p>

                          {playlistSongs.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {playlistSongs.slice(0, 3).map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => navigate('/mixer', { state: { song: s } })}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-[var(--color-brand-medium)] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                                  title={`Abrir "${s.name}" no Mixer`}
                                >
                                  <span>▶</span>
                                  <span className="truncate max-w-[140px]">{s.name}</span>
                                </button>
                              ))}
                              {playlistSongs.length > 3 && (
                                <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                                  +{playlistSongs.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloco 2: Gêneros na Playlist */}
                      {playlistGenres.length > 0 && (
                        <div className="hidden lg:flex flex-wrap items-center gap-1.5 shrink-0 relative z-10">
                          {playlistGenres.slice(0, 2).map(g => (
                            <span
                              key={g}
                              className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Bloco 3: Ações da Playlist */}
                      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 relative z-10">
                        <button
                          type="button"
                          onClick={() => handleOpenManageSongs(playlist)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-4 py-2.5 rounded-xl studio-btn-transition shadow-xs hover:shadow-md active:scale-95 cursor-pointer text-sm"
                        >
                          <PlaylistIcon className="w-4 h-4" />
                          <span>Gerenciar Músicas</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditPlaylist(playlist)}
                          className="p-2.5 text-slate-500 hover:text-[var(--color-brand-medium)] dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer active:scale-95"
                          title="Editar nome, foto ou descrição da playlist"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePlaylist(playlist)}
                          className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition border border-transparent hover:border-red-100 dark:hover:border-red-900/40 cursor-pointer active:scale-95"
                          title={`Excluir playlist "${playlist.name}"`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </StudioTiltCard>
                  );
                })}
              </div>
            ) : (
              /* MODO GRADE DE PLAYLISTS */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {processedPlaylists.map(playlist => {
                  const playlistSongs = Array.isArray(playlist.songs) ? playlist.songs : [];
                  const playlistGenres = Array.from(new Set(playlistSongs.map(s => s.genre).filter(Boolean)));
                  const coverSrc =
                    playlist.cover_image_url ||
                    (playlistSongs[0] ? (playlistSongs[0].cover_image_url || getGenreImage(playlistSongs[0].genre)) : getGenreImage('Rock'));

                  return (
                    <StudioTiltCard
                      key={playlist.id}
                      maxTilt={4.2}
                      hoverScale={1.015}
                      className="group bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Capa da Playlist */}
                      <div
                        onClick={() => handleOpenManageSongs(playlist)}
                        className="relative w-full h-44 sm:h-48 overflow-hidden bg-slate-900 cursor-pointer"
                      >
                        <img
                          src={coverSrc}
                          alt={playlist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-black/30 pointer-events-none" />

                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md text-blue-300 text-[11px] px-2.5 py-1 rounded-lg font-extrabold border border-blue-400/30 shadow-xs tabular-nums">
                            <PlaylistIcon className="w-3.5 h-3.5" />
                            {playlistSongs.length} música{playlistSongs.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {playlistGenres.length > 0 && (
                          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
                            {playlistGenres.slice(0, 2).map(g => (
                              <span
                                key={g}
                                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider shadow-xs"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Corpo do Card da Playlist */}
                      <div className="p-5 flex flex-col flex-1 justify-between relative z-10">
                        <div>
                          <h3
                            onClick={() => handleOpenManageSongs(playlist)}
                            className="text-lg font-black text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-brand-deep)] truncate tracking-tight mb-1 cursor-pointer"
                            title={playlist.name}
                          >
                            {playlist.name}
                          </h3>
                          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm line-clamp-2 mb-3 min-h-[2.25rem]">
                            {playlist.description || 'Sem descrição adicionada.'}
                          </p>

                          {/* Lista compacta das músicas na playlist */}
                          {playlistSongs.length > 0 ? (
                            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                Faixas na playlist:
                              </span>
                              {playlistSongs.slice(0, 3).map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => navigate('/mixer', { state: { song: s } })}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/70 transition cursor-pointer text-left"
                                  title={`Abrir "${s.name}" no Mixer`}
                                >
                                  <span className="truncate">{s.name}</span>
                                  <span className="text-[10px] text-[var(--color-brand-medium)] dark:text-blue-400 shrink-0">
                                    Abrir Mixer →
                                  </span>
                                </button>
                              ))}
                              {playlistSongs.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenManageSongs(playlist)}
                                  className="text-[11px] font-bold text-[var(--color-brand-medium)] dark:text-blue-400 hover:underline text-left pt-0.5 cursor-pointer"
                                >
                                  Ver todas as {playlistSongs.length} músicas...
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 italic">
                              Nenhuma música adicionada ainda.
                            </div>
                          )}
                        </div>

                        {/* Rodapé de Ações */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => handleOpenManageSongs(playlist)}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold py-2.5 px-3 rounded-xl studio-btn-transition shadow-xs hover:shadow-md active:scale-95 cursor-pointer text-xs sm:text-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span>Adicionar / Ver Músicas</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditPlaylist(playlist)}
                            className="p-2.5 text-slate-400 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-95 cursor-pointer"
                            title="Editar playlist"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePlaylist(playlist)}
                            className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition border border-transparent hover:border-red-100 dark:hover:border-red-900/40 active:scale-95 cursor-pointer"
                            title="Excluir playlist"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </StudioTiltCard>
                  );
                })}
              </div>
            )}
          </>
        )}

      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: CRIAR / EDITAR PLAYLIST (NOME, FOTO E DESCRIÇÃO)                */}
      {/* ========================================================================= */}
      {isPlaylistFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60">
                  <PlaylistIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {editingPlaylist ? 'Editar Playlist' : 'Criar Nova Playlist'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defina o nome, foto de capa e descrição da sua playlist
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaylistFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlaylist} className="p-6 flex flex-col gap-4">
              {playlistFormError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs font-bold">
                  {playlistFormError}
                </div>
              )}

              {/* Seleção de Foto da Playlist */}
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
                  {playlistFormImagePreview && !playlistFormRemoveCover ? (
                    <img
                      src={playlistFormImagePreview}
                      alt="Preview da capa"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PlaylistIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Foto da Playlist (Opcional)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold cursor-pointer transition">
                      Escolher Imagem
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handlePlaylistImageChange}
                        className="hidden"
                      />
                    </label>
                    {playlistFormImagePreview && !playlistFormRemoveCover && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlaylistFormImageFile(null);
                          setPlaylistFormImagePreview('');
                          setPlaylistFormRemoveCover(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      >
                        Remover foto
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    PNG, JPG ou WEBP. Se não enviar, usaremos a arte das faixas.
                  </span>
                </div>
              </div>

              {/* Nome da Playlist */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nome da Playlist *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex.: Repertório Acústico, Treino de Guitarra..."
                  value={playlistFormName}
                  onChange={(e) => setPlaylistFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20"
                />
              </div>

              {/* Descrição da Playlist */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  placeholder="Anote detalhes do repertório, afinações ou objetivo desta playlist..."
                  value={playlistFormDescription}
                  onChange={(e) => setPlaylistFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPlaylistFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={playlistFormLoading}
                  className="px-6 py-2.5 rounded-xl text-sm font-extrabold bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-60"
                >
                  {playlistFormLoading
                    ? 'Salvando...'
                    : editingPlaylist
                    ? 'Salvar Alterações'
                    : 'Criar e Adicionar Músicas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ESCOLHER MÚSICAS DA BIBLIOTECA PARA ADICIONAR À PLAYLIST         */}
      {/* ========================================================================= */}
      {managingPlaylist && isAddSongsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Cabeçalho do Seletor de Músicas */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/60">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  Adicionar Músicas à Playlist
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha as músicas da sua biblioteca para incluir em <strong>{managingPlaylist.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSongsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Busca e Lista de Músicas da Biblioteca */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sua Biblioteca ({songs.length})
                </span>
                {selectedSongIdsToAdd.length > 0 && (
                  <button
                    type="button"
                    disabled={manageSongsLoading}
                    onClick={() => handleAddSongsToPlaylist(selectedSongIdsToAdd)}
                    className="text-xs font-extrabold px-3.5 py-1.5 rounded-xl bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white transition cursor-pointer shadow-xs"
                  >
                    + Adicionar Selecionadas ({selectedSongIdsToAdd.length})
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="Pesquisar música por nome, artista ou gênero..."
                value={manageSongSearch}
                onChange={(e) => setManageSongSearch(e.target.value)}
                className="w-full px-3.5 py-2.5 mb-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[var(--color-brand-medium)]"
              />

              {songs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                  <p>Sua biblioteca ainda não possui músicas cadastradas.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSongsModalOpen(false);
                      navigate('/upload');
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-[var(--color-brand-medium)] text-white font-bold cursor-pointer"
                  >
                    Enviar Música
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  {availableSongsForModal.map(song => {
                    const alreadyInPlaylist = (managingPlaylist.songs || []).some(s => s.id === song.id);
                    const isSelected = selectedSongIdsToAdd.includes(song.id);

                    return (
                      <div
                        key={song.id}
                        className={`flex items-center justify-between gap-2.5 p-3 rounded-xl border transition ${
                          alreadyInPlaylist
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 opacity-75'
                            : isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {!alreadyInPlaylist && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSongToAdd(song.id)}
                              className="w-4 h-4 rounded accent-[var(--color-brand-medium)] cursor-pointer shrink-0"
                            />
                          )}
                          <img
                            src={song.cover_image_url || getGenreImage(song.genre)}
                            alt={song.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                              {song.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {song.artist || 'Artista Desconhecido'} • {song.genre || 'Geral'}
                            </p>
                          </div>
                        </div>

                        {alreadyInPlaylist ? (
                          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 shrink-0">
                            Na playlist ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={manageSongsLoading}
                            onClick={() => handleAddSongsToPlaylist([song.id])}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white text-xs font-extrabold transition cursor-pointer shrink-0 shadow-2xs"
                          >
                            + Adicionar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsAddSongsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-sm font-extrabold shadow-xs transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
