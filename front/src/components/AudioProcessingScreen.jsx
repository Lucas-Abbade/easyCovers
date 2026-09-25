import React, { useState, useEffect, useMemo } from 'react';
import { getGenreImage } from '../utils/genreImages';
import ThemeToggle from './ThemeToggle';

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

// Configuração das 6 stems separadas pelo EasyCovers
const STEMS_INFO = [
  { id: 'vocals', name: 'Vocais', icon: '🎤', color: 'from-purple-500 to-indigo-500' },
  { id: 'drums', name: 'Bateria', icon: '🥁', color: 'from-amber-500 to-orange-500' },
  { id: 'bass', name: 'Baixo', icon: '🎸', color: 'from-emerald-500 to-teal-500' },
  { id: 'guitar', name: 'Guitarra', icon: '🎸', color: 'from-blue-500 to-cyan-500' },
  { id: 'piano', name: 'Teclado / Piano', icon: '🎹', color: 'from-pink-500 to-rose-500' },
  { id: 'other', name: 'Outros / Sintetizadores', icon: '🎛️', color: 'from-gray-500 to-slate-600' }
];

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

  // Cronômetro de tempo decorrido
  useEffect(() => {
    if (status !== 'processing') return;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // Rotação suave do carrossel de dicas a cada 6 segundos
  useEffect(() => {
    if (status !== 'processing') return;

    const interval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % MUSICIAN_TIPS.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [status]);

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

  return (
    <div 
      className="font-sans min-h-screen bg-repeat flex flex-col"
      style={{ 
        backgroundImage: "url('/assets/dashboard_bg.jpg')",
        backgroundSize: "320px 320px",
        backgroundColor: "var(--color-brand-light)"
      }}
    >
      {/* Header Padronizado EasyCovers */}
      <header className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-md border-b border-slate-200/80 dark:border-slate-800 px-6 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30 transition-all">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/logo_symbol.png" 
              alt="EasyCovers Logo" 
              className="h-10 md:h-12 w-auto object-contain drop-shadow-sm"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-[var(--color-brand-deep)] leading-tight">
                EasyCovers
              </h1>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium hidden sm:inline-block">
                AI Audio Stem Separation Studio
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Status Badge Superior */}
        <div className="flex items-center gap-2">
          {status === 'processing' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs md:text-sm font-semibold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand-medium)] animate-pulse"></span>
              <span>Processando em tempo real</span>
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs md:text-sm font-semibold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Processamento Concluído</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs md:text-sm font-semibold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Ocorreu uma falha</span>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 my-4 md:my-6 flex flex-col gap-6">

        {/* Card de Resumo da Música */}
        <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/80 dark:border-slate-800 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] flex items-center justify-center text-white shadow-md shrink-0 relative overflow-hidden">
                <img 
                  src={songInfo?.cover_image_url || getGenreImage(songInfo?.genre)} 
                  alt="Capa da música" 
                  className="w-full h-full object-cover"
                />
                {status === 'processing' && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100 leading-tight">
                    {songInfo?.name || "Música em Processamento"}
                  </h2>
                  {isCatalog ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <span>🎧</span>
                      Catálogo Deezer
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
                <p className="text-gray-600 dark:text-slate-300 font-medium text-sm md:text-base">
                  {songInfo?.artist || "Artista / Banda"}
                </p>
              </div>
            </div>

            {/* Badges de Metadados Musicais */}
            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center">
              {songInfo?.genre && (
                <div className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs font-bold border border-gray-200 dark:border-slate-700 shadow-xs">
                  🎵 {songInfo.genre}
                </div>
              )}
              {songInfo?.instrument && (
                <div className="px-3 py-1.5 rounded-xl bg-[var(--color-brand-light)] dark:bg-blue-950/60 text-[var(--color-brand-dark)] dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 shadow-xs">
                  🎸 {songInfo.instrument}
                </div>
              )}
              {songInfo?.original_key && songInfo.original_key !== 'Unknown' && (
                <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 shadow-xs">
                  🎼 Tom: {songInfo.original_key}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SEÇÃO PRINCIPAL: Barra de Progresso e Métricas */}
        <section className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-xl border-t-4 border-[var(--color-brand-medium)] border-x border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-6 transition-all">
          
          {/* Cabeçalho da Barra de Progresso */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400">
                {status === 'success' ? 'Conclusão' : `Etapa ${currentStage} de ${stages.length}`}
              </span>
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100 mt-0.5">
                {status === 'success' 
                  ? "Separação Concluída com Sucesso!" 
                  : status === 'error' 
                  ? "Falha durante o processamento" 
                  : stages[currentStage - 1]?.name || "Processando faixas..."}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
                {status === 'success' 
                  ? "As 6 stems foram isoladas com alta pureza e estão prontas para tocar ou praticar." 
                  : status === 'error'
                  ? errorMessage || "Ocorreu um imprevisto durante o processamento da faixa."
                  : stages[currentStage - 1]?.desc}
              </p>
            </div>

            {/* Contador de Porcentagem & Tempo */}
            <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-5xl font-black text-[var(--color-brand-deep)] tabular-nums tracking-tight">
                  {Math.min(100, Math.max(0, Math.round(progress)))}
                </span>
                <span className="text-xl font-bold text-[var(--color-brand-medium)] dark:text-blue-400">%</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 font-semibold mt-1">
                <span>⏱️ {formatTime(elapsedSeconds)}</span>
                <span>•</span>
                <span className="text-[var(--color-brand-medium)] dark:text-blue-400">{estimatedRemainingText}</span>
              </div>
            </div>
          </div>

          {/* BARRA DE CARREGAMENTO (Design Sênior com Shimmer e Glow) */}
          <div className="relative w-full">
            <div 
              role="progressbar" 
              aria-valuenow={Math.round(progress)} 
              aria-valuemin="0" 
              aria-valuemax="100"
              className="w-full h-5 md:h-6 bg-blue-50 dark:bg-slate-800 rounded-full p-1 border border-blue-200 dark:border-slate-700 shadow-inner overflow-hidden flex items-center"
            >
              <div 
                className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden ${
                  status === 'error'
                    ? 'bg-rose-500'
                    : status === 'success'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                    : 'bg-gradient-to-r from-blue-500 via-[var(--color-brand-medium)] to-indigo-600 animate-shimmer'
                }`}
                style={{ width: `${Math.min(100, Math.max(progress, 3))}%` }}
              >
                {/* Linha de reflexo de vidro */}
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/25 rounded-t-full"></div>
              </div>
            </div>

            {/* Marcadores de Etapas sob a barra */}
            <div className="flex justify-between items-center px-1 mt-2 text-[11px] font-bold text-gray-400 dark:text-slate-500">
              <span>0% Inicial</span>
              <span className={progress >= 20 ? "text-[var(--color-brand-medium)] dark:text-blue-400" : ""}>20% Áudio</span>
              <span className={progress >= 40 ? "text-[var(--color-brand-medium)] dark:text-blue-400" : ""}>40% IA Demucs</span>
              <span className={progress >= 80 ? "text-[var(--color-brand-medium)] dark:text-blue-400" : ""}>80% Stems WAV</span>
              <span className={progress >= 100 ? "text-emerald-600 dark:text-emerald-400" : ""}>100% Concluído</span>
            </div>
          </div>

          {/* LINHA DO TEMPO / STEPPER DAS ETAPAS */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1">
              Progresso das Etapas
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {stages.map((stage) => {
                const isCompleted = currentStage > stage.id || status === 'success';
                const isCurrent = currentStage === stage.id && status === 'processing';

                return (
                  <div 
                    key={stage.id} 
                    className={`flex md:flex-col items-center md:items-start gap-3 p-3 rounded-xl transition-all border ${
                      isCompleted 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200' 
                        : isCurrent 
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-sm animate-pulse-glow' 
                        : 'bg-gray-50/60 dark:bg-slate-800/50 border-gray-200/80 dark:border-slate-700/80 text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {/* Indicador de Ícone */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : isCurrent
                        ? 'bg-[var(--color-brand-medium)] text-white shadow-md'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                    }`}>
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isCurrent ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        stage.id
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold leading-tight ${isCurrent ? 'text-[var(--color-brand-deep)] dark:text-blue-200' : isCompleted ? 'text-emerald-950 dark:text-emerald-200' : 'text-gray-500 dark:text-slate-400'}`}>
                        {stage.name}
                      </p>
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 hidden md:block mt-1 line-clamp-2">
                        {isCompleted ? 'Concluído' : isCurrent ? 'Em andamento...' : 'Aguardando'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VISUALIZADOR DAS 6 STEMS POR IA */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-2">
                <span>🎚️ Isolamento de Faixas em Tempo Real</span>
                <span className="text-[11px] font-semibold text-[var(--color-brand-medium)] dark:text-blue-400">
                  (HTDemucs 6 Stems)
                </span>
              </h4>
              <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Formato Lossless WAV</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {STEMS_INFO.map((stem) => {
                // Durante a etapa 3 em diante, as faixas começam a ser visualmente extraídas
                const isStemActive = currentStage >= 3;
                const isStemDone = currentStage >= 4 || status === 'success';

                return (
                  <div 
                    key={stem.id} 
                    className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                      isStemDone
                        ? 'bg-white dark:bg-slate-800/90 border-emerald-200 dark:border-emerald-800/70 shadow-sm'
                        : isStemActive
                        ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/70 shadow-sm'
                        : 'bg-gray-50/50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/70 opacity-60'
                    }`}
                  >
                    <span className="text-2xl mb-1">{stem.icon}</span>
                    <span className="text-xs font-bold text-gray-800 dark:text-slate-100">{stem.name}</span>
                    
                    {/* Equalizador animado */}
                    <div className="h-6 flex items-end justify-center gap-0.5 my-1.5">
                      {isStemActive && status === 'processing' ? (
                        <>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-1"></span>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-2"></span>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-3"></span>
                          <span className="w-1 bg-[var(--color-brand-medium)] rounded-full eq-bar-4"></span>
                        </>
                      ) : isStemDone ? (
                        <span className="text-emerald-500 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Pronta
                        </span>
                      ) : (
                        <span className="w-12 h-1 bg-gray-200 dark:bg-slate-700 rounded-full"></span>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">
                      {isStemDone ? 'WAV 44.1kHz' : isStemActive ? 'Isolando...' : 'Pendente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD DE DICAS MUSICAIS (CARROSSEL DINÂMICO) */}
          {status === 'processing' && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-800/90 rounded-xl p-4 border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3.5 transition-all">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 shadow-xs border border-blue-200 dark:border-slate-700 flex items-center justify-center text-lg shrink-0">
                💡
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand-medium)] dark:text-blue-400">
                    {MUSICIAN_TIPS[currentTipIndex].title}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">
                    ({currentTipIndex + 1} de {MUSICIAN_TIPS.length})
                  </span>
                </div>
                <p className="text-xs md:text-sm text-gray-700 dark:text-slate-300 leading-relaxed font-medium transition-opacity duration-300">
                  {MUSICIAN_TIPS[currentTipIndex].text}
                </p>
              </div>
            </div>
          )}

          {/* ÁREA DE SUCESSO / AÇÕES FINAIS */}
          {status === 'success' && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50/50 dark:bg-emerald-950/30 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/70">
              <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base">Música pronta para uso!</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Todas as 6 faixas foram geradas e salvas com sucesso.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-700 transition shadow-sm text-sm"
                >
                  Ir para Biblioteca
                </button>
                <button
                  type="button"
                  onClick={onOpenMixer}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] transition shadow-md text-sm"
                >
                  <img src="/assets/icons/icon_mixer_white.png" alt="Mixer" className="w-4 h-4 object-contain" />
                  Abrir no Mixer
                </button>
              </div>
            </div>
          )}

          {/* ÁREA DE ERRO / RETENTATIVA */}
          {status === 'error' && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-rose-50/60 dark:bg-rose-950/30 p-5 rounded-xl border border-rose-200 dark:border-rose-800/70">
              <div className="flex items-center gap-3 text-rose-800 dark:text-rose-200">
                <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  ✕
                </div>
                <div>
                  <h4 className="font-bold text-sm md:text-base">Não foi possível concluir</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md">
                    {errorMessage || "Verifique sua conexão, o link fornecido ou se o servidor Python está ativo."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-700 transition shadow-sm text-sm"
                >
                  Voltar e Editar
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-md text-sm"
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
