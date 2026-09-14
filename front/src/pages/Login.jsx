import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ScissorsIcon, 
  MixerFadersIcon, 
  PitchShiftIcon, 
  CloudLibraryIcon, 
  LockShieldIcon 
} from '../components/Icons';

const Login = ({ onLogin }) => {
  // Controle de fluxo da página (Showcase explicativo vs. Formulário de Autenticação)
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Estados dos campos de formulário
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados visuais e de interação
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();
  const GOOGLE_CLIENT_ID = '306538057431-96v86vvcrqvi556j85o2gad7mr5irf45.apps.googleusercontent.com';
  const googleInitialized = useRef(false);

  // Callback de autenticação via Google OAuth
  const handleGoogleResponse = useCallback(async (response) => {
    const id_token = response?.credential;
    if (!id_token) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('http://localhost:8000/auth/google/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token })
      });

      const data = await res.json();
      if (res.ok) {
        const userData = {
          id: data.id,
          email: data.email,
          username: data.username,
          profile_picture_url: data.profile_picture_url || '',
          is_profile_completed: Boolean(data.is_profile_completed)
        };
        onLogin(userData);
        if (!userData.is_profile_completed) {
          navigate('/edit-profile', { state: { isNewUser: true } });
        } else {
          navigate('/dashboard');
        }
      } else {
        setErrorMessage(data.detail || 'Falha no login com Google.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao conectar com o servidor para login com Google.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, onLogin]);

  // Função para renderizar o botão do Google
  const renderGoogleButton = useCallback(() => {
    if (window.google?.accounts?.id) {
      const el = document.getElementById('googleSignInDiv');
      if (el) {
        el.innerHTML = '';
        window.google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: isRegistering ? 'signup_with' : 'signin_with',
          shape: 'pill'
        });
      }
    }
  }, [isRegistering]);

  // Inicialização do SDK do Google
  useEffect(() => {
    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId);

    const initializeGoogle = () => {
      if (window.google?.accounts?.id && !googleInitialized.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse
        });
        googleInitialized.current = true;
      }
      if (showAuthForm) {
        renderGoogleButton();
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      document.body.appendChild(script);
    } else {
      initializeGoogle();
    }
  }, [handleGoogleResponse, renderGoogleButton, showAuthForm]);

  // Re-renderiza o botão do Google quando o usuário abre o formulário ou troca o modo
  useEffect(() => {
    if (showAuthForm) {
      const timer = setTimeout(() => {
        renderGoogleButton();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showAuthForm, isRegistering, renderGoogleButton]);

  // Submissão do formulário de autenticação (Login ou Cadastro)
  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validações rigorosas para cadastro
    if (isRegistering) {
      if (!username.trim() || !email.trim() || !password || !confirmPassword) {
        setErrorMessage("Por favor, preencha todos os campos.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("As senhas não coincidem.");
        return;
      }
      
      const hasUpperCase = /[A-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (password.length < 8 || !hasUpperCase || !hasNumber) {
        setErrorMessage("A senha deve ter no mínimo 8 caracteres, contendo pelo menos 1 letra maiúscula e 1 número.");
        return;
      }
    } else {
      if (!email.trim() || !password) {
        setErrorMessage("Informe seu e-mail e senha para acessar.");
        return;
      }
    }

    const endpoint = isRegistering ? "register" : "login";
    const payload = isRegistering 
      ? { username: username.trim(), email: email.trim(), password } 
      : { email: email.trim(), password };

    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/${endpoint}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        const userData = {
          id: data.id,
          email: data.email,
          username: data.username,
          profile_picture_url: data.profile_picture_url || '',
          is_profile_completed: Boolean(data.is_profile_completed)
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
        setErrorMessage(data.detail || "Não foi possível realizar a autenticação.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Erro ao conectar com o servidor. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
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
  const passMatchMet = password && confirmPassword && password === confirmPassword;

  return (
    <div 
      className="font-sans min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden bg-cover bg-center selection:bg-[var(--color-brand-medium)] selection:text-white"
      style={{ backgroundImage: "url('/assets/login_hero_bg.jpg')" }}
    >
      {/* Overlay refinado de alto contraste com glassmorphism e iluminação de fundo */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0E1F4C]/70 via-[#0E1F4C]/50 to-[#1A3F99]/60 backdrop-blur-[2px] pointer-events-none"></div>

      {/* Orbs de iluminação ambiente para profundidade visual de nível sênior */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-2xl">
        
        {/* ========================================================================= */}
        {/* ETAPA 1: CARD DE APRESENTAÇÃO E RECURSOS (HERO ONBOARDING)                 */}
        {/* ========================================================================= */}
        {!showAuthForm ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/80 transition-all duration-300 animate-fade-in-scale">
            {/* Header da Marca */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <img 
                  src="/assets/logo_symbol.png" 
                  alt="EasyCovers Logo" 
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] tracking-tight">
                      EasyCovers
                    </h1>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-blue-50 text-[var(--color-brand-medium)] border border-blue-200/70 tracking-wider">
                      Studio
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Inteligência Artificial para Músicos
                  </p>
                </div>
              </div>

              {/* Indicador Sonoro (Equalizer animado nativo) */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-full" title="Motor de áudio ativo">
                <span className="w-1.5 h-3 bg-[var(--color-brand-medium)] rounded-full eq-bar-1"></span>
                <span className="w-1.5 h-5 bg-[var(--color-brand-medium)] rounded-full eq-bar-2"></span>
                <span className="w-1.5 h-4 bg-[var(--color-brand-medium)] rounded-full eq-bar-3"></span>
                <span className="w-1.5 h-6 bg-[var(--color-brand-medium)] rounded-full eq-bar-4"></span>
                <span className="ml-2 text-[11px] font-bold text-slate-600">6 Stems AI</span>
              </div>
            </div>

            {/* Texto de Apresentação e Mensagem de Destaque */}
            <div className="mt-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-[var(--color-brand-medium)] border border-blue-200/60 mb-3">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand-medium)] animate-ping"></span>
                Novo fluxo de estudos e ensaios
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-brand-deep)] tracking-tight leading-tight">
                Sua música como você nunca ouviu. Nem tocou.
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-2 leading-relaxed">
                O EasyCovers transforma qualquer gravação em uma estação multitrack interativa. 
                Isole instrumentos, personalize a mixagem em tempo real e domine o seu repertório com precisão profissional.
              </p>
            </div>

            {/* Grid dos 4 Pilares / Funções do Site */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-7">
              {/* Card 1: Separação de Stems */}
              <div className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/80 transition-all duration-200 shadow-xs hover:shadow-md hover:border-blue-200 group">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
                    <ScissorsIcon className="w-4 h-4 text-purple-700" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 group-hover:text-[var(--color-brand-medium)] transition-colors">
                    Separação em 6 Faixas
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Isole e guarde stems de <strong>Vocais, Bateria, Baixo, Guitarra e Piano</strong> com inteligência artificial de estúdio.
                </p>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Voz</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Bateria</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Baixo</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Guitarra</span>
                </div>
              </div>

              {/* Card 2: Mixer Multitrack */}
              <div className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/80 transition-all duration-200 shadow-xs hover:shadow-md hover:border-blue-200 group">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-[var(--color-brand-medium)] flex items-center justify-center font-bold shadow-xs">
                    <MixerFadersIcon className="w-4 h-4 text-[var(--color-brand-medium)]" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 group-hover:text-[var(--color-brand-medium)] transition-colors">
                    Mixer Multitrack ao Vivo
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Controle volumes individuais, ative <strong>Solo</strong> para tirar partes de ouvido ou use <strong>Mute</strong> para praticar como backing track.
                </p>
              </div>

              {/* Card 3: Transposição Harmônica */}
              <div className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/80 transition-all duration-200 shadow-xs hover:shadow-md hover:border-blue-200 group">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
                    <PitchShiftIcon className="w-4 h-4 text-emerald-700" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 group-hover:text-[var(--color-brand-medium)] transition-colors">
                    Transposição de Afinação
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Mude a tonalidade (pitch shift) em semitons em tempo real para adequar ao seu alcance vocal ou instrumento.
                </p>
              </div>

              {/* Card 4: Biblioteca na Nuvem */}
              <div className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/80 transition-all duration-200 shadow-xs hover:shadow-md hover:border-blue-200 group">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
                    <CloudLibraryIcon className="w-4 h-4 text-indigo-700" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 group-hover:text-[var(--color-brand-medium)] transition-colors">
                    Biblioteca de Backing Tracks
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Guarde suas músicas sincronizadas, organize por gênero ou instrumento e acerte cada ensaio de forma prática.
                </p>
              </div>
            </div>

            {/* Ação Principal: Botão "Vamos Começar" */}
            <div className="pt-2 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setShowAuthForm(true)}
                className="w-full bg-gradient-to-r from-[var(--color-brand-medium)] via-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-[var(--color-brand-dark)] hover:to-[var(--color-brand-deep)] text-white p-4 rounded-2xl text-base sm:text-lg font-black tracking-wide shadow-lg hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 group cursor-pointer"
              >
                <span>Vamos começar</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>

              <p className="text-xs font-semibold text-slate-400 mt-3.5 flex items-center justify-center gap-2 text-center">
                <span className="inline-flex items-center gap-1.5">
                  <LockShieldIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Acesso rápido e seguro
                </span>
                <span>•</span>
                <span>Login com e-mail ou conta Google</span>
              </p>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* ETAPA 2: FORMULÁRIO DE LOGIN E CADASTRO                                   */
          /* ========================================================================= */
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/80 transition-all duration-300 animate-fade-in-scale max-w-md mx-auto">
            {/* Navegação de Retorno para Apresentação */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowAuthForm(false);
                  setErrorMessage('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--color-brand-medium)] transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                <span>Voltar para apresentação</span>
              </button>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">EasyCovers Auth</span>
            </div>

            {/* Cabeçalho do Card */}
            <div className="text-center mb-5">
              <img 
                src="/assets/logo_symbol.png" 
                alt="EasyCovers Logo" 
                className="mx-auto w-14 h-14 object-contain drop-shadow-sm mb-2"
              />
              <h2 className="text-2xl font-black text-[var(--color-brand-deep)] tracking-tight">
                {isRegistering ? "Crie sua conta gratuita" : "Bem-vindo de volta"}
              </h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">
                {isRegistering 
                  ? "Junte-se à comunidade de músicos e comece a mixar suas faixas" 
                  : "Acesse seu estúdio e continue de onde parou"}
              </p>
            </div>

            {/* Seletor de Modo (Abas de Login / Cadastro) */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center mb-5">
              <button
                type="button"
                onClick={() => toggleMode(false)}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  !isRegistering 
                    ? 'bg-white text-[var(--color-brand-deep)] shadow-xs' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => toggleMode(true)}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  isRegistering 
                    ? 'bg-white text-[var(--color-brand-deep)] shadow-xs' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Cadastrar
              </button>
            </div>

            {/* Alerta de Erro Inline com Design Moderno */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2 animate-fade-in-scale">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500 shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="flex-1 leading-relaxed">{errorMessage}</span>
                <button 
                  type="button" 
                  onClick={() => setErrorMessage('')} 
                  className="text-red-400 hover:text-red-700"
                  aria-label="Fechar mensagem de erro"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Formulário Principal */}
            <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
              
              {/* Campo Nome de Usuário (Apenas Cadastro) */}
              {isRegistering && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 ml-1">Nome de Usuário</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="ex: lucas_guitar"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Campo E-mail */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 ml-1">E-mail</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 ml-1">Senha</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={isRegistering ? "Crie uma senha forte" : "Insira sua senha"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Campo Confirmar Senha e Requisitos (Apenas Cadastro) */}
              {isRegistering && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 ml-1">Confirmar Senha</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                      </span>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repita sua senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:border-transparent outline-none transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showConfirmPassword ? "Ocultar confirmação" : "Ver confirmação"}
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Checklist visual de requisitos de senha para UX de alto nível */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] flex flex-col gap-1 text-slate-500">
                    <span className="font-bold text-slate-700 mb-0.5">Critérios de segurança da senha:</span>
                    <div className="grid grid-cols-2 gap-1">
                      <span className={`flex items-center gap-1 ${passLengthMet ? 'text-emerald-600 font-bold' : ''}`}>
                        {passLengthMet ? '✓' : '•'} 8+ caracteres
                      </span>
                      <span className={`flex items-center gap-1 ${passUpperMet ? 'text-emerald-600 font-bold' : ''}`}>
                        {passUpperMet ? '✓' : '•'} Letra maiúscula
                      </span>
                      <span className={`flex items-center gap-1 ${passNumberMet ? 'text-emerald-600 font-bold' : ''}`}>
                        {passNumberMet ? '✓' : '•'} Pelo menos 1 número
                      </span>
                      <span className={`flex items-center gap-1 ${passMatchMet ? 'text-emerald-600 font-bold' : ''}`}>
                        {passMatchMet ? '✓' : '•'} Senhas coincidem
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Botão de Envio Principal */}
              <button 
                type="submit" 
                disabled={isLoading}
                className="mt-2 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white py-3 px-4 rounded-xl text-sm font-black transition-all shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Processando...</span>
                  </>
                ) : (
                  <span>{isRegistering ? "Criar Minha Conta" : "Entrar no Studio"}</span>
                )}
              </button>
            </form>

            {/* Divisor Visual */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold tracking-wider text-[10px]">
                  ou continue com
                </span>
              </div>
            </div>

            {/* Botão Oficial do Google Sign-In SDK */}
            <div className="flex flex-col gap-2">
              <div id="googleSignInDiv" className="w-full min-h-[44px] flex justify-center"></div>
            </div>

            {/* Alternador de Modo no Rodapé */}
            <div className="text-center mt-4 pt-3 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => toggleMode(!isRegistering)} 
                className="text-xs text-[var(--color-brand-medium)] hover:text-[var(--color-brand-dark)] hover:underline font-bold transition-colors cursor-pointer"
              >
                {isRegistering 
                  ? "Já tem uma conta no EasyCovers? Faça login" 
                  : "Não tem uma conta? Cadastre-se gratuitamente"}
              </button>
            </div>

            {/* Termos e Rodapé */}
            <footer className="mt-3 text-center text-[10px] text-slate-400 leading-tight">
              Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
            </footer>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;