import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const GOOGLE_CLIENT_ID = '306538057431-96v86vvcrqvi556j85o2gad7mr5irf45.apps.googleusercontent.com';

  // Callback when Google returns an ID token
  const handleGoogleResponse = async (response) => {
    const id_token = response?.credential;
    if (!id_token) return;

    try {
      const res = await fetch('http://localhost:8000/auth/google/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token })
      });

      const data = await res.json();
      if (res.ok) {
        onLogin({ id: data.id, email: data.email, username: data.username });
        navigate('/dashboard');
      } else {
        alert(`Erro: ${data.detail || 'falha no login com Google'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com o servidor para login com Google.');
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse
        });

        const el = document.getElementById('googleSignInDiv');
        if (el) {
          // render a compact button that matches our width
          window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: '100%' });
        }
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();

    // LÓGICA DE VALIDAÇÃO PARA CADASTRO
    if (isRegistering) {
      if (!username || !email || !password || !confirmPassword) {
        return alert("Preencha todos os campos!");
      }
      if (password !== confirmPassword) {
        return alert("As senhas não coincidem!");
      }
      
      // Regras da senha: Min 8 chars, 1 maiúscula, 1 número
      const hasUpperCase = /[A-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (password.length < 8 || !hasUpperCase || !hasNumber) {
        return alert("Sua senha deve ter no mínimo 8 caracteres, contendo pelo menos uma letra maiúscula e um número.");
      }
    } else {
      // LÓGICA PARA LOGIN SIMPLES
      if (!email || !password) return alert("Preencha email e senha!");
    }

    const endpoint = isRegistering ? "register" : "login";
    
    // Se for cadastro, manda o username. Se for login, manda só email e senha.
    const payload = isRegistering 
      ? { username, email, password } 
      : { email, password };

    try {
      const response = await fetch(`http://localhost:8000/${endpoint}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Envia o usuário completo para o App (agora com username!)
        onLogin({ id: data.id, email: data.email, username: data.username });
        
        // Limpa os campos por precaução
        setUsername(''); setPassword(''); setConfirmPassword('');
        
        // Redireciona sempre para o Dashboard após cadastro ou login
        navigate('/dashboard');
        
      } else {
        alert(`Erro: ${data.detail}`);
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // Função para limpar os campos quando o usuário troca entre Login e Cadastro
  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="font-sans min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/assets/login_hero_bg.jpg')" }}>
      {/* Overlay sutil para garantir contraste e leitura impecável */}
      <div className="absolute inset-0 bg-[#0E1F4C]/40 backdrop-blur-[1px] pointer-events-none"></div>

      <div className="bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col gap-4 items-stretch border-t-4 border-[var(--color-brand-medium)] relative z-10">
        <header className="text-center">
          <img 
            src="/assets/logo_symbol.png" 
            alt="EasyCovers Logo" 
            className="mx-auto w-20 h-20 object-contain drop-shadow-sm mb-2"
          />
          <h1 className="text-3xl font-extrabold text-[#0D204B]">EasyCovers</h1>
          <p className="text-[var(--color-brand-deep)] mt-1 text-sm font-medium">Crie e mixe suas backing tracks</p>
        </header>

        <form onSubmit={handleAuth} className="flex flex-col gap-3">
          {isRegistering && (
            <input
              type="text"
              placeholder="Nome de Usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="p-3 border border-gray-200 rounded-md text-base focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none"
            />
          )}

          <input
            type="email"
            placeholder="Insira seu E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 border border-gray-200 rounded-md text-base focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none"
            required
          />

          <input
            type="password"
            placeholder="Insira sua Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 border border-gray-200 rounded-md text-base focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none"
            required
          />

          {isRegistering && (
            <input
              type="password"
              placeholder="Confirme sua Senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="p-3 border border-gray-200 rounded-md text-base focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none"
            />
          )}

          <button type="submit" className="bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white p-3 rounded-lg text-lg font-bold transition">
            {isRegistering ? "Cadastrar" : "Entrar"}
          </button>
        </form>

        <div className="text-center mt-1">
          <button onClick={toggleMode} className="text-[var(--color-brand-medium)] hover:underline font-medium">
            {isRegistering ? "Já tem uma conta? Faça login" : "Não tem conta? Cadastre-se"}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
            {/* Google Sign-in button rendered by Google's SDK */}
            <div id="googleSignInDiv" className="w-full"></div>

        </div>

        <footer className="mt-4 text-center text-xs text-gray-400">
          Ao continuar, você aceita os termos e políticas de uso.
        </footer>
      </div>
    </div>
  );
};

export default Login;