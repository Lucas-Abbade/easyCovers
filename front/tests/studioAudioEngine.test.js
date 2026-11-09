import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEM_KEYS,
  WSOLA_WORKLET_CODE,
  SongTransportClock,
  StudioAudioEngine,
  createWsolaPitchState,
  processWsolaPitchBlock,
  computeStemGainLinear,
  computeStemGainDb,
  computeEffectivePitchRatio,
} from '../src/utils/studioAudioEngine.js';

// ============================================================================
// Mock determinístico da Web Audio API para testes profundos de ciclo de vida
// ============================================================================
class MockAudioParam {
  constructor(initialValue = 0) {
    this.value = initialValue;
    this.events = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', val, time });
  }
  setTargetAtTime(val, time, timeConstant) {
    this.value = val;
    this.events.push({ type: 'setTargetAtTime', val, time, timeConstant });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', val, time });
  }
  cancelScheduledValues(time) {
    this.events.push({ type: 'cancelScheduledValues', time });
  }
}

class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
    this.disconnected = false;
  }
  connect(target) {
    this.connections.push(target);
    return target;
  }
  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.gain = new MockAudioParam(1);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.threshold = new MockAudioParam(-24);
    this.knee = new MockAudioParam(30);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.25);
  }
}

class MockAnalyserNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.fftSize = 256;
    this.smoothingTimeConstant = 0.8;
    this._testSignalAmplitude = 0.25;
  }
  getFloatTimeDomainData(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.sin((2 * Math.PI * i) / array.length) * this._testSignalAmplitude;
    }
  }
}

class MockChannelSplitterNode extends MockAudioNode {}

class MockScriptProcessorNode extends MockAudioNode {
  constructor(context, bufferSize, inputChannels, outputChannels) {
    super(context);
    this.bufferSize = bufferSize;
    this.inputChannels = inputChannels;
    this.outputChannels = outputChannels;
    this.onaudioprocess = null;
  }
}

class MockBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new MockAudioParam(1);
    this.started = false;
    this.stopped = false;
    this.startArgs = null;
    this.onended = null;
    context._allCreatedSources.push(this);
  }
  start(when = 0, offset = 0) {
    if (this.started) {
      throw new Error('InvalidStateError: AudioBufferSourceNode cannot be started more than once');
    }
    this.started = true;
    this.startArgs = { when, offset };
  }
  stop() {
    if (!this.started) {
      throw new Error('InvalidStateError: AudioBufferSourceNode cannot be stopped before start');
    }
    this.stopped = true;
    if (typeof this.onended === 'function') {
      this.onended();
    }
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 10.0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode(this);
    this._allCreatedSources = [];
  }
  async resume() {
    this.state = 'running';
  }
  createGain() {
    return new MockGainNode(this);
  }
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode(this);
  }
  createAnalyser() {
    return new MockAnalyserNode(this);
  }
  createChannelSplitter(ch) {
    return new MockChannelSplitterNode(this, ch);
  }
  createScriptProcessor(size, inCh, outCh) {
    return new MockScriptProcessorNode(this, size, inCh, outCh);
  }
  createBufferSource() {
    return new MockBufferSourceNode(this);
  }
}

function createFakeAudioBuffer(duration = 180.0) {
  return {
    duration,
    sampleRate: 44100,
    numberOfChannels: 2,
    length: Math.floor(duration * 44100),
  };
}

// ============================================================================
// 1. Testes do Relógio de Transporte Escalado por Velocidade (SongTransportClock)
// ============================================================================
test('SongTransportClock mantém posição exata da música em múltiplas alterações de velocidade', () => {
  const clock = new SongTransportClock(200, 0, 1.0);

  // Inicia em t_ctx = 10s a 1.0x
  clock.start(10.0);
  assert.equal(clock.getPositionAt(10.0), 0);
  assert.equal(clock.getPositionAt(20.0), 10.0); // 10s reais a 1.0x = 10s da música

  // Muda para 0.5x em t_ctx = 20s (posição atual deve permanecer exatamente 10.0s, sem salto!)
  clock.setSpeed(0.5, 20.0);
  assert.equal(clock.getPositionAt(20.0), 10.0);
  assert.equal(clock.getPositionAt(30.0), 15.0); // +10s reais a 0.5x = +5s da música (15.0s)

  // Muda para 1.25x em t_ctx = 30s
  clock.setSpeed(1.25, 30.0);
  assert.equal(clock.getPositionAt(30.0), 15.0);
  assert.equal(clock.getPositionAt(38.0), 25.0); // +8s reais a 1.25x = +10s da música (25.0s)

  // Pause em t_ctx = 38s
  clock.pause(38.0);
  assert.equal(clock.getPositionAt(99.0), 25.0); // parado enquanto em pausa

  // Seek durante pausa e retomada em 0.75x
  clock.seek(40.0, 100.0);
  clock.setSpeed(0.75, 100.0);
  clock.start(100.0);
  assert.equal(clock.getPositionAt(104.0), 43.0); // +4s reais a 0.75x = +3s da música
});

