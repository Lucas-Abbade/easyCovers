import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getGenreImage } from '../utils/genreImages';
import ThemeToggle from './ThemeToggle';
import DashboardStudioBackground from './DashboardStudioBackground';
import StudioTiltCard from './StudioTiltCard';
import {
  useScrollVariable,
  useDocumentVisibility,
} from '../utils/motionTokens';

// Dicas dinâmicas exibidas durante o processamento
const MUSICIAN_TIPS = [
  {
    title: "Dica de Ensaio",
    text: "No Mixer, você pode mutar o seu instrumento para criar sua própria backing track e tocar junto com a banda original."
  },
  {
    title: "Fidelidade Sonora",
    text: "As 6 faixas são exportadas em formato WAV a 44.1 kHz estéreo, garantindo máxima pureza harmônica sem perdas de compressão."
  },
  {
    title: "Mudança de Tom",
    text: "Precisa ajustar a música ao seu alcance vocal ou afinação da guitarra? Use a transposição em semitons direto no Mixer."
  },
  {
    title: "Precisão Neural",
    text: "O modelo HTDemucs analisa espectrogramas complexos com redes neurais profundas para separar frequências sobrepostas com precisão cirúrgica."
  },
  {
    title: "Treino de Groove",
    text: "Experimente deixar solados apenas o Baixo e a Bateria para aperfeiçoar sua precisão de tempo e dinâmica de execução."
  }
];

// Configuração 3D das 6 stems separadas pelo EasyCovers
const STEMS_INFO = [
  {
    id: 'vocals',
    name: 'Vocais',
    icon: '🎤',
    img3d: '/assets/parallax/studio_condenser_mic.png',
    freq: '120Hz–12kHz',
    barColor: 'bg-purple-500',
    ledColor: 'bg-purple-400 shadow-[0_0_8px_#a855f7]',
  },
  {
    id: 'drums',
    name: 'Bateria',
    icon: '🥁',
    img3d: '/assets/parallax/instrument_drums.png',
    freq: '40Hz–16kHz',
    barColor: 'bg-amber-500',
    ledColor: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
  },
  {
    id: 'bass',
    name: 'Baixo',
    icon: '🎸',
    img3d: '/assets/parallax/instrument_bass.png',
    freq: '32Hz–800Hz',
    barColor: 'bg-emerald-500',
    ledColor: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
  },
  {
    id: 'guitar',
    name: 'Guitarra',
    icon: '🎸',
    img3d: '/assets/parallax/instrument_guitar.png',
    freq: '80Hz–8kHz',
    barColor: 'bg-blue-500',
    ledColor: 'bg-blue-400 shadow-[0_0_8px_#3b82f6]',
  },
  {
    id: 'piano',
    name: 'Teclado / Piano',
    icon: '🎹',
    img3d: '/assets/parallax/instrument_mic_keys.png',
    freq: '65Hz–10kHz',
    barColor: 'bg-pink-500',
    ledColor: 'bg-pink-400 shadow-[0_0_8px_#ec4899]',
  },
  {
    id: 'other',
    name: 'Outros / Synths',
    icon: '🎛️',
    img3d: '/assets/parallax/studio_analog_mixer.png',
    freq: 'FULL SPECTRUM',
    barColor: 'bg-cyan-500',
    ledColor: 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]',
  }
];

const LED_SEGMENTS = 24;

