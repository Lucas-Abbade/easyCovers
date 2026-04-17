import os
import torch
import librosa
import soundfile as sf
import numpy as np
from demucs.apply import apply_model
from demucs.pretrained import get_model

print("--- Inicializando IA (Demucs) ---")
modelo_nome = "htdemucs"
model = get_model(modelo_nome)
model.cpu() 
print("Modelo IA pronto!")

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