// ============================================================================
// 2. Testes de Fidelidade DSP (Bit-Exact Bypass & WSOLA Pitch Shifter)
// ============================================================================
test('processWsolaPitchBlock é 100% bit-exact (erro zero absoluto) em 1.0x e 0 semitons', () => {
  const state = createWsolaPitchState();
  const blockSize = 128;
  const numBlocks = 50;

  let maxAbsError = 0;

  for (let b = 0; b < numBlocks; b++) {
    const inL = new Float32Array(blockSize);
    const inR = new Float32Array(blockSize);
    const outL = new Float32Array(blockSize);
    const outR = new Float32Array(blockSize);

    for (let i = 0; i < blockSize; i++) {
      const sampleIdx = b * blockSize + i;
      const t = sampleIdx / 44100;
      inL[i] =
        0.5 * Math.sin(2 * Math.PI * 440 * t) +
        0.25 * Math.sin(2 * Math.PI * 1320 * t) +
        0.1 * Math.cos(2 * Math.PI * 3520 * t);
      inR[i] =
        0.5 * Math.cos(2 * Math.PI * 440 * t) -
        0.2 * Math.sin(2 * Math.PI * 880 * t);
    }

    processWsolaPitchBlock(state, inL, inR, outL, outR, 1.0);

    for (let i = 0; i < blockSize; i++) {
      const errL = Math.abs(outL[i] - inL[i]);
      const errR = Math.abs(outR[i] - inR[i]);
      if (errL > maxAbsError) maxAbsError = errL;
      if (errR > maxAbsError) maxAbsError = errR;
    }
  }

  assert.equal(maxAbsError, 0, 'Em 1.0x / 0st a saída deve ser idêntica bit-a-bit à entrada');
});

test('processWsolaPitchBlock opera sem falhas, NaNs ou clipping em todos os presets de velocidade (0.5x a 1.25x) e tons (-12 a +12 st)', () => {
  const speeds = [0.5, 0.75, 0.9, 1.0, 1.1, 1.25];
  const pitches = [-12, -5, -2, 0, 2, 5, 12];

  for (const speed of speeds) {
    for (const pitch of pitches) {
      const state = createWsolaPitchState();
      const ratio = computeEffectivePitchRatio(speed, pitch);
      const blockSize = 128;
      let rmsAccum = 0;
      let sampleCount = 0;
      let maxPeak = 0;

      // Roda 0.5 segundo de áudio estéreo contínuo (440 Hz)
      for (let b = 0; b < 172; b++) {
        const inL = new Float32Array(blockSize);
        const inR = new Float32Array(blockSize);
        const outL = new Float32Array(blockSize);
        const outR = new Float32Array(blockSize);

        for (let i = 0; i < blockSize; i++) {
          const t = (b * blockSize + i) / 44100;
          inL[i] = 0.6 * Math.sin(2 * Math.PI * 440 * t);
          inR[i] = 0.6 * Math.cos(2 * Math.PI * 440 * t);
        }

        processWsolaPitchBlock(state, inL, inR, outL, outR, ratio);

        // Após o preenchimento inicial do buffer circular (primeiros ~25 blocos), mede estabilidade
        if (b > 25) {
          for (let i = 0; i < blockSize; i++) {
            assert.ok(Number.isFinite(outL[i]), `outL não-finito para speed=${speed}, pitch=${pitch}`);
            assert.ok(Number.isFinite(outR[i]), `outR não-finito para speed=${speed}, pitch=${pitch}`);
            const absL = Math.abs(outL[i]);
            if (absL > maxPeak) maxPeak = absL;
            rmsAccum += outL[i] * outL[i];
            sampleCount++;
          }
        }
      }

      const rms = Math.sqrt(rmsAccum / sampleCount);
      assert.ok(
        rms > 0.25 && rms < 0.65,
        `Energia RMS consistente esperada para speed=${speed}, pitch=${pitch}, obteve rms=${rms.toFixed(4)}`
      );
      assert.ok(
        maxPeak <= 0.85,
        `Sem picos espúrios para speed=${speed}, pitch=${pitch}, obteve maxPeak=${maxPeak.toFixed(4)}`
      );
    }
  }
});

