import React, { useState, useEffect } from 'react';
import {
  SpotifyIcon,
  SparklesIcon,
  MixerFadersIcon,
  MusicNoteIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from './Icons';

const BENEFITS = [
  {
    icon: SpotifyIcon,
    color: 'text-[#1DB954] bg-emerald-500/15 border-emerald-500/30',
    title: 'Suas Playlists Reais no Estúdio',
    description:
      'Cole o link do seu Perfil do Spotify e nós importamos automaticamente seu nome, foto e todas as suas playlists públicas.',
  },
  {
    icon: MusicNoteIcon,
    color: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
    title: 'Músicas, Capas & Prévia de 30s',
    description:
      'Explore todas as faixas das suas playlists e ouça prévias de 30 segundos diretamente no seu perfil.',
  },
  {
    icon: MixerFadersIcon,
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    title: 'Separação em 6 Stems com 1 Clique',
    description:
      'Envie qualquer música da sua biblioteca direto para a IA isolar Voz, Guitarra, Baixo, Bateria, Piano e Outros.',
  },
  {
    icon: SparklesIcon,
    color: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
    title: 'DNA Musical & Repertório',
    description:
      'Seus artistas mais presentes nas suas playlists são adicionados automaticamente ao seu perfil musical.',
  },
];

const SPOTIFY_URL_REGEX =
  /^(?:https?:\/\/(?:open|play)\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(?:embed\/)?(user|playlist|album|track)\/[A-Za-z0-9._-]+|spotify:(user|playlist|album|track):[A-Za-z0-9._-]+)/i;

const SpotifyOnboardingModal = ({
  isOpen,
  onClose,
  userId,
  returnTo = '/profile',
  onConnectedSuccess,
  isPostRegistration = false,
}) => {
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      fetch('http://localhost:8000/api/spotify/config-status')
        .then((res) => res.json())
        .then((data) => {
          setOauthConfigured(Boolean(data.configured));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDirectConnect = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!userId) return;

    const trimmed = spotifyUrl.trim();
    if (!trimmed) {
      setErrorMsg(
        'Por favor, cole o link do seu Perfil do Spotify (https://open.spotify.com/user/...) ou de uma Playlist antes de continuar.'
      );
      return;
    }

    if (!SPOTIFY_URL_REGEX.test(trimmed)) {
      setErrorMsg(
        'Link inválido! Cole um link oficial do Spotify (ex: https://open.spotify.com/user/... ou https://open.spotify.com/playlist/...) e tente novamente.'
      );
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`http://localhost:8000/api/spotify/connect-direct/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotify_url: trimmed,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSpotifyUrl('');
        if (onConnectedSuccess) {
          onConnectedSuccess(data.spotify_connection, data);
        } else {
          onClose();
        }
      } else {
        setErrorMsg(
          data.detail ||
            'Não foi possível encontrar este perfil ou playlist no Spotify. Verifique o link e tente novamente.'
        );
      }
    } catch (err) {
      console.error('Erro ao vincular Spotify diretamente:', err);
      setErrorMsg('Erro de conexão com o servidor EasyCovers. Tente novamente.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOAuthRedirect = async () => {
    if (!userId) return;
    setIsConnecting(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `http://localhost:8000/api/spotify/auth-url?user_id=${userId}&return_to=${encodeURIComponent(returnTo)}`
      );
      const data = await res.json();
      if (data.configured && data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      console.error('Erro ao iniciar OAuth:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-spotify-backdrop overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-gradient-to-b from-slate-900 via-[#0B1528] to-slate-950 text-white border border-emerald-500/30 shadow-2xl overflow-hidden animate-spotify-pop my-6">
        {/* Glow decorativo */}
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#1DB954]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          title="Fechar"
        >
          ✕
        </button>

        <div className="p-6 sm:p-8 relative z-10">
          {/* Cabeçalho Animado */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-2xl bg-[#1DB954]/20 border border-[#1DB954]/50 flex items-center justify-center animate-spotify-float animate-spotify-pulse shadow-lg">
                <SpotifyIcon className="w-9 h-9 text-[#1DB954]" color="#1DB954" />
              </div>
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#1DB954] text-slate-950 rounded-full shadow">
                Direto
              </span>
            </div>

            {isPostRegistration && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold mb-2">
                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                Perfil Criado com Sucesso!
              </span>
            )}

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Vincule seu Perfil do Spotify
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-md leading-relaxed">
              Cole o link do seu <strong className="text-emerald-400">Perfil do Spotify</strong> (ou de uma Playlist) para importar automaticamente seu perfil e todas as suas playlists públicas!
            </p>
          </div>

          {/* Lista de Benefícios com Animação Stagger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
            {BENEFITS.map((item, index) => {
              const IconComponent = item.icon;
              const delayClasses = [
                'stagger-item-1',
                'stagger-item-2',
                'stagger-item-3',
                'stagger-item-4',
              ];
              return (
                <div
                  key={item.title}
                  className={`p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-start gap-2.5 ${delayClasses[index] || ''}`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-300/90 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alerta de Erro caso o link seja inválido */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/20 border border-red-400/50 text-red-200 text-xs font-bold flex items-start gap-2.5 animate-fade-in-scale">
              <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-extrabold mb-0.5">Link não reconhecido</p>
                <p className="text-red-100/90 font-medium leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Formulário Único e Direto */}
          <form
            onSubmit={handleDirectConnect}
            className="space-y-3.5 bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-emerald-500/30"
          >
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-1.5">
                Link do seu Perfil ou Playlist do Spotify *
              </label>
              <input
                type="text"
                value={spotifyUrl}
                onChange={(e) => {
                  setSpotifyUrl(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="https://open.spotify.com/user/... ou https://open.spotify.com/playlist/..."
                className={`w-full px-3.5 py-3 rounded-xl bg-slate-950/90 border text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none transition ${
                  errorMsg
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-slate-700 focus:border-[#1DB954]'
                }`}
              />
              <span className="text-[11px] text-slate-400 mt-1.5 block leading-relaxed">
                💡 <strong>Como copiar no Spotify:</strong> Abra seu Perfil (ou Playlist) ➔ clique nos <strong>3 pontinhos (•••)</strong> ➔ <strong>Compartilhar</strong> ➔ <strong>Copiar link do perfil</strong>.
              </span>
            </div>

            <button
              type="submit"
              disabled={isConnecting}
              className="w-full py-3.5 px-6 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.99] text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-[#1DB954]/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Buscando seu perfil e playlists no Spotify...</span>
                </>
              ) : (
                <>
                  <SpotifyIcon className="w-5 h-5 text-slate-950" color="#052e16" />
                  <span>Vincular Meu Perfil & Importar Playlists</span>
                </>
              )}
            </button>

            {oauthConfigured && (
              <button
                type="button"
                onClick={handleOAuthRedirect}
                disabled={isConnecting}
                className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ou entrar via Login Oficial Spotify (OAuth)</span>
              </button>
            )}
          </form>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-4 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isPostRegistration ? 'Ir para o meu Perfil agora (fazer isso depois)' : 'Agora não'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotifyOnboardingModal;
