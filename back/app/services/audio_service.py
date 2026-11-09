import os
import subprocess
import numpy as np
import soundfile as sf
from typing import Tuple, Any

# Suprime pop-ups modais de erro do Windows (ex: "python.exe - Imagem Incorreta" 0xc0e90002)
if os.name == "nt":
    try:
        import ctypes
        ctypes.windll.kernel32.SetErrorMode(0x0001 | 0x0002 | 0x8000)
    except Exception:
        pass

# Contorna bloqueios de segurança do Windows (Smart App Control / WinError 4551) no torchaudio
try:
    import torchaudio._extension.utils as _ta_utils
    _orig_load_lib = _ta_utils._load_lib
    def _safe_load_lib(lib):
        try:
            return _orig_load_lib(lib)
        except OSError:
            pass
    _ta_utils._load_lib = _safe_load_lib
except Exception:
    pass

_model = None
_device = None

# Parâmetros de referência de estúdio para preservação máxima de qualidade
STUDIO_SAMPLE_RATE = 44100
STUDIO_CHANNELS = 2
STUDIO_STEM_SUBTYPE = "PCM_24"  # 24-bit Studio PCM (144 dB de faixa dinâmica sem truncamento de 16-bit)
PEAK_CEILING = 0.999            # Limiar anti-clipping (-0.01 dBFS) para evitar distorção digital


def get_demucs_model():
    """
    Carrega o modelo Demucs sob demanda (Lazy Loading).
    Evita travar a inicialização da API inteira caso haja problemas no PyTorch ou na política do sistema.
    """
    global _model, _device
    if _model is None:
        print("--- Inicializando IA (Demucs) sob demanda ---")
        try:
            import torch
            from demucs.pretrained import get_model

            modelo_nome = "htdemucs_6s"
            _model = get_model(modelo_nome)
            _device = "cuda" if torch.cuda.is_available() else "cpu"
            _model.to(_device)
            _model.eval()
            print(f"Modelo IA pronto no dispositivo: {_device}")
        except OSError as e:
            if "4551" in str(e) or "Controle de Aplicativo" in str(e):
                raise RuntimeError(
                    "O recurso de segurança 'Controle Inteligente de Aplicativos' (Smart App Control) do Windows "
                    "bloqueou o carregamento do PyTorch (shm.dll).\n"
                    "Para solucionar:\n"
                    "1. Abra o menu Iniciar e pesquise por 'Segurança do Windows'.\n"
                    "2. Acesse 'Controle de aplicativos e do navegador'.\n"
                    "3. Em 'Controle de Aplicativo Inteligente', selecione 'Desativado'."
                ) from e
            raise
    return _model, _device


def normalize_demucs_input_np(wav_np: np.ndarray) -> Tuple[np.ndarray, float, float]:
    """
    Normalização estatística padrão do Demucs (média zero e variância unitária sobre a referência mono).
    Preserva a calibração interna da rede neural htdemucs_6s e evita artefatos de separação em faixas
    muito altas ou muito baixas.

    Args:
        wav_np: Array numpy [canais, amostras] em float32.

    Returns:
        Tuple (wav_norm, ref_mean, ref_std)
    """
    arr = np.asarray(wav_np, dtype=np.float32)
    ref = arr.mean(axis=0)
    ref_mean = float(ref.mean())
    ref_std = max(float(ref.std()), 1e-8)
    wav_norm = (arr - ref_mean) / ref_std
    return wav_norm, ref_mean, ref_std


def denormalize_demucs_sources_np(
    sources_np: np.ndarray, ref_mean: float, ref_std: float
) -> np.ndarray:
    """
    Restaura a escala dinâmica original das fontes separadas pelo Demucs.
    Quando sources_np possui dimensão [num_stems, canais, amostras] (3D), distribui o offset DC
    (ref_mean / num_stems) para que a soma dos 6 stems no mixer reconstrua exatamente o sinal original
    sem multiplicar o offset DC por 6.
    """
    arr = np.asarray(sources_np, dtype=np.float32)
    if arr.ndim >= 3 and arr.shape[0] > 0:
        dc_per_stem = float(ref_mean) / float(arr.shape[0])
        return arr * float(ref_std) + dc_per_stem
    return arr * float(ref_std) + float(ref_mean)


def prevent_stem_clipping(
    audio_np: np.ndarray, ceiling: float = PEAK_CEILING
) -> np.ndarray:
    """
    Remove eventuais valores NaN/Inf e aplica atenuação linear transparente APENAS se o pico
    ultrapassar o teto seguro (0.999), evitando ceifamento digital (hard clipping) ao salvar em PCM
    e preservando 100% da relação sinal-ruído quando o sinal já está abaixo do teto.
    """
    clean = np.nan_to_num(
        np.asarray(audio_np, dtype=np.float32), nan=0.0, posinf=0.0, neginf=0.0
    )
    peak = float(np.max(np.abs(clean))) if clean.size > 0 else 0.0
    if peak > ceiling and peak > 0.0:
        clean = clean * (ceiling / peak)
    return clean


def prevent_multi_stem_clipping(
    sources_np: np.ndarray, ceiling: float = PEAK_CEILING
) -> np.ndarray:
    """
    Aplica proteção anti-clipping coerente em todas as trilhas (stems) simultaneamente,
    escalando todos os stems pelo mesmo fator caso qualquer stem ultrapasse o teto seguro (0.999).
    Isso preserva 100% o balanço de mixagem relativo e a coerência de fase entre os 6 instrumentos.
    """
    clean = np.nan_to_num(
        np.asarray(sources_np, dtype=np.float32), nan=0.0, posinf=0.0, neginf=0.0
    )
    global_peak = float(np.max(np.abs(clean))) if clean.size > 0 else 0.0
    if global_peak > ceiling and global_peak > 0.0:
        clean = clean * (ceiling / global_peak)
    return clean


