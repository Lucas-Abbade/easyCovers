import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AudioProcessingScreen from '../components/AudioProcessingScreen';

const keyOptions = [
  "Unknown",
  "C", "Cm",
  "C#", "C#m",
  "D", "Dm",
  "D#", "D#m",
  "E", "Em",
  "F", "Fm",
  "F#", "F#m",
  "G", "Gm",
  "G#", "G#m",
  "A", "Am",
  "A#", "A#m",
  "B", "Bm",
];

const Upload = ({ onAddSong, user }) => {
  const navigate = useNavigate();
  const [uploadForm, setUploadForm] = useState({ 
    name: '', 
    artist: '', 
    genre: '', 
    instrument: 'Guitarra', 
    original_key: 'Unknown' 
  });
  const [audioFile, setAudioFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Estados da nova tela de processamento unificada
  const [processingState, setProcessingState] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSongInfo, setActiveSongInfo] = useState(null);
  const [processedSong, setProcessedSong] = useState(null);

  const progressIntervalRef = useRef(null);
  const lastSourceRef = useRef(null); // 'file' | 'youtube'

  // Prevenção de fechamento acidental da aba durante o processamento
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (processingState === 'processing') {
        e.preventDefault();
        e.returnValue = "O processamento de áudio ainda está em andamento. Tem certeza que deseja sair?";
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [processingState]);

  // Limpa o timer de progresso
  const clearProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Inicia a progressão dinâmica e realista de etapas enquanto a requisição HTTP ocorre
  const startProgressSimulation = () => {
    clearProgressTimer();
    setProgress(3);
    setCurrentStage(1);

    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;

      setProgress((prev) => {
        let next = prev;

        // Etapa 1: Aquisição do áudio (0s a 6s) -> 3% a 22%
        if (elapsed < 6) {
          setCurrentStage(1);
          next = 3 + (elapsed / 6) * 19;
        }
        // Etapa 2: Normalização acústica EBU R128 (6s a 14s) -> 22% a 38%
        else if (elapsed < 14) {
          setCurrentStage(2);
          next = 22 + ((elapsed - 6) / 8) * 16;
        }
        // Etapa 3: Separação por IA HTDemucs (14s a 50s) -> 38% a 82%
        else if (elapsed < 50) {
          setCurrentStage(3);
          next = 38 + ((elapsed - 14) / 36) * 44;
        }
        // Etapa 4: Renderização de stems WAV (50s a 80s) -> 82% a 92%
        else if (elapsed < 80) {
          setCurrentStage(4);
          next = 82 + ((elapsed - 50) / 30) * 10;
        }
        // Aguardando resposta final do servidor (desaceleração assintótica até 94%)
        else {
          setCurrentStage(4);
          next = Math.min(94, prev + 0.1);
        }

        return Math.min(94, next);
      });
    }, 400);
  };

  // Finaliza a barra para 100% ao receber confirmação do servidor
  const completeProgressSuccessfully = useCallback((finalSong) => {
    clearProgressTimer();
    setCurrentStage(5);
    setProgress(100);
    setProcessingState('success');
    setProcessedSong(finalSong);

    // Registra a música no estado global do app
    if (onAddSong && finalSong) {
      onAddSong(finalSong);
    }
  }, [onAddSong]);

  // Manipula falhas de processamento
  const handleProcessingError = (detailMessage) => {
    clearProgressTimer();
    setProcessingState('error');
    setErrorMessage(detailMessage || "Ocorreu uma falha no processamento. Verifique sua conexão e tente novamente.");
  };

  // 1. Processamento via Upload de Arquivo
  const handleUploadSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!uploadForm.name.trim() || !uploadForm.artist.trim() || !uploadForm.genre) {
      alert("Por favor, preencha o nome da música, artista e escolha um gênero!");
      return;
    }

    if (!audioFile) {
      alert("Por favor, selecione um arquivo de áudio (.mp3, .wav, .flac)!");
      return;
    }

    lastSourceRef.current = 'file';
    setActiveSongInfo({
      name: uploadForm.name,
      artist: uploadForm.artist,
      genre: uploadForm.genre,
      instrument: uploadForm.instrument,
      original_key: uploadForm.original_key,
      sourceType: 'file',
      sourceDetail: audioFile.name
    });

    setProcessingState('processing');
    startProgressSimulation('file');

    const formData = new FormData();
    formData.append("file", audioFile);

    try {
      const params = new URLSearchParams({
        name: uploadForm.name,
        artist: uploadForm.artist,
        genre: uploadForm.genre,
        instrument: uploadForm.instrument,
        original_key: uploadForm.original_key,
        user_id: user.id
      }).toString();

      const response = await fetch(`http://localhost:8000/processar-audio/?${params}`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const createdSong = {
          id: data.id,
          name: uploadForm.name,
          artist: uploadForm.artist,
          genre: uploadForm.genre,
          instrument: uploadForm.instrument,
          original_key: uploadForm.original_key,
          folder: data.folder,
          folder_path: data.folder
        };
        completeProgressSuccessfully(createdSong);
      } else {
        const errorData = await response.json().catch(() => ({}));
        handleProcessingError(errorData.detail || "Não foi possível separar as faixas do arquivo de áudio.");
      }
    } catch (error) {
      console.error("Erro no envio:", error);
      handleProcessingError("Falha na conexão com o servidor EasyCovers. O backend Python está em execução?");
    }
  };

  // 2. Processamento via Link do YouTube
  const handleYoutubeUpload = async () => {
    if (!youtubeUrl.trim()) {
      alert("Por favor, cole um link do YouTube!");
      return;
    }

    lastSourceRef.current = 'youtube';
    const fallbackTitle = uploadForm.name.trim() || "Música do YouTube";
    const fallbackArtist = uploadForm.artist.trim() || "YouTube";

    setActiveSongInfo({
      name: fallbackTitle,
      artist: fallbackArtist,
      genre: uploadForm.genre || "Gênero Geral",
      instrument: uploadForm.instrument,
      original_key: uploadForm.original_key,
      sourceType: 'youtube',
      sourceDetail: youtubeUrl
    });

    setProcessingState('processing');
    startProgressSimulation('youtube');

    try {
      const cleanUrl = youtubeUrl.trim().split('&')[0];
      const response = await fetch("http://localhost:8000/upload-youtube/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanUrl,
          user_id: user.id,
          custom_title: uploadForm.name.trim() || undefined,
          custom_artist: uploadForm.artist.trim() || undefined,
          custom_genre: uploadForm.genre || undefined,
          custom_instrument: uploadForm.instrument,
          custom_original_key: uploadForm.original_key
        }),
      });

      if (response.ok) {
        const newSong = await response.json();
        // Garante formato consistente de folder/folder_path
        const standardizedSong = {
          ...newSong,
          folder: newSong.folder_path || newSong.folder,
          folder_path: newSong.folder_path || newSong.folder
        };
        completeProgressSuccessfully(standardizedSong);
      } else {
        const errorData = await response.json().catch(() => ({}));
        handleProcessingError(errorData.detail || "Erro ao baixar ou processar o áudio do YouTube.");
      }
    } catch (error) {
      console.error("Erro no YouTube:", error);
      handleProcessingError("Falha na conexão com o servidor ao processar o YouTube.");
    }
  };

  // Ações de Conclusão / Redirecionamento
  const handleOpenMixer = () => {
    if (processedSong) {
      navigate('/mixer', { state: { song: processedSong } });
    } else {
      navigate('/dashboard');
    }
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleCancelAndEdit = () => {
    clearProgressTimer();
    setProcessingState('idle');
  };

  const handleRetry = () => {
    if (lastSourceRef.current === 'youtube') {
      handleYoutubeUpload();
    } else {
      handleUploadSubmit();
    }
  };

  // Se o estado for processando, concluído ou erro, renderiza a tela unificada de processamento!
  if (processingState !== 'idle') {
    return (
      <AudioProcessingScreen
        songInfo={activeSongInfo}
        currentStage={currentStage}
        progress={progress}
        status={processingState}
        errorMessage={errorMessage}
        onRetry={handleRetry}
        onCancel={handleCancelAndEdit}
        onOpenMixer={handleOpenMixer}
        onGoToDashboard={handleGoToDashboard}
      />
    );
  }

  // Formulário padrão de envio (quando o estado é 'idle')
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
            src="/assets/logo_symbol.png" 
            alt="EasyCovers Logo" 
            className="h-10 w-auto object-contain drop-shadow-sm"
          />
          <h1 className="text-2xl font-extrabold text-[var(--color-brand-deep)]">
            EasyCovers
          </h1>
        </div>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="text-gray-600 hover:text-[var(--color-brand-medium)] font-bold flex items-center gap-2 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Voltar para Biblioteca
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-8 my-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border-t-4 border-[var(--color-brand-medium)]">
        <div className="flex flex-col items-center mb-6">
          <img 
            src="/assets/upload_illustration.jpg" 
            alt="Ilustração de envio de áudio" 
            className="w-44 h-auto object-contain mb-2 rounded-xl"
          />
          <h2 className="text-2xl font-extrabold text-[var(--color-brand-deep)]">Adicionar sua música</h2>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Envie o áudio ou cole um link do YouTube para separar as faixas com IA
          </p>
        </div>
        
        <form onSubmit={handleUploadSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Nome da Música</label>
              <input 
                type="text" 
                placeholder="Ex: Comfortably Numb"
                value={uploadForm.name} 
                onChange={e => setUploadForm({...uploadForm, name: e.target.value})} 
                className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] transition" 
                required 
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-2">Artista / Banda</label>
              <input 
                type="text" 
                placeholder="Ex: Pink Floyd"
                value={uploadForm.artist} 
                onChange={e => setUploadForm({...uploadForm, artist: e.target.value})} 
                className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] transition" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Gênero</label>
              <select 
                value={uploadForm.genre} 
                onChange={e => setUploadForm({...uploadForm, genre: e.target.value})} 
                className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white transition"
                required
              >
                <option value="" disabled>Selecione um gênero</option>
                <option value="Rock">Rock</option>
                <option value="Heavy Metal">Heavy Metal</option>
                <option value="Grunge">Grunge</option>
                <option value="Indie Rock">Indie Rock</option>
                <option value="Rock Progressivo">Rock Progressivo</option>
                <option value="Blues Rock">Blues Rock</option>
                <option value="Samba">Samba</option>
                <option value="Bossa Nova">Bossa Nova</option>
                <option value="MPB">MPB</option>
                <option value="Sertanejo">Sertanejo</option>
                <option value="Música Clássica">Música Clássica</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">Seu Instrumento</label>
              <select 
                value={uploadForm.instrument} 
                onChange={e => setUploadForm({...uploadForm, instrument: e.target.value})} 
                className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white transition"
              >
                <option>Guitarra</option>
                <option>Violão</option>
                <option>Baixo</option>
                <option>Bateria</option>
                <option>Voz</option>
                <option>Teclado</option>
              </select>
            </div>              
            
            <div>
              <label className="block text-gray-700 font-bold mb-2">Tom Original</label>
              <select 
                value={uploadForm.original_key} 
                onChange={(e) => setUploadForm({...uploadForm, original_key: e.target.value})} 
                className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white transition"
              >
                {keyOptions.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>            
          </div>

          {/* Opção 1: Importar do YouTube */}
          <div className="mt-4 pt-6 border-t-2 border-gray-200">
            <h3 className="text-lg font-bold text-[var(--color-brand-deep)] mb-3 flex items-center gap-2">
              <img src="/assets/icons/icon_youtube.png" alt="YouTube" className="w-6 h-6 object-contain" />
              Opção A: Importar pelo YouTube
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Cole o link do vídeo e preencha os dados acima para iniciar a separação por IA.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="flex-1 p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] transition"
              />
              <button 
                type="button"
                onClick={handleYoutubeUpload} 
                disabled={!youtubeUrl.trim()}
                className="flex items-center justify-center gap-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition shadow-sm shrink-0"
              >
                <img src="/assets/icons/icon_youtube_white.png" alt="YouTube" className="w-6 h-6 object-contain" />
                Importar e Separar
              </button>
            </div>
          </div>

          {/* Separador Visual */}
          <div className="flex items-center my-2 text-gray-400 font-medium">
            <div className="flex-1 border-b border-gray-200"></div>
            <span className="px-4 text-xs font-bold uppercase tracking-wider">ou envie um arquivo local</span>
            <div className="flex-1 border-b border-gray-200"></div>
          </div>
          
          {/* Opção 2: Upload de Arquivo Local */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 border-2 border-dashed border-[var(--color-brand-medium)] p-6 text-center rounded-xl bg-[var(--color-brand-light)]/30 flex flex-col justify-center items-center">
              <label className="cursor-pointer">
                <span className="flex items-center gap-3 bg-[var(--color-brand-medium)] text-white px-6 py-3 rounded-xl font-bold hover:bg-[var(--color-brand-dark)] transition shadow-sm">
                  <img src="/assets/icons/icon_upload_cloud_white.png" alt="Upload" className="w-7 h-7 object-contain" />
                  Selecionar Arquivo
                </span>
                <input 
                  type="file" 
                  accept="audio/*,.mp3,.wav,.flac,.m4a" 
                  onChange={(e) => setAudioFile(e.target.files[0])} 
                  className="hidden" 
                />
              </label>
              <p className="text-xs text-gray-600 mt-3">
                {audioFile ? (
                  <span className="font-bold text-[var(--color-brand-medium)]">
                    ✓ Arquivo selecionado: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                ) : (
                  "Formatos suportados: .mp3, .wav, .flac, .m4a"
                )}
              </p>
            </div>

            <button 
              type="submit" 
              disabled={!audioFile}
              className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-base font-bold transition shadow-md shrink-0 sm:w-48"
            >
              <img src="/assets/icons/icon_scissors_white.png" alt="Separar" className="w-6 h-6 object-contain" />
              Separar Faixas
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Upload;