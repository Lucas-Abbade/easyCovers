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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white">
        <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm9.75 0a.75.75 0 01.75-.75H18a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H16.5a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
      </svg>
    ) : (
      /* Ícone de Play da folha de UI com traço branco limpo */
      <img 
        src="/assets/icons/icon_play_white.png" 
        alt="Play" 
        className="w-12 h-12 object-contain pl-1"
      />
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