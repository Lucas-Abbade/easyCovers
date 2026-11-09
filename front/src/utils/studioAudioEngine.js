import * as Tone from 'tone';

export const STEM_KEYS = ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'];

const RING_BUFFER_SIZE = 16384;
const RING_BUFFER_MASK = RING_BUFFER_SIZE - 1;
const GRAIN_SIZE = 1536; // ~34.8ms a 44.1kHz (abaixo do limiar de eco de Haas no hop de 17.4ms)
const HOP_SIZE = GRAIN_SIZE >> 1; // 768 amostras (~17.4ms)
const SEARCH_RADIUS = 256; // +-256 amostras (~11.6ms de janela de busca de período fundamental)
const CORR_LENGTH = 256; // ~5.8ms (cobre períodos fundamentais graves/vocais com passo 4)
const BYPASS_SAFE_DELAY = 1920; // Margem estrita anti-overtake para transições imediatas até 0.5x
const MODE_CROSSFADE_SAMPLES = 64; // ~1.45ms de ponte suave ao entrar/sair do bypass 1.0x

// Janela de Hann complementar: w[k] + w[k + HOP_SIZE] === 1.0 para todo k
const HANN_WINDOW = new Float32Array(GRAIN_SIZE);
for (let i = 0; i < GRAIN_SIZE; i++) {
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / GRAIN_SIZE));
}

/**
 * Converte a porcentagem do fader de um stem (0..100, onde 80% = 0.0 dB Nominal / ganho unitário 1.0)
 * para ganho linear. Preserva 100% da faixa dinâmica original em 80%.
 */
export function computeStemGainLinear(volumePercent, isEffectivelyMuted = false) {
  if (isEffectivelyMuted) return 0;
  const clamped = Math.max(0, Math.min(100, Number(volumePercent) || 0));
  if (clamped <= 0) return 0;
  return clamped / 80;
}

/**
 * Converte a porcentagem do fader de um stem (0..100, onde 80% = 0.0 dB) em decibéis.
 */
