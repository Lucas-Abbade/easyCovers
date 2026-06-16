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
        alert("Erro no processamento.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="font-sans bg-[var(--color-brand-light)] min-h-screen">
      <header className="bg-white shadow-md px-8 py-4 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-[var(--color-brand-medium)]">EasyCovers</h1>
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-[var(--color-brand-medium)] font-bold flex items-center gap-2 transition">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Voltar para Biblioteca
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-8 mt-10 bg-white rounded-xl shadow-lg border-t-4 border-[var(--color-brand-medium)]">
        <h2 className="text-2xl font-bold text-[var(--color-brand-deep)] mb-6">Adicionar sua música</h2>
        
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
              <h3 className="text-lg font-bold text-[var(--color-brand-deep)] mb-4">Insira seu áudio</h3>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Cole o link do youtube"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1 p-3 border rounded-lg outline-none focus:border-[var(--color-brand-medium)]"
                  disabled={status !== "idle"}
                />
                {/* AQUI ESTÁ A MUDANÇA: w-40 shrink-0 e py-3 */}
                <button 
                  type="button"
                  onClick={handleYoutubeUpload} 
                  disabled={status !== "idle" || !youtubeUrl}
                  className="bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] disabled:bg-gray-400 text-white w-40 shrink-0 py-3 rounded-lg font-bold transition"
                >
                  {status === "downloading" ? "Baixando..." : status === "processing" ? "Processando..." : "Adicionar"}
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
                  <span className="bg-[var(--color-brand-medium)] text-white px-4 py-2 rounded-lg font-bold hover:bg-[var(--color-brand-dark)] transition">Selecionar Arquivo de Áudio</span>
                  <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="hidden" disabled={status !== "idle"} />
                </label>
                <p className="text-sm text-gray-600 mt-4">
                  {audioFile ? `Arquivo selecionado: ${audioFile.name}` : "Formatos suportados: .mp3, .wav, .flac"}
                </p>
              </div>

              {/* AQUI ESTÁ A MUDANÇA: w-40 shrink-0 */}
              <button 
                type="submit" 
                disabled={status !== "idle"}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white w-40 shrink-0 rounded-lg text-lg font-bold transition shadow-md flex items-center justify-center"
              >
                {status === "processing" ? "Processando..." : "Adicionar"}
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