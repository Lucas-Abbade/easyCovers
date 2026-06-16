import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Tone from 'tone';
import PlayPauseButton from '../components/PlayPauseButton'; // Importando o botão que separamos!

const trackLabels = {
  vocals: "Vocais",
  drums: "Bateria",
  bass: "Baixo",
  other: "Outros"
};

const keyNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const normalizeKeyName = (key) => {
  if (!key) return "Unknown";
  if (typeof key === 'object' && key.value) return key.value;
  return key;
};

const getShiftedKey = (originalKey, semitones) => {
  const normalized = normalizeKeyName(originalKey);
  if (!normalized || normalized === "Unknown") return "Unknown";
  const isMinor = normalized.endsWith("m");
  const root = isMinor ? normalized.slice(0, -1) : normalized;
  const index = keyNames.indexOf(root);
  if (index === -1) return normalized;
  const shiftedIndex = (index + semitones + 12) % 12;
  return `${keyNames[shiftedIndex]}${isMinor ? 'm' : ''}`;
};

const Mixer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const song = location.state?.song;

  // Estados de controle do áudio e tempo
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0); // Tempo atual (segundos)
  const [duration, setDuration] = useState(0); // Duração total da música
  
  // Estados de volume e mute (como já tínhamos)
  const [volumes, setVolumes] = useState({ vocals: 80, drums: 80, bass: 80, other: 80 });
  const [mutes, setMutes] = useState({ vocals: false, drums: false, bass: false, other: false });
  const [masterVolume, setMasterVolume] = useState(100);
  const [originalKey, setOriginalKey] = useState("Unknown");
  const [currentPitch, setCurrentPitch] = useState(0);
  const [currentKey, setCurrentKey] = useState("Unknown");
  
  const players = useRef(null);
  const pitchShift = useRef(null);
  const progressInterval = useRef(null);

  const trackLabels = {
    vocals: "Vocais",
    drums: "Bateria",
    bass: "Baixo",
    other: "Outros"
  };

  // Função auxiliar para formatar os segundos em "Minutos:Segundos" (ex: 3:45)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
    const min = Math.floor(timeInSeconds / 60);
    const sec = Math.floor(timeInSeconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  useEffect(() => {
    if (!song) {
      navigate('/dashboard');
      return;
    }

    const caminhoDaPasta = song.folder_path || song.folder;
    const pastaID = caminhoDaPasta.split(/[\\/]/).pop();
    const baseUrl = `http://localhost:8000/stems/${pastaID}/`;

    setOriginalKey(normalizeKeyName(song.original_key || song.originalKey || "Unknown"));
    setCurrentPitch(0);
    setCurrentKey(getShiftedKey(song.original_key || song.originalKey || "Unknown", 0));

    pitchShift.current = new Tone.PitchShift(0).toDestination();
    players.current = new Tone.Players({
      vocals: baseUrl + "vocals.wav", 
      drums: baseUrl + "drums.wav",
      bass: baseUrl + "bass.wav", 
      other: baseUrl + "other.wav",
    }).connect(pitchShift.current);

    Tone.loaded().then(() => {
      setIsLoaded(true);
      Tone.Destination.volume.value = 0; 
      
      // 1. Pega a duração total da música usando a faixa de voz como base
      setDuration(players.current.player("vocals").buffer.duration);
      
      // 2. Sincroniza todas as faixas para tocarem exatamente juntas na "esteira" do Tone
      ["vocals", "drums", "bass", "other"].forEach(track => {
        handleVolumeChange(track, 80);
        players.current.player(track).sync().start(0);
      });
    });
    
    return () => {
      // Limpeza ao sair da tela
      cancelAnimationFrame(progressInterval.current);
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
      players.current?.dispose();
      pitchShift.current?.dispose();
    };
  }, [song, navigate]);

  // Atualiza a barra de progresso constantemente enquanto a música toca
  useEffect(() => {
    const updateProgress = () => {
      if (Tone.Transport.state === 'started') {
        setProgress(Tone.Transport.seconds);
        
        // Se a música acabar, ele pausa e volta pro começo automaticamente
        if (duration > 0 && Tone.Transport.seconds >= duration) {
          Tone.Transport.stop();
          Tone.Transport.seconds = 0;
          setProgress(0);
          setIsPlaying(false);
        } else {
          progressInterval.current = requestAnimationFrame(updateProgress);
        }
      }
    };

    if (isPlaying) {
      progressInterval.current = requestAnimationFrame(updateProgress);
    }

    return () => cancelAnimationFrame(progressInterval.current);
  }, [isPlaying, duration]);

  // Nova lógica de Tocar/Pausar (agora pausa em vez de parar tudo)
  const togglePlay = async () => {
    if (Tone.context.state !== 'running') await Tone.start();
    
    if (isPlaying) {
      Tone.Transport.pause(); // Pausa exatamente onde está
    } else {
      Tone.Transport.start(); // Continua de onde parou
    }
    setIsPlaying(!isPlaying);
  };

  // Nova função para quando o usuário arrastar a bolinha da linha do tempo
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setProgress(newTime);
    Tone.Transport.seconds = newTime; // Pula o áudio para o tempo escolhido
  };

  const toggleMute = (track) => {
    const isMuted = !mutes[track];
    setMutes(prev => ({ ...prev, [track]: isMuted }));
    players.current.player(track).mute = isMuted;
  };