test('processWsolaPitchBlock suporta varredura contínua do slider de velocidade sem descontinuidades', () => {
  const state = createWsolaPitchState();
  const blockSize = 128;
  let prevSample = 0;
  let maxStepDelta = 0;

  for (let b = 0; b < 200; b++) {
    // Modula a velocidade continuamente entre 0.5x e 1.25x
    const speed = 0.875 + 0.375 * Math.sin((2 * Math.PI * b) / 100);
    const ratio = computeEffectivePitchRatio(speed, 0);

    const inL = new Float32Array(blockSize);
    const inR = new Float32Array(blockSize);
    const outL = new Float32Array(blockSize);
    const outR = new Float32Array(blockSize);

    for (let i = 0; i < blockSize; i++) {
      const t = (b * blockSize + i) / 44100;
      inL[i] = 0.5 * Math.sin(2 * Math.PI * 330 * t);
      inR[i] = 0.5 * Math.sin(2 * Math.PI * 330 * t);
    }

    processWsolaPitchBlock(state, inL, inR, outL, outR, ratio);

    if (b > 20) {
      for (let i = 0; i < blockSize; i++) {
        const delta = Math.abs(outL[i] - prevSample);
        if (delta > maxStepDelta) maxStepDelta = delta;
        prevSample = outL[i];
      }
    } else {
      prevSample = outL[blockSize - 1];
    }
  }

  assert.ok(
    maxStepDelta < 0.35,
    `Transições entre amostras devem ser suaves sem cliques/duplicações (maxStepDelta=${maxStepDelta.toFixed(4)})`
  );
});

