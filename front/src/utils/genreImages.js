/**
 * Mapeamento de imagens de ambientação para cada gênero musical.
 * Todas as imagens possuem proporção quadrada (1:1) com estética de ambientação
 * e são compartilhadas tanto pelo modo de exibição em linha quanto pelo modo em grade.
 */

export const GENRE_IMAGES = {
  "Rock": "/assets/genres/genre_rock.jpg",
  "Heavy Metal": "/assets/genres/genre_heavy_metal.jpg",
  "Grunge": "/assets/genres/genre_grunge.jpg",
  "Indie Rock": "/assets/genres/genre_indie_rock.jpg",
  "Rock Progressivo": "/assets/genres/genre_rock_progressivo.jpg",
  "Blues Rock": "/assets/genres/genre_blues_rock.jpg",
  "Pop": "/assets/genres/genre_default.jpg",
  "Samba": "/assets/genres/genre_samba.jpg",
  "Bossa Nova": "/assets/genres/genre_bossa_nova.jpg",
  "MPB": "/assets/genres/genre_mpb.jpg",
  "Sertanejo": "/assets/genres/genre_sertanejo.jpg",
  "Eletrônica": "/assets/genres/genre_default.jpg",
  "Jazz": "/assets/genres/genre_bossa_nova.jpg",
  "R&B / Soul": "/assets/genres/genre_blues_rock.jpg",
  "Hip-Hop / Rap": "/assets/genres/genre_default.jpg",
  "Reggae": "/assets/genres/genre_mpb.jpg",
  "Música Clássica": "/assets/genres/genre_musica_classica.jpg",
};

export const AVAILABLE_GENRES = Object.keys(GENRE_IMAGES);

export const DEFAULT_GENRE_IMAGE = "/assets/genres/genre_default.jpg";

// Função para normalização de strings (remove acentos e espaços extras para matching tolerante)
const normalizeKey = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Mapa normalizado para lookup rápido e seguro
const normalizedMap = Object.entries(GENRE_IMAGES).reduce((acc, [genre, path]) => {
  acc[normalizeKey(genre)] = path;
  return acc;
}, {});

/**
 * Retorna o caminho da imagem de ambientação associada a um gênero.
 * @param {string} genre - Nome do gênero musical
 * @returns {string} Caminho da imagem correspondente ou imagem padrão de estúdio
 */
export const getGenreImage = (genre) => {
  if (!genre) return DEFAULT_GENRE_IMAGE;
  
  // 1. Tenta correspondência exata
  if (GENRE_IMAGES[genre]) {
    return GENRE_IMAGES[genre];
  }

  // 2. Tenta correspondência normalizada (sem acento, case-insensitive)
  const norm = normalizeKey(genre);
  if (normalizedMap[norm]) {
    return normalizedMap[norm];
  }

  // 3. Fallback de correspondência parcial
  for (const [key, path] of Object.entries(normalizedMap)) {
    if (norm.includes(key) || key.includes(norm)) {
      return path;
    }
  }

  return DEFAULT_GENRE_IMAGE;
};

