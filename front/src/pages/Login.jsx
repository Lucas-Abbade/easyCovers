import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

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
    <div className="font-sans bg-[var(--color-brand-light)] min-h-screen flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md text-center border-t-4 border-[var(--color-brand-medium)]">
        <header className="mb-8">
          <h1 className="text-5xl font-extrabold text-[var(--color-brand-medium)]">EasyCovers</h1>
          <p className="text-[var(--color-brand-deep)] mt-2 text-lg">
            {isRegistering ? "Crie sua conta" : "Acesse suas backing tracks"}
          </p>
        </header>
        
        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          {/* Campo de Nome de Usuário (Só aparece no cadastro) */}
          {isRegistering && (
            <input 
              type="text" 
              placeholder="Nome de Usuário" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none" 
            />
          )}

          <input 
            type="email" 
            placeholder="Seu E-mail" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none" 
            required 
          />
          
          <input 
            type="password" 
            placeholder="Sua Senha" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none" 
            required 
          />

          {/* Campo de Confirmar Senha (Só aparece no cadastro) */}
          {isRegistering && (
            <input 
              type="password" 
              placeholder="Confirme sua Senha" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[var(--color-brand-medium)] outline-none" 
            />
          )}

          <button type="submit" className="bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white p-4 rounded-lg text-xl font-bold mt-2 transition">
            {isRegistering ? "Cadastrar" : "Entrar"}
          </button>
        </form>
        
        <button onClick={toggleMode} className="mt-6 text-[var(--color-brand-medium)] hover:underline font-bold">
          {isRegistering ? "Já tem uma conta? Faça login" : "Não tem conta? Cadastre-se"}
        </button>
      </div>
    </div>
  );
};

export default Login;