// ============================================================================
// 3. Testes de Anti-Duplicação de Fontes no StudioAudioEngine
// ============================================================================
test('StudioAudioEngine nunca duplica AudioBufferSourceNodes ao alterar velocidade, buscar (seek) ou fazer loop A-B', async () => {
  const mockCtx = new MockAudioContext();
  const engine = new StudioAudioEngine({ audioContext: mockCtx });
  engine._initAudioGraph();
  await engine._setupPitchProcessor();

  // Injeta buffers decodificados diretamente para simular os 6 stems carregados
  for (const key of STEM_KEYS) {
    engine.buffers[key] = createFakeAudioBuffer(180.0);
  }
  engine.clock.duration = 180.0;
  engine.isLoaded = true;

  // Antes do play: 0 fontes ativas
  assert.equal(engine.getActiveSourceCount(), 0);

  // 1. Inicia reprodução: exatamente 6 fontes ativas (1 por stem)
  await engine.play();
  assert.equal(engine.getActiveSourceCount(), 6);
  assert.equal(mockCtx._allCreatedSources.length, 6);

  // 2. Altera a velocidade 12 vezes seguidas enquanto toca (0.5x -> 0.75x -> 0.9x -> 1.1x -> 1.25x -> 1.0x...)
  const speedChanges = [0.75, 0.5, 0.9, 1.1, 1.25, 1.0, 0.65, 1.15, 0.8, 1.25, 0.5, 1.0];
  for (const spd of speedChanges) {
    mockCtx.currentTime += 1.5;
    engine.setSpeed(spd);
    assert.equal(
      engine.getActiveSourceCount(),
      6,
      `Deve haver estritamente 6 fontes ativas após setSpeed(${spd})`
    );
    // Verifica que setSpeed atualiza o playbackRate in-place sem criar novas fontes duplicadas!
    assert.equal(
      mockCtx._allCreatedSources.length,
      6,
      'setSpeed deve ajustar playbackRate in-place nas 6 fontes ativas sem instanciar novas fontes'
    );
  }

  // Verifica que em 1.0x e 0st o bypass bit-exact está 100% ativo (dry=1, wet=0)
  assert.equal(engine.dryBypassGain.gain.value, 1.0);
  assert.equal(engine.wetPitchGain.gain.value, 0.0);

  // E que em 0.75x o processador harmônico WSOLA assume (dry=0, wet=1)
  engine.setSpeed(0.75);
  assert.equal(engine.dryBypassGain.gain.value, 0.0);
  assert.equal(engine.wetPitchGain.gain.value, 1.0);

  // 3. Executa seek durante a reprodução: as 6 fontes antigas devem parar e desconectar antes das 6 novas
  engine.seek(45.0);
  assert.equal(engine.getActiveSourceCount(), 6);
  const stoppedSourcesAfterFirstSeek = mockCtx._allCreatedSources.filter((s) => s.stopped);
  const activeSourcesAfterFirstSeek = mockCtx._allCreatedSources.filter((s) => !s.stopped);
  assert.equal(stoppedSourcesAfterFirstSeek.length, 6);
  assert.equal(activeSourcesAfterFirstSeek.length, 6);

  // Verifica que o offset passado para start() nas novas fontes é exatamente 45.0s
  for (const src of activeSourcesAfterFirstSeek) {
    assert.equal(src.startArgs.offset, 45.0);
  }

  // 4. Testa Loop A-B em velocidade reduzida (0.75x)
  engine.setLoop(true, 40.0, 50.0);
  // Avança 8 segundos no AudioContext a 0.75x => +6.0s de música (45.0 + 6.0 = 51.0 >= 50.0 -> faz wrap para 40.0!)
  mockCtx.currentTime += 8.0;
  const posAfterLoop = engine.getCurrentSongTime();
  assert.equal(posAfterLoop, 40.0);
  assert.equal(engine.getActiveSourceCount(), 6, 'Loop A-B não pode deixar fontes antigas tocando');

  // 5. Pause e Stop zeram imediatamente todas as fontes ativas
  engine.pause();
  assert.equal(engine.getActiveSourceCount(), 0);

  await engine.play();
  assert.equal(engine.getActiveSourceCount(), 6);

  engine.stop();
  assert.equal(engine.getActiveSourceCount(), 0);
  assert.equal(engine.getCurrentSongTime(), 0);

  engine.dispose();
  assert.equal(engine.getActiveSourceCount(), 0);
});

test('StudioAudioEngine é imune à montagem dupla do React <StrictMode> e preserva ganho nominal 0.0 dB em 80%', async () => {
  // Verifica calibração do fader: 80% = 1.0 linear (0.0 dB), 0% = 0.0, 100% = 1.25 (+1.94 dB)
  assert.equal(computeStemGainLinear(80, false), 1.0);
  assert.equal(computeStemGainLinear(80, true), 0.0);
  assert.equal(computeStemGainLinear(0, false), 0.0);
  assert.equal(computeStemGainLinear(100, false), 1.25);
  assert.equal(computeStemGainDb(80, false), 0);

  // Simula React StrictMode: Engine #1 é montada e descartada antes da Engine #2 tocar
  const mockCtx = new MockAudioContext();
  const engine1 = new StudioAudioEngine({ audioContext: mockCtx });
  engine1._initAudioGraph();
  for (const key of STEM_KEYS) {
    engine1.buffers[key] = createFakeAudioBuffer(120);
  }
  engine1.isLoaded = true;
  await engine1.play();
  assert.equal(engine1.getActiveSourceCount(), 6);
  engine1.dispose();
  assert.equal(engine1.getActiveSourceCount(), 0);

  const engine2 = new StudioAudioEngine({ audioContext: mockCtx });
  engine2._initAudioGraph();
  for (const key of STEM_KEYS) {
    engine2.buffers[key] = createFakeAudioBuffer(120);
  }
  engine2.isLoaded = true;
  await engine2.play();
  assert.equal(engine2.getActiveSourceCount(), 6);

  // Testa Solo / Mute / Volumes na Engine #2
  engine2.setRouting(
    { vocals: false, drums: true, bass: false, guitar: false, piano: false, other: false },
    { vocals: false, drums: false, bass: false, guitar: false, piano: false, other: false }
  );

  assert.equal(engine2.stemGains.vocals.gain.value, 1.0);
  assert.equal(engine2.stemGains.drums.gain.value, 0.0);

  // Ativa Solo apenas em 'guitar': todos os demais devem ir a 0.0
  engine2.setRouting(
    { vocals: false, drums: false, bass: false, guitar: false, piano: false, other: false },
    { vocals: false, drums: false, bass: false, guitar: true, piano: false, other: false }
  );

  assert.equal(engine2.stemGains.guitar.gain.value, 1.0);
  assert.equal(engine2.stemGains.vocals.gain.value, 0.0);
  assert.equal(engine2.stemGains.bass.gain.value, 0.0);

  // Telemetria real dos Analysers retorna níveis coerentes
  const telemetry = engine2.getTelemetryLevels();
  assert.ok(telemetry.masterL > 0 && telemetry.masterL <= 100);
  assert.ok(telemetry.stemLevels.guitar > 0);
  assert.equal(telemetry.stemLevels.vocals, 0, 'Canal não-solado deve reportar 0 no medidor visual');

  engine2.dispose();
});

