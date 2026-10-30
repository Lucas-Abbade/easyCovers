import React, { useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from '../utils/motionTokens';

/**
 * Divisória de seção em formato de Corda Musical Interativa (Elastic String SVG).
 * - Quando o cursor passa ou puxa a linha, ela enverga usando uma curva de Bézier quadrática.
 * - Ao soltar, vibra fisicamente com oscilação harmônica amortecida (damped spring) a 60fps
 *   manipulando diretamente o atributo `d` do SVG sem re-renderizar a árvore React.
 */
const ElasticGuitarString = ({
  stringName = 'E2',
  frequency = '82.4 Hz',
  gauge = '.046w',
  accentColor = 'var(--color-brand-medium)',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const svgRef = useRef(null);
  const mainPathRef = useRef(null);
  const harmonicPathRef = useRef(null);
  const rafRef = useRef(null);

  // Estado físico mutável em ref para performance de 60-120fps sem re-render
  const physicsRef = useRef({
    isDragging: false,
    controlX: 500,
    displacementY: 0,
  });

  const setStringGeometry = useCallback((cx, dy) => {
    const restY = 28;
    const clampedCx = Math.min(920, Math.max(80, cx));
    const cy = restY + dy;
    const dMain = `M 0 ${restY} Q ${clampedCx.toFixed(1)} ${cy.toFixed(1)} 1000 ${restY}`;

    if (mainPathRef.current) {
      mainPathRef.current.setAttribute('d', dMain);
    }
    if (harmonicPathRef.current) {
      const cyHarmonic = restY - dy * 0.45;
      const dHarmonic = `M 0 ${restY} Q ${clampedCx.toFixed(1)} ${cyHarmonic.toFixed(1)} 1000 ${restY}`;
      harmonicPathRef.current.setAttribute('d', dHarmonic);
      harmonicPathRef.current.style.opacity = Math.min(
        0.55,
        Math.abs(dy) / 26
      ).toFixed(2);
    }
  }, []);

  const triggerPluckRelease = useCallback(
    (initialAmplitude, initialCx) => {
      if (prefersReducedMotion) {
        setStringGeometry(500, 0);
        return;
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      const startAmplitude =
        Math.abs(initialAmplitude) < 4 ? 14 : initialAmplitude;
      const targetCx = initialCx || 500;
      const startTime = performance.now();
      const damping = 5.2; // Taxa de decaimento exponencial
      const angularFreq = 38.0; // Frequência de vibração da corda

      const animateSpring = (now) => {
        const elapsedSec = (now - startTime) / 1000;
        const envelope = Math.exp(-damping * elapsedSec);
        const currentDy =
          startAmplitude * envelope * Math.cos(angularFreq * elapsedSec);
        // Retorna gradualmente o ponto X para o centro (500)
        const currentCx = targetCx + (500 - targetCx) * (1 - envelope);

        if (Math.abs(currentDy) > 0.25 && elapsedSec < 1.4) {
          physicsRef.current.displacementY = currentDy;
          physicsRef.current.controlX = currentCx;
          setStringGeometry(currentCx, currentDy);
          rafRef.current = requestAnimationFrame(animateSpring);
        } else {
          physicsRef.current.displacementY = 0;
          physicsRef.current.controlX = 500;
          setStringGeometry(500, 0);
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(animateSpring);
    },
    [prefersReducedMotion, setStringGeometry]
  );

  const handlePointerMove = (e) => {
    if (prefersReducedMotion || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const relX = ((e.clientX - rect.left) / rect.width) * 1000;
    const centerPx = rect.top + rect.height / 2;
    const rawDy = e.clientY - centerPx;

    // Se o usuário esticar além do limite máximo (24px), a corda "escapa" da palheta e vibra!
    if (Math.abs(rawDy) > 24) {
      if (physicsRef.current.isDragging) {
        physicsRef.current.isDragging = false;
        triggerPluckRelease(
          Math.sign(rawDy) * 24,
          physicsRef.current.controlX
        );
      }
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    physicsRef.current.isDragging = true;
    physicsRef.current.controlX = relX;
    // Garante deflexão mínima quando o ponteiro cruza rapidamente a linha
    const effectiveDy =
      Math.abs(rawDy) < 3 ? (rawDy >= 0 ? 10 : -10) : rawDy * 1.15;
    physicsRef.current.displacementY = effectiveDy;
    setStringGeometry(relX, effectiveDy);
  };

  const handlePointerLeave = () => {
    if (prefersReducedMotion) return;
    if (physicsRef.current.isDragging || Math.abs(physicsRef.current.displacementY) > 0.5) {
      physicsRef.current.isDragging = false;
      triggerPluckRelease(
        physicsRef.current.displacementY || 14,
        physicsRef.current.controlX
      );
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 select-none"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        {/* Tarraxa / Identificador de Afinação Esquerdo */}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
          <span className="w-2 h-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
          <span className="font-black text-slate-500 dark:text-slate-400">
            {stringName}
          </span>
          <span>• {frequency}</span>
        </div>

        {/* Corda Vetorial Elástica */}
        <div className="relative flex-1 h-11 flex items-center">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 56"
            preserveAspectRatio="none"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            style={{ touchAction: 'pan-y' }}
            className="w-full h-11 cursor-ns-resize overflow-visible"
          >
            {/* Sombra Harmônica Secundária (Visível durante a vibração) */}
            <path
              ref={harmonicPathRef}
              d="M 0 28 Q 500 28 1000 28"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.2"
              strokeDasharray="4 4"
              style={{ opacity: 0 }}
            />
            {/* Corda Principal Tensionada */}
            <path
              ref={mainPathRef}
              d="M 0 28 Q 500 28 1000 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-slate-300/90 dark:text-slate-700/90 hover:text-[var(--color-brand-medium)] dark:hover:text-blue-400 transition-colors duration-200"
            />
          </svg>
        </div>

        {/* Cavalete / Calibre da Corda Direito */}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
          <span>{gauge}</span>
          <span className="w-2 h-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
        </div>
      </div>
    </div>
  );
};

export default ElasticGuitarString;