const handleVolumeChange = (track, value) => {
  const numericValue = parseFloat(value);
  setVolumes(prev => ({ ...prev, [track]: numericValue }));
  
  if (players.current && players.current.has(track)) {
    const player = players.current.player(track);
    
    player.volume.value = numericValue === 0 
      ? -Infinity 
      : 20 * Math.log10((numericValue / 100) * 0.5);
  }
};

const handleMasterVolumeChange = (value) => {
  const numericValue = parseFloat(value);
  setMasterVolume(numericValue);

  if (Tone.Destination) {
    Tone.Destination.volume.value = numericValue === 0
      ? -Infinity
      : 20 * Math.log10(numericValue / 100);
  }
};

const changePitch = (delta) => {
  const nextPitch = currentPitch + delta;
  if (!pitchShift.current || nextPitch < -12 || nextPitch > 12) return;
  pitchShift.current.pitch = nextPitch;
  setCurrentPitch(nextPitch);
  setCurrentKey(getShiftedKey(originalKey, nextPitch));
};
  return (
    <div className="font-sans bg-[var(--color-brand-light)] min-h-screen">
       <header className="bg-white shadow-md px-8 py-4 flex justify-between items-center">
         <h1 className="text-3xl font-extrabold text-[var(--color-brand-medium)]">EasyCovers</h1>
         <button onClick={() => { setIsPlaying(false); Tone.Transport.stop(); navigate(-1); }} className="text-gray-600 font-bold hover:underline">Voltar ao Dashboard</button>
       </header>

       <main className="max-w-6xl mx-auto p-6 mt-6">
         <section className="bg-white p-10 rounded-xl shadow-lg border-t-4 border-[var(--color-brand-medium)]">
           
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
             <div className="flex gap-6 items-center">
               <div className="w-24 h-24 bg-gradient-to-br from-[var(--color-brand-medium)] to-[var(--color-brand-dark)] rounded-lg flex items-center justify-center shadow-md">
                 <span className="text-white text-4xl">🎵</span>
               </div>
               <div>
                 <h2 className="text-4xl font-black text-gray-800 uppercase leading-none mb-2">{song.name}</h2>
                 <p className="text-xl text-gray-600 font-medium">
                   Artista: <span className="text-[var(--color-brand-deep)]">{song.artist || "Desconhecido"}</span>
                 </p>
                 <span className="inline-block mt-2 px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-full uppercase tracking-widest">
                   {song.genre || "Gênero não definido"}
                 </span>
               </div>
             </div>
           </div>

           <div className="mb-8 grid gap-4 md:grid-flow-col md:auto-cols-max md:items-center bg-slate-50 p-5 rounded-3xl border border-slate-200">
             <div className="text-sm text-slate-600">
               <span className="font-bold text-slate-900">Tom original:</span> {originalKey}
             </div>
             <div className="text-sm text-slate-600">
               <span className="font-bold text-slate-900">Tom atual:</span> {currentKey} {currentPitch !== 0 ? `(${currentPitch > 0 ? '+' : ''}${currentPitch} semitons)` : ''}
             </div>
             <div className="flex gap-3">
               <button
                 onClick={() => changePitch(-1)}
                 className="bg-white border border-slate-300 text-slate-700 px-5 py-3 rounded-xl font-semibold hover:bg-slate-100 transition"
               >
                 - Tom
               </button>
               <button
                 onClick={() => changePitch(1)}
                 className="bg-[var(--color-brand-medium)] text-white px-5 py-3 rounded-xl font-semibold hover:bg-[var(--color-brand-dark)] transition"
               >
                 + Tom
               </button>
             </div>
           </div>

           {/* TIMELINE (LINHA DO TEMPO E PLAYER)          */}
           {/* ========================================= */}
           <div className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center">
              
              {/* COMPONENTE DO BOTÃO NOVO (Deixe apenas este!) */}
              <div className="mb-6 flex items-center justify-center w-24 h-24">
                <PlayPauseButton 
                  isPlaying={isPlaying} 
                  isLoaded={isLoaded} 
                  togglePlay={togglePlay} 
                />
              </div>

              {/* Linha do Tempo Estilo Spotify */}
              <div className="flex items-center gap-4 w-full">
                <span className="text-sm font-bold text-gray-500 w-12 text-right">
                  {formatTime(progress)}
                </span>
                
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  step="0.1"
                  value={progress} 
                  onChange={handleSeek} 
                  disabled={!isLoaded}
                  className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all"
                  // NOVO: Gradiente dinâmico para a cor azulada
                  style={{
                    background: `linear-gradient(to right, #2563eb ${(progress / (duration || 100)) * 100}%, #d1d5db ${(progress / (duration || 100)) * 100}%)`
                  }}
                />
                
                <span className="text-sm font-bold text-gray-500 w-12">
                  {formatTime(duration)}
                </span>
              </div>
           </div>

           {/* Master Volume */}
            <div className="mb-8 flex items-center gap-6 max-w-md mx-auto">
              <span className="text-sm font-bold text-gray-400 uppercase">Master</span>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={masterVolume} 
                onChange={(e) => handleMasterVolumeChange(e.target.value)} 
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                // NOVO: Gradiente para o volume master
                style={{
                  background: `linear-gradient(to right, #2563eb ${masterVolume}%, #d1d5db ${masterVolume}%)`
                }}
              />
              <span className="text-lg font-black text-gray-700 w-12 text-right">{masterVolume}%</span>
            </div>
           
           {/* Canais do Mixer Vertical */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
  {["vocals", "drums", "bass", "other"].map(track => (
    <div key={track} className={`border-2 p-6 rounded-2xl text-center flex flex-col items-center transition-all ${mutes[track] ? 'bg-gray-200 border-gray-300 opacity-60' : 'bg-white border-gray-100 shadow-sm'}`}>
      
      {/* Nome da Faixa Traduzido */}
      <h4 className="text-sm font-black mb-4 uppercase tracking-widest text-gray-500">
        {trackLabels[track]}
      </h4>

      {/* Slider Vertical (Feito com Rotação de -90 graus para preservar o gradiente) */}
      <div className="flex flex-col items-center justify-center h-48 w-full relative my-4">
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={volumes[track]} 
          onChange={(e) => handleVolumeChange(track, e.target.value)} 
          className="appearance-none w-48 h-2 rounded-lg cursor-pointer accent-blue-600 absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 origin-center -rotate-90"
          style={{
            background: `linear-gradient(to right, #2563eb ${volumes[track]}%, #d1d5db ${volumes[track]}%)`
          }}
        />
      </div>
      
      <span className="text-sm font-bold text-blue-600 mb-4">{volumes[track]}%</span>

      {/* Botão de Mute com Ícone */}
      <button 
        onClick={() => toggleMute(track)} 
        className={`flex items-center justify-center gap-2 py-3 w-full rounded-xl text-xs font-bold transition-all transform active:scale-95 ${mutes[track] ? 'bg-red-500 text-white' : 'bg-gray-800 text-white hover:bg-black shadow-md'}`}
      >
        {mutes[track] ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M13.5 4.06c0-1.333-1.612-2.003-2.553-1.062l-4.506 4.506H4.5a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25h1.941l4.506 4.506c.941.941 2.553.271 2.553-1.062V4.06zM17.28 9.22a.75.75 0 10-1.06 1.06L17.44 11.5l-1.22 1.22a.75.75 0 101.06 1.06l1.22-1.22 1.22 1.22a.75.75 0 101.06-1.06L19.56 11.5l1.22-1.22a.75.75 0 10-1.06-1.06l-1.22 1.22-1.22-1.22z" />
            </svg>
            MUDO
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M13.5 4.06c0-1.333-1.612-2.003-2.553-1.062l-4.506 4.506H4.5a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25h1.941l4.506 4.506c.941.941 2.553.271 2.553-1.062V4.06zM18.75 12a.75.75 0 00-1.5 0 4.25 4.25 0 01-4.25 4.25.75.75 0 000 1.5 5.75 5.75 0 005.75-5.75z" />
              <path d="M22.5 12a.75.75 0 00-1.5 0 8.25 8.25 0 01-8.25 8.25.75.75 0 000 1.5 9.75 9.75 0 009.75-9.75z" />
            </svg>
            MUTE
          </>
        )}
      </button>
    </div>
  ))}
</div>
         </section>
       </main>
    </div>
  );
};

export default Mixer;