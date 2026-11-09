import os
import sys
import shutil
import tempfile
import unittest
from unittest.mock import patch, MagicMock
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.audio_service import (
    STUDIO_SAMPLE_RATE,
    STUDIO_CHANNELS,
    STUDIO_STEM_SUBTYPE,
    PEAK_CEILING,
    normalize_demucs_input_np,
    denormalize_demucs_sources_np,
    prevent_stem_clipping,
    prevent_multi_stem_clipping,
    save_high_res_stem,
    normalize_audio,
)


class TestBackendAudioQuality(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="easycovers_audio_test_")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_demucs_reference_normalization_and_exact_inversion(self):
        """
        Verifica que a normalização estatística de entrada do Demucs produz média zero e
        desvio padrão unitário na referência mono, e que a desnormalização recupera o sinal original
        com precisão de ponto flutuante.
        """
        t = np.linspace(0, 1.0, STUDIO_SAMPLE_RATE, endpoint=False, dtype=np.float32)
        left = 0.35 * np.sin(2 * np.pi * 440.0 * t) + 0.05
        right = 0.25 * np.cos(2 * np.pi * 880.0 * t) + 0.05
        stereo = np.stack([left, right], axis=0)

        wav_norm, ref_mean, ref_std = normalize_demucs_input_np(stereo)
        mono_norm = wav_norm.mean(axis=0)

        self.assertAlmostEqual(float(mono_norm.mean()), 0.0, places=5)
        self.assertAlmostEqual(float(mono_norm.std()), 1.0, places=5)

        restored = denormalize_demucs_sources_np(wav_norm, ref_mean, ref_std)
        max_err = float(np.max(np.abs(restored - stereo)))
        self.assertLess(max_err, 1e-6)

    def test_demucs_normalization_handles_digital_silence_safely(self):
        """
        Verifica que um arquivo em silêncio absoluto (std = 0) não gera divisão por zero nem NaNs.
        """
        silence = np.zeros((2, 4096), dtype=np.float32)
        wav_norm, ref_mean, ref_std = normalize_demucs_input_np(silence)
        self.assertTrue(np.all(np.isfinite(wav_norm)))
        self.assertGreaterEqual(ref_std, 1e-8)

    def test_prevent_stem_clipping_preserves_sub_ceiling_and_attenuates_overshoots(self):
        """
        Sinais abaixo de 0.999 devem permanecer 100% bit-exact; sinais com picos > 0.999
        devem ser escalados linearmente (sem achatamento de onda / hard-clipping).
        """
        t = np.linspace(0, 0.1, 4410, endpoint=False, dtype=np.float32)
        clean_sig = (0.85 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        out_clean = prevent_stem_clipping(clean_sig)
        np.testing.assert_array_equal(out_clean, clean_sig)

        hot_sig = (1.45 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        out_hot = prevent_stem_clipping(hot_sig)
        self.assertAlmostEqual(float(np.max(np.abs(out_hot))), PEAK_CEILING, places=5)

        # Verifica que a forma de onda continua senoidal pura (correlação = 1.0)
        corr = float(np.corrcoef(hot_sig, out_hot)[0, 1])
        self.assertAlmostEqual(corr, 1.0, places=6)

        # Verifica limpeza de NaN / Inf
        dirty = np.array([[0.5, np.nan, np.inf, -np.inf]], dtype=np.float32)
        cleaned = prevent_stem_clipping(dirty)
        self.assertTrue(np.all(np.isfinite(cleaned)))

    def test_save_high_res_stem_writes_24bit_pcm_with_superior_snr(self):
        """
        Garante que os stems são salvos em WAV 24-bit PCM (PCM_24) a 44.1 kHz estéreo,
        reduzindo o erro de quantização em ~48 dB comparado ao PCM_16 antigo.
        """
        t = np.linspace(0, 0.25, STUDIO_SAMPLE_RATE // 4, endpoint=False, dtype=np.float32)
        audio = np.stack(
            [0.5 * np.sin(2 * np.pi * 440 * t), 0.5 * np.cos(2 * np.pi * 440 * t)],
            axis=1,
        )

        out_24 = os.path.join(self.temp_dir, "vocals_24.wav")
        out_16 = os.path.join(self.temp_dir, "vocals_16.wav")

        save_high_res_stem(out_24, audio, sr=STUDIO_SAMPLE_RATE)
        sf.write(out_16, audio, STUDIO_SAMPLE_RATE, subtype="PCM_16")

        info_24 = sf.info(out_24)
        self.assertEqual(info_24.samplerate, STUDIO_SAMPLE_RATE)
        self.assertEqual(info_24.channels, STUDIO_CHANNELS)
        self.assertEqual(info_24.subtype, STUDIO_STEM_SUBTYPE)

        read_24, _ = sf.read(out_24, dtype="float32")
        read_16, _ = sf.read(out_16, dtype="float32")

        err_24 = float(np.max(np.abs(read_24 - audio)))
        err_16 = float(np.max(np.abs(read_16 - audio)))
        self.assertLess(err_24, err_16 * 0.01)

    @patch("app.services.audio_service.subprocess.run")
    def test_normalize_audio_uses_32bit_float_and_sinc_resampler(self, mock_run):
        """
        Verifica que normalize_audio invoca o FFmpeg com codec pcm_f32le (32-bit float)
        e filtro aresample de alta precisão em 44100 Hz estéreo.
        """
        mock_run.return_value = MagicMock(returncode=0)
        in_path = os.path.join(self.temp_dir, "input.wav")
        out_path = os.path.join(self.temp_dir, "normalized.wav")

        result = normalize_audio(in_path, out_path)
        self.assertEqual(result, out_path)
        mock_run.assert_called_once()

        cmd = mock_run.call_args[0][0]
        self.assertIn("pcm_f32le", cmd)
        self.assertIn("44100", cmd)
        af_idx = cmd.index("-af") + 1
        self.assertIn("aresample=44100:filter_size=64:phase_shift=10", cmd[af_idx])
        self.assertIn("loudnorm=I=-14:TP=-1.0:LRA=11", cmd[af_idx])

    def test_upload_router_does_not_transcode_to_lossy_mp3(self):
        """
        Verifica que o roteador de upload extrai o áudio em WAV sem perda (preferredcodec='wav')
        em vez de comprimir para MP3 192kbps antes do Demucs.
        """
        upload_router_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "app", "routers", "upload.py")
        )
        with open(upload_router_path, "r", encoding="utf-8") as f:
            source = f.read()

        self.assertNotIn("'preferredcodec': 'mp3'", source)
        self.assertIn("'preferredcodec': 'wav'", source)

    def test_multi_stem_coherence_and_dc_offset_distribution(self):
        """
        Verifica que a desnormalização 3D de 6 stems não multiplica o offset DC por 6 ao somar
        as faixas no mixer, e que prevent_multi_stem_clipping preserva a proporção exata de volume
        entre os instrumentos quando algum stem ultrapassa PEAK_CEILING.
        """
        t = np.linspace(0, 0.1, 4410, endpoint=False, dtype=np.float32)
        mix = np.stack(
            [0.6 * np.sin(2 * np.pi * 220 * t) + 0.03, 0.4 * np.cos(2 * np.pi * 440 * t) + 0.03],
            axis=0,
        )
        wav_norm, ref_mean, ref_std = normalize_demucs_input_np(mix)

        # Divide o mix normalizado em 6 stems proporcionais cuja soma é exatamente wav_norm
        weights = np.array([0.25, 0.20, 0.15, 0.20, 0.10, 0.10], dtype=np.float32)[:, None, None]
        sources_norm = weights * wav_norm[None, :, :]

        denorm_stems = denormalize_demucs_sources_np(sources_norm, ref_mean, ref_std)
        reconstructed_mix = denorm_stems.sum(axis=0)
        max_reconstruction_err = float(np.max(np.abs(reconstructed_mix - mix)))
        self.assertLess(max_reconstruction_err, 1e-5)

        # Testa atenuação coerente entre stems quando o stem 0 tem pico > PEAK_CEILING (1.25)
        hot_stems = np.zeros((6, 2, 100), dtype=np.float32)
        hot_stems[0, :, :] = 1.25  # drums acima do teto
        hot_stems[1, :, :] = 0.50  # bass abaixo do teto (proporção drums/bass = 2.5)

        safe_stems = prevent_multi_stem_clipping(hot_stems, ceiling=PEAK_CEILING)
        self.assertAlmostEqual(float(np.max(np.abs(safe_stems))), PEAK_CEILING, places=5)
        ratio_after = float(safe_stems[0, 0, 0] / safe_stems[1, 0, 0])
        self.assertAlmostEqual(ratio_after, 2.5, places=5)

    def test_ydl_robust_options(self):
        """
        Verifica se as configurações do yt-dlp contêm proteção contra quedas de CDN
        (http_chunk_size, extractor_args android/web, source_address IPv4 e retries).
        """
        from app.routers.upload import _build_ydl_options
        opts = _build_ydl_options("test_uuid", ffmpeg_threads=2)
        self.assertIn('http_chunk_size', opts)
        self.assertGreater(opts['http_chunk_size'], 0)
        self.assertEqual(opts.get('source_address'), '0.0.0.0')
        self.assertIn('extractor_args', opts)
        self.assertIn('android', opts['extractor_args']['youtube']['player_client'])
        self.assertGreaterEqual(opts.get('retries', 0), 5)
        self.assertGreaterEqual(opts.get('socket_timeout', 0), 20)


if __name__ == "__main__":
    unittest.main()
