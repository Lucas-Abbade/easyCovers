import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ email, songs, onDeleteSong, onLogout }) => {
  const navigate = useNavigate(); 
  
  // 1. Estados para controlar os filtros e a ordenação
  const [searchName, setSearchName] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [sortBy, setSortBy] = useState('date_desc'); // Padrão: Mais recentes primeiro

  // 2. Lógica para filtrar e ordenar as músicas
  // Fazemos uma cópia do array original para não bagunçar os dados reais
  let processedSongs = [...songs];

  // Aplicando Filtros
  if (searchName) {
    processedSongs = processedSongs.filter(song => 
      song.name.toLowerCase().includes(searchName.toLowerCase())
    );
  }
  if (searchArtist) {
    processedSongs = processedSongs.filter(song => 
      song.artist.toLowerCase().includes(searchArtist.toLowerCase())
    );
  }
  if (filterGenre) {
    processedSongs = processedSongs.filter(song => 
      song.genre === filterGenre
    );
  }

  // Aplicando Ordenação
  processedSongs.sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'artist_asc':
        return a.artist.localeCompare(b.artist);
      case 'genre_asc':
        return (a.genre || '').localeCompare(b.genre || '');
      case 'date_asc':
        return a.id - b.id; // Mais antigos primeiro (IDs menores)
      case 'date_desc':
      default:
        return b.id - a.id; // Mais recentes primeiro (IDs maiores)
    }
  });

  // Lista de gêneros predefinidos (a mesma do Upload) para o filtro
  const generosDisponiveis = [
    "Rock", "Heavy Metal", "Grunge", "Indie Rock", "Rock Progressivo", 
    "Blues Rock", "Samba", "Bossa Nova", "MPB", "Sertanejo", "Música Clássica"
  ];

  return (
    <div 
      className="font-sans min-h-screen bg-repeat"
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      <header className="bg-white/95 backdrop-blur-md shadow-md px-8 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/logo.jpg" 
            alt="EasyCovers Logo" 
            className="w-10 h-10 object-contain rounded-lg shadow-sm"
          />
          <h1 className="text-2xl font-extrabold text-[var(--color-brand-medium)]">
            EasyCovers
          </h1>
        </div>
  
        {/* NOVO: Botão de Perfil no canto superior direito */}
        <button 
          onClick={() => navigate('/profile')} 
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-5 rounded-full transition-all border border-gray-200 shadow-sm"
        >
          <span className="text-lg">👤</span>
          Meu Perfil
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-3xl font-bold text-gray-800">Sua Biblioteca</h2>
          <button 
            onClick={() => navigate('/upload')} 
            className="flex items-center gap-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-bold px-6 py-2.5 rounded-lg transition shadow-md whitespace-nowrap"
          >
            <img src="/assets/icons/icon_upload_cloud_white.png" alt="Upload" className="w-10 h-10 object-contain" />
            Adicionar Música
          </button>
        </div>

        {/* ========================================= */}
        {/* BARRA DE FERRAMENTAS (PESQUISA E FILTROS) */}
        {/* ========================================= */}
        {songs.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8 flex flex-col lg:flex-row gap-4">
            
            {/* Pesquisas por Texto */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="🔍 Buscar por nome da música..." 
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-[var(--color-brand-medium)] focus:ring-1 focus:ring-[var(--color-brand-medium)]"
              />
              <input 
                type="text" 
                placeholder="👤 Buscar por artista..." 
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-[var(--color-brand-medium)] focus:ring-1 focus:ring-[var(--color-brand-medium)]"
              />
            </div>

            {/* Filtro por Gênero */}
            <div className="w-full lg:w-48">
              <select 
                value={filterGenre} 
                onChange={(e) => setFilterGenre(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white cursor-pointer"
              >
                <option value="">Todos os Gêneros</option>
                {generosDisponiveis.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div className="w-full lg:w-48">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white cursor-pointer"
              >
                <option value="date_desc">Mais recentes</option>
                <option value="date_asc">Mais antigos</option>
                <option value="name_asc">Nome (A-Z)</option>
                <option value="artist_asc">Artista (A-Z)</option>
                <option value="genre_asc">Gênero (A-Z)</option>
              </select>
            </div>
            
            {/* Botão de Limpar Filtros (só aparece se algo estiver filtrado) */}
            {(searchName || searchArtist || filterGenre || sortBy !== 'date_desc') && (
              <button 
                onClick={() => {
                  setSearchName('');
                  setSearchArtist('');
                  setFilterGenre('');
                  setSortBy('date_desc');
                }}
                className="lg:self-center text-sm font-bold text-gray-500 hover:text-red-500 transition px-2"
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/* LISTA DE MÚSICAS                          */}
        {/* ========================================= */}
        {songs.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
            <img 
              src="/assets/empty_state.jpg" 
              alt="Biblioteca vazia" 
              className="w-56 h-auto object-contain mb-6 rounded-xl opacity-90"
            />
            <p className="text-gray-700 text-xl font-bold mb-2">Sua biblioteca está vazia.</p>
            <p className="text-gray-500 max-w-md">Adicione uma música para começar a mágica da separação de faixas com IA!</p>
            <button 
              onClick={() => navigate('/upload')} 
              className="mt-6 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-bold px-6 py-2.5 rounded-lg transition shadow-sm"
            >
              Adicionar primeira música
            </button>
          </div>
        ) : processedSongs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xl font-bold mb-2">Nenhuma música encontrada.</p>
            <p className="text-gray-400">Tente ajustar seus filtros ou termos de pesquisa.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {processedSongs.map(song => (
              <div 
                key={song.id} 
                className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-[var(--color-brand-medium)] hover:shadow-md transition flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                  <div className="hidden md:flex w-12 h-12 bg-blue-50/80 border border-blue-100 rounded-xl items-center justify-center shadow-inner shrink-0">
                    <img 
                      src="/assets/icons/icon_music_note.png" 
                      alt="Música" 
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <img 
                        src="/assets/icons/icon_music_note.png" 
                        alt="Nota" 
                        className="w-4 h-4 md:hidden object-contain shrink-0"
                      />
                      <h3 className="text-xl font-black text-gray-800 truncate leading-tight">{song.name}</h3>
                    </div>
                    <p className="text-gray-500 font-medium truncate">{song.artist}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide">
                    {song.genre || "N/A"}
                  </span>
                  <span className="bg-[var(--color-brand-light)] text-[var(--color-brand-deep)] text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide">
                    {song.instrument || "N/A"}
                  </span>
                </div>

                <div className="flex gap-3 w-full md:w-auto shrink-0">
                  <button 
                    onClick={() => navigate('/mixer', { state: { song } })} 
                    className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-bold px-7 py-2 rounded-lg transition shadow-sm"
                  >
                    <img src="/assets/icons/icon_play_white.png" alt="Tocar" className="w-10 h-10 object-contain" />
                    Tocar
                  </button>
                  <button 
                    onClick={() => onDeleteSong(song.id)} 
                    className="bg-red-50 hover:bg-red-100 text-red-500 font-bold px-5 py-2.5 rounded-lg transition"
                    title="Excluir"
                  >
                    Excluir
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