import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SpotifyIcon,
  MixerFadersIcon,
  SparklesIcon,
  CheckCircleIcon,
  MusicNoteIcon,
  AlertCircleIcon,
} from './Icons';

const SpotifyHubSection = ({
  userId,
  spotifyConnection,
  onOpenConnectModal,
  onProfileRefresh,
}) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('playlists'); // 'playlists' | 'liked'
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);

  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [syncingTaste, setSyncingTaste] = useState(false);
  const [tasteSyncBanner, setTasteSyncBanner] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Estado para importar qualquer Playlist real do Spotify por link em 1 clique
  const [importPlaylistUrl, setImportPlaylistUrl] = useState('');
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [importErrorMsg, setImportErrorMsg] = useState('');

  // Player de prévia de 30s
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState(null);
  const audioRef = useRef(null);

  const isConnected = Boolean(spotifyConnection?.connected);

  const stopAudioPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingTrackId(null);
  }, []);

  useEffect(() => {
    return () => stopAudioPreview();
  }, [stopAudioPreview]);

  const fetchPlaylists = useCallback(async () => {
    if (!userId || !isConnected) return;
    setLoadingPlaylists(true);
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/playlists/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error('Erro ao buscar playlists do Spotify:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  }, [userId, isConnected]);

  const fetchLikedTracks = useCallback(async () => {
    if (!userId || !isConnected) return;
    setLoadingTracks(true);
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/liked-tracks/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setLikedTracks(data.tracks || []);
      }
    } catch (err) {
      console.error('Erro ao buscar músicas curtidas do Spotify:', err);
    } finally {
      setLoadingTracks(false);
    }
  }, [userId, isConnected]);

  useEffect(() => {
    if (isConnected) {
      fetchPlaylists();
      fetchLikedTracks();
    }
  }, [isConnected, fetchPlaylists, fetchLikedTracks]);

  const handleOpenPlaylist = async (pl) => {
    stopAudioPreview();
    setSelectedPlaylist(pl);
    setSearchFilter('');
    setLoadingTracks(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/spotify/playlists/${userId}/${pl.id}/tracks`
      );
      if (res.ok) {
        const data = await res.json();
        setPlaylistTracks(data.tracks || []);
      }
    } catch (err) {
      console.error('Erro ao abrir faixas da playlist:', err);
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleImportRealPlaylist = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!importPlaylistUrl.trim() || !userId) return;

    setImportingPlaylist(true);
    setImportErrorMsg('');
    setTasteSyncBanner('');

    try {
      const res = await fetch(`http://localhost:8000/api/spotify/import-playlist/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url: importPlaylistUrl.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.playlist) {
        setImportPlaylistUrl('');
        setTasteSyncBanner(data.message || 'Playlist importada com sucesso!');
        await fetchPlaylists();
        await fetchLikedTracks();
        if (onProfileRefresh) onProfileRefresh();
        // Abre automaticamente a playlist recém-importada para mostrar as músicas!
        handleOpenPlaylist(data.playlist);
      } else {
        setImportErrorMsg(
          data.detail || 'Não foi possível importar. Verifique se o link é de uma playlist pública do Spotify.'
        );
      }
    } catch (err) {
      console.error('Erro ao importar playlist:', err);
      setImportErrorMsg('Erro de conexão ao importar playlist do Spotify.');
    } finally {
      setImportingPlaylist(false);
    }
  };

  const handleImportLikedByUrl = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!importPlaylistUrl.trim() || !userId) return;

    setImportingPlaylist(true);
    setImportErrorMsg('');
    setTasteSyncBanner('');

    try {
      const res = await fetch(`http://localhost:8000/api/spotify/import-liked/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url: importPlaylistUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportPlaylistUrl('');
        setTasteSyncBanner(data.message || 'Músicas Curtidas importadas com sucesso!');
        await fetchLikedTracks();
      } else {
        setImportErrorMsg(
          data.detail || 'Link inválido. Cole o link de uma playlist ou música do Spotify e tente novamente.'
        );
      }
    } catch (err) {
      console.error('Erro ao importar músicas curtidas:', err);
      setImportErrorMsg('Erro de conexão ao importar Músicas Curtidas.');
    } finally {
      setImportingPlaylist(false);
    }
  };

  const handleToggleLikeTrack = async (track) => {
    if (!userId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/liked-tracks/${userId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          duration: track.duration || 0,
          cover: track.cover || '',
          preview: track.preview || '',
          external_url: track.external_url || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylistTracks((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, is_liked: data.is_liked } : t))
        );
        await fetchLikedTracks();
      }
    } catch (err) {
      console.error('Erro ao curtir/descurtir música:', err);
    }
  };

  const handleDeletePlaylist = async (e, plId) => {
    e.stopPropagation();
    if (!window.confirm('Remover esta playlist importada do seu perfil?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/playlists/${userId}/${plId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedPlaylist?.id === plId) {
          setSelectedPlaylist(null);
          setPlaylistTracks([]);
        }
        fetchPlaylists();
      }
    } catch (err) {
      console.error('Erro ao remover playlist:', err);
    }
  };

  const handleSyncMusicalTaste = async () => {
    if (!userId) return;
    setSyncingTaste(true);
    setTasteSyncBanner('');
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/sync-taste/${userId}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setTasteSyncBanner(
          `DNA Musical atualizado! Artistas sincronizados: ${(data.imported_artists || []).slice(0, 4).join(', ')}...`
        );
        if (onProfileRefresh) onProfileRefresh();
      }
    } catch (err) {
      console.error('Erro ao sincronizar DNA musical:', err);
    } finally {
      setSyncingTaste(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    if (!window.confirm('Deseja desvincular sua conta do Spotify do seu perfil EasyCovers?')) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/spotify/disconnect/${userId}`, {
        method: 'POST',
      });
      if (res.ok) {
        setPlaylists([]);
        setSelectedPlaylist(null);
        setPlaylistTracks([]);
        setLikedTracks([]);
        if (onProfileRefresh) onProfileRefresh();
      }
    } catch (err) {
      console.error('Erro ao desvincular Spotify:', err);
    }
  };

  // Toca prévia de 30s da música (usa preview oficial do Spotify ou busca automaticamente no catálogo Deezer)
  const handleTogglePreview = async (track) => {
    if (playingTrackId === track.id) {
      stopAudioPreview();
      return;
    }

    stopAudioPreview();
    let previewUrl = track.preview;

    if (!previewUrl) {
      setLoadingPreviewId(track.id);
      try {
        const q = `${track.title} ${track.artist}`;
        const res = await fetch(
          `http://localhost:8000/api/music/search?q=${encodeURIComponent(q)}&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          const first = (data.results || [])[0];
          if (first?.preview) {
            previewUrl = first.preview;
            track.preview = previewUrl;
          }
        }
      } catch (err) {
        console.warn('Não foi possível buscar preview alternativo:', err);
      } finally {
        setLoadingPreviewId(null);
      }
    }

    if (!previewUrl) {
      alert('Prévia de 30s indisponível para esta faixa.');
      return;
    }

    const audio = new Audio(previewUrl);
    audio.volume = 0.75;
    audio.onended = () => setPlayingTrackId(null);
    audio.play().catch((err) => console.warn('Erro ao reproduzir áudio:', err));
    audioRef.current = audio;
    setPlayingTrackId(track.id);
  };

  // Envia a faixa em 1 clique para a tela de Upload/Separação de 6 Stems
  const handleSendToStemSeparation = (track) => {
    stopAudioPreview();
    navigate('/upload', {
      state: {
        spotifyTrack: {
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          duration: track.duration || 0,
          cover: track.cover || '',
          suggested_genre: track.suggested_genre || 'Rock',
          original_key: track.original_key || 'Unknown',
        },
      },
    });
  };

  const handleOpenInMixer = (studioSong) => {
    stopAudioPreview();
    navigate('/mixer', {
      state: {
        song: {
          ...studioSong,
          folder: studioSong.folder_path || studioSong.folder,
        },
      },
    });
  };

  const formatDuration = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- ESTADO 1: CONTA SPOTIFY AINDA NÃO VINCULADA ---
  if (!isConnected) {
    return (
      <section className="mb-8 rounded-3xl overflow-hidden bg-gradient-to-r from-[#0B1528] via-[#0F243C] to-[#0A2E24] text-white shadow-lg border border-emerald-500/30 relative">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#1DB954]/15 blur-3xl pointer-events-none" />
        <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center shrink-0 shadow-md animate-spotify-pulse">
              <SpotifyIcon className="w-8 h-8 sm:w-9 sm:h-9 text-[#1DB954]" color="#1DB954" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1DB954]/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-1.5">
                <span>Integração Direta • Sem Chaves Necessárias</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Vincule seu Spotify e traga suas Playlists Reais
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                Importe qualquer playlist sua do Spotify colando apenas o link, ouça prévias de 30s e separe qualquer música em 6 stems (Voz, Guitarra, Baixo, Bateria, Piano e Outros) com 1 clique.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenConnectModal}
            className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-[#1DB954]/25 transition-all flex items-center justify-center gap-2.5 shrink-0 cursor-pointer"
          >
            <SpotifyIcon className="w-5 h-5 text-slate-950" color="#052e16" />
            <span>Vincular Conta do Spotify</span>
          </button>
        </div>
      </section>
    );
  }

  // Lista ativa de faixas filtrada pela busca
  const rawActiveTracks = activeTab === 'liked' ? likedTracks : playlistTracks;
  const filteredTracks = rawActiveTracks.filter((t) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      (t.title || '').toLowerCase().includes(term) ||
      (t.artist || '').toLowerCase().includes(term) ||
      (t.album || '').toLowerCase().includes(term)
    );
  });

  // --- ESTADO 2: CONTA SPOTIFY CONECTADA (HUB COMPLETO) ---
  return (
    <section className="mb-8 bg-white dark:bg-slate-900/95 rounded-3xl shadow-sm border border-emerald-500/30 dark:border-emerald-500/25 overflow-hidden transition-all">
      {/* Barra Superior do Hub Spotify */}
      <div className="bg-gradient-to-r from-[#0B1528] via-[#0F243C] to-[#0b3325] px-6 sm:px-8 py-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#1DB954] flex items-center justify-center shadow-md shrink-0">
            <SpotifyIcon className="w-7 h-7 text-slate-950" color="#052e16" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                Spotify Studio Hub
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
                <CheckCircleIcon className="w-3 h-3 text-emerald-400" />
                Conectado como {spotifyConnection.display_name || spotifyConnection.spotify_id}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Importe qualquer playlist pública do seu Spotify pelo link e separe suas faixas em 6 stems com IA
            </p>
          </div>
        </div>

        {/* Botões Rápidos: Sincronizar DNA Musical & Desvincular */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncMusicalTaste}
            disabled={syncingTaste}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Importar seus Artistas e Gêneros do Spotify para o perfil EasyCovers"
          >
            <SparklesIcon className="w-4 h-4 text-emerald-400" />
            <span>
              {syncingTaste ? 'Sincronizando DNA...' : 'Sincronizar DNA Musical'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDisconnectSpotify}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/40 text-slate-300 hover:text-red-200 text-xs font-bold transition-all cursor-pointer"
            title="Desvincular conta do Spotify"
          >
            Desvincular
          </button>
        </div>
      </div>

      {/* BARRA RÁPIDA: IMPORTAR QUALQUER PLAYLIST REAL DO SPOTIFY POR LINK */}
      <div className="px-6 sm:px-8 py-4 bg-emerald-50/70 dark:bg-emerald-950/25 border-b border-emerald-200/60 dark:border-emerald-900/50">
        <form onSubmit={handleImportRealPlaylist} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900 dark:text-emerald-300 shrink-0">
            <SpotifyIcon className="w-4 h-4 text-[#1DB954]" color="#1DB954" />
            <span>+ Importar Playlist do Spotify:</span>
          </div>
          <input
            type="text"
            value={importPlaylistUrl}
            onChange={(e) => setImportPlaylistUrl(e.target.value)}
            placeholder="Cole o link da sua playlist, álbum ou música (https://open.spotify.com/playlist/...)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/80 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
          />
          <button
            type="submit"
            disabled={importingPlaylist || !importPlaylistUrl.trim()}
            className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#18a349] disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-all shrink-0 cursor-pointer"
          >
            {importingPlaylist ? 'Importando...' : 'Importar Agora'}
          </button>
        </form>
        {importErrorMsg && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertCircleIcon className="w-4 h-4 shrink-0" />
            <span>{importErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Banner de Feedback de Sincronização de Gostos ou Playlist */}
      {tasteSyncBanner && (
        <div className="mx-6 sm:mx-8 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{tasteSyncBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setTasteSyncBanner('')}
            className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navegação de Abas Internas */}
      <div className="px-6 sm:px-8 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopAudioPreview();
              setActiveTab('playlists');
              setSelectedPlaylist(null);
              setSearchFilter('');
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'playlists'
                ? 'bg-[#1DB954] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Minhas Playlists ({playlists.length})
          </button>

          <button
            type="button"
            onClick={() => {
              stopAudioPreview();
              setActiveTab('liked');
              setSelectedPlaylist(null);
              setSearchFilter('');
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'liked'
                ? 'bg-[#1DB954] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>♥ Músicas Curtidas</span>
            {likedTracks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">
                {likedTracks.length}
              </span>
            )}
          </button>
        </div>

        {/* Filtro de Busca Rápida quando estiver vendo lista de músicas */}
        {(selectedPlaylist || activeTab === 'liked') && (
          <div className="flex items-center gap-2 w-full sm:w-64">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar música ou artista..."
              className="w-full px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
            />
          </div>
        )}
      </div>

      {/* Conteúdo Principal do Hub */}
      <div className="p-6 sm:p-8">
        {/* VISÃO 1: GRID DE PLAYLISTS */}
        {activeTab === 'playlists' && !selectedPlaylist && (
          <>
            {loadingPlaylists ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-[#1DB954] rounded-full animate-spin" />
                <p className="text-xs font-bold">Sincronizando suas playlists do Spotify...</p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
                Nenhuma playlist encontrada. Cole o link de uma playlist sua na barra acima para importar!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {playlists.map((pl) => {
                  const total = pl.tracks_total || 1;
                  const ready = pl.in_studio_count || 0;
                  const pct = Math.min(100, Math.round((ready / total) * 100));

                  return (
                    <div
                      key={pl.id}
                      onClick={() => handleOpenPlaylist(pl)}
                      className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-[#1DB954]/60 transition-all p-4 flex flex-col justify-between cursor-pointer shadow-2xs hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start gap-3.5 mb-3">
                          <img
                            src={pl.cover || '/assets/genres/genre_default.jpg'}
                            alt={pl.name}
                            className="w-16 h-16 rounded-xl object-cover shadow-sm shrink-0 border border-slate-200/60 dark:border-slate-700 group-hover:scale-105 transition-transform"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-[#1DB954] mb-0.5">
                                {pl.tracks_total} faixas {pl.is_custom_imported ? '• Importada' : ''}
                              </span>
                              {pl.is_custom_imported && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePlaylist(e, pl.id)}
                                  className="text-[11px] text-slate-400 hover:text-red-500 font-bold px-1.5 py-0.5 rounded"
                                  title="Remover playlist"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm group-hover:text-[#1DB954] transition-colors line-clamp-1">
                              {pl.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {pl.description || `Criada por ${pl.owner}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Barra de Progresso do Setlist no Estúdio */}
                      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                          <span className="text-slate-500 dark:text-slate-400">
                            No seu Estúdio EasyCovers
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {ready} de {pl.tracks_total} prontas
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1DB954] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* VISÃO 2: FAIXAS DE UMA PLAYLIST SELECIONADA OU MÚSICAS CURTIDAS */}
        {(selectedPlaylist || activeTab === 'liked') && (
          <div>
            {/* Cabeçalho da Playlist Selecionada */}
            {selectedPlaylist && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      stopAudioPreview();
                      setSelectedPlaylist(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all cursor-pointer"
                  >
                    ← Voltar
                  </button>
                  <img
                    src={selectedPlaylist.cover || '/assets/genres/genre_default.jpg'}
                    alt={selectedPlaylist.name}
                    className="w-12 h-12 rounded-xl object-cover shadow-xs"
                  />
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-slate-100 text-base">
                      {selectedPlaylist.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cada faixa exibe sua capa original • Clique em ♥ para salvar em Músicas Curtidas ou separe os 6 stems
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loadingTracks ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-[#1DB954] rounded-full animate-spin" />
                <p className="text-xs font-bold">Carregando faixas com capas originais do Spotify...</p>
              </div>
            ) : activeTab === 'liked' && likedTracks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center max-w-2xl mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-[#1DB954] flex items-center justify-center mx-auto mb-3 text-xl font-black">
                  ♥
                </div>
                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 mb-1.5">
                  Sua lista de Músicas Curtidas está vazia
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  No Spotify, a pasta <strong>Músicas Curtidas</strong> (<em>Liked Songs</em>) é privada por padrão e não fica pública no link do perfil. Você pode adicionar suas músicas curtidas aqui de duas formas:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-5">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mb-1">
                      1. Curtir direto nas suas Playlists (♥)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Abra qualquer uma das suas playlists importadas e clique no botão <strong>♥</strong> ao lado das músicas que desejar favoritar.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mb-1">
                      2. Importar Playlist de Curtidas
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      No Spotify (PC/Web), abra <em>Músicas Curtidas</em>, aperte <code className="font-mono">Ctrl+A</code> → <em>Adicionar à nova playlist</em> e cole o link abaixo:
                    </p>
                  </div>
                </div>
                <form onSubmit={handleImportLikedByUrl} className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
                  <input
                    type="text"
                    value={importPlaylistUrl}
                    onChange={(e) => setImportPlaylistUrl(e.target.value)}
                    placeholder="Cole o link da playlist com suas Músicas Curtidas..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
                  />
                  <button
                    type="submit"
                    disabled={importingPlaylist || !importPlaylistUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#18a349] disabled:opacity-50 text-white text-xs font-extrabold transition shrink-0 cursor-pointer"
                  >
                    {importingPlaylist ? 'Importando...' : 'Importar Curtidas'}
                  </button>
                </form>
              </div>
            ) : filteredTracks.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                Nenhuma faixa encontrada para o filtro informado.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredTracks.map((track) => {
                  const isPlaying = playingTrackId === track.id;
                  const isLoadingPrev = loadingPreviewId === track.id;
                  const isLiked = Boolean(track.is_liked) || activeTab === 'liked';

                  return (
                    <div
                      key={track.id}
                      className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        track.in_studio
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/70 dark:border-emerald-800/60'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700">
                          {track.cover ? (
                            <img
                              src={track.cover}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <MusicNoteIcon className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                              {track.title}
                            </h5>
                            {track.in_studio && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase tracking-wider">
                                ✓ Já no Estúdio
                              </span>
                            )}
                            {track.duration > 0 && (
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                {formatDuration(track.duration)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {track.artist} {track.album ? `• ${track.album}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Ações da Faixa: Curtir (♥) + Prévia 30s + Separar 6 Stems / Abrir no Mixer */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleLikeTrack(track)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer border ${
                            isLiked
                              ? 'bg-emerald-500/15 border-emerald-400/50 text-[#1DB954]'
                              : 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 hover:text-[#1DB954] border-slate-200 dark:border-slate-600'
                          }`}
                          title={isLiked ? 'Remover de Músicas Curtidas' : 'Adicionar às Músicas Curtidas'}
                        >
                          ♥
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePreview(track)}
                          disabled={isLoadingPrev}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isPlaying
                              ? 'bg-[#1DB954] text-white shadow-xs animate-pulse'
                              : 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                          }`}
                          title="Ouvir prévia de 30 segundos"
                        >
                          <span>{isLoadingPrev ? '...' : isPlaying ? '⏸ Pausar' : '▶ 30s'}</span>
                        </button>

                        {track.in_studio && track.studio_song ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInMixer(track.studio_song)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <MixerFadersIcon className="w-3.5 h-3.5 text-white" />
                            <span>Abrir no Mixer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendToStemSeparation(track)}
                            className="px-3.5 py-2 rounded-xl bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
                            <span>Separar 6 Stems</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default SpotifyHubSection;
