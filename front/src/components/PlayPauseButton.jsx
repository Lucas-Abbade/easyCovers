import React from "react";

const PlayPauseButton = ({ isPlaying, isLoaded, togglePlay, size = "large" }) => {
  const isLarge = size === "large";
  const sizeClasses = isLarge ? "w-20 h-20 md:w-22 md:h-22" : "w-14 h-14";

  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={!isLoaded}
      aria-label={!isLoaded ? "Carregando áudio..." : isPlaying ? "Pausar reprodução (Espaço)" : "Iniciar reprodução (Espaço)"}
      title={!isLoaded ? "Carregando faixas de áudio..." : isPlaying ? "Pausar (Espaço)" : "Tocar (Espaço)"}
      className={`relative flex items-center justify-center rounded-full transition-all duration-300 transform active:scale-95 cursor-pointer disabled:cursor-wait disabled:opacity-75 focus:outline-none focus:ring-4 focus:ring-blue-300 ${sizeClasses} ${
        !isLoaded
          ? "bg-slate-300 text-slate-500 shadow-md"
          : isPlaying
          ? "bg-gradient-to-br from-red-500 via-red-600 to-rose-700 text-white shadow-[0_0_30px_rgba(225,29,72,0.5)] hover:shadow-[0_0_35px_rgba(225,29,72,0.7)] hover:scale-105"
          : "bg-gradient-to-br from-[var(--color-brand-medium)] via-blue-600 to-[var(--color-brand-dark)] text-white shadow-[0_0_30px_rgba(43,105,230,0.5)] hover:shadow-[0_0_35px_rgba(43,105,230,0.75)] hover:scale-105"
      }`}
    >
      {/* Outer subtle glow ring when playing */}
      {isPlaying && (
        <span className="absolute inset-0 rounded-full bg-red-400 opacity-30 animate-ping pointer-events-none"></span>
      )}

      {!isLoaded ? (
        <div className="flex flex-col items-center justify-center">
          <svg className="w-8 h-8 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        </div>
      ) : isPlaying ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-9 h-9 md:w-10 md:h-10 text-white drop-shadow-md"
        >
          <path
            fillRule="evenodd"
            d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm9.75 0a.75.75 0 01.75-.75H18a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H16.5a.75.75 0 01-.75-.75V5.25z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-10 h-10 md:w-11 md:h-11 text-white pl-1 drop-shadow-md"
        >
          <path
            fillRule="evenodd"
            d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
};

export default PlayPauseButton;