test('processWsolaPitchBlock impede ultrapassagem do writePtr (zero eco de 371ms) e elimina cliques ao cruzar 1.0x', () => {
  const state = createWsolaPitchState();
  const blockSize = 128;
  let sampleIdx = 0;

  const runSignalBlock = (ratio) => {
    const inL = new Float32Array(blockSize);
    const inR = new Float32Array(blockSize);
    const outL = new Float32Array(blockSize);
    const outR = new Float32Array(blockSize);
    for (let i = 0; i < blockSize; i++, sampleIdx++) {
      const t = sampleIdx / 44100;
      inL[i] = 0.6 * Math.sin(2 * Math.PI * 330 * t);
      inR[i] = 0.6 * Math.cos(2 * Math.PI * 330 * t);
    }
    processWsolaPitchBlock(state, inL, inR, outL, outR, ratio);
    return { inL, outL };
  };

  // 1. Toca em 1.0x e muda abruptamente para 0.5x (ratio = 2.0) e depois 0.5x + 12st (ratio = 4.0)
  runSignalBlock(1.0);
  for (let b = 0; b < 20; b++) {
    runSignalBlock(2.0);
    const delay0 = (state.writePtr - Math.floor(state.readPos0) + 16384) & 16383;
    const delay1 = (state.writePtr - Math.floor(state.readPos1) + 16384) & 16383;
    assert.ok(
      delay0 > 0 && delay0 < 8192,
      `readPos0 nunca deve ultrapassar writePtr em 0.5x (obteve delay0=${delay0})`
    );
    assert.ok(
      delay1 > 0 && delay1 < 8192,
      `readPos1 nunca deve ultrapassar writePtr em 0.5x (obteve delay1=${delay1})`
    );
  }

  for (let b = 0; b < 20; b++) {
    runSignalBlock(4.0);
    const delay0 = (state.writePtr - Math.floor(state.readPos0) + 16384) & 16383;
    const delay1 = (state.writePtr - Math.floor(state.readPos1) + 16384) & 16383;
    assert.ok(
      delay0 > 0 && delay0 < 8192,
      `readPos0 nunca deve ultrapassar writePtr em ratio=4.0 (obteve delay0=${delay0})`
    );
    assert.ok(
      delay1 > 0 && delay1 < 8192,
      `readPos1 nunca deve ultrapassar writePtr em ratio=4.0 (obteve delay1=${delay1})`
    );
  }

  // 2. Verifica transição suave 0.95x -> 1.0x -> 0.95x sem clique de fase e retorno ao bit-exact
  for (let b = 0; b < 30; b++) {
    runSignalBlock(computeEffectivePitchRatio(0.95, 0));
  }
  const prevActive = runSignalBlock(computeEffectivePitchRatio(0.95, 0));
  const enterBypass = runSignalBlock(1.0);
  const boundaryDelta = Math.abs(enterBypass.outL[0] - prevActive.outL[blockSize - 1]);
  assert.ok(
    boundaryDelta < 0.12,
    `Transição 0.95x -> 1.0x deve ser contínua sem clique (boundaryDelta=${boundaryDelta.toFixed(4)})`
  );

  // No bloco seguinte em 1.0x (após as 64 amostras de crossfade), deve voltar a ser 100% bit-exact
  const steadyBypass = runSignalBlock(1.0);
  let maxBypassErr = 0;
  for (let i = 0; i < blockSize; i++) {
    const err = Math.abs(steadyBypass.outL[i] - steadyBypass.inL[i]);
    if (err > maxBypassErr) maxBypassErr = err;
  }
  assert.equal(maxBypassErr, 0, 'Após a ponte de 64 amostras, 1.0x deve voltar a ser 100% bit-exact');
});

