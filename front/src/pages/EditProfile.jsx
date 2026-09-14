import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AvatarEditor from 'react-avatar-editor';
import { 
  SparklesIcon, 
  PaletteIcon, 
  UserIcon, 
  GuitarIcon, 
  GlobeIcon, 
  FloppyIcon, 
  SpotifyIcon, 
  YouTubeIcon, 
  InstagramIcon, 
  XIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '../components/Icons';

const PRESET_GENRES = [
  "Rock", "Pop", "Heavy Metal", "Hard Rock", "Blues", 
  "MPB", "Jazz", "Samba", "Eletrônica", "Hip Hop", 
  "Funk", "Sertanejo", "Indie", "Música Clássica", "Reggae"
];

const INSTRUMENTS_LIST = [
  "Guitarra", "Violão", "Baixo", "Vocal", 
  "Bateria", "Teclado / Piano", "Saxofone / Metais", 
  "Produção / Beatmaker", "Outro"
];

const EXPERIENCE_LEVELS = [
  "Iniciante", "Intermediário", "Avançado", "Profissional / Produtor"
];

const EditProfile = ({ onUpdateUser }) => {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  // Flag para saber se veio do cadastro/primeiro login
  const isNewUser = Boolean(location.state?.isNewUser);

  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    bio: "",
    instrument: "",
    favorite_genres: "",
    favorite_artists: "",
    location: "",
    experience_level: "",
    social_instagram: "",
    social_youtube: "",
    social_spotify: "",
    social_x: "",
  });

  // Estados para Foto de Perfil
  const [profilePic, setProfilePic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("https://ui-avatars.com/api/?name=User&background=random&size=150");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [scale, setScale] = useState(1);
  const [removePicture, setRemovePicture] = useState(false);
  const editorRef = useRef(null);

  // Estados para Banner de Capa
  const [bannerPic, setBannerPic] = useState(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState("");
  const [removeBanner, setRemoveBanner] = useState(false);

  // Estados de feedback e controle
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Carrega dados existentes do usuário
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
          setFormData({
            full_name: data.full_name || "",
            username: data.username || user.username || "",
            bio: data.bio || "",
            instrument: data.instrument || "",
            favorite_genres: data.favorite_genres || "",
            favorite_artists: data.favorite_artists || "",
            location: data.location || "",
            experience_level: data.experience_level || "",
            social_instagram: data.social_instagram || "",
            social_youtube: data.social_youtube || "",
            social_spotify: data.social_spotify || "",
            social_x: data.social_x || "",
          });

          if (data.profile_picture_url) {
            setPreviewUrl(data.profile_picture_url);
          } else {
            const initial = (data.full_name || data.username || 'User')[0].toUpperCase();
            setPreviewUrl(`https://ui-avatars.com/api/?name=${initial}&background=2B69E6&color=fff&size=150`);
          }

          if (data.banner_picture_url) {
            setBannerPreviewUrl(data.banner_picture_url);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados do perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Alternar gênero favorito por tag/chip
  const handleToggleGenre = (genre) => {
    const currentGenres = formData.favorite_genres
      ? formData.favorite_genres.split(',').map(g => g.trim()).filter(Boolean)
      : [];

    let updatedGenres;
    if (currentGenres.includes(genre)) {
      updatedGenres = currentGenres.filter(g => g !== genre);
    } else {
      updatedGenres = [...currentGenres, genre];
    }

    setFormData(prev => ({ ...prev, favorite_genres: updatedGenres.join(', ') }));
  };

  // Manipulação de imagem de perfil (Upload + Modal de Corte)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIsCropping(true);
      setScale(1);
      setRemovePicture(false);
    }
  };

  const handleSaveCrop = () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImageScaledToCanvas();
      setPreviewUrl(canvas.toDataURL());
      canvas.toBlob((blob) => {
        const file = new File([blob], "profile_pic.png", { type: "image/png" });
        setProfilePic(file);
        setRemovePicture(false);
      });
      setIsCropping(false);
    }
  };

  const handleRemoveAvatar = () => {
    setProfilePic(null);
    setRemovePicture(true);
    setPreviewUrl(`https://ui-avatars.com/api/?name=EC&background=2B69E6&color=fff&size=150`);
  };

  // Manipulação de imagem de banner
  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerPic(file);
      setRemoveBanner(false);
      const url = URL.createObjectURL(file);
      setBannerPreviewUrl(url);
    }
  };

  const handleRemoveBanner = () => {
    setBannerPic(null);
    setRemoveBanner(true);
    setBannerPreviewUrl("");
  };

  // Pular Onboarding
  const handleSkipOnboarding = async () => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return navigate('/dashboard');

    const user = JSON.parse(savedUser);
    try {
      await fetch(`http://localhost:8000/profile/${user.id}/complete-onboarding`, {
        method: "POST"
      });
      
      const updated = { ...user, is_profile_completed: true };
      localStorage.setItem('user', JSON.stringify(updated));
      if (onUpdateUser) onUpdateUser({ is_profile_completed: true });
    } catch (err) {
      console.error("Erro ao registrar conclusão do onboarding:", err);
    }
    navigate('/dashboard');
  };

  // Salvar perfil completo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      alert("Sessão expirada. Faça login novamente.");
      return navigate('/');
    }
    const user = JSON.parse(savedUser);

    if (!formData.username.trim()) {
      setErrorMessage("O nome de usuário (@username) é obrigatório.");
      return;
    }

    setIsSubmitting(true);

    const dataToSend = new FormData();
    dataToSend.append('full_name', formData.full_name);
    dataToSend.append('username', formData.username);
    dataToSend.append('bio', formData.bio);
    dataToSend.append('instrument', formData.instrument);
    dataToSend.append('favorite_genres', formData.favorite_genres);
    dataToSend.append('favorite_artists', formData.favorite_artists);
    dataToSend.append('location', formData.location);
    dataToSend.append('experience_level', formData.experience_level);
    dataToSend.append('social_instagram', formData.social_instagram);
    dataToSend.append('social_youtube', formData.social_youtube);
    dataToSend.append('social_spotify', formData.social_spotify);
    dataToSend.append('social_x', formData.social_x);
    
    if (removePicture) {
      dataToSend.append('remove_picture', 'true');
    } else if (profilePic) {
      dataToSend.append('profile_picture', profilePic);
    }

    if (removeBanner) {
      dataToSend.append('remove_banner', 'true');
    } else if (bannerPic) {
      dataToSend.append('banner_picture', bannerPic);
    }

    try {
      const response = await fetch(`http://localhost:8000/update-profile/${user.id}`, {
        method: "POST",
        body: dataToSend,
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage("Perfil atualizado com sucesso!");
        
        // Atualiza o estado global e o localStorage
        const updatedUser = { 
          ...user, 
          username: result.user?.username || formData.username,
          profile_picture_url: result.user?.profile_picture_url || "",
          is_profile_completed: true
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        if (onUpdateUser) onUpdateUser(updatedUser);

        // Se for novo usuário, redireciona ao Dashboard; se for edição normal, volta ao Perfil
        setTimeout(() => {
          if (isNewUser) {
            navigate('/dashboard');
          } else {
            navigate('/profile');
          }
        }, 600);

      } else {
        setErrorMessage(result.detail || "Ocorreu um erro ao salvar as alterações.");
      }
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      setErrorMessage("Erro ao conectar com o servidor. Verifique sua conexão.");
    } finally {
      setIsSubmitting(false);
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
          <p className="font-bold text-slate-600">Carregando configurações de perfil...</p>
        </div>
      </div>
    );
  }

  // Lista dos gêneros atualmente ativos
  const activeGenres = formData.favorite_genres
    ? formData.favorite_genres.split(',').map(g => g.trim()).filter(Boolean)
    : [];

  return (
    <div 
      className="font-sans min-h-screen bg-repeat text-slate-800 selection:bg-[var(--color-brand-medium)] selection:text-white pb-20"
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      
      {/* --- MODAL DE CORTE DE FOTO DE PERFIL --- */}
      {isCropping && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full animate-fade-in border border-slate-100">
            <h3 className="text-lg font-black mb-4 text-slate-800 tracking-tight">
              Ajustar Foto de Perfil
            </h3>
            
            <div className="border-4 border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-slate-50">
              <AvatarEditor
                ref={editorRef}
                image={selectedFile}
                width={220}
                height={220}
                border={25}
                borderRadius={110}
                color={[15, 23, 42, 0.7]}
                scale={scale}
                rotate={0}
              />
            </div>
            
            {/* Controle de Zoom */}
            <div className="w-full mt-5 flex flex-col items-center">
              <div className="flex justify-between w-full text-xs font-bold text-slate-500 mb-1">
                <span>Zoom</span>
                <span>{Math.round(scale * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.02" 
                value={scale} 
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-brand-medium)]"
              />
            </div>

            {/* Botões do Modal */}
            <div className="flex gap-3 w-full mt-6">
              <button 
                type="button"
                onClick={() => setIsCropping(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs active:scale-95"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveCrop}
                className="flex-1 py-2.5 px-4 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white font-bold rounded-xl transition-all shadow-md text-xs active:scale-95"
              >
                Aplicar Corte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CABEÇALHO GLOBAL --- */}
      <header className="bg-white/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40 transition-all">
        <div 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
          title="EasyCovers"
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
                {isNewUser ? "Boas-Vindas" : "Edição"}
              </span>
            </div>
          </div>
        </div>

        {/* Botão Superior Direito */}
        <div>
          {isNewUser ? (
            <button 
              type="button"
              onClick={handleSkipOnboarding}
              className="text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              <span>Pular por enquanto</span>
              <span>➔</span>
            </button>
          ) : (
            <button 
              type="button"
              onClick={() => navigate('/profile')} 
              className="text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Cancelar e Voltar ao Perfil</span>
            </button>
          )}
        </div>
      </header>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">

        {/* Banner de Boas-Vindas se for Primeiro Acesso */}
        {isNewUser && (
          <div className="mb-6 p-6 rounded-3xl bg-gradient-to-r from-[var(--color-brand-deep)] to-[var(--color-brand-medium)] text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <SparklesIcon className="w-6 h-6 text-amber-300 shrink-0" />
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">Bem-vindo ao EasyCovers!</h2>
              </div>
              <p className="text-blue-100 text-xs sm:text-sm max-w-xl">
                Configure sua identidade musical agora para que seu estúdio fique com a sua cara. Você pode alterar tudo depois no seu perfil.
              </p>
            </div>
            <button
              onClick={handleSkipOnboarding}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all whitespace-nowrap"
            >
              Configurar Depois
            </button>
          </div>
        )}

        {/* Mensagens de Feedback */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold flex items-center gap-2.5 shadow-xs">
            <AlertCircleIcon className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center gap-2.5 shadow-xs">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SEÇÃO 1: FOTOS E APARÊNCIA VISUAL */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
              <PaletteIcon className="w-5 h-5 text-indigo-500" /> Fotos & Identidade Visual
            </h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">
              Personalize o avatar e o banner de capa que aparecem no seu perfil.
            </p>

            {/* Banner de Capa */}
            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                Banner de Capa
              </label>
              <div 
                className="h-36 sm:h-44 w-full rounded-2xl bg-cover bg-center relative border border-slate-200 overflow-hidden flex items-center justify-center group"
                style={{ 
                  backgroundImage: bannerPreviewUrl 
                    ? `url(${bannerPreviewUrl})` 
                    : "linear-gradient(135deg, #0E1F4C 0%, #1A3F99 50%, #2B69E6 100%)"
                }}
              >
                <div className="absolute inset-0 bg-black/30 backdrop-brightness-90 group-hover:bg-black/50 transition-colors"></div>
                <div className="relative z-10 flex flex-wrap gap-2 justify-center">
                  <label 
                    htmlFor="banner-upload"
                    className="cursor-pointer px-4 py-2 bg-white/90 hover:bg-white text-slate-800 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>{bannerPreviewUrl ? "Trocar Banner" : "Carregar Banner"}</span>
                  </label>
                  <input 
                    id="banner-upload" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleBannerChange} 
                    className="hidden" 
                  />

                  {bannerPreviewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      className="px-3 py-2 bg-red-600/80 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                    >
                      Remover Capa
                    </button>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 block">
                Recomendado: imagem horizontal (1200 x 400px). Formatos JPG, PNG ou WEBP.
              </span>
            </div>

            {/* Foto de Perfil */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                Foto de Perfil (Avatar)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-[var(--color-brand-medium)] shadow-md bg-white"
                />
                
                <div className="flex flex-col gap-2 items-center sm:items-start text-center sm:text-left">
                  <div className="flex flex-wrap gap-2">
                    <label 
                      htmlFor="avatar-upload"
                      className="cursor-pointer px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      </svg>
                      <span>Escolher Nova Foto</span>
                    </label>
                    <input 
                      id="avatar-upload" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                      className="hidden" 
                    />

                    {previewUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-all"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Você poderá recortar e ajustar o zoom da imagem antes de salvar.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: DADOS PESSOAIS */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-500" /> Informações Pessoais
            </h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">
              Dados visíveis para identificação dentro do EasyCovers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Nome Completo */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Nome Completo / Artístico
                </label>
                <input 
                  type="text" 
                  name="full_name" 
                  value={formData.full_name} 
                  onChange={handleChange}
                  placeholder="Ex: Lucas Abbade" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Nome de Usuário (@username) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">@</span>
                  <input 
                    type="text" 
                    name="username" 
                    value={formData.username} 
                    onChange={handleChange}
                    placeholder="seu_usuario" 
                    required
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Localização */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Cidade / Localização
              </label>
              <input 
                type="text" 
                name="location" 
                value={formData.location} 
                onChange={handleChange}
                placeholder="Ex: São Paulo, Brasil" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"
              />
            </div>

            {/* Bio */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Sobre mim (Bio Musical)
                </label>
                <span className={`text-[11px] font-bold ${formData.bio.length > 300 ? 'text-red-500' : 'text-slate-400'}`}>
                  {formData.bio.length} / 300
                </span>
              </div>
              <textarea 
                name="bio" 
                value={formData.bio} 
                onChange={handleChange}
                maxLength={300}
                rows={3}
                placeholder="Conte sobre sua história musical, bandas em que toca ou o que gosta de produzir..." 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all resize-none"
              />
            </div>
          </section>

          {/* SEÇÃO 3: IDENTIDADE MUSICAL */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
              <GuitarIcon className="w-5 h-5 text-amber-500" /> Identidade Musical & Preferências
            </h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">
              Essas informações ajudam a customizar sugestões de stems e tons musicais.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Instrumento Principal */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Instrumento Principal
                </label>
                <select 
                  name="instrument" 
                  value={formData.instrument} 
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">Selecione um instrumento...</option>
                  {INSTRUMENTS_LIST.map((inst) => (
                    <option key={inst} value={inst}>{inst}</option>
                  ))}
                </select>
              </div>

              {/* Nível de Experiência */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Nível de Experiência
                </label>
                <select 
                  name="experience_level" 
                  value={formData.experience_level} 
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">Selecione seu nível...</option>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gêneros Favoritos com Chips Interativos */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                Gêneros Musicais Favoritos (Clique para selecionar)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_GENRES.map((genre) => {
                  const isSelected = activeGenres.includes(genre);
                  return (
                    <button
                      type="button"
                      key={genre}
                      onClick={() => handleToggleGenre(genre)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSelected 
                          ? 'bg-[var(--color-brand-medium)] text-white shadow-xs' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isSelected ? `✓ ${genre}` : `+ ${genre}`}
                    </button>
                  );
                })}
              </div>

              <input 
                type="text" 
                name="favorite_genres" 
                value={formData.favorite_genres} 
                onChange={handleChange}
                placeholder="Ou digite outros separados por vírgula..." 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"
              />
            </div>

            {/* Artistas Favoritos */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Artistas & Bandas Favoritas
              </label>
              <input 
                type="text" 
                name="favorite_artists" 
                value={formData.favorite_artists} 
                onChange={handleChange}
                placeholder="Ex: Pink Floyd, Red Hot Chili Peppers, Tim Maia, Iron Maiden..." 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Separe os artistas com vírgula.
              </span>
            </div>
          </section>

          {/* SEÇÃO 4: REDES SOCIAIS & PORTFÓLIO */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200/80">
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
              <GlobeIcon className="w-5 h-5 text-blue-600" /> Presença Online & Redes Sociais
            </h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">
              Insira o link completo ou o seu nome de usuário/canal. Os links ficarão clicáveis diretamente na sua página de perfil.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Spotify */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  <SpotifyIcon className="w-4 h-4 text-[#1DB954]" color="#1DB954" />
                  <span>Spotify</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#1DB954] pointer-events-none flex items-center">
                    <SpotifyIcon className="w-4 h-4" color="#1DB954" />
                  </span>
                  <input 
                    type="text" 
                    name="social_spotify" 
                    value={formData.social_spotify} 
                    onChange={handleChange}
                    placeholder="https://open.spotify.com/artist/... ou nome" 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Link do seu perfil de artista, playlist ou música no Spotify.
                </span>
              </div>

              {/* YouTube */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  <YouTubeIcon className="w-4 h-4 text-[#FF0000]" color="#FF0000" />
                  <span>YouTube</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#FF0000] pointer-events-none flex items-center">
                    <YouTubeIcon className="w-4 h-4" color="#FF0000" />
                  </span>
                  <input 
                    type="text" 
                    name="social_youtube" 
                    value={formData.social_youtube} 
                    onChange={handleChange}
                    placeholder="https://youtube.com/@seuCanal ou @canal" 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Link do seu canal, clipe ou vídeo no YouTube.
                </span>
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  <InstagramIcon className="w-4 h-4 text-[#E4405F]" color="#E4405F" />
                  <span>Instagram</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#E4405F] pointer-events-none flex items-center">
                    <InstagramIcon className="w-4 h-4" color="#E4405F" />
                  </span>
                  <input 
                    type="text" 
                    name="social_instagram" 
                    value={formData.social_instagram} 
                    onChange={handleChange}
                    placeholder="https://instagram.com/perfil ou @perfil" 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Seu @handle ou URL direta do Instagram.
                </span>
              </div>

              {/* X (antigo Twitter) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  <XIcon className="w-3.5 h-3.5 text-slate-900" color="currentColor" />
                  <span>X (antigo Twitter)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-800 pointer-events-none flex items-center">
                    <XIcon className="w-4 h-4" color="currentColor" />
                  </span>
                  <input 
                    type="text" 
                    name="social_x" 
                    value={formData.social_x} 
                    onChange={handleChange}
                    placeholder="https://x.com/seuUsuario ou @seuUsuario" 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Seu @handle ou link do perfil no X (Twitter).
                </span>
              </div>
            </div>
          </section>

          {/* BOTÕES DE AÇÃO DO FORMULÁRIO */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            {!isNewUser && (
              <button 
                type="button"
                onClick={() => navigate('/profile')}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all text-sm active:scale-95"
              >
                Cancelar
              </button>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full flex-1 py-3.5 px-6 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white text-base font-extrabold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Salvando Alterações...</span>
                </>
              ) : (
                <>
                  <FloppyIcon className="w-5 h-5" />
                  <span>{isNewUser ? "Concluir e Ir para o Dashboard" : "Salvar Alterações no Perfil"}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </main>
    </div>
  );
};

export default EditProfile;