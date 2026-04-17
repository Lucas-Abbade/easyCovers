import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Upload = ({ onAddSong, user }) => {
  const navigate = useNavigate();
  // Estado inicial mantém o gênero vazio para obrigar o usuário a escolher um
  const [uploadForm, setUploadForm] = useState({ name: '', artist: '', genre: '', instrument: 'Guitarra' });
  const [audioFile, setAudioFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    
    // NOVO: Adicionado verificação para garantir que o gênero também foi escolhido
    if (!uploadForm.name || !uploadForm.artist || !uploadForm.genre || !audioFile) {
      alert("Preencha todos os dados, escolha um gênero e anexe um arquivo!");
      return;
    }

    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", audioFile);

    try {
      const params = new URLSearchParams({
        name: uploadForm.name,
        artist: uploadForm.artist,
        genre: uploadForm.genre,
        instrument: uploadForm.instrument,
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
      setIsProcessing(false);
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
        <h2 className="text-2xl font-bold text-[var(--color-brand-deep)] mb-6">Processar Nova Música</h2>
        
        {isProcessing ? (
          <div className="text-center p-10">
            <div className="w-16 h-16 border-t-4 border-b-4 border-[var(--color-brand-medium)] rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-[var(--color-brand-deep)]">Separando as faixas com IA...</h3>
            <p className="text-gray-500 mt-2">Isso pode levar de 1 a 5 minutos dependendo do seu computador e do tamanho da música.</p>
          </div>
        ) : (
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
              {/* NOVO: Campo de Gênero transformado em Select */}
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
            </div>

            <div className="mt-4 border-2 border-dashed border-[var(--color-brand-medium)] p-8 text-center rounded-lg bg-[var(--color-brand-light)]/30">
              <label className="cursor-pointer">
                <span className="bg-[var(--color-brand-medium)] text-white px-4 py-2 rounded-lg font-bold hover:bg-[var(--color-brand-dark)] transition">Selecionar Arquivo de Áudio</span>
                <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="hidden" />
              </label>
              <p className="text-sm text-gray-600 mt-4">
                {audioFile ? `Arquivo selecionado: ${audioFile.name}` : "Formatos suportados: .mp3, .wav, .flac"}
              </p>
            </div>

            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-lg font-bold mt-4 transition shadow-md">
              Iniciar Separação Mágica
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

export default Upload;