test('StudioAudioEngine deduplica registro concorrente de AudioWorklet sob <StrictMode> e cancela eventos agendados em setSpeed/pause', async () => {
  let addModuleCalls = 0;
  class StrictWorkletAudioContext extends MockAudioContext {
    constructor() {
      super();
      this.audioWorklet = {
        addModule: async () => {
          addModuleCalls++;
          await new Promise((r) => setTimeout(r, 10));
          if (addModuleCalls > 1) {
            throw new Error(
              'NotSupportedError: An AudioWorkletProcessor with name:"studio-wsola-pitch-worklet" is already registered'
            );
          }
        },
      };
    }
  }

  const sharedCtx = new StrictWorkletAudioContext();
  const e1 = new StudioAudioEngine({ audioContext: sharedCtx });
  const e2 = new StudioAudioEngine({ audioContext: sharedCtx });
  e1._initAudioGraph();
  e2._initAudioGraph();

  // Dispara _setupPitchProcessor concorrentemente (como no mount duplo do <StrictMode>)
  await Promise.all([
    e1._setupPitchProcessor(),
    e1._setupPitchProcessor(),
    e2._setupPitchProcessor(),
  ]);

  assert.equal(addModuleCalls, 1, 'addModule deve ser chamado exatamente 1 vez por AudioContext');
  assert.ok(e1.wsolaNode, 'e1 deve possuir wsolaNode configurado');
  assert.ok(e2.wsolaNode, 'e2 deve possuir wsolaNode configurado');

  // Verifica que mixBusNode conectou apenas 1 wsolaNode (dryBypassGain + 1 wsolaNode = 2 conexões por engine)
  assert.equal(e2.mixBusNode.connections.length, 2);

  // Verifica cancelamento de eventos agendados em setSpeed imediatamente após play()
  for (const key of STEM_KEYS) {
    e2.buffers[key] = createFakeAudioBuffer(120);
  }
  e2.clock.duration = 120;
  e2.isLoaded = true;

  await e2.play();
  e2.setSpeed(0.75);
  const vocalsRateEvents = e2.activeSources.vocals.playbackRate.events;
  assert.ok(
    vocalsRateEvents.some((ev) => ev.type === 'cancelScheduledValues'),
    'setSpeed deve cancelar agendamentos futuros em source.playbackRate'
  );
  assert.equal(e2.activeSources.vocals.playbackRate.value, 0.75);

  // Verifica que pause() durante play() assíncrono impede início tardio de fontes
  e2.pause();
  let resumeResolver;
  sharedCtx.state = 'suspended';
  sharedCtx.resume = () =>
    new Promise((resolve) => {
      resumeResolver = () => {
        sharedCtx.state = 'running';
        resolve();
      };
    });

  const playPromise = e2.play();
  e2.pause(); // Usuário clicou em Pause enquanto resume() ainda estava pendente
  resumeResolver();
  await playPromise;

  assert.equal(
    e2.getActiveSourceCount(),
    0,
    'play() cancelado por pause() durante await não pode iniciar fontes'
  );

  e1.dispose();
  e2.dispose();
});