const AudioProcessingScreen = ({
  songInfo,
  currentStage = 1,
  progress = 0,
  status = 'processing', // 'processing' | 'success' | 'error'
  errorMessage = '',
  onRetry,
  onCancel,
  onOpenMixer,
  onGoToDashboard
}) => {
  const processingRootRef = useRef(null);
  useScrollVariable(processingRootRef);
  const isTabVisible = useDocumentVisibility();

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isYoutube = songInfo?.sourceType === 'youtube';
  const isCatalog = songInfo?.sourceType === 'catalog';

  // Definição das 5 etapas cronológicas
  const stages = useMemo(() => [
    {
      id: 1,
      name: isCatalog
        ? "Obtenção Automática de Áudio (Catálogo Deezer)"
        : isYoutube
        ? "Obtenção do Áudio do YouTube"
        : "Upload e Análise do Arquivo",
      desc: isCatalog
        ? "Localizando e capturando a faixa de áudio oficial a partir do catálogo musical."
        : isYoutube 
        ? "Conectando aos servidores e capturando o fluxo de áudio em alta qualidade." 
        : "Carregando o arquivo selecionado e verificando integridade sonora.",
      estimatedShare: 15
    },
    {
      id: 2,
      name: "Calibração e Normalização Acústica",
      desc: "Aplicando normalização padrão EBU R128 (-16 LUFS) a 44.1 kHz estéreo.",
      estimatedShare: 15
    },
    {
      id: 3,
      name: "Separação de Faixas por IA (HTDemucs)",
      desc: "Redes neurais profundas isolando frequências de voz, harmonia e percussão.",
      estimatedShare: 45
    },
    {
      id: 4,
      name: "Renderização e Exportação de Stems",
      desc: "Codificando as 6 trilhas independentes em formato WAV de alta pureza.",
      estimatedShare: 15
    },
    {
      id: 5,
      name: "Finalização e Sincronização",
      desc: "Indexando metadados e registrando as faixas na sua biblioteca EasyCovers.",
      estimatedShare: 10
    }
  ], [isYoutube, isCatalog]);

  // Cronômetro de tempo decorrido (pausa se a aba estiver oculta ou se finalizado)
  useEffect(() => {
    if (status !== 'processing' || !isTabVisible) return undefined;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status, isTabVisible]);

  // Rotação suave do carrossel de dicas a cada 6 segundos
  useEffect(() => {
    if (status !== 'processing' || !isTabVisible) return undefined;

    const interval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % MUSICIAN_TIPS.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [status, isTabVisible]);

  // Formatação de minutos e segundos (MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Estimativa de tempo restante amigável
  const estimatedRemainingText = useMemo(() => {
    if (status === 'success') return "Processamento finalizado!";
    if (status === 'error') return "Interrompido";
    if (progress < 25) return "Estimativa: ~1 a 2 min";
    if (progress < 50) return "Estimativa: ~45 a 60 seg";
    if (progress < 80) return "Estimativa: ~20 a 35 seg";
    if (progress < 95) return "Estimativa: ~10 seg (quase pronto!)";
    return "Finalizando detalhes...";
  }, [progress, status]);

  const clampedPercent = Math.min(100, Math.max(0, Math.round(progress)));
  const activeLedCount = Math.round((clampedPercent / 100) * LED_SEGMENTS);

  return (
    <div 
      ref={processingRootRef}
      className={`font-sans min-h-screen bg-repeat flex flex-col text-slate-800 dark:text-slate-100 relative overflow-x-hidden ${
        !isTabVisible ? 'animations-paused' : ''
      }`}
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      {/* Camada Parallax 3D de Sala de Controle durante o isolamento neural */}
      <DashboardStudioBackground
        studioLiveMode={status === 'processing' || status === 'success'}
        phantomPower={true}
        hoveredSong={{
          name: songInfo?.name || 'HTDEMUCS 6-STEM ENGINE',
          genre: songInfo?.genre || 'NEURAL DSP',
        }}
      />

      {/* Header Padronizado EasyCovers com Glassmorphism */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/logo_symbol.png" 
              alt="EasyCovers Logo" 
              className="h-10 w-auto object-contain drop-shadow-xs"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[var(--color-brand-deep)] leading-tight tracking-tight">
                  EasyCovers
                </h1>
                <span className="hidden sm:inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 tracking-wider">
                  DSP Engine
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline-block">
                AI Audio Stem Separation Studio
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Status Badge Superior */}
        <div className="flex items-center gap-2">
          {status === 'processing' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-bold shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand-medium)] animate-pulse"></span>
              <span>Processando em tempo real</span>
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-bold shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Processamento Concluído</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-bold shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Ocorreu uma falha</span>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 my-2 md:my-4 flex flex-col gap-6">

        {/* Card 3D de Resumo da Música no Rack */}
        <StudioTiltCard maxTilt={1.5} hoverScale={1.003}>
          <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-lg border border-white/80 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] flex items-center justify-center text-white shadow-md shrink-0 relative overflow-hidden studio-img-outline">
                  <img 
                    src={songInfo?.cover_image_url || getGenreImage(songInfo?.genre)} 
                    alt="Capa da música" 
                    className="w-full h-full object-cover"
                  />
                  {status === 'processing' && (
                    <div className="absolute inset-0 bg-blue-500/20 animate-pulse"></div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-700">
                      MASTER SIGNAL INTAKE
                    </span>
                    {isCatalog ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <span>🎧</span>
                        Catálogo Deezer / Spotify
                      </span>
                    ) : isYoutube ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <img src="/assets/icons/icon_youtube.png" alt="YouTube" className="w-3.5 h-3.5 object-contain" />
                        YouTube
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-medium)] dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <img src="/assets/icons/icon_upload_cloud.png" alt="Arquivo" className="w-3.5 h-3.5 object-contain" />
                        Arquivo de Áudio
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight truncate">
                    {songInfo?.name || "Música em Processamento"}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm md:text-base truncate">
                    {songInfo?.artist || "Artista / Banda"}
                  </p>
                </div>
              </div>

              {/* Badges de Metadados Musicais */}
              <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center shrink-0 tabular-nums">
                {songInfo?.genre && (
                  <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-2xs">
                    🎵 {songInfo.genre}
                  </div>
                )}
                {songInfo?.instrument && (
                  <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[var(--color-brand-dark)] dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 shadow-2xs">
                    🎸 {songInfo.instrument}
                  </div>
                )}
                {songInfo?.original_key && songInfo.original_key !== 'Unknown' && (
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                    🎼 Tom: {songInfo.original_key}
                  </div>
                )}
              </div>
            </div>
          </section>
        </StudioTiltCard>

        {/* SEÇÃO PRINCIPAL: Console DSP, Barra Rack LED Bargraph e 6 Stems 3D */}
        <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/90 dark:border-slate-800 flex flex-col gap-6">
          
          {/* Cabeçalho da Barra de Progresso */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400">
                  {status === 'success' ? 'DSP CONCLUÍDO' : `STAGE 0${currentStage} / 0${stages.length}`}
                </span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  • EBU R128 / 44.1kHz
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 text-balance">
                {status === 'success' 
                  ? "Separação Concluída com Sucesso!" 
                  : status === 'error' 
                  ? "Falha durante o processamento" 
                  : stages[currentStage - 1]?.name || "Processando faixas..."}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl text-pretty">
                {status === 'success' 
                  ? "As 6 stems foram isoladas com alta pureza e estão prontas para tocar ou praticar no Console Mixer." 
                  : status === 'error'
                  ? errorMessage || "Ocorreu um imprevisto durante o processamento da faixa."
                  : stages[currentStage - 1]?.desc}
              </p>
            </div>

            {/* Contador de Porcentagem & Tempo em Tabular-Nums */}
            <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 tabular-nums">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-5xl font-black text-[var(--color-brand-deep)] tabular-nums tracking-tight">
                  {clampedPercent}
                </span>
                <span className="text-xl font-bold text-[var(--color-brand-medium)] dark:text-blue-400">%</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1 tabular-nums">
                <span className="font-mono">⏱️ {formatTime(elapsedSeconds)}</span>
                <span>•</span>
                <span className="text-[var(--color-brand-medium)] dark:text-blue-400">{estimatedRemainingText}</span>
              </div>
            </div>
          </div>

          {/* CHASSI RACK LED BARGRAPH + BARRA DE PROGRESSO ACESSÍVEL */}
          <div className="rounded-2xl p-3.5 bg-[#0B1325] border border-slate-800 shadow-inner flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              <span>HTDEMUCS v4 NEURAL SPECTRUM BUS</span>
              <span className="text-emerald-400 tabular-nums">
                {status === 'success'
                  ? 'LOCKED • 0.0 dBFS'
                  : status === 'error'
                  ? 'SIGNAL FAULT'
                  : `BUFFER ${clampedPercent}%`}
              </span>
            </div>

            {/* Barra contínua acessível com Shimmer */}
            <div 
              role="progressbar" 
              aria-valuenow={clampedPercent} 
              aria-valuemin="0" 
              aria-valuemax="100"
              className="w-full h-4 bg-slate-900 rounded-full p-0.5 border border-slate-700/80 shadow-inner overflow-hidden flex items-center"
            >
              <div 
                className={`h-full rounded-full studio-card-transition relative overflow-hidden ${
                  status === 'error'
                    ? 'bg-rose-500'
                    : status === 'success'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                    : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 animate-shimmer'
                }`}
                style={{ width: `${Math.min(100, Math.max(progress, 3))}%` }}
              >
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/25 rounded-t-full" />
              </div>
            </div>

            {/* Bargraph Segmentado de Hardware (24 LEDs de Rack) */}
            <div
              className="grid gap-1 pt-0.5"
              style={{ gridTemplateColumns: `repeat(${LED_SEGMENTS}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {Array.from({ length: LED_SEGMENTS }).map((_, idx) => {
                const isLit = idx < activeLedCount;
                const isAmberZone = idx >= 16 && idx < 21;
                const isPeakZone = idx >= 21;

                let litColor = 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]';
                if (status === 'error') {
                  litColor = 'bg-rose-500';
                } else if (isPeakZone) {
                  litColor = 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]';
                } else if (isAmberZone) {
                  litColor = 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]';
                }

                return (
                  <span
                    key={idx}
                    className={`h-2 rounded-xs transition-colors duration-200 ${
                      isLit ? litColor : 'bg-slate-800/90'
                    }`}
                  />
                );
              })}
            </div>

            {/* Marcadores de Etapas sob a barra */}
            <div className="flex justify-between items-center px-0.5 text-[10px] font-mono font-bold text-slate-400 tabular-nums">
              <span>0% INPUT</span>
              <span className={progress >= 20 ? "text-cyan-400" : ""}>20% EBU R128</span>
              <span className={progress >= 40 ? "text-blue-400" : ""}>40% HTDEMUCS IA</span>
              <span className={progress >= 80 ? "text-amber-400" : ""}>80% WAV STEMS</span>
              <span className={progress >= 100 ? "text-emerald-400" : ""}>100% READY</span>
            </div>
          </div>

          {/* LINHA DO TEMPO / STEPPER DAS 5 ETAPAS */}
          <div className="pt-2 flex flex-col gap-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Progresso das Etapas de Estúdio
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {stages.map((stage) => {
                const isCompleted = currentStage > stage.id || status === 'success';
                const isCurrent = currentStage === stage.id && status === 'processing';

                return (
                  <div 
                    key={stage.id} 
                    className={`flex md:flex-col items-center md:items-start gap-3 p-3.5 rounded-2xl studio-card-transition border ${
                      isCompleted 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200' 
                        : isCurrent 
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-sm animate-pulse-glow' 
                        : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-xs tabular-nums ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : isCurrent
                        ? 'bg-[var(--color-brand-medium)] text-white shadow-sm'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isCurrent ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        `0${stage.id}`
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-extrabold leading-tight ${isCurrent ? 'text-[var(--color-brand-deep)] dark:text-blue-200' : isCompleted ? 'text-emerald-950 dark:text-emerald-200' : 'text-slate-500 dark:text-slate-400'}`}>
                        {stage.name}
                      </p>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden md:block mt-1">
                        {isCompleted ? 'Concluído' : isCurrent ? 'Em andamento...' : 'Aguardando'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VISUALIZADOR 3D DAS 6 STEMS POR IA (StudioTiltCard) */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>🎚️ Isolamento de Canais 3D em Tempo Real</span>
                <span className="text-[11px] font-mono font-bold text-[var(--color-brand-medium)] dark:text-blue-400">
                  (HTDemucs 6 Stems)
                </span>
              </h4>
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500 font-semibold tabular-nums">
                Lossless WAV • 44.1kHz
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {STEMS_INFO.map((stem) => {
                const isStemActive = currentStage >= 3;
                const isStemDone = currentStage >= 4 || status === 'success';
                const isFocusedInstrument =
                  songInfo?.instrument &&
                  stem.name.toLowerCase().includes(songInfo.instrument.toLowerCase());

                return (
                  <StudioTiltCard
                    key={stem.id}
                    maxTilt={4.5}
                    hoverScale={1.03}
                  >
                    <div 
                      className={`p-3 rounded-2xl border flex flex-col items-center text-center studio-card-transition relative overflow-hidden ${
                        isStemDone
                          ? 'bg-white dark:bg-slate-800/95 border-emerald-300 dark:border-emerald-800/80 shadow-sm'
                          : isStemActive
                          ? 'bg-blue-50/60 dark:bg-slate-800/90 border-blue-300 dark:border-blue-800/80 shadow-sm'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/70 opacity-75'
                      }`}
                    >
                      {/* LED de Canal Superior */}
                      <div className="w-full flex items-center justify-between mb-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isStemDone
                              ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                              : isStemActive
                              ? stem.ledColor
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 tabular-nums">
                          {isFocusedInstrument ? 'FOCUS' : 'CH'}
                        </span>
                      </div>

                      {/* Render 3D do Instrumento/Equipamento */}
                      <div className="w-12 h-12 flex items-center justify-center my-0.5">
                        <img
                          src={stem.img3d}
                          alt={stem.name}
                          className="w-11 h-11 object-contain drop-shadow-md"
                        />
                      </div>

                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight mt-1">
                        {stem.name}
                      </span>
                      <span className="text-[9px] font-mono font-semibold text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                        {stem.freq}
                      </span>
                      
                      {/* Equalizador animado */}
                      <div className="h-6 flex items-end justify-center gap-1 my-1.5">
                        {isStemActive && status === 'processing' ? (
                          <>
                            <span className={`w-1 ${stem.barColor} rounded-full eq-bar-1`}></span>
                            <span className={`w-1 ${stem.barColor} rounded-full eq-bar-2`}></span>
                            <span className={`w-1 ${stem.barColor} rounded-full eq-bar-3`}></span>
                            <span className={`w-1 ${stem.barColor} rounded-full eq-bar-4`}></span>
                          </>
                        ) : isStemDone ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Pronta
                          </span>
                        ) : (
                          <span className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold tabular-nums">
                        {isStemDone ? 'WAV 44.1kHz' : isStemActive ? 'Isolando...' : 'Pendente'}
                      </span>
                    </div>
                  </StudioTiltCard>
                );
              })}
            </div>
          </div>

          {/* CARD DE DICAS MUSICAIS (CARROSSEL DINÂMICO) */}
          {status === 'processing' && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-800/90 rounded-2xl p-4 border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 shadow-2xs border border-blue-200 dark:border-slate-700 flex items-center justify-center text-lg shrink-0">
                💡
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 tabular-nums">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400">
                    {MUSICIAN_TIPS[currentTipIndex].title}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    ({currentTipIndex + 1} de {MUSICIAN_TIPS.length})
                  </span>
                </div>
                <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium text-pretty">
                  {MUSICIAN_TIPS[currentTipIndex].text}
                </p>
              </div>
            </div>
          )}

          {/* ÁREA DE SUCESSO / AÇÕES FINAIS */}
          {status === 'success' && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50/60 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/70">
              <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="font-black text-sm md:text-base">Música pronta para a Mesa de Mixagem!</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Todas as 6 faixas foram geradas em alta pureza e salvas na sua biblioteca.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="flex-1 sm:flex-initial min-h-[42px] px-5 py-2.5 rounded-xl font-extrabold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 studio-btn-transition active:scale-95 shadow-2xs text-sm cursor-pointer"
                >
                  Ir para Biblioteca
                </button>
                <button
                  type="button"
                  onClick={onOpenMixer}
                  className="flex-1 sm:flex-initial min-h-[42px] flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-white bg-gradient-to-r from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] hover:from-blue-600 hover:to-blue-800 studio-btn-transition active:scale-95 shadow-md text-sm cursor-pointer"
                >
                  <img src="/assets/icons/icon_mixer_white.png" alt="Mixer" className="w-4 h-4 object-contain" />
                  <span>Abrir no Mixer</span>
                </button>
              </div>
            </div>
          )}

          {/* ÁREA DE ERRO / RETENTATIVA */}
          {status === 'error' && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-rose-50/60 dark:bg-rose-950/30 p-5 rounded-2xl border border-rose-200 dark:border-rose-800/70">
              <div className="flex items-center gap-3 text-rose-800 dark:text-rose-200">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  ✕
                </div>
                <div>
                  <h4 className="font-black text-sm md:text-base">Não foi possível concluir</h4>
                  <p className="text-xs text-rose-700 dark:text-emerald-300 max-w-md">
                    {errorMessage || "Verifique sua conexão, o link fornecido ou se o servidor Python está ativo."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 sm:flex-initial min-h-[42px] px-5 py-2.5 rounded-xl font-extrabold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 studio-btn-transition active:scale-95 shadow-2xs text-sm cursor-pointer"
                >
                  Voltar e Editar
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 sm:flex-initial min-h-[42px] px-6 py-2.5 rounded-xl font-extrabold text-white bg-rose-600 hover:bg-rose-700 studio-btn-transition active:scale-95 shadow-md text-sm cursor-pointer"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}

        </section>

      </main>
    </div>
  );
};

export default AudioProcessingScreen;
