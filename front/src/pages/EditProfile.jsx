import React, { useState, useRef, useEffect } from 'react';  // Add useEffect
import { useNavigate, useLocation } from 'react-router-dom';
import AvatarEditor from 'react-avatar-editor';

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const isNewUser = location.state?.isNewUser;

  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    bio: "",
    instrument: "",
    favorite_genres: "",
    favorite_artists: "",
  });

  // --- ESTADOS NOVOS PARA O EDITOR DE FOTO ---
  const [profilePic, setProfilePic] = useState(null); // Arquivo final cortado
  const [previewUrl, setPreviewUrl] = useState("https://ui-avatars.com/api/?name=User&background=random&size=150");
  
  const [selectedFile, setSelectedFile] = useState(null); // Arquivo bruto
  const [isCropping, setIsCropping] = useState(false); // Controla se o Modal está aberto
  const [scale, setScale] = useState(1); // Controla o Zoom da foto
  const editorRef = useRef(null); // Referência para pegar a imagem de dentro do editor

  // Fetch and load existing profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || !user.id) {
        alert("Usuário não identificado. Faça login novamente.");
        navigate('/');
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/profile/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setFormData({
            full_name: data.full_name || "",
            username: data.username || "",
            bio: data.bio || "",
            instrument: data.instrument || "",
            favorite_genres: data.favorite_genres || "",
            favorite_artists: data.favorite_artists || "",
          });
          if (data.profile_picture_url) {
            setPreviewUrl(data.profile_picture_url);  // Load existing profile pic URL
          }
        } else {
          console.error("Erro ao carregar perfil:", response.statusText);
          // For new users, keep defaults
        }
      } catch (error) {
        console.error("Erro na requisição de perfil:", error);
      }
    };

    loadProfile();
  }, [navigate]);  // Run once on mount

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Quando o usuário escolhe a imagem no PC
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIsCropping(true); // Abre a janelinha de edição
      setScale(1); // Reseta o zoom
    }
  };

  // Quando o usuário clica em "Confirmar" no Modal
  const handleSaveCrop = () => {
    if (editorRef.current) {
      // Pega a imagem exatamente como está no quadradinho
      const canvas = editorRef.current.getImageScaledToCanvas();
      
      // Transforma em uma URL para mostrar no Preview da tela principal
      setPreviewUrl(canvas.toDataURL());

      // Transforma em um "Arquivo" (Blob) para podermos enviar pro Back-end depois
      canvas.toBlob((blob) => {
        const file = new File([blob], "profile_pic.png", { type: "image/png" });
        setProfilePic(file);
      });

      setIsCropping(false); // Fecha a janelinha
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Pegar o ID do usuário logado (assumindo que você salvou no login)
  // Se você usa o estado do App.jsx, pode passar via props também.
  const user = JSON.parse(localStorage.getItem('user')); 
  if (!user || !user.id) {
    return alert("Usuário não identificado. Faça login novamente.");
  }

  // 2. Criar o FormData (necessário para enviar arquivos)
  const dataToSend = new FormData();
  dataToSend.append('full_name', formData.full_name);
  dataToSend.append('username', formData.username);
  dataToSend.append('bio', formData.bio);
  dataToSend.append('instrument', formData.instrument);
  dataToSend.append('favorite_genres', formData.favorite_genres);
  dataToSend.append('favorite_artists', formData.favorite_artists);
  
  // Enviar a foto apenas se o usuário tiver escolhido uma nova
  if (profilePic) {
    dataToSend.append('profile_picture', profilePic);
  }

  try {
    const response = await fetch(`http://localhost:8000/update-profile/${user.id}`, {
      method: "POST", // Ou PUT
      body: dataToSend, // FormData não precisa de Header "Content-Type" manual
    });

    if (response.ok) {
      const result = await response.json();
      alert("Perfil atualizado com sucesso!");
      
      // Se o username mudou, atualize o localStorage para refletir no Dashboard
      const updatedUser = { ...user, username: formData.username };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      navigate('/dashboard');
    } else {
      const errorData = await response.json();
      alert(`Erro ao salvar: ${errorData.detail}`);
    }
  } catch (error) {
    console.error("Erro na requisição:", error);
    alert("Erro ao conectar com o servidor.");
  }
};

  return (
    <div className="font-sans bg-[var(--color-brand-light)] min-h-screen">
      
      {/* --- MODAL DE CORTE DE FOTO (Aparece por cima de tudo) --- */}
      {isCropping && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full animate-fade-in">
            <h3 className="text-xl font-extrabold mb-6 text-gray-800 uppercase tracking-widest">Ajustar Foto</h3>
            
            <div className="border-4 border-gray-100 rounded-lg overflow-hidden shadow-inner">
              <AvatarEditor
                ref={editorRef}
                image={selectedFile}
                width={200}
                height={200}
                border={30}
                borderRadius={100} // Transforma o guia de corte em um círculo
                color={[255, 255, 255, 0.8]} // Cor da máscara por fora do círculo
                scale={scale}
                rotate={0}
              />
            </div>
            
            {/* Controle de Zoom */}
            <div className="w-full mt-6 flex flex-col items-center">
              <label className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Ajustar Zoom</label>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.01" 
                value={scale} 
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Botões do Modal */}
            <div className="flex gap-4 w-full mt-8">
              <button 
                type="button"
                onClick={() => setIsCropping(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all uppercase text-sm"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveCrop}
                className="flex-1 py-3 px-4 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition-all shadow-md uppercase text-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* -------------------------------------------------------- */}

      <header className="bg-white shadow-md px-8 py-4 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-[var(--color-brand-medium)]">EasyCovers</h1>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="text-gray-500 font-bold hover:text-gray-800 transition-colors"
        >
          {isNewUser ? "Pular por enquanto ➔" : "Voltar ao Dashboard"}
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-6">
        <section className="bg-white p-10 rounded-xl shadow-lg border-t-4 border-[var(--color-brand-medium)]">
          
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black text-gray-800 uppercase leading-none mb-2">
              {isNewUser ? "Bem-vindo!" : "Meu Perfil"}
            </h2>
            <p className="text-gray-500 font-medium">
              {isNewUser ? "Para começar, configure sua identidade musical" : "Personalize sua identidade musical no EasyCovers"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <img 
                src={previewUrl} 
                alt="Preview do Perfil" 
                className="w-32 h-32 rounded-full object-cover border-4 border-[var(--color-brand-medium)] shadow-md mb-4" 
              />
              <label 
                htmlFor="file-upload" 
                className="cursor-pointer bg-white border-2 border-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-100 transition-all shadow-sm"
              >
                Escolher Nova Foto
              </label>
              <input 
                id="file-upload" 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                className="hidden" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Nome de Usuário</label>
                <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="@seu.apelido" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"/>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Nome Completo</label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="Seu nome real" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"/>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Sobre mim (Bio)</label>
              <textarea name="bio" value={formData.bio} onChange={handleChange} placeholder="Conte um pouco sobre sua jornada musical..." rows="4" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all resize-none"/>
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Instrumento Principal</label>
                <select name="instrument" value={formData.instrument} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all cursor-pointer">
                  <option value="">Selecione...</option>
                  <option value="Vocal">Vocal</option>
                  <option value="Guitarra">Guitarra</option>
                  <option value="Violão">Violão</option>
                  <option value="Baixo">Baixo</option>
                  <option value="Bateria">Bateria</option>
                  <option value="Teclado/Piano">Teclado / Piano</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Gêneros Favoritos</label>
                <input type="text" name="favorite_genres" value={formData.favorite_genres} onChange={handleChange} placeholder="Ex: Rock, Pop, Jazz..." className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"/>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Artistas Favoritos</label>
              <input type="text" name="favorite_artists" value={formData.favorite_artists} onChange={handleChange} placeholder="Ex: Charlie Brown Jr, Beatles, Anitta..." className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-medium)] focus:bg-white transition-all"/>
            </div>

            <button type="submit" className="w-full mt-6 bg-gray-800 hover:bg-black text-white text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-md transform active:scale-95 uppercase tracking-widest">
              Salvar Alterações
            </button>
          </form>

        </section>
      </main>
    </div>
  );
};

export default Profile;