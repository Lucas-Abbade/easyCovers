import { useState, useEffect, useRef } from 'react';

/**
 * Tokens de movimento e física baseados na skill `motion-foundations`.
 * Centraliza durações, curvas de easing, distâncias e escalas para evitar números mágicos.
 */
export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
    slow: 0.6,
    crawl: 1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp: [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    linear: [0, 0, 1, 1],
    smoothCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
    bounceCss: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
  },
  scale: {
    subtle: 0.98,
    press: 0.96,
    pop: 1.03,
  },
};

export const springs = {
  snappy: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
  instant: { type: 'spring', stiffness: 600, damping: 35 },
  release: { type: 'spring', stiffness: 200, damping: 20, restDelta: 0.001 },
};

export const motionConfig = {
  isLowEnd() {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency <= 4
    );
  },

  prefersReduced() {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  },

  shouldAnimate({ essential = false } = {}) {
    if (this.prefersReduced()) return false;
    if (!essential && this.isLowEnd()) return false;
    return true;
  },

  duration() {
    return this.isLowEnd() || this.prefersReduced()
      ? motionTokens.duration.instant
      : motionTokens.duration.normal;
  },
};

/**
 * Hook acessível que respeita a configuração `prefers-reduced-motion: reduce` do sistema operacional.
 */
export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() =>
    motionConfig.prefersReduced()
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
}

/**
 * Hook que monitora `document.visibilityState` para pausar animações contínuas
 * quando a aba está em segundo plano (Regra 2 e Regra 7 de `motion-advanced`).
 */
export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}

/**
 * Hook de Scroll-Reveal que dispara apenas uma vez (`once: true` — Regra 7 de `motion-patterns`).
 */
export function useInViewOnce(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (inView) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return [ref, inView];
}

/**
 * Hook de contador numérico animado com interpolação suave e suporte a `prefers-reduced-motion`.
 */
export function useAnimatedCounter(targetValue, active = true) {
  const prefersReduced = useReducedMotion();
  const numericTarget = Number(targetValue) || 0;
  const [animatedValue, setAnimatedValue] = useState(numericTarget);

  useEffect(() => {
    if (!active || prefersReduced || numericTarget <= 0) {
      return undefined;
    }

    let rafId = null;
    const durationMs = motionTokens.duration.crawl * 1000;
    const startTime = performance.now();
    const startValue = Math.max(0, Math.floor(numericTarget * 0.65));

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(
        startValue + (numericTarget - startValue) * eased
      );
      setAnimatedValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [numericTarget, active, prefersReduced]);

  if (!active || prefersReduced || numericTarget <= 0) {
    return numericTarget;
  }

  return animatedValue;
}