export function computeStemGainDb(volumePercent, isEffectivelyMuted = false) {
  const linear = computeStemGainLinear(volumePercent, isEffectivelyMuted);
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Calcula a razão de pitch efetiva necessária no processador WSOLA dado
 * o playbackSpeed (0.5x..1.25x) e a transposição currentPitch (-12..+12 semitons).
 * Como o AudioBufferSourceNode altera a velocidade e o tom juntos por playbackSpeed,
 * o processador WSOLA compensa aplicando (2^(currentPitch / 12)) / playbackSpeed.
 */
export function computeEffectivePitchRatio(playbackSpeed = 1.0, currentPitchSemitones = 0) {
  const safeSpeed = Math.max(0.25, Math.min(2.0, Number(playbackSpeed) || 1.0));
  const safePitch = Math.max(-24, Math.min(24, Number(currentPitchSemitones) || 0));
  const targetPitchFactor = Math.pow(2, safePitch / 12);
  return targetPitchFactor / safeSpeed;
}

/**
 * Interpolação cúbica Hermite de 4 pontos em buffer circular para preservação
 * cristalina de altas frequências sem aliasing linear.
 */
export function readCubicHermiteCircular(buffer, readPos) {
  const ipos = Math.floor(readPos);
  const frac = readPos - ipos;
  const i0 = (ipos - 1) & RING_BUFFER_MASK;
  const i1 = ipos & RING_BUFFER_MASK;
  const i2 = (ipos + 1) & RING_BUFFER_MASK;
  const i3 = (ipos + 2) & RING_BUFFER_MASK;

  const y0 = buffer[i0];
  const y1 = buffer[i1];
  const y2 = buffer[i2];
  const y3 = buffer[i3];

  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

  return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

/**
 * Cria o estado interno do processador WSOLA (Waveform Similarity Overlap-Add) estéreo.
 */
export function createWsolaPitchState() {
  const initialDelay = BYPASS_SAFE_DELAY;
  return {
    bufL: new Float32Array(RING_BUFFER_SIZE),
    bufR: new Float32Array(RING_BUFFER_SIZE),
    writePtr: initialDelay,
    phase0: 0,
    readPos0: 0,
    readPos1: 0,
    wasBypass: true,
    crossfadeRemaining: 0,
    refSamples: new Float32Array(CORR_LENGTH >> 2),
  };
}

/**
 * Busca por correlação cruzada normalizada o melhor deslocamento de fase (em amostras)
 * para alinhar o novo grão com o grão ativo sem causar duplicação de transientes,
 * auto-seleção estagnada (lag 0) ou ultrapassagem do ponteiro de escrita (writePtr).
 */
function findBestWsolaAlignedPosition(state, activeReadPos, pitchRatio) {
  const { bufL, bufR, writePtr } = state;

  // Mantém centerDelay constante em toda a faixa varispeed normal (pitchRatio <= 2.0)
  // e expande automaticamente para transposições extremas (pitchRatio > 2.0).
  const effectiveRatioForMargin = Math.max(pitchRatio, 2.0);
  const extraConsumed = Math.ceil((effectiveRatioForMargin - 1.0) * GRAIN_SIZE);
  const minSafeDelay = extraConsumed + 64;
  const centerDelay = minSafeDelay + SEARCH_RADIUS + 64;

  const activeDelay = (writePtr - Math.floor(activeReadPos) + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
  const avoidSelfLag =
    (pitchRatio > 1.0 && activeDelay < centerDelay - 24) ||
    (pitchRatio < 1.0 && activeDelay > centerDelay + 24);

  const refSamples = state.refSamples || new Float32Array(CORR_LENGTH >> 2);
  let refEnergy = 0;
  for (let k = 0, idx = 0; k < CORR_LENGTH; k += 4, idx++) {
    const rIdx = Math.floor(activeReadPos + k * pitchRatio) & RING_BUFFER_MASK;
    const mono = 0.5 * (bufL[rIdx] + bufR[rIdx]);
    refSamples[idx] = mono;
    refEnergy += mono * mono;
  }

  if (refEnergy < 1e-8) {
    return (writePtr - centerDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
  }

  let bestOffset = 0;
  let bestScore = -Infinity;

  // Passo 1: Busca em malha de 4 amostras sobre [-SEARCH_RADIUS, +SEARCH_RADIUS]
  for (let delta = -SEARCH_RADIUS; delta <= SEARCH_RADIUS; delta += 4) {
    const candidateDelay = centerDelay - delta;
    if (candidateDelay < minSafeDelay) continue;
    if (avoidSelfLag && Math.abs(candidateDelay - activeDelay) < 24) continue;

    const candidateStart = (writePtr - candidateDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
    let cross = 0;
    let candEnergy = 0;

    for (let k = 0, idx = 0; k < CORR_LENGTH; k += 4, idx++) {
      const cIdx = Math.floor(candidateStart + k * pitchRatio) & RING_BUFFER_MASK;
      const mono = 0.5 * (bufL[cIdx] + bufR[cIdx]);
      cross += refSamples[idx] * mono;
      candEnergy += mono * mono;
    }

    const normCorr = cross / Math.sqrt(refEnergy * candEnergy + 1e-10);
    const centerBias = 1.0 - 0.015 * (Math.abs(delta) / SEARCH_RADIUS);
    const score = normCorr * centerBias;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = delta;
    }
  }

  // Passo 2: Refinamento fino de 1 amostra ao redor do melhor candidato
  const coarseBest = bestOffset;
  for (let delta = coarseBest - 3; delta <= coarseBest + 3; delta++) {
    if (delta < -SEARCH_RADIUS || delta > SEARCH_RADIUS) continue;
    const candidateDelay = centerDelay - delta;
    if (candidateDelay < minSafeDelay) continue;
    if (avoidSelfLag && Math.abs(candidateDelay - activeDelay) < 24) continue;

    const candidateStart = (writePtr - candidateDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
    let cross = 0;
    let candEnergy = 0;

    for (let k = 0, idx = 0; k < CORR_LENGTH; k += 4, idx++) {
      const cIdx = Math.floor(candidateStart + k * pitchRatio) & RING_BUFFER_MASK;
      const mono = 0.5 * (bufL[cIdx] + bufR[cIdx]);
      cross += refSamples[idx] * mono;
      candEnergy += mono * mono;
    }

    const normCorr = cross / Math.sqrt(refEnergy * candEnergy + 1e-10);
    const centerBias = 1.0 - 0.015 * (Math.abs(delta) / SEARCH_RADIUS);
    const score = normCorr * centerBias;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = delta;
    }
  }

  const finalDelay = Math.max(minSafeDelay, centerDelay - bestOffset);
  return (writePtr - finalDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
}

/**
 * Processa um bloco estéreo com o algoritmo WSOLA (Waveform Similarity Overlap-Add).
 * Quando pitchRatio === 1.0, opera em modo bit-transparente (bypass exato mantendo o ring buffer aquecido
 * na margem segura BYPASS_SAFE_DELAY e aplicando micro-ponte de 64 amostras apenas em transições).
 */
export function processWsolaPitchBlock(state, inputL, inputR, outputL, outputR, pitchRatio = 1.0) {
  const { bufL, bufR } = state;
  const len = inputL.length;
  const isBypass = Math.abs(pitchRatio - 1.0) < 0.0005;

  if (state.wasBypass === undefined) {
    state.wasBypass = true;
    state.crossfadeRemaining = 0;
  }

  if (isBypass !== state.wasBypass) {
    state.wasBypass = isBypass;
    state.crossfadeRemaining = MODE_CROSSFADE_SAMPLES;
    if (!isBypass) {
      state.phase0 = 0;
      const safeAnchor = (state.writePtr - BYPASS_SAFE_DELAY + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
      state.readPos1 = safeAnchor;
      state.readPos0 = findBestWsolaAlignedPosition(state, safeAnchor, pitchRatio);
    }
  }

  for (let i = 0; i < len; i++) {
    const inL = inputL[i];
    const inR = inputR ? inputR[i] : inL;

    bufL[state.writePtr] = inL;
    bufR[state.writePtr] = inR;

    if (isBypass && state.crossfadeRemaining === 0) {
      outputL[i] = inL;
      if (outputR) outputR[i] = inR;

      const syncPos = (state.writePtr - BYPASS_SAFE_DELAY + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
      state.readPos0 = syncPos;
      state.readPos1 = syncPos;
      state.phase0 = 0;
      state.writePtr = (state.writePtr + 1) & RING_BUFFER_MASK;
      continue;
    }

    const phase0 = state.phase0;
    const phase1 = (phase0 + HOP_SIZE) % GRAIN_SIZE;

    // Alinhamento de fase por correlação cruzada WSOLA no início de cada grão
    if (phase0 === 0) {
      state.readPos0 = findBestWsolaAlignedPosition(state, state.readPos1, pitchRatio);
    } else if (phase1 === 0) {
      state.readPos1 = findBestWsolaAlignedPosition(state, state.readPos0, pitchRatio);
    }

    // Guarda estrita anti-overtake caso pitchRatio aumente abruptamente no meio de um grão
    const minReq0 = Math.ceil(Math.max(0, pitchRatio - 1.0) * (GRAIN_SIZE - phase0)) + 16;
    const delay0 = (state.writePtr - Math.floor(state.readPos0) + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
    if (delay0 < minReq0 || delay0 > RING_BUFFER_SIZE - 512) {
      state.readPos0 = findBestWsolaAlignedPosition(state, state.readPos1, pitchRatio);
    }

    const minReq1 = Math.ceil(Math.max(0, pitchRatio - 1.0) * (GRAIN_SIZE - phase1)) + 16;
    const delay1 = (state.writePtr - Math.floor(state.readPos1) + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
    if (delay1 < minReq1 || delay1 > RING_BUFFER_SIZE - 512) {
      state.readPos1 = findBestWsolaAlignedPosition(state, state.readPos0, pitchRatio);
    }

    const w0 = HANN_WINDOW[phase0];
    const w1 = HANN_WINDOW[phase1];

    const s0L = readCubicHermiteCircular(bufL, state.readPos0);
    const s1L = readCubicHermiteCircular(bufL, state.readPos1);
    const wetL = s0L * w0 + s1L * w1;

    let wetR = wetL;
    if (outputR) {
      const s0R = readCubicHermiteCircular(bufR, state.readPos0);
      const s1R = readCubicHermiteCircular(bufR, state.readPos1);
      wetR = s0R * w0 + s1R * w1;
    }

    if (state.crossfadeRemaining > 0) {
      const alpha = 1.0 - state.crossfadeRemaining / MODE_CROSSFADE_SAMPLES;
      state.crossfadeRemaining--;
      if (isBypass) {
        outputL[i] = wetL * (1.0 - alpha) + inL * alpha;
        if (outputR) outputR[i] = wetR * (1.0 - alpha) + inR * alpha;
      } else {
        outputL[i] = inL * (1.0 - alpha) + wetL * alpha;
        if (outputR) outputR[i] = inR * (1.0 - alpha) + wetR * alpha;
      }
    } else {
      outputL[i] = wetL;
      if (outputR) outputR[i] = wetR;
    }

    state.readPos0 += pitchRatio;
    if (state.readPos0 >= RING_BUFFER_SIZE) state.readPos0 -= RING_BUFFER_SIZE;

    state.readPos1 += pitchRatio;
    if (state.readPos1 >= RING_BUFFER_SIZE) state.readPos1 -= RING_BUFFER_SIZE;

    state.phase0 = (phase0 + 1) % GRAIN_SIZE;
    state.writePtr = (state.writePtr + 1) & RING_BUFFER_MASK;
  }
}

/**
 * Relógio de transporte musical de alta precisão que rastreia o tempo real da música
 * escalado por playbackSpeed (0.5x..1.25x), eliminando a dessincronização do Tone.Transport.
 */
export class SongTransportClock {
  constructor(duration = 0, initialOffset = 0, initialSpeed = 1.0) {
    this.duration = Math.max(0, Number(duration) || 0);
    this.offsetSeconds = Math.max(0, Number(initialOffset) || 0);
    this.playbackSpeed = Math.max(0.25, Math.min(2.0, Number(initialSpeed) || 1.0));
    this.startContextTime = 0;
    this.isPlaying = false;
  }

  start(contextTime) {
    if (!this.isPlaying) {
      this.startContextTime = Number(contextTime) || 0;
      this.isPlaying = true;
    }
  }

  pause(contextTime) {
    if (this.isPlaying) {
      this.offsetSeconds = this.getPositionAt(contextTime);
      this.isPlaying = false;
    }
  }

  stop() {
    this.isPlaying = false;
    this.offsetSeconds = 0;
  }

  seek(targetSeconds, contextTime) {
    const maxDur = this.duration > 0 ? this.duration : Infinity;
    this.offsetSeconds = Math.max(0, Math.min(maxDur, Number(targetSeconds) || 0));
    if (this.isPlaying) {
      this.startContextTime = Number(contextTime) || 0;
    }
    return this.offsetSeconds;
  }

  setSpeed(newSpeed, contextTime) {
    const clamped = Math.max(0.25, Math.min(2.0, Number(newSpeed) || 1.0));
    if (this.isPlaying) {
      this.offsetSeconds = this.getPositionAt(contextTime);
      this.startContextTime = Number(contextTime) || 0;
    }
    this.playbackSpeed = clamped;
    return this.offsetSeconds;
  }

  getPositionAt(contextTime) {
    if (!this.isPlaying) {
      return this.offsetSeconds;
    }
    const elapsedWall = Math.max(0, (Number(contextTime) || 0) - this.startContextTime);
    const pos = this.offsetSeconds + elapsedWall * this.playbackSpeed;
    return this.duration > 0 ? Math.min(this.duration, pos) : pos;
  }
}

/**
 * Código do AudioWorkletProcessor WSOLA injetado via Blob URL para execução
 * na thread de áudio dedicada de tempo real (zero bloqueio da UI).
 */
export const WSOLA_WORKLET_CODE = `
const RING_BUFFER_SIZE = 16384;
const RING_BUFFER_MASK = RING_BUFFER_SIZE - 1;
const GRAIN_SIZE = 1536;
const HOP_SIZE = GRAIN_SIZE >> 1;
const SEARCH_RADIUS = 256;
const CORR_LENGTH = 256;
const BYPASS_SAFE_DELAY = 1920;
const MODE_CROSSFADE_SAMPLES = 64;

const HANN_WINDOW = new Float32Array(GRAIN_SIZE);
for (let i = 0; i < GRAIN_SIZE; i++) {
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / GRAIN_SIZE));
}

function readCubic(buffer, readPos) {
  const ipos = Math.floor(readPos);
  const frac = readPos - ipos;
  const y0 = buffer[(ipos - 1) & RING_BUFFER_MASK];
  const y1 = buffer[ipos & RING_BUFFER_MASK];
  const y2 = buffer[(ipos + 1) & RING_BUFFER_MASK];
  const y3 = buffer[(ipos + 2) & RING_BUFFER_MASK];
  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

class StudioWsolaPitchWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'pitchRatio',
        defaultValue: 1.0,
        minValue: 0.25,
        maxValue: 4.0,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.bufL = new Float32Array(RING_BUFFER_SIZE);
    this.bufR = new Float32Array(RING_BUFFER_SIZE);
    this.writePtr = BYPASS_SAFE_DELAY;
    this.phase0 = 0;
    this.readPos0 = 0;
    this.readPos1 = 0;
    this.wasBypass = true;
    this.crossfadeRemaining = 0;
    this.refSamples = new Float32Array(CORR_LENGTH >> 2);
  }

  findAlignedPos(activeReadPos, pitchRatio) {
    const bufL = this.bufL;
    const bufR = this.bufR;
    const writePtr = this.writePtr;
    const effectiveRatioForMargin = Math.max(pitchRatio, 2.0);
    const extraConsumed = Math.ceil((effectiveRatioForMargin - 1.0) * GRAIN_SIZE);
    const minSafeDelay = extraConsumed + 64;
    const centerDelay = minSafeDelay + SEARCH_RADIUS + 64;

    const activeDelay = (writePtr - Math.floor(activeReadPos) + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
    const avoidSelfLag =
      (pitchRatio > 1.0 && activeDelay < centerDelay - 24) ||
      (pitchRatio < 1.0 && activeDelay > centerDelay + 24);

    const refSamples = this.refSamples;
    let refEnergy = 0;
    for (let k = 0, idx = 0; k < CORR_LENGTH; k += 4, idx++) {
      const rIdx = Math.floor(activeReadPos + k * pitchRatio) & RING_BUFFER_MASK;
      const mono = 0.5 * (bufL[rIdx] + bufR[rIdx]);
      refSamples[idx] = mono;
      refEnergy += mono * mono;
    }

    if (refEnergy < 1e-8) {
      return (writePtr - centerDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
    }

    let bestOffset = 0;
    let bestScore = -Infinity;

    for (let delta = -SEARCH_RADIUS; delta <= SEARCH_RADIUS; delta += 4) {
      const candidateDelay = centerDelay - delta;
      if (candidateDelay < minSafeDelay) continue;
      if (avoidSelfLag && Math.abs(candidateDelay - activeDelay) < 24) continue;
      const candidateStart = (writePtr - candidateDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
      let cross = 0;
      let candEnergy = 0;
      for (let k = 0, idx = 0; k < CORR_LENGTH; k += 4, idx++) {
        const cIdx = Math.floor(candidateStart + k * pitchRatio) & RING_BUFFER_MASK;
        const mono = 0.5 * (bufL[cIdx] + bufR[cIdx]);
        cross += refSamples[idx] * mono;
        candEnergy += mono * mono;
      }
      const normCorr = cross / Math.sqrt(refEnergy * candEnergy + 1e-10);
      const centerBias = 1.0 - 0.015 * (Math.abs(delta) / SEARCH_RADIUS);
      const score = normCorr * centerBias;
      if (score > bestScore) {
        bestScore = score;
        bestOffset = delta;
      }
    }

    const coarseBest = bestOffset;
    for (let delta = coarseBest - 3; delta <= coarseBest + 3; delta++) {
      if (delta < -SEARCH_RADIUS || delta > SEARCH_RADIUS) continue;
      const candidateDelay = centerDelay - delta;
      if (candidateDelay < minSafeDelay) continue;
      if (avoidSelfLag && Math.abs(candidateDelay - activeDelay) < 24) continue;
      const candidateStart = (writePtr - candidateDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
      let cross = 0;
      let candEnergy = 0;
      for (let k = 0, idx = 0; k < CORR_LENGTH; k += 4, idx++) {
        const cIdx = Math.floor(candidateStart + k * pitchRatio) & RING_BUFFER_MASK;
        const mono = 0.5 * (bufL[cIdx] + bufR[cIdx]);
        cross += refSamples[idx] * mono;
        candEnergy += mono * mono;
      }
      const normCorr = cross / Math.sqrt(refEnergy * candEnergy + 1e-10);
      const centerBias = 1.0 - 0.015 * (Math.abs(delta) / SEARCH_RADIUS);
      const score = normCorr * centerBias;
      if (score > bestScore) {
        bestScore = score;
        bestOffset = delta;
      }
    }

    const finalDelay = Math.max(minSafeDelay, centerDelay - bestOffset);
    return (writePtr - finalDelay + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;
    const inL = input && input.length > 0 ? input[0] : null;
    const inR = input && input.length > 1 ? input[1] : inL;

    if (!inL) {
      outL.fill(0);
      if (outR) outR.fill(0);
      return true;
    }

    const pitchRatio = parameters.pitchRatio[0] || 1.0;
    const isBypass = Math.abs(pitchRatio - 1.0) < 0.0005;
    const bufL = this.bufL;
    const bufR = this.bufR;
    const len = outL.length;

    if (isBypass !== this.wasBypass) {
      this.wasBypass = isBypass;
      this.crossfadeRemaining = MODE_CROSSFADE_SAMPLES;
      if (!isBypass) {
        this.phase0 = 0;
        const safeAnchor = (this.writePtr - BYPASS_SAFE_DELAY + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
        this.readPos1 = safeAnchor;
        this.readPos0 = this.findAlignedPos(safeAnchor, pitchRatio);
      }
    }

    for (let i = 0; i < len; i++) {
      const sL = inL[i];
      const sR = inR ? inR[i] : sL;

      bufL[this.writePtr] = sL;
      bufR[this.writePtr] = sR;

      if (isBypass && this.crossfadeRemaining === 0) {
        outL[i] = sL;
        if (outR) outR[i] = sR;
        const syncPos = (this.writePtr - BYPASS_SAFE_DELAY + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
        this.readPos0 = syncPos;
        this.readPos1 = syncPos;
        this.phase0 = 0;
        this.writePtr = (this.writePtr + 1) & RING_BUFFER_MASK;
        continue;
      }

      const phase0 = this.phase0;
      const phase1 = (phase0 + HOP_SIZE) % GRAIN_SIZE;

      if (phase0 === 0) {
        this.readPos0 = this.findAlignedPos(this.readPos1, pitchRatio);
      } else if (phase1 === 0) {
        this.readPos1 = this.findAlignedPos(this.readPos0, pitchRatio);
      }

      const minReq0 = Math.ceil(Math.max(0, pitchRatio - 1.0) * (GRAIN_SIZE - phase0)) + 16;
      const delay0 = (this.writePtr - Math.floor(this.readPos0) + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
      if (delay0 < minReq0 || delay0 > RING_BUFFER_SIZE - 512) {
        this.readPos0 = this.findAlignedPos(this.readPos1, pitchRatio);
      }

      const minReq1 = Math.ceil(Math.max(0, pitchRatio - 1.0) * (GRAIN_SIZE - phase1)) + 16;
      const delay1 = (this.writePtr - Math.floor(this.readPos1) + RING_BUFFER_SIZE) & RING_BUFFER_MASK;
      if (delay1 < minReq1 || delay1 > RING_BUFFER_SIZE - 512) {
        this.readPos1 = this.findAlignedPos(this.readPos0, pitchRatio);
      }

      const w0 = HANN_WINDOW[phase0];
      const w1 = HANN_WINDOW[phase1];

      const wetL = readCubic(bufL, this.readPos0) * w0 + readCubic(bufL, this.readPos1) * w1;
      let wetR = wetL;
      if (outR) {
        wetR = readCubic(bufR, this.readPos0) * w0 + readCubic(bufR, this.readPos1) * w1;
      }

      if (this.crossfadeRemaining > 0) {
        const alpha = 1.0 - this.crossfadeRemaining / MODE_CROSSFADE_SAMPLES;
        this.crossfadeRemaining--;
        if (isBypass) {
          outL[i] = wetL * (1.0 - alpha) + sL * alpha;
          if (outR) outR[i] = wetR * (1.0 - alpha) + sR * alpha;
        } else {
          outL[i] = sL * (1.0 - alpha) + wetL * alpha;
          if (outR) outR[i] = sR * (1.0 - alpha) + wetR * alpha;
        }
      } else {
        outL[i] = wetL;
        if (outR) outR[i] = wetR;
      }

      this.readPos0 += pitchRatio;
      if (this.readPos0 >= RING_BUFFER_SIZE) this.readPos0 -= RING_BUFFER_SIZE;

      this.readPos1 += pitchRatio;
      if (this.readPos1 >= RING_BUFFER_SIZE) this.readPos1 -= RING_BUFFER_SIZE;

      this.phase0 = (phase0 + 1) % GRAIN_SIZE;
      this.writePtr = (this.writePtr + 1) & RING_BUFFER_MASK;
    }

    return true;
  }
}

registerProcessor('studio-wsola-pitch-worklet', StudioWsolaPitchWorklet);
`;

const registeredContexts = new WeakSet();
const registrationPromises = new WeakMap();
let sharedNativeAudioContext = null;

/**
 * Obtém ou instancia o AudioContext nativo do navegador (evitando o wrapper incompatível
 * standardized-audio-context do Tone.context.rawContext que falha no construtor nativo AudioWorkletNode
 * e não implementa createScriptProcessor).
 */
function getOrCreateNativeAudioContext() {
  if (sharedNativeAudioContext && sharedNativeAudioContext.state !== 'closed') {
    return sharedNativeAudioContext;
  }
  if (typeof window !== 'undefined') {
    const NativeAudioCtx = window.AudioContext || window.webkitAudioContext;
    if (NativeAudioCtx) {
      sharedNativeAudioContext = new NativeAudioCtx({ latencyHint: 'playback' });
      return sharedNativeAudioContext;
    }
  }
  return Tone.context?.rawContext || (Tone.getContext && Tone.getContext()?.rawContext) || null;
}

export async function ensureWsolaWorkletRegistered(rawContext) {
  if (!rawContext?.audioWorklet) return false;
  if (registeredContexts.has(rawContext)) return true;
  if (registrationPromises.has(rawContext)) {
    return registrationPromises.get(rawContext);
  }

  const promise = (async () => {
    try {
      const blob = new Blob([WSOLA_WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      try {
        await rawContext.audioWorklet.addModule(url);
        registeredContexts.add(rawContext);
        return true;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err && /already registered/i.test(String(err.message || err))) {
        registeredContexts.add(rawContext);
        return true;
      }
      console.warn('Aviso ao registrar AudioWorklet WSOLA, usando fallback:', err);
      return false;
    } finally {
      registrationPromises.delete(rawContext);
    }
  })();

  registrationPromises.set(rawContext, promise);
  return promise;
}

/**
 * Calcula nível normalizado [0..100] (-48 dB .. 0 dB) a partir de um AnalyserNode em tempo real.
 */
function computeAnalyserLevel(analyser, tempBuffer) {
  if (!analyser || !tempBuffer) return 0;
  analyser.getFloatTimeDomainData(tempBuffer);
  let sumSq = 0;
  let peak = 0;
  const len = tempBuffer.length;
  for (let i = 0; i < len; i++) {
    const s = Math.abs(tempBuffer[i]);
    if (s > peak) peak = s;
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / len);
  const blended = Math.max(rms * 1.35, peak * 0.85);
  if (blended <= 1e-5) return 0;
  const db = 20 * Math.log10(blended);
  if (!Number.isFinite(db) || db <= -48) return 0;
  return Math.min(100, Math.max(0, Math.round(((db + 48) / 48) * 100)));
}

/**
 * Engine de Áudio Multifaixa Studio-Grade para o EasyCovers.
 *
 * Soluciona definitivamente:
 * 1. Duplicação de áudio ao alterar velocidade: gerencia atomicamente exatamente 1 AudioBufferSourceNode
 *    por stem (impossibilitando múltiplas fontes simultâneas por StrictMode, seek ou loop) e substitui
 *    o Tone.PitchShift (que causava slapback echo de 50-100ms e bug de LFO em pitch negativo) por um
 *    processador WSOLA (Waveform Similarity Overlap-Add) com busca de correlação de fase e guarda anti-overtake.
 * 2. Qualidade Máxima do Upload: opera em 100% Bit-Exact Bypass (0.0ms latência, ganho unitário 0.0 dB
 *    em 80% do fader) quando velocidade = 1.0x e tom = 0 st, com Master Lookahead Limiter (-1.0 dBFS)
 *    contra clipping digital.
 * 3. Sincronização Absoluta: relógio próprio (SongTransportClock) escalado pela velocidade real.
 */
export class StudioAudioEngine {
  constructor(options = {}) {
    this.disposed = false;
    this.isLoaded = false;
    this.buffers = {};
    this.activeSources = {};
    this.stemGains = {};
    this.stemAnalysers = {};
    this.analyserScratch = new Float32Array(256);
    this.injectedContext = options.audioContext || null;

    this.volumes = {
      vocals: 80,
      drums: 80,
      bass: 80,
      other: 80,
      guitar: 80,
      piano: 80,
    };
    this.mutes = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };
    this.solos = {
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      guitar: false,
      piano: false,
    };

    this.masterVolume = 100;
    this.isMasterMuted = false;
    this.playbackSpeed = 1.0;
    this.currentPitch = 0;

    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    this.clock = new SongTransportClock(0, 0, 1.0);

    this.rawContext = null;
    this.mixBusNode = null;
    this.dryBypassGain = null;
    this.wetPitchGain = null;
    this.wsolaNode = null;
    this.wsolaFallbackState = null;
    this._pitchSetupPromise = null;
    this._playSessionId = 0;
    this._loopWatchdogTimer = null;
    this.masterLimiter = null;
    this.masterGainNode = null;
    this.masterSplitter = null;
    this.masterAnalyserL = null;
    this.masterAnalyserR = null;
  }

  _initAudioGraph() {
    if (this.rawContext) return;
    const ctx = this.injectedContext || getOrCreateNativeAudioContext();
    this.rawContext = ctx;

    this.mixBusNode = ctx.createGain();
    this.mixBusNode.gain.value = 1.0;

    this.dryBypassGain = ctx.createGain();
    this.dryBypassGain.gain.value = 1.0;

    this.wetPitchGain = ctx.createGain();
    this.wetPitchGain.gain.value = 0.0;

    // Master Limiter transparente (-1.0 dBFS ceiling) para impedir hard-clipping
    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1.0;
    this.masterLimiter.knee.value = 2.0;
    this.masterLimiter.ratio.value = 20.0;
    this.masterLimiter.attack.value = 0.002;
    this.masterLimiter.release.value = 0.08;

    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.value = 1.0;

    // Medidores Estéreo Master L/R reais
    this.masterSplitter = ctx.createChannelSplitter(2);
    this.masterAnalyserL = ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 256;
    this.masterAnalyserL.smoothingTimeConstant = 0.75;
    this.masterAnalyserR = ctx.createAnalyser();
    this.masterAnalyserR.fftSize = 256;
    this.masterAnalyserR.smoothingTimeConstant = 0.75;

    this.mixBusNode.connect(this.dryBypassGain);
    this.dryBypassGain.connect(this.masterLimiter);
    this.wetPitchGain.connect(this.masterLimiter);

    this.masterLimiter.connect(this.masterGainNode);
    this.masterGainNode.connect(ctx.destination);

    this.masterGainNode.connect(this.masterSplitter);
    this.masterSplitter.connect(this.masterAnalyserL, 0);
    this.masterSplitter.connect(this.masterAnalyserR, 1);

    // Cria os 6 canais de stem com GainNode e AnalyserNode dedicados
    STEM_KEYS.forEach((track) => {
      const gainNode = ctx.createGain();
      gainNode.gain.value = computeStemGainLinear(this.volumes[track], false);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;

      gainNode.connect(analyser);
      gainNode.connect(this.mixBusNode);

      this.stemGains[track] = gainNode;
      this.stemAnalysers[track] = analyser;
    });
  }

  async _setupPitchProcessor() {
    if (!this.rawContext || this.wsolaNode) return;
    if (this._pitchSetupPromise) {
      await this._pitchSetupPromise;
      return;
    }

    this._pitchSetupPromise = (async () => {
      const ctx = this.rawContext;
      const hasWorklet = await ensureWsolaWorkletRegistered(ctx);

      if (this.disposed || this.wsolaNode) return;

      if (hasWorklet) {
        const workletOptions = {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        };

        let workletNode = null;
        if (typeof AudioWorkletNode !== 'undefined') {
          try {
            workletNode = new AudioWorkletNode(ctx, 'studio-wsola-pitch-worklet', workletOptions);
          } catch (err) {
            if (Tone.context?.rawContext === ctx && typeof Tone.context.createAudioWorkletNode === 'function') {
              try {
                workletNode = Tone.context.createAudioWorkletNode('studio-wsola-pitch-worklet', workletOptions);
              } catch {
                // Continua para o fallback
              }
            }
            if (!workletNode) {
              console.warn('Falha ao instanciar AudioWorkletNode WSOLA:', err);
            }
          }
        }

        if (workletNode) {
          this.mixBusNode.connect(workletNode);
          workletNode.connect(this.wetPitchGain);
          this.wsolaNode = workletNode;
          this._updatePitchRouting();
          return;
        }
      }

      // Fallback determinístico caso AudioWorklet não esteja disponível no ambiente
      const rawNativeCtx = ctx._nativeAudioContext || ctx._context || ctx;
      const createSpNode =
        typeof ctx.createScriptProcessor === 'function'
          ? ctx.createScriptProcessor.bind(ctx)
          : typeof rawNativeCtx?.createScriptProcessor === 'function'
          ? rawNativeCtx.createScriptProcessor.bind(rawNativeCtx)
          : null;

      if (createSpNode) {
        const sp = createSpNode(1024, 2, 2);
        this.wsolaFallbackState = createWsolaPitchState();
        sp.onaudioprocess = (event) => {
          if (this.disposed) return;
          const inBuf = event.inputBuffer;
          const outBuf = event.outputBuffer;
          const inL = inBuf.getChannelData(0);
          const inR = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : inL;
          const outL = outBuf.getChannelData(0);
          const outR = outBuf.numberOfChannels > 1 ? outBuf.getChannelData(1) : null;
          const ratio = computeEffectivePitchRatio(this.playbackSpeed, this.currentPitch);
          processWsolaPitchBlock(this.wsolaFallbackState, inL, inR, outL, outR, ratio);
        };
        this.mixBusNode.connect(sp);
        sp.connect(this.wetPitchGain);
        this.wsolaNode = sp;
        this._updatePitchRouting();
      }
    })();

    try {
      await this._pitchSetupPromise;
    } finally {
      this._pitchSetupPromise = null;
    }
  }

  /**
   * Alterna automaticamente entre 100% Bit-Exact Hardware Bypass (quando 1.0x e 0 st)
   * e o processador WSOLA Phase-Locked (quando velocidade != 1.0x ou pitch != 0 st).
   */
  _updatePitchRouting() {
    if (!this.rawContext || !this.dryBypassGain || !this.wetPitchGain) return;
    const now = this.rawContext.currentTime;
    const ratio = computeEffectivePitchRatio(this.playbackSpeed, this.currentPitch);
    const isNeutral = Math.abs(ratio - 1.0) < 0.0005 || !this.wsolaNode;

    if (this.wsolaNode?.parameters) {
      const param = this.wsolaNode.parameters.get('pitchRatio');
      if (param) {
        param.cancelScheduledValues?.(now);
        param.value = ratio;
        param.setValueAtTime(ratio, now);
      }
    }

    this.dryBypassGain.gain.cancelScheduledValues?.(now);
    this.wetPitchGain.gain.cancelScheduledValues?.(now);

    if (isNeutral) {
      this.dryBypassGain.gain.setTargetAtTime(1.0, now, 0.002);
      this.wetPitchGain.gain.setTargetAtTime(0.0, now, 0.002);
    } else {
      this.dryBypassGain.gain.setTargetAtTime(0.0, now, 0.002);
      this.wetPitchGain.gain.setTargetAtTime(1.0, now, 0.002);
    }
  }

  /**
   * Carrega e decodifica os 6 stems WAV em paralelo diretamente no AudioContext nativo
   * (com fallback para ToneAudioBuffer) e proteção contra condição de corrida.
   */
  async loadStems(baseUrl) {
    this._initAudioGraph();
    await this._setupPitchProcessor();
    if (this.disposed) return 0;

    const loadedBuffers = {};
    const ctx = this.rawContext;

    await Promise.all(
      STEM_KEYS.map(async (track) => {
        const url = `${baseUrl}${track}.wav`;
        if (typeof fetch === 'function' && typeof ctx?.decodeAudioData === 'function') {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Falha HTTP ${res.status} ao carregar stem: ${url}`);
          }
          const arrayBuffer = await res.arrayBuffer();
          if (this.disposed) return;
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          if (this.disposed) return;
          loadedBuffers[track] = decoded;
        } else {
          const toneBuffer = new Tone.ToneAudioBuffer();
          await toneBuffer.load(url);
          if (this.disposed) {
            toneBuffer.dispose();
            return;
          }
          loadedBuffers[track] = toneBuffer;
        }
      })
    );

    if (this.disposed) {
      Object.values(loadedBuffers).forEach((b) => b?.dispose?.());
      return 0;
    }

    this.buffers = loadedBuffers;
    let duration = 0;
    for (const track of STEM_KEYS) {
      const buf = loadedBuffers[track];
      const audioBuffer = typeof buf?.get === 'function' ? buf.get() : buf;
      if (audioBuffer?.duration && audioBuffer.duration > duration) {
        duration = audioBuffer.duration;
      }
    }
    this.clock.duration = duration;
    this.isLoaded = true;
    this._applyStemGains();
    this._updatePitchRouting();
    return duration;
  }

  _clearLoopWatchdog() {
    if (this._loopWatchdogTimer) {
      clearInterval(this._loopWatchdogTimer);
      this._loopWatchdogTimer = null;
    }
  }

  _startLoopWatchdog() {
    this._clearLoopWatchdog();
    this._loopWatchdogTimer = setInterval(() => {
      if (this.disposed || !this.clock.isPlaying) {
        this._clearLoopWatchdog();
        return;
      }
      this.getCurrentSongTime();
    }, 30);
    if (typeof this._loopWatchdogTimer?.unref === 'function') {
      this._loopWatchdogTimer.unref();
    }
  }

  /**
   * Para e desconecta imediatamente todas as fontes ativas.
   * Garante matematicamente que NUNCA existam 2 fontes tocando o mesmo stem.
   */
  _stopAllActiveSources() {
    this._clearLoopWatchdog();
    STEM_KEYS.forEach((track) => {
      const existing = this.activeSources[track];
      if (existing) {
        try {
          existing.onended = null;
          existing.stop(0);
        } catch {
          // Ignora caso já esteja parado
        }
        try {
          existing.disconnect();
        } catch {
          // Ignora
        }
        this.activeSources[track] = null;
      }
    });
  }

  /**
   * Inicia exatamente 1 AudioBufferSourceNode por stem sincronizados no mesmo sample clock.
   */
  _startSourcesAtOffset(offsetSeconds) {
    if (this.disposed || !this.isLoaded || !this.rawContext) return;
    this._stopAllActiveSources();

    const ctx = this.rawContext;
    const duration = this.clock.duration;
    const clampedOffset = Math.max(0, Math.min(duration, Number(offsetSeconds) || 0));
    if (duration > 0 && clampedOffset >= duration) return;

    const startTime = ctx.currentTime + 0.004;

    STEM_KEYS.forEach((track) => {
      const toneBuf = this.buffers[track];
      const audioBuffer = typeof toneBuf?.get === 'function' ? toneBuf.get() : toneBuf;
      const stemGain = this.stemGains[track];
      if (!audioBuffer || !stemGain) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this.playbackSpeed;
      source.playbackRate.setValueAtTime(this.playbackSpeed, startTime);
      source.connect(stemGain);
      source.start(startTime, clampedOffset);

      this.activeSources[track] = source;
    });

    this.clock.offsetSeconds = clampedOffset;
    this.clock.startContextTime = startTime;
    this.clock.isPlaying = true;
    this._startLoopWatchdog();
  }

  async play() {
    if (this.disposed || !this.isLoaded) return;
    const sessionId = ++this._playSessionId;
    this._initAudioGraph();

    if (this.rawContext.state === 'suspended' && typeof this.rawContext.resume === 'function') {
      await this.rawContext.resume();
    }
    if (this.disposed || sessionId !== this._playSessionId) return;

    await this._setupPitchProcessor();
    if (this.disposed || sessionId !== this._playSessionId) return;

    let startOffset = this.clock.getPositionAt(this.rawContext.currentTime);
    if (this.clock.duration > 0 && startOffset >= this.clock.duration - 0.05) {
      startOffset = this.loopEnabled ? this.loopStart : 0;
    }

    this._startSourcesAtOffset(startOffset);
  }

  pause() {
    this._playSessionId++;
    if (!this.rawContext) return;
    this.clock.pause(this.rawContext.currentTime);
    this._stopAllActiveSources();
  }

  stop() {
    this._playSessionId++;
    this.clock.stop();
    this._stopAllActiveSources();
  }

  seek(targetSeconds) {
    if (!this.rawContext) return 0;
    const wasPlaying = this.clock.isPlaying;
    const clamped = this.clock.seek(targetSeconds, this.rawContext.currentTime);
    if (wasPlaying) {
      this._startSourcesAtOffset(clamped);
    } else {
      this._stopAllActiveSources();
    }
    return clamped;
  }

  /**
   * Altera a velocidade de reprodução (0.5x..1.25x) em tempo real SEM recriar fontes
   * e SEM duplicar o áudio, atualizando a taxa de leitura dos buffers ativos e a compensação WSOLA.
   */
  setSpeed(speed) {
    const clamped = Math.max(0.5, Math.min(1.25, Number(speed) || 1.0));
    const now = this.rawContext ? this.rawContext.currentTime : 0;

    this.clock.setSpeed(clamped, now);
    this.playbackSpeed = clamped;

    if (this.rawContext) {
      STEM_KEYS.forEach((track) => {
        const source = this.activeSources[track];
        if (source) {
          source.playbackRate.cancelScheduledValues?.(0);
          source.playbackRate.value = clamped;
          source.playbackRate.setValueAtTime(clamped, now);
        }
      });
    }

    this._updatePitchRouting();
  }

  /**
   * Altera a transposição harmônica (-12..+12 semitons) com preservação da velocidade atual.
   */
  setPitch(semitones) {
    const clamped = Math.max(-12, Math.min(12, Math.round(Number(semitones) || 0)));
    this.currentPitch = clamped;
    this._updatePitchRouting();
  }

  setLoop(enabled, startSec, endSec) {
    if (typeof startSec === 'number') this.loopStart = Math.max(0, startSec);
    if (typeof endSec === 'number') this.loopEnd = Math.max(0, endSec);
    this.loopEnabled = Boolean(enabled);
  }

  _applyStemGains() {
    if (!this.rawContext) return;
    const now = this.rawContext.currentTime;
    const anySolo = Object.values(this.solos).some(Boolean);

    STEM_KEYS.forEach((track) => {
      const gainNode = this.stemGains[track];
      if (!gainNode) return;
      const effectivelyMuted = anySolo
        ? !this.solos[track] || this.mutes[track]
        : this.mutes[track];
      const targetLinear = computeStemGainLinear(this.volumes[track], effectivelyMuted);
      gainNode.gain.cancelScheduledValues?.(now);
      gainNode.gain.setTargetAtTime(targetLinear, now, 0.01);
    });
  }

  setStemVolume(track, volumePercent) {
    const numericValue = Math.max(0, Math.min(100, Math.round(Number(volumePercent) || 0)));
    this.volumes[track] = numericValue;
    this._applyStemGains();
  }

  setRouting(mutes, solos) {
    if (mutes) this.mutes = { ...this.mutes, ...mutes };
    if (solos) this.solos = { ...this.solos, ...solos };
    this._applyStemGains();
  }

  setMasterVolume(volumePercent, isMuted = false) {
    const numericValue = Math.max(0, Math.min(100, Math.round(Number(volumePercent) || 0)));
    this.masterVolume = numericValue;
    this.isMasterMuted = Boolean(isMuted) || numericValue === 0;

    if (this.rawContext && this.masterGainNode) {
      const targetGain = this.isMasterMuted ? 0 : numericValue / 100;
      const now = this.rawContext.currentTime;
      this.masterGainNode.gain.cancelScheduledValues?.(now);
      this.masterGainNode.gain.setTargetAtTime(targetGain, now, 0.01);
    }
  }

  /**
   * Retorna a posição atual na música (em segundos) e processa automaticamente
   * o wrap de Loop A-B com precisão de sample clock.
   */
  getCurrentSongTime() {
    if (!this.rawContext) return this.clock.offsetSeconds;
    const pos = this.clock.getPositionAt(this.rawContext.currentTime);

    if (
      this.clock.isPlaying &&
      this.loopEnabled &&
      this.loopEnd > this.loopStart &&
      pos >= this.loopEnd
    ) {
      this._startSourcesAtOffset(this.loopStart);
      return this.loopStart;
    }

    return pos;
  }

  /**
   * Retorna o número exato de AudioBufferSourceNodes ativos (para auditoria e testes).
   */
  getActiveSourceCount() {
    return STEM_KEYS.reduce(
      (count, track) => count + (this.activeSources[track] ? 1 : 0),
      0
    );
  }

  /**
   * Coleta a telemetria real de nível [0..100] de cada stem e do barramento Master L/R.
   */
  getTelemetryLevels() {
    const stemLevels = {};
    const anySolo = Object.values(this.solos).some(Boolean);

    STEM_KEYS.forEach((track) => {
      const effectivelyMuted = anySolo
        ? !this.solos[track] || this.mutes[track]
        : this.mutes[track];
      if (
        !this.clock.isPlaying ||
        effectivelyMuted ||
        this.volumes[track] <= 0 ||
        this.isMasterMuted
      ) {
        stemLevels[track] = 0;
      } else {
        stemLevels[track] = computeAnalyserLevel(
          this.stemAnalysers[track],
          this.analyserScratch
        );
      }
    });

    let masterL = 0;
    let masterR = 0;
    if (this.clock.isPlaying && !this.isMasterMuted && this.masterVolume > 0) {
      masterL = computeAnalyserLevel(this.masterAnalyserL, this.analyserScratch);
      masterR = computeAnalyserLevel(this.masterAnalyserR, this.analyserScratch);
    }

    return { stemLevels, masterL, masterR };
  }

  dispose() {
    this.disposed = true;
    this._playSessionId++;
    this._stopAllActiveSources();

    Object.values(this.buffers).forEach((b) => {
      try {
        b?.dispose?.();
      } catch {
        // Ignora
      }
    });
    this.buffers = {};

    [
      ...Object.values(this.stemGains),
      ...Object.values(this.stemAnalysers),
      this.mixBusNode,
      this.dryBypassGain,
      this.wetPitchGain,
      this.wsolaNode,
      this.masterLimiter,
      this.masterGainNode,
      this.masterSplitter,
      this.masterAnalyserL,
      this.masterAnalyserR,
    ].forEach((node) => {
      try {
        node?.disconnect();
      } catch {
        // Ignora
      }
    });

    this.stemGains = {};
    this.stemAnalysers = {};
    this.wsolaNode = null;
  }
}
