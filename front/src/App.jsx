import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importando nossas páginas modularizadas!
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Mixer from './pages/Mixer';

// Importando as novas páginas de Perfil
import ViewProfile from './pages/ViewProfile';
import EditProfile from './pages/EditProfile';

const App = () => {
  // 1. Tenta recuperar o usuário do "computador" (localStorage) ao abrir o site com proteção contra JSON inválido
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      return parsed && parsed.id ? parsed : null;
    } catch (err) {
      console.warn("Dados de sessão inválidos no localStorage, limpando:", err);
      localStorage.removeItem('user');
      return null;
    }
  });
  
  const [songs, setSongs] = useState([]);

  // 2. Sempre que o 'user' mudar (login ou refresh), garante persistência e busca as músicas no servidor
  useEffect(() => {
    if (user && user.id) {
      // Salva o usuário no computador para persistir o login
      localStorage.setItem('user', JSON.stringify(user));
      
      // Busca as músicas reais do banco de dados
      fetch(`http://localhost:8000/songs/${user.id}`)
        .then(res => (res.ok ? res.json() : []))
        .then(data => {
          setSongs(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error("Erro ao carregar biblioteca:", err));
    }
  }, [user]);

  const handleLogin = (userData) => {
    if (!userData || !userData.id) return;
    // Grava sincronamente no localStorage ANTES da navegação para evitar race condition
    // com os useEffects das páginas filhas (EditProfile / ViewProfile) no React 19
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };
  
  const handleLogout = () => {
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      // Ignora caso o SDK do Google não esteja carregado
    }
    localStorage.removeItem('user');
    setUser(null);
    setSongs([]);
  };

  const handleUpdateUser = (updatedData) => {
    setUser(prev => {
      const merged = { ...(prev || {}), ...updatedData };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };

  const handleAddSong = (newSong) => {
    // Adiciona a música nova na lista sem precisar recarregar
    setSongs(prev => [...prev, newSong]);
  };

  const handleDeleteSong = async (id) => {
    // Confirmação por segurança para o usuário não apagar sem querer
    const confirmacao = window.confirm("Tem certeza que deseja excluir esta música e seus arquivos?");
    if (!confirmacao) return;

    try {
      // 1. Avisa o Python para deletar tudo
      const response = await fetch(`http://localhost:8000/songs/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 2. Se o Python confirmou que deletou, removemos da tela do React
        setSongs(prevSongs => prevSongs.filter(s => s.id !== id));
      } else {
        const errorData = await response.json();
        alert(`Erro ao excluir: ${errorData.detail}`);
      }
    } catch (error) {
      console.error("Erro na requisição de exclusão:", error);
      alert("Erro ao conectar com o servidor para excluir.");
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          user ? (
            <Navigate
              to={user.is_profile_completed === false ? "/edit-profile" : "/dashboard"}
              state={user.is_profile_completed === false ? { isNewUser: true } : undefined}
              replace
            />
          ) : (
            <Login onLogin={handleLogin} />
          )
        } />
        
        <Route path="/dashboard" element={
          user ? <Dashboard email={user.username || user.email} user={user} songs={songs} onDeleteSong={handleDeleteSong} onLogout={handleLogout} /> 
          : <Navigate to="/" />
        } />
        
        <Route path="/upload" element={
          user ? <Upload onAddSong={handleAddSong} user={user} /> 
          : <Navigate to="/" />
        } />
        
        <Route path="/mixer" element={
          user ? <Mixer /> 
          : <Navigate to="/" />
        } />

        {/* --- ROTAS DE PERFIL --- */}
        <Route path="/profile" element={
          user ? <ViewProfile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />  
          : <Navigate to="/" />
        } />

        <Route path="/edit-profile" element={
          user ? <EditProfile user={user} onUpdateUser={handleUpdateUser} />  
          : <Navigate to="/" />
        } />
        {/* ----------------------- */}

      </Routes>
    </Router>
  );
};

export default App;