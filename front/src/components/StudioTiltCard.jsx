import React, { useRef, useCallback, useEffect } from 'react';
import { useReducedMotion } from '../utils/motionTokens';

/**
 * Cartão com Física de Inclinação 3D (Perspective Tilt) e Reflexo Especular (Rim-Light Glare).
 * Opera a 60-120fps diretamente na GPU via CSS Variables sem re-renderizar a árvore React.
 */
const StudioTiltCard = ({
  children,
  className = '',
  maxTilt = 4.2,
  hoverScale = 1.01,
  onHoverStart,
  onHoverEnd,
  style,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef(null);
  const rafRef = useRef(null);

  const resetTilt = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--tilt-rx', '0deg');
    el.style.setProperty('--tilt-ry', '0deg');
    el.style.setProperty('--tilt-scale', '1');
    el.style.setProperty('--glare-opacity', '0');
  }, []);

  const handlePointerEnter = useCallback(() => {
    onHoverStart?.();
  }, [onHoverStart]);

  const handlePointerMove = useCallback(
    (e) => {
      if (prefersReducedMotion || !cardRef.current) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = cardRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        // Coordenadas normalizadas [0..1] e centralizadas [-0.5..+0.5]
        const normX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const normY = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
        const centerX = normX - 0.5;
        const centerY = normY - 0.5;

        // Rotação 3D natural (inclina em direção ao cursor)
        const rotateX = (-centerY * maxTilt * 2).toFixed(2);
        const rotateY = (centerX * maxTilt * 2).toFixed(2);

        el.style.setProperty('--tilt-rx', `${rotateX}deg`);
        el.style.setProperty('--tilt-ry', `${rotateY}deg`);
        el.style.setProperty('--tilt-scale', String(hoverScale));
        el.style.setProperty('--glare-x', `${(normX * 100).toFixed(1)}%`);
        el.style.setProperty('--glare-y', `${(normY * 100).toFixed(1)}%`);
        el.style.setProperty('--glare-opacity', '1');
      });
    },
    [prefersReducedMotion, maxTilt, hoverScale]
  );

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    resetTilt();
    onHoverEnd?.();
  }, [resetTilt, onHoverEnd]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onFocus={handlePointerEnter}
      onBlur={handlePointerLeave}
      className={`studio-tilt-card ${className}`}
    >
      {/* Camada de Reflexo Especular de Estúdio (Rim-Light Glare) */}
      <div
        className="studio-tilt-glare pointer-events-none absolute inset-0 rounded-[inherit] z-20"
        aria-hidden="true"
      />
      {children}
    </div>
  );
};

export default StudioTiltCard;

