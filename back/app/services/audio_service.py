import os
import torch
import torchaudio
import soundfile as sf
import numpy as np
import subprocess
from demucs.apply import apply_model
from demucs.pretrained import get_model

print("--- Inicializando IA (Demucs) ---")
modelo_nome = "htdemucs_6s"
model = get_model(modelo_nome)
device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)
print(f"Modelo IA pronto no dispositivo: {device}")

def normalize_audio(input_path: str, output_path: str):
    """
    Normaliza o áudio usando ffmpeg com o filtro loudnorm.
    
    Args:
        input_path: Caminho do arquivo de áudio original
        output_path: Caminho do arquivo normalizado
    
    Raises:
        Exception: Se o ffmpeg falhar na normalização
    """
    try:
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-y',  # Sobrescreve o arquivo de saída
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"Audio normalizado: {output_path}")
        return output_path
    
    except subprocess.CalledProcessError as e:
        print(f"Erro ao normalizar audio: {e.stderr}")
        raise Exception(f"Erro ao normalizar audio com ffmpeg: {e.stderr}")
    except Exception as e:
        print(f"Erro inesperado na normalizacao: {e}")
        raise

def process_demucs(temp_path: str, musica_folder: str):
    """
    Recebe o caminho do áudio temporário e a pasta de destino.
    Aplica o Demucs e salva as 6 trilhas na pasta.
    """
    wav_torch, sr = torchaudio.load(temp_path)
    if sr != 44100:
        resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=44100)
        wav_torch = resampler(wav_torch)
        sr = 44100

    if wav_torch.shape[0] == 1:
        wav_torch = wav_torch.repeat(2, 1)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    sources = apply_model(model, wav_torch[None], device=device, shifts=0, overlap=0.1, segment=7)[0]
    stems_names = ["drums", "bass", "other", "vocals", "guitar", "piano"]

    for i, stem_name in enumerate(stems_names):
        audio_final = sources[i].numpy().T
        file_name = f"{stem_name}.wav"
        final_output = os.path.join(musica_folder, file_name)
        sf.write(final_output, audio_final, sr)