test('StudioWsolaPitchWorklet (AudioWorkletProcessor) executa bit-a-bit idêntico ao processWsolaPitchBlock e prioriza AudioContext nativo sobre standardized-audio-context', async () => {
  // 1. Compila e registra o código real do AudioWorkletProcessor (WSOLA_WORKLET_CODE)
  let registeredName = null;
  let RegisteredWorkletClass = null;

  class BaseAudioWorkletProcessor {}
  const registerFn = (name, cls) => {
    registeredName = name;
    RegisteredWorkletClass = cls;
  };

  const loader = new Function('AudioWorkletProcessor', 'registerProcessor', WSOLA_WORKLET_CODE);
  loader(BaseAudioWorkletProcessor, registerFn);

  assert.equal(registeredName, 'studio-wsola-pitch-worklet');
  assert.ok(RegisteredWorkletClass, 'StudioWsolaPitchWorklet deve ser registrado com sucesso');
  assert.equal(RegisteredWorkletClass.parameterDescriptors[0].name, 'pitchRatio');

  const workletProcessor = new RegisteredWorkletClass();
  const refState = createWsolaPitchState();
  const blockSize = 128;

  // Executa sequência de blocos: 1.0x -> 0.75x -> 0.5x -> 1.0x -> 1.25x e compara amostra por amostra
  const ratioSequence = [1.0, 1.0, 1.333333, 1.333333, 2.0, 2.0, 1.0, 1.0, 0.8, 0.8];
  let sampleIdx = 0;

  for (const ratio of ratioSequence) {
    const inL = new Float32Array(blockSize);
    const inR = new Float32Array(blockSize);
    for (let i = 0; i < blockSize; i++, sampleIdx++) {
      const t = sampleIdx / 44100;
      inL[i] = 0.55 * Math.sin(2 * Math.PI * 330 * t) + 0.15 * Math.cos(2 * Math.PI * 660 * t);
      inR[i] = 0.55 * Math.cos(2 * Math.PI * 330 * t) - 0.15 * Math.sin(2 * Math.PI * 660 * t);
    }

    const workletOutL = new Float32Array(blockSize);
    const workletOutR = new Float32Array(blockSize);
    const refOutL = new Float32Array(blockSize);
    const refOutR = new Float32Array(blockSize);

    const keepAlive = workletProcessor.process(
      [[inL, inR]],
      [[workletOutL, workletOutR]],
      { pitchRatio: new Float32Array([ratio]) }
    );
    assert.equal(keepAlive, true);

    processWsolaPitchBlock(refState, inL, inR, refOutL, refOutR, ratio);

    for (let i = 0; i < blockSize; i++) {
      assert.equal(
        workletOutL[i],
        refOutL[i],
        `Divergência L no AudioWorklet em ratio=${ratio}, sample=${i}`
      );
      assert.equal(
        workletOutR[i],
        refOutR[i],
        `Divergência R no AudioWorklet em ratio=${ratio}, sample=${i}`
      );
    }
  }

  // 2. Simula ambiente de navegador onde window.AudioWorkletNode exige instância estrita de window.AudioContext
  // (rejeitando wrappers como standardized-audio-context do Tone.js)
  const prevWindow = globalThis.window;
  const prevAudioWorkletNode = globalThis.AudioWorkletNode;

  try {
    class NativeBrowserAudioContext extends MockAudioContext {
      constructor() {
        super();
        this.audioWorklet = {
          addModule: async () => {},
        };
      }
    }

    class StrictBrowserAudioWorkletNode extends MockAudioNode {
      constructor(ctx, name, options) {
        if (!(ctx instanceof NativeBrowserAudioContext)) {
          throw new TypeError(
            "Failed to construct 'AudioWorkletNode': parameter 1 is not of type 'BaseAudioContext'."
          );
        }
        super(ctx);
        this.name = name;
        this.options = options;
        this.parameters = new Map([['pitchRatio', new MockAudioParam(1.0)]]);
      }
    }

    globalThis.window = {
      AudioContext: NativeBrowserAudioContext,
    };
    globalThis.AudioWorkletNode = StrictBrowserAudioWorkletNode;

    const browserEngine = new StudioAudioEngine();
    browserEngine._initAudioGraph();
    await browserEngine._setupPitchProcessor();

    assert.ok(
      browserEngine.rawContext instanceof NativeBrowserAudioContext,
      'StudioAudioEngine deve instanciar o AudioContext nativo do navegador'
    );
    assert.ok(
      browserEngine.wsolaNode instanceof StrictBrowserAudioWorkletNode,
      'StudioAudioEngine deve instanciar o AudioWorkletNode nativo sem erro de wrapper'
    );

    browserEngine.setSpeed(0.75);
    browserEngine.setPitch(-2);
    const expectedRatio = computeEffectivePitchRatio(0.75, -2);
    assert.ok(
      Math.abs(browserEngine.wsolaNode.parameters.get('pitchRatio').value - expectedRatio) < 1e-6
    );

    browserEngine.dispose();
  } finally {
    globalThis.window = prevWindow;
    globalThis.AudioWorkletNode = prevAudioWorkletNode;
  }
});
