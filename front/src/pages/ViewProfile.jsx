import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  SpotifyIcon, 
  YouTubeIcon, 
  InstagramIcon, 
  XIcon, 
  GuitarIcon, 
  StarIcon, 
  ActivityChartIcon, 
  MixerFadersIcon, 
  MusicNoteIcon 
} from '../components/Icons';

const ViewProfile = ({ onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) {
        navigate('/');
        return;
      }

      const user = JSON.parse(savedUser);
      if (!user || !user.id) {
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8000/profile/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          
          // Mantém o cache local atualizado com a foto mais recente
          if (data.profile_picture_url !== user.profile_picture_url || data.username !== user.username) {
            const updated = { ...user, username: data.username, profile_picture_url: data.profile_picture_url };
            localStorage.setItem('user', JSON.stringify(updated));
          }
        } else {
          setError("Não foi possível carregar os dados do perfil.");
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
        setError("Erro ao conectar com o servidor.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  // Formatação de data de ingresso
  const formattedMemberDate = React.useMemo(() => {
    if (!profile?.created_at) return 'Membro recente';
    try {
      const date = new Date(profile.created_at);
      return `Membro desde ${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    } catch {
      return 'Membro do EasyCovers';
    }
  }, [profile?.created_at]);

  // Extração de tags de gêneros musicais
  const genreTags = React.useMemo(() => {
    if (!profile?.favorite_genres) return [];
    return profile.favorite_genres
      .split(',')
      .map(g => g.trim())
      .filter(Boolean);
  }, [profile?.favorite_genres]);

  // Extração de tags de artistas
  const artistTags = React.useMemo(() => {
    if (!profile?.favorite_artists) return [];
    return profile.favorite_artists
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);
  }, [profile?.favorite_artists]);

  // Iniciais para o fallback do avatar
  const initials = React.useMemo(() => {
    const name = profile?.full_name || profile?.username || profile?.email || 'EC';
    return name.slice(0, 2).toUpperCase();
  }, [profile]);

  // Formatação inteligente de URLs de redes sociais
  const formatSocialUrl = (network, value) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    switch (network) {
      case 'instagram':
        return `https://instagram.com/${trimmed.replace('@', '')}`;
      case 'spotify':
        return `https://open.spotify.com/search/${encodeURIComponent(trimmed)}`;
      case 'youtube':
        return trimmed.startsWith('@') 
          ? `https://youtube.com/${trimmed}` 
          : `https://youtube.com/@${trimmed}`;
      case 'x':
        return `https://x.com/${trimmed.replace('@', '')}`;
      default:
        return `https://${trimmed}`;
    }
  };

  if (loading) {
    return (
      <div 
        className="font-sans min-h-screen bg-repeat flex flex-col justify-center items-center p-4 text-slate-700"
        style={{ 
          backgroundImage: "url('/assets/dashboard_bg.jpg')",
          backgroundSize: "320px 320px",
          backgroundColor: "var(--color-brand-light)"
        }}
      >
        <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-lg flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[var(--color-brand-medium)] rounded-full animate-spin"></div>
          <p className="font-bold text-slate-600 animate-pulse">Carregando perfil musical...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div 
        className="font-sans min-h-screen bg-repeat flex flex-col justify-center items-center p-4"
        style={{ 
          backgroundImage: "url('/assets/dashboard_bg.jpg')",
          backgroundSize: "320px 320px",
          backgroundColor: "var(--color-brand-light)"
        }}
      >
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
            !
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">Erro ao carregar perfil</h2>
          <p className="text-slate-600 text-sm mb-6">{error || "Perfil não encontrado."}</p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all"
            >
              Voltar ao Dashboard
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-bold rounded-xl text-sm shadow-md transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="font-sans min-h-screen bg-repeat text-slate-800 selection:bg-[var(--color-brand-medium)] selection:text-white pb-16"
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      {/* 1. CABEÇALHO GLOBAL */}
      <header className="bg-white/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40 transition-all">
        <div 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
          title="EasyCovers - Ir para o Dashboard"
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
                Perfil
              </span>
            </div>
          </div>
        </div>

        {/* Botões de Ação do Topo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm shadow-xs active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          {/* Botão de Edição de Perfil */}
          <button 
            onClick={() => navigate('/edit-profile')} 
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-bold rounded-xl transition-all text-sm shadow-md hover:shadow-lg active:scale-95"
            title="Editar informações e preferências do perfil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <span>Editar Perfil</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Encerrar sessão"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* 2. ÁREA PRINCIPAL */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
        
        {/* CARD PRINCIPAL DE IDENTIDADE / HERO DO PERFIL */}
        <section className="bg-white rounded-3xl shadow-md border border-slate-200/80 overflow-hidden mb-8 transition-all">
          {/* Banner de Capa */}
          <div 
            className="h-48 sm:h-64 w-full bg-cover bg-center relative"
            style={{ 
              backgroundImage: profile.banner_picture_url 
                ? `url(${profile.banner_picture_url})` 
                : "linear-gradient(135deg, #0E1F4C 0%, #1A3F99 50%, #2B69E6 100%)"
            }}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-brightness-90"></div>
            
            {/* Botão rápido para trocar de banner */}
            <button
              onClick={() => navigate('/edit-profile')}
              className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-md transition-all flex items-center gap-1.5 shadow-sm"
              title="Personalizar banner"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <span>Alterar Capa</span>
            </button>
          </div>

          {/* Header Info com Avatar Sobreposto */}
          <div className="px-6 sm:px-10 pb-8 relative pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-6">
              {/* Foto de Perfil */}
              <div className="relative group">
                {profile.profile_picture_url ? (
                  <img 
                    src={profile.profile_picture_url} 
                    alt={profile.full_name || profile.username}
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl sm:rounded-3xl object-cover border-4 border-white shadow-xl bg-white"
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] text-white text-3xl sm:text-4xl font-black flex items-center justify-center border-4 border-white shadow-xl">
                    {initials}
                  </div>
                )}
                <button 
                  onClick={() => navigate('/edit-profile')}
                  className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-xl shadow-md backdrop-blur-xs transition-transform active:scale-90"
                  title="Alterar foto de perfil"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
              </div>

              {/* Botão de Edição Principal no Corpo */}
              <div className="w-full sm:w-auto flex items-center gap-3">
                <button 
                  onClick={() => navigate('/edit-profile')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                  <span>Editar Perfil</span>
                </button>
              </div>
            </div>

            {/* Nome, Handle e Badges */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {profile.full_name || profile.username}
                </h2>
                {profile.experience_level && (
                  <span className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-blue-50 text-[var(--color-brand-medium)] border border-blue-200/60">
                    {profile.experience_level}
                  </span>
                )}
                {profile.instrument && (
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center gap-1.5">
                    <GuitarIcon className="w-3.5 h-3.5 text-amber-600" />
                    <span>{profile.instrument}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500">
                <span className="text-[var(--color-brand-medium)] font-bold">
                  @{profile.username}
                </span>
                
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {profile.location}
                  </span>
                )}

                <span className="flex items-center gap-1 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {formattedMemberDate}
                </span>
              </div>

              {/* Bio */}
              <div className="pt-2">
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed max-w-3xl whitespace-pre-line">
                  {profile.bio || (
                    <span className="text-slate-400 italic">
                      Nenhuma biografia adicionada. Clique em "Editar Perfil" para contar um pouco sobre sua trajetória musical!
                    </span>
                  )}
                </p>
              </div>

              {/* Redes Sociais & Links Externos */}
              <div className="flex flex-wrap items-center gap-2.5 pt-3">
                {profile.social_spotify && (
                  <a 
                    href={formatSocialUrl('spotify', profile.social_spotify)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/70 text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 group"
                    title="Ouvir no Spotify (abre em nova aba)"
                  >
                    <SpotifyIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Spotify</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-emerald-600/70 group-hover:translate-x-0.5 transition-transform">
                      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                    </svg>
                  </a>
                )}

                {profile.social_youtube && (
                  <a 
                    href={formatSocialUrl('youtube', profile.social_youtube)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/70 text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 group"
                    title="Assistir no YouTube (abre em nova aba)"
                  >
                    <YouTubeIcon className="w-3.5 h-3.5 text-red-600" />
                    <span>YouTube</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-red-600/70 group-hover:translate-x-0.5 transition-transform">
                      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                    </svg>
                  </a>
                )}

                {profile.social_instagram && (
                  <a 
                    href={formatSocialUrl('instagram', profile.social_instagram)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/70 text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 group"
                    title="Ver no Instagram (abre em nova aba)"
                  >
                    <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
                    <span>Instagram</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-pink-600/70 group-hover:translate-x-0.5 transition-transform">
                      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                    </svg>
                  </a>
                )}

                {profile.social_x && (
                  <a 
                    href={formatSocialUrl('x', profile.social_x)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300/80 text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 group"
                    title="Seguir no X / Twitter (abre em nova aba)"
                  >
                    <XIcon className="w-3.5 h-3.5 text-slate-900" />
                    <span>X (Twitter)</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-700/70 group-hover:translate-x-0.5 transition-transform">
                      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                    </svg>
                  </a>
                )}

                {!profile.social_instagram && !profile.social_spotify && !profile.social_youtube && !profile.social_x && (
                  <span className="text-xs text-slate-400 font-medium italic">
                    Nenhum link social adicionado. Clique em "Editar Perfil" para conectar suas redes.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3. GRID DE CARDS COM DETALHES MUSICAIS E ESTATÍSTICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card: Gêneros Musicais Favoritos */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[var(--color-brand-medium)] flex items-center justify-center font-bold">
                  <GuitarIcon className="w-4 h-4 text-[var(--color-brand-medium)]" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">Gêneros Favoritos</h3>
              </div>
              
              {genreTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {genreTags.map((genre, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs italic">Nenhum gênero especificado.</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-400 font-medium">
              <span>Total selecionado</span>
              <span className="font-bold text-slate-600">{genreTags.length}</span>
            </div>
          </div>

          {/* Card: Artistas & Influências */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <StarIcon className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">Artistas Favoritos</h3>
              </div>

              {artistTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {artistTags.map((artist, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-amber-50 text-amber-800 rounded-lg text-xs font-bold border border-amber-200/50"
                    >
                      {artist}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs italic">Nenhum artista especificado.</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-400 font-medium">
              <span>Influências registradas</span>
              <span className="font-bold text-slate-600">{artistTags.length}</span>
            </div>
          </div>

          {/* Card: Estatísticas da Biblioteca */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <ActivityChartIcon className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">Atividade no Studio</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                  <div className="text-2xl font-black text-[var(--color-brand-medium)]">
                    {profile.songs_count || 0}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Músicas
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                  <div className="text-2xl font-black text-emerald-600">
                    {profile.instrument ? "1" : "0"}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Instrumento
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => navigate('/upload')}
                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[var(--color-brand-medium)] font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
              >
                <span>+ Enviar nova música</span>
              </button>
            </div>
          </div>

        </div>

        {/* 4. MÚSICAS RECENTES DA BIBLIOTECA */}
        <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Músicas na Biblioteca ({profile.songs_count || 0})
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Faixas processadas com stems de IA no seu estúdio
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs sm:text-sm font-bold text-[var(--color-brand-medium)] hover:underline"
            >
              Ver Todas no Dashboard ➔
            </button>
          </div>

          {profile.recent_songs && profile.recent_songs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {profile.recent_songs.map((song) => (
                <div 
                  key={song.id}
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-[var(--color-brand-medium)]/50 hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1">
                      <span className="uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        {song.genre || 'Gênero n/d'}
                      </span>
                      {song.original_key && song.original_key !== 'Unknown' && (
                        <span className="text-[var(--color-brand-medium)]">
                          Tom: {song.original_key}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-[var(--color-brand-medium)] truncate">
                      {song.name}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">
                      {song.artist || 'Artista desconhecido'}
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('/mixer')}
                    className="w-full py-1.5 bg-white hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center justify-center gap-1.5 shadow-2xs group/btn"
                  >
                    <MixerFadersIcon className="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-white transition-colors" />
                    <span>Abrir no Mixer</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--color-brand-medium)] flex items-center justify-center mx-auto mb-3 shadow-xs">
                <MusicNoteIcon className="w-6 h-6 text-[var(--color-brand-medium)]" />
              </div>
              <h4 className="font-bold text-slate-700 text-sm mb-1">Nenhuma música adicionada ainda</h4>
              <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                Faça o upload do seu primeiro arquivo de áudio ou link do YouTube para separar as faixas com IA.
              </p>
              <button
                onClick={() => navigate('/upload')}
                className="px-5 py-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Fazer Primeiro Upload
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default ViewProfile;