import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importando nossas páginas modularizadas!
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Mixer from './pages/Mixer';

const App = () => {
  // 1. Tenta recuperar o usuário do "computador" (localStorage) ao abrir o site
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [songs, setSongs] = useState([]);

  // 2. Sempre que o 'user' mudar (login ou refresh), busca as músicas no servidor
  useEffect(() => {
    if (user) {
      // Salva o usuário no computador para persistir o login
      localStorage.setItem('user', JSON.stringify(user));
      
      // Busca as músicas reais do banco de dados
      fetch(`http://localhost:8000/songs/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setSongs(data);
        })
        .catch(err => console.error("Erro ao carregar biblioteca:", err));
    } else {
      localStorage.removeItem('user');
      setSongs([]);
    }
  }, [user]);

  const handleLogin = (userData) => setUser(userData);
  
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
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
        setSongs(songs.filter(s => s.id !== id));
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
        <Route path="/" element={<Login onLogin={handleLogin} />} />
        
        <Route path="/dashboard" element={
          user ? <Dashboard email={user.username || user.email} songs={songs} onDeleteSong={handleDeleteSong} onLogout={handleLogout} /> 
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
      </Routes>
    </Router>
  );
};

export default App;