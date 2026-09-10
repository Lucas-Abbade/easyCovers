import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [uploadForm, setUploadForm] = useState({ name: '', artist: '', genre: '', instrument: 'Guitarra', original_key: 'Unknown' });
  const [audioFile, setAudioFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [status, setStatus] = useState("idle");

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    
    if (!uploadForm.name || !uploadForm.artist || !uploadForm.genre || !audioFile) {
      alert("Preencha todos os dados, escolha um gênero e anexe um arquivo!");
      return;
    }

    setStatus("processing");

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
        
        onAddSong({ 
          id: data.id, 
          name: uploadForm.name, 
          artist: uploadForm.artist,
          genre: uploadForm.genre,
          instrument: uploadForm.instrument,
          original_key: uploadForm.original_key,
          folder: data.folder
        });
        
        setUploadForm({ name: '', artist: '', genre: '', instrument: 'Guitarra' });
        setAudioFile(null);
        navigate('/dashboard');
      } else {
        const errorData = await response.json();
        alert(`Erro ao processar: ${errorData.detail || 'Tente novamente.'}`);
      }
    } catch (error) {
      console.error("Erro no envio:", error);
      alert("Falha na conexão. O servidor Python está rodando?");
    } finally {
      setStatus("idle");
    }
  };

  const handleYoutubeUpload = async () => {
    if (!youtubeUrl) return alert("Cole um link!");

    setStatus("downloading");

    try {
      const response = await fetch("http://localhost:8000/upload-youtube/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            url: youtubeUrl.split('&')[0],
            user_id: user.id,
            custom_title: uploadForm.name,
            custom_artist: uploadForm.artist,
            custom_genre: uploadForm.genre,
            custom_instrument: uploadForm.instrument,
            custom_original_key: uploadForm.original_key
        }),
      });

      if (response.ok) {
        setStatus("processing");
        
        const newSong = await response.json(); 
        
        onAddSong(newSong); 

        alert("Música processada com sucesso!");
        navigate("/dashboard"); 
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Erro no processamento: ${errorData.detail || 'Tente novamente.'}`);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setStatus("idle");
    }
  };

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
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-[var(--color-brand-medium)] font-bold flex items-center gap-2 transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
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
          <p className="text-sm text-gray-500 mt-1">Envie o áudio ou cole um link do YouTube para separar as faixas</p>
        </div>
        
        <form onSubmit={handleUploadSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-2">Nome da Música</label>
                <input type="text" value={uploadForm.name} onChange={e => setUploadForm({...uploadForm, name: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)]" required />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-2">Artista / Banda</label>
                <input type="text" value={uploadForm.artist} onChange={e => setUploadForm({...uploadForm, artist: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)]" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-2">Gênero</label>
                <select 
                  value={uploadForm.genre} 
                  onChange={e => setUploadForm({...uploadForm, genre: e.target.value})} 
                  className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white"
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
                <select value={uploadForm.instrument} onChange={e => setUploadForm({...uploadForm, instrument: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white">
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
                <select value={uploadForm.original_key} onChange={(e) => setUploadForm({...uploadForm, original_key: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)] bg-white">
                  {keyOptions.map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>            
            </div>

            <div className="mt-6 pt-6 border-t-2 border-gray-300">
              <h3 className="text-lg font-bold text-[var(--color-brand-deep)] mb-4 flex items-center gap-2">
                <img src="/assets/icons/icon_youtube.png" alt="YouTube" className="w-6 h-6 object-contain" />
                Importar pelo YouTube
              </h3>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Cole o link do YouTube..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1 p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)]"
                  disabled={status !== "idle"}
                />
                <button 
                  type="button"
                  onClick={handleYoutubeUpload} 
                  disabled={status !== "idle" || !youtubeUrl}
                  className="flex items-center justify-center gap-2.5 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:bg-gray-400 text-white w-48 shrink-0 py-2.5 rounded-lg font-bold transition shadow-sm"
                >
                  <img src="/assets/icons/icon_youtube_white.png" alt="YouTube" className="w-9 h-9 object-contain" />
                  {status === "downloading" ? "Baixando..." : status === "processing" ? "Processando..." : "Importar"}
                </button>
              </div>
            </div>

            <div className="flex items-center my-2 text-gray-500 font-medium">
              <div className="flex-1 border-b border-gray-300"></div>
              <span className="px-4 text-sm">ou</span>
              <div className="flex-1 border-b border-gray-300"></div>
            </div>
            
            <div className="flex gap-3 items-stretch mt-2">
              <div className="flex-1 border-2 border-dashed border-[var(--color-brand-medium)] p-6 text-center rounded-lg bg-[var(--color-brand-light)]/30 flex flex-col justify-center items-center">
                <label className="cursor-pointer">
                  <span className="flex items-center gap-3 bg-[var(--color-brand-medium)] text-white px-6 py-3 rounded-xl font-bold hover:bg-[var(--color-brand-dark)] transition shadow-sm">
                    <img src="/assets/icons/icon_upload_cloud_white.png" alt="Upload" className="w-10 h-10 object-contain" />
                    Selecionar Arquivo de Áudio
                  </span>
                  <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="hidden" disabled={status !== "idle"} />
                </label>
                <p className="text-sm text-gray-600 mt-4">
                  {audioFile ? `Arquivo selecionado: ${audioFile.name}` : "Formatos suportados: .mp3, .wav, .flac"}
                </p>
              </div>

              <button 
                type="submit" 
                disabled={status !== "idle"}
                className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white w-48 shrink-0 rounded-lg text-lg font-bold transition shadow-md"
              >
                <img src="/assets/icons/icon_scissors_white.png" alt="Separar" className="w-9 h-9 object-contain" />
                {status === "processing" ? "Processando..." : "Separar Faixas"}
              </button>
            </div>
          </form>
      </main>

      {/* Pop-up de Status */}
      {(status === "downloading" || status === "processing") && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl text-center text-gray-800 max-w-md mx-4">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[var(--color-brand-medium)] rounded-full animate-spin mx-auto mb-6"></div>
            {status === "downloading" ? (
              <>
                <p className="text-lg font-semibold">Buscando e baixando arquivo da música...</p>
                <p className="text-gray-500 mt-2">Aguarde enquanto preparamos o áudio do YouTube.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">IA separando as trilhas (Voz, Bateria, Baixo...)</p>
                <p className="text-gray-500 mt-2">Isso pode levar de 1 a 5 minutos dependendo do tamanho da música.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;