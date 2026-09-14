import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuitarIcon } from '../components/Icons';

const Dashboard = ({ email, user, songs = [], onDeleteSong, onLogout }) => {
  const navigate = useNavigate();

  // Estados para busca, filtros e ordenação
  const [searchName, setSearchName] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [sortBy, setSortBy] = useState('date_desc'); // Padrão: Mais recentes
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  // Lista de gêneros predefinidos (mesma do Upload)
  const generosDisponiveis = [
    "Rock", "Heavy Metal", "Grunge", "Indie Rock", "Rock Progressivo", 
    "Blues Rock", "Samba", "Bossa Nova", "MPB", "Sertanejo", "Música Clássica"
  ];

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

  // Obter iniciais do usuário para o avatar do cabeçalho
  const userInitials = useMemo(() => {
    if (!email) return 'EC';
    const namePart = email.split('@')[0];
    return namePart.slice(0, 2).toUpperCase();
  }, [email]);

  return (
    <div 
      className="font-sans min-h-screen bg-repeat text-slate-800 selection:bg-[var(--color-brand-medium)] selection:text-white"
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO GLOBAL COM GLASSMORHPISM E PERFIL                           */}
      {/* ========================================================================= */}
      <header className="bg-white/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40 transition-all">
        {/* Identidade da Marca */}
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
              <span className="hidden sm:inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-[var(--color-brand-medium)] border border-blue-200/60 tracking-wider">
                Studio
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 hidden md:block">
              Inteligência Artificial para Músicos
            </span>
          </div>
        </div>

        {/* Ações de Usuário e Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate('/profile')} 
            className="flex items-center gap-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3.5 sm:px-4 rounded-xl transition-all border border-slate-200 shadow-xs hover:border-slate-300 active:scale-95 group"
            title="Acessar dados do seu perfil"
          >
            {user?.profile_picture_url ? (
              <img 
                src={user.profile_picture_url} 
                alt="Foto de Perfil" 
                className="w-7 h-7 rounded-lg object-cover border border-slate-200 shadow-xs" 
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white text-xs font-black flex items-center justify-center shadow-xs">
                {userInitials}
              </div>
            )}
            <span className="text-sm font-bold text-slate-700 group-hover:text-[var(--color-brand-deep)] max-w-[120px] sm:max-w-[160px] truncate hidden sm:inline">
              {user?.username || (email ? email.split('@')[0] : 'Meu Perfil')}
            </span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 font-bold text-sm rounded-xl transition-colors border border-transparent hover:border-red-100 flex items-center gap-1.5 active:scale-95"
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        
        {/* HERO DA BIBLIOTECA & AÇÃO DE UPLOAD */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-xs border border-white/60 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex-1 min-w-0 z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-[var(--color-brand-medium)] border border-blue-200/60">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand-medium)] animate-pulse"></span>
                Painel do Músico
              </span>
              <span className="text-xs font-semibold text-slate-400">EasyCovers Engine</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] tracking-tight">
              Sua Biblioteca de Músicas
            </h2>
            <p className="text-slate-500 text-sm sm:text-base mt-1.5 max-w-2xl font-normal leading-relaxed">
              Isole stems acústicos com inteligência artificial, transponha afinações e controle o volume de cada instrumento individualmente.
            </p>

            {/* Micro-estatísticas da biblioteca */}
            {songs.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-800 text-sm">{metrics.total}</span>
                  <span className="text-slate-500 font-medium">música{metrics.total !== 1 ? 's' : ''}</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-800 text-sm">{metrics.genreCount}</span>
                  <span className="text-slate-500 font-medium">gênero{metrics.genreCount !== 1 ? 's' : ''}</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    6 STEMS
                  </span>
                  <span className="text-slate-500 font-medium">prontos para isolamento</span>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Adicionar Nova Música */}
          <div className="z-10 w-full md:w-auto shrink-0">
            <button 
              onClick={() => navigate('/upload')} 
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-6 py-3.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group cursor-pointer"
            >
              <img 
                src="/assets/icons/icon_upload_cloud_white.png" 
                alt="Upload" 
                className="w-6 h-6 object-contain transition-transform duration-200 group-hover:-translate-y-0.5" 
              />
              <span className="text-base tracking-wide">Adicionar Música</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. BARRA DE FERRAMENTAS AVANÇADA (BUSCA, FILTROS E ORDENAÇÃO)            */}
        {/* ========================================================================= */}
        {songs.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 mb-6 flex flex-col gap-4">
            
            {/* Linha Principal de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              
              {/* Campo: Busca por Música */}
              <div className="lg:col-span-4 relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar por nome da música..." 
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full pl-11 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-400 text-sm font-medium border border-slate-200 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all"
                />
                {searchName && (
                  <button 
                    onClick={() => setSearchName('')}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 text-xs rounded-md"
                    title="Limpar campo"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Campo: Busca por Artista */}
              <div className="lg:col-span-3 relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar por artista..." 
                  value={searchArtist}
                  onChange={(e) => setSearchArtist(e.target.value)}
                  className="w-full pl-11 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-400 text-sm font-medium border border-slate-200 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all"
                />
                {searchArtist && (
                  <button 
                    onClick={() => setSearchArtist('')}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 text-xs rounded-md"
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
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-700 text-sm font-medium border border-slate-200 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all cursor-pointer appearance-none"
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
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-white focus:bg-white text-slate-700 text-sm font-medium border border-slate-200 rounded-xl outline-none focus:border-[var(--color-brand-medium)] focus:ring-2 focus:ring-[var(--color-brand-medium)]/20 transition-all cursor-pointer appearance-none"
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
              <div className="lg:col-span-1 flex items-center justify-end gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex-1 flex items-center justify-center p-1.5 rounded-lg transition-all ${
                    viewMode === 'list' 
                      ? 'bg-white text-[var(--color-brand-medium)] shadow-xs font-bold' 
                      : 'text-slate-500 hover:text-slate-700'
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
                      ? 'bg-white text-[var(--color-brand-medium)] shadow-xs font-bold' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Exibição em Grade de cartões"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                </button>
              </div>

            </div>

            {/* Linha Secundária: Resumo dos Resultados e Chips de Filtros Ativos */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <span>
                  Exibindo <strong className="text-slate-800 font-bold">{processedSongs.length}</strong> de <strong className="text-slate-800 font-bold">{songs.length}</strong> faixa{songs.length !== 1 ? 's' : ''}
                </span>
                {isFiltered && (
                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    Filtros ativos
                  </span>
                )}
              </div>

              {isFiltered && (
                <div className="flex flex-wrap items-center gap-2">
                  {searchName && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
                      Música: "{searchName}"
                      <button onClick={() => setSearchName('')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  {searchArtist && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
                      Artista: "{searchArtist}"
                      <button onClick={() => setSearchArtist('')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  {filterGenre && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
                      Gênero: {filterGenre}
                      <button onClick={() => setFilterGenre('')} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  )}
                  {sortBy !== 'date_desc' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
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
        {/* 4. LISTA / GRADE DE MÚSICAS OU ESTADOS VAZIOS                             */}
        {/* ========================================================================= */}

        {/* ESTADO VAZIO 1: Nenhuma música cadastrada no perfil */}
        {songs.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200/90 text-center flex flex-col items-center max-w-2xl mx-auto my-6">
            <div className="w-48 h-48 mb-6 relative">
              <img 
                src="/assets/empty_state.jpg" 
                alt="Biblioteca Vazia" 
                className="w-full h-full object-contain drop-shadow-sm rounded-2xl"
              />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
              Sua biblioteca está vazia
            </h3>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md mb-6 font-normal">
              Você ainda não adicionou nenhuma música. Envie um arquivo de áudio ou cole um link do YouTube para isolar as faixas com IA!
            </p>

            {/* Mini-passo a passo para novos usuários */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left mb-8">
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                <span className="text-xs font-black text-[var(--color-brand-medium)] block mb-1">1. ENVIAR</span>
                <p className="text-xs text-slate-600">Envie áudio em MP3/WAV ou insira o link do YouTube.</p>
              </div>
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                <span className="text-xs font-black text-[var(--color-brand-medium)] block mb-1">2. IA PROCESSA</span>
                <p className="text-xs text-slate-600">Separação de 6 instrumentos (Voz, Bateria, Baixo, etc.).</p>
              </div>
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                <span className="text-xs font-black text-[var(--color-brand-medium)] block mb-1">3. MIXER</span>
                <p className="text-xs text-slate-600">Mute seu instrumento e toque com a backing track perfeita.</p>
              </div>
            </div>

            <button 
              onClick={() => navigate('/upload')} 
              className="flex items-center gap-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-extrabold px-8 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
            >
              <img src="/assets/icons/icon_upload_cloud_white.png" alt="Adicionar" className="w-5 h-5 object-contain" />
              <span>Adicionar Primeira Música</span>
            </button>
          </div>
        ) : processedSongs.length === 0 ? (
          /* ESTADO VAZIO 2: Pesquisa ou filtro sem resultados */
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-10 shadow-xs border border-slate-200 text-center flex flex-col items-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-1.5">
              Nenhuma música encontrada
            </h4>
            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              Não encontramos nenhuma faixa compatível com os filtros atuais. Verifique se o nome ou artista foi digitado corretamente.
            </p>
            <button 
              onClick={handleClearFilters}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-xl transition active:scale-95"
            >
              Redefinir Filtros de Busca
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* ======================================================================= */
          /* MODO LISTA: Cartões horizontais elegantes estilo DAW/Studio             */
          /* ======================================================================= */
          <div className="flex flex-col gap-3.5">
            {processedSongs.map(song => (
              <div 
                key={song.id} 
                className="group bg-white/95 backdrop-blur-xs p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden"
              >
                {/* Faixa decorativa lateral esquerda sutil */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] opacity-90 group-hover:w-2 transition-all duration-200"></div>

                {/* Bloco 1: Capa/Vinil e Metadados Principais */}
                <div className="flex items-center gap-4 flex-1 w-full min-w-0 pl-1 sm:pl-2">
                  {/* Capa de Disco / Vinil com gradiente */}
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300 border border-slate-700/30">
                    <div className="absolute inset-1 rounded-full border border-slate-600/40 opacity-70"></div>
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-[var(--color-brand-deep)] border-2 border-white/80 flex items-center justify-center shadow-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    </div>
                    <img 
                      src="/assets/icons/icon_music_note_white.png" 
                      alt="Nota" 
                      className="w-7 h-7 object-contain opacity-80 absolute top-1 right-1 pointer-events-none"
                    />
                  </div>

                  {/* Informações de Título e Artista */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-[var(--color-brand-deep)] truncate tracking-tight">
                        {song.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold truncate">
                      <span className="text-slate-400 font-normal">por</span>
                      <span className="truncate text-slate-700 font-bold">{song.artist || "Artista Desconhecido"}</span>
                    </div>

                    {/* Chips rápidos mobile */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 md:hidden">
                      <span className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
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

                {/* Bloco 2: Badges e Tags Musicais (Desktop / Tablet) */}
                <div className="hidden md:flex flex-wrap items-center gap-2 shrink-0">
                  {/* Badge de Gênero */}
                  <span className="bg-slate-100/90 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider border border-slate-200">
                    {song.genre || "Geral"}
                  </span>

                  {/* Badge de Instrumento */}
                  {song.instrument && (
                    <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-xs px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider border border-blue-200/80 inline-flex items-center gap-1.5">
                      <GuitarIcon className="w-3.5 h-3.5" />
                      <span>{song.instrument}</span>
                    </span>
                  )}

                  {/* Badge de Tom Original (se existir no objeto song) */}
                  {song.original_key && song.original_key !== 'Unknown' && (
                    <span className="bg-amber-50 text-amber-800 text-xs px-2.5 py-1.5 rounded-xl font-extrabold uppercase tracking-wider border border-amber-200">
                      Tom: {song.original_key}
                    </span>
                  )}

                  {/* Status 6 Stems IA */}
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-extrabold border border-emerald-200" title="Faixas separadas prontas no mixer">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    6 Stems
                  </span>
                </div>

                {/* Bloco 3: Ações (Abrir Mixer e Excluir) */}
                <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {/* Botão Primário: Tocar / Abrir Mixer */}
                  <button 
                    onClick={() => navigate('/mixer', { state: { song } })} 
                    className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold px-6 py-2.5 rounded-xl transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
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
                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 font-bold rounded-xl transition-colors border border-transparent hover:border-red-100 cursor-pointer active:scale-95"
                    title={`Excluir "${song.name}" da biblioteca`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>

              </div>
            ))}
          </div>
        ) : (
          /* ======================================================================= */
          /* MODO GRADE: Cartões modernos estilo streaming musical                   */
          /* ======================================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedSongs.map(song => (
              <div 
                key={song.id} 
                className="group bg-white/95 backdrop-blur-xs rounded-2xl shadow-xs border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between relative overflow-hidden"
              >
                {/* Topo do Card: Arte de Capa Vinil e Badges */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    {/* Vinil Estilizado */}
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300 border border-slate-700/30">
                      <div className="absolute inset-1 rounded-full border border-slate-600/40 opacity-70"></div>
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-[var(--color-brand-deep)] border-2 border-white/80 flex items-center justify-center shadow-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      </div>
                      <img 
                        src="/assets/icons/icon_music_note_white.png" 
                        alt="Nota" 
                        className="w-6 h-6 object-contain opacity-80 absolute top-1 right-1 pointer-events-none"
                      />
                    </div>

                    {/* Badge de status do stem */}
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] px-2.5 py-1 rounded-lg font-extrabold border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        6 Stems IA
                      </span>
                      {song.original_key && song.original_key !== 'Unknown' && (
                        <span className="bg-amber-50 text-amber-800 text-[11px] px-2 py-0.5 rounded-md font-extrabold border border-amber-200">
                          {song.original_key}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Textos: Título e Artista */}
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-[var(--color-brand-deep)] truncate tracking-tight mb-1" title={song.name}>
                    {song.name}
                  </h3>
                  <p className="text-slate-500 text-sm font-semibold truncate mb-4" title={song.artist}>
                    {song.artist || "Artista Desconhecido"}
                  </p>

                  {/* Badges de Gênero e Instrumento */}
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="bg-slate-100 text-slate-700 text-[11px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border border-slate-200">
                      {song.genre || "Geral"}
                    </span>
                    {song.instrument && (
                      <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-[11px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border border-blue-200/80 inline-flex items-center gap-1">
                        <GuitarIcon className="w-3 h-3" />
                        <span>{song.instrument}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Rodapé do Card: Ações */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button 
                    onClick={() => navigate('/mixer', { state: { song } })} 
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 text-white font-extrabold py-2.5 px-4 rounded-xl transition-all shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                  >
                    <img src="/assets/icons/icon_play_white.png" alt="Tocar" className="w-4 h-4 object-contain" />
                    <span className="text-sm">Abrir Mixer</span>
                  </button>

                  <button 
                    onClick={() => onDeleteSong(song.id)} 
                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-100 active:scale-95"
                    title="Excluir música"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;