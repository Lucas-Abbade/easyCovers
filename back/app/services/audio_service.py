import os
import torch
import librosa
import soundfile as sf
import numpy as np
import subprocess
from demucs.apply import apply_model
from demucs.pretrained import get_model

print("--- Inicializando IA (Demucs) ---")
modelo_nome = "htdemucs"
model = get_model(modelo_nome)
model.cpu() 
print("Modelo IA pronto!")

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
        print(f"✓ Áudio normalizado: {output_path}")
        return output_path
    
    except subprocess.CalledProcessError as e:
        print(f"✗ Erro ao normalizar áudio: {e.stderr}")
        raise Exception(f"Erro ao normalizar áudio com ffmpeg: {e.stderr}")
    except Exception as e:
        print(f"✗ Erro inesperado na normalização: {e}")
        raise

def process_demucs(temp_path: str, musica_folder: str):
    """
    Recebe o caminho do áudio temporário e a pasta de destino.
    Aplica o Demucs e salva as 4 trilhas na pasta.
    """
    wav_np, sr = librosa.load(temp_path, sr=44100, mono=False)
    if wav_np.ndim == 1: wav_np = np.stack([wav_np, wav_np])
    wav_torch = torch.from_numpy(wav_np)
    
    sources = apply_model(model, wav_torch[None], device="cpu")[0]
    stems_names = ["drums", "bass", "other", "vocals"]

    for i, stem_name in enumerate(stems_names):
        audio_final = sources[i].numpy().T
        file_name = f"{stem_name}.wav"
        final_output = os.path.join(musica_folder, file_name)
        sf.write(final_output, audio_final, sr)