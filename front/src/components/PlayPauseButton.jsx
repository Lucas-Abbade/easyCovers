import React from "react";

const PlayPauseButton = ({ isPlaying, isLoaded, togglePlay }) => {
  // Classes base que mantêm o formato, transição suave e animação de escala ao passar o mouse
  const baseClasses = "flex items-center justify-center rounded-full transition-all duration-300 transform hover:scale-105";
  
  // Classes específicas do estilo Glowing (Brilhante/Pulsante)
  // Nota: Usei valores de sombra personalizados para dar o efeito de "luz" ao redor do botão
  const glowingClasses = isPlaying
    ? "w-20 h-20 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_25px_rgba(220,38,38,0.6)] animate-pulse"
    : "w-20 h-20 bg-[var(--color-brand-medium)] hover:bg-[var(--color-brand-dark)] text-white shadow-[0_0_25px_var(--color-brand-medium)]";

  // Renderiza o ícone apropriado (Ampulheta, Play ou Pause)
  const renderIcon = () => {
    if (!isLoaded) return <span className="text-xl animate-spin">⏳</span>;

    return isPlaying ? (
      /* Ícone de Pause */
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
        <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm9.75 0a.75.75 0 01.75-.75H18a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H16.5a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
      </svg>
    ) : (
      /* Ícone de Play (com um leve padding à esquerda 'pl-1' para o triângulo ficar centralizado visualmente) */
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white pl-1">
        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <button 
      onClick={togglePlay} 
      disabled={!isLoaded} 
      className={`${baseClasses} ${glowingClasses}`}
      title={isPlaying ? "Pausar" : "Tocar"}
    >
      {renderIcon()}
    </button>
  );
};

export default PlayPauseButton;