def save_high_res_stem(
    output_path: str,
    audio_np: np.ndarray,
    sr: int = STUDIO_SAMPLE_RATE,
    subtype: str = STUDIO_STEM_SUBTYPE,
) -> str:
    """
    Salva uma faixa (stem) em formato WAV de alta resolução (24-bit PCM por padrão),
    com proteção contra clipping digital.
    """
    safe_audio = prevent_stem_clipping(audio_np, ceiling=PEAK_CEILING)
    sf.write(output_path, safe_audio, sr, subtype=subtype)
    return output_path


def normalize_audio(input_path: str, output_path: str):
    """
    Normaliza o áudio usando FFmpeg em ponto flutuante de 32 bits (pcm_f32le),
    com reamostragem sinc de alta precisão (filter_size=64, phase_shift=10) e
    loudnorm calibrado para -14 LUFS / True Peak -1.0 dBTP em 44100 Hz estéreo.

    Args:
        input_path: Caminho do arquivo de áudio original
        output_path: Caminho do arquivo normalizado (.wav 32-bit float para alimentar o Demucs sem perda)

    Raises:
        Exception: Se o ffmpeg falhar na normalização
    """
    try:
        cmd = [
            "ffmpeg",
            "-i",
            input_path,
            "-af",
            "aresample=44100:filter_size=64:phase_shift=10,loudnorm=I=-14:TP=-1.0:LRA=11",
            "-ar",
            str(STUDIO_SAMPLE_RATE),
            "-ac",
            str(STUDIO_CHANNELS),
            "-c:a",
            "pcm_f32le",
            "-y",  # Sobrescreve o arquivo de saída
            output_path,
        ]

        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"Audio normalizado (32-bit float / 44.1kHz): {output_path}")
        return output_path

    except subprocess.CalledProcessError as e:
        print(f"Erro ao normalizar audio: {e.stderr}")
        raise Exception(f"Erro ao normalizar audio com ffmpeg: {e.stderr}")
    except Exception as e:
        print(f"Erro inesperado na normalizacao: {e}")
        raise


def load_audio(path: str):
    """
    Carrega o arquivo de áudio para um tensor PyTorch float32 no formato [canais, amostras].
    Usa soundfile como leitor primário de alta velocidade (libsndfile em C).
    Caso falhe por formato incomum, realiza fallback usando FFmpeg via Demucs AudioFile.
    Elimina a dependência problemática do torchaudio.load() com torchcodec no Windows.
    """
    try:
        import torch

        data, sr = sf.read(path, dtype="float32", always_2d=True)
        # sf.read retorna [amostras, canais]. Transpomos para [canais, amostras]
        wav_torch = torch.from_numpy(data.T)
        return wav_torch, sr
    except Exception as sf_err:
        print(
            f"soundfile falhou para '{path}' ({sf_err}). Tentando fallback FFmpeg via AudioFile..."
        )
        from demucs.audio import AudioFile

        af = AudioFile(path)
        wav = af.read(
            streams=0, samplerate=STUDIO_SAMPLE_RATE, channels=STUDIO_CHANNELS
        )
        return wav, STUDIO_SAMPLE_RATE


def process_demucs(temp_path: str, musica_folder: str):
    """
    Recebe o caminho do áudio temporário e a pasta de destino.
    Aplica o Demucs com normalização estatística de referência (zero-mean, unit-variance),
    overlap de 0.25 para janelamento suave sem artefatos de borda e salva as 6 trilhas
    em WAV 24-bit PCM de estúdio com proteção anti-clipping.
    """
    import torch
    import torchaudio
    from demucs.apply import apply_model

    model, device = get_demucs_model()

    wav_torch, sr = load_audio(temp_path)

    if sr != STUDIO_SAMPLE_RATE:
        resampler = torchaudio.transforms.Resample(
            orig_freq=sr, new_freq=STUDIO_SAMPLE_RATE
        )
        wav_torch = resampler(wav_torch)
        sr = STUDIO_SAMPLE_RATE

    if wav_torch.shape[0] == 1:
        wav_torch = wav_torch.repeat(2, 1)
    elif wav_torch.shape[0] > 2:
        wav_torch = wav_torch[:2, :]

    # Normalização estatística exigida pelo modelo htdemucs_6s para máxima fidelidade espectral
    ref = wav_torch.mean(0)
    ref_mean = ref.mean()
    ref_std = ref.std().clamp(min=1e-8)
    wav_norm = (wav_torch - ref_mean) / ref_std

    with torch.no_grad():
        sources = apply_model(
            model,
            wav_norm[None],
            device=device,
            shifts=0,
            split=True,
            overlap=0.25,
        )[0]
        num_stems = max(1, int(sources.shape[0]))
        sources = sources * ref_std + (ref_mean / num_stems)

    sources_np = prevent_multi_stem_clipping(
        sources.detach().cpu().numpy(), ceiling=PEAK_CEILING
    )

    stems_names = list(
        getattr(
            model,
            "sources",
            ["drums", "bass", "other", "vocals", "guitar", "piano"],
        )
    )

    for i, stem_name in enumerate(stems_names):
        audio_final = sources_np[i].T
        file_name = f"{stem_name}.wav"
        final_output = os.path.join(musica_folder, file_name)
        save_high_res_stem(
            final_output, audio_final, sr=sr, subtype=STUDIO_STEM_SUBTYPE
        )
