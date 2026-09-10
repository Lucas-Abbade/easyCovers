# 🎵 EasyCovers — Identidade Visual Completa

> Todos os assets gerados respeitam a paleta de cores atual do projeto e o contexto musical da aplicação.

---

## 🎨 Paleta de Cores

| Token | Hex | Uso |
|---|---|---|
| `--color-brand-light` | `#D1E8FF` | Fundo de páginas, badges claros |
| `--color-brand-medium` | `#2B69E6` | Cor principal — botões, destaques, links |
| `--color-brand-dark` | `#1A3F99` | Hover de botões, bordas de ênfase |
| `--color-brand-deep` | `#0E1F4C` | Texto escuro, títulos, fundos de seção |

---

## 🏷️ Logo Principal

![Logo EasyCovers — símbolo EC + nota musical com gradiente azul](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\easycovers_logo_1789063227191.jpg)

**Conceito:** As letras "E" e "C" foram fundidas com o formato de uma nota musical, criando um símbolo único. O gradiente vai de `#2B69E6` (azul vibrante) a `#0E1F4C` (azul noite), reforçando a identidade musical e tecnológica.

**Usos recomendados:**
- Header/navbar de todas as páginas
- Splash screen de carregamento
- E-mails transacionais

---

## 📱 Favicon / Ícone do App

![Favicon — nota musical em badge azul gradiente](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\easycovers_favicon_1789063340070.jpg)

**Conceito:** Versão simplificada do logo para uso em tamanhos pequenos — uma nota musical branca sobre badge azul. Legível a 16×16px.

**Usos recomendados:**
- `<link rel="icon">` no HTML
- Aba do navegador
- Ícone de PWA

---

## 🌅 Fundo da Tela de Login

![Hero background para tela de login — fundo azul noite com elementos musicais iluminados](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\login_hero_background_1789063237381.jpg)

**Conceito:** Cena atmosférica cinematográfica com fundo escuro (`#0E1F4C`) e efeitos de luz azul `#2B69E6`. Elementos flutuantes: claves de sol, notas musicais, ondas sonoras, equalizador e silhuetas de guitarra e teclado. Bokeh de partículas de luz no espaço.

**Uso recomendado:**
```jsx
// Em Login.jsx — como background à direita do form (layout split-screen)
<div style={{ backgroundImage: `url('/assets/login_hero_background.jpg')` }} 
     className="hidden lg:flex flex-1 bg-cover bg-center" />
```

---

## 🎚️ Fundo da Página de Mixer/Estúdio

![Background para página de mixer — faixas de áudio glowing sobre fundo escuro](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\mixer_page_background_1789063304094.jpg)

**Conceito:** Representa visualmente uma DAW (Digital Audio Workstation) com múltiplas faixas de áudio em azul neon sobre fundo escuro, remetendo ao contexto de edição de stems do EasyCovers.

**Uso recomendado:**
- Como banner no topo da página Mixer
- Como fundo com `opacity-20` no container da página

---

## 🗂️ Padrão de Fundo — Dashboard

![Padrão de fundo para dashboard — notas musicais sutis sobre azul claro](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\dashboard_bg_pattern_1789063245963.jpg)

**Conceito:** Textura tileable levíssima em `#D1E8FF` com símbolos musicais minúsculos — notas, claves, equalizadores, ondas — em azul apenas 12% de opacidade. Funciona como background sem distrair o conteúdo.

**Uso recomendado:**
```css
/* Como background-image da página Dashboard */
background-image: url('/assets/dashboard_bg_pattern.jpg');
background-size: 400px 400px;
background-repeat: repeat;
```

---

## 🎸 Ícones de Instrumentos

![Set de ícones de instrumentos musicais — 8 ícones em badges azuis](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\icon_sheet_instruments_1789063275509.jpg)

**Conteúdo do set:**
1. 🎸 Guitarra Elétrica
2. 🥁 Bateria
3. 🎹 Piano (grand piano)
4. 🎸 Baixo
5. 🎻 Violino
6. 🎤 Microfone
7. 🎷 Saxofone
8. 🎺 Trompete

**Uso recomendado:**
- Cards de músicas no Dashboard (identificar instrumento da faixa)
- Select de instrumento na página de Upload
- Perfil do usuário (instrumento principal)

> **Nota:** Os ícones na linha de baixo (mais claros) representam o estado **inativo/selecionado** — podem ser usados como estados alternativos.

---

## 🖱️ Ícones de Ações da Interface

![Set de ícones de UI — play, upload, waveform, scissors, mixer, headphones, YouTube, download](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\icon_sheet_ui_actions_1789063284536.jpg)

**Conteúdo do set (linha 1):**
1. ▶️ Play — reproduzir faixa
2. ☁️⬆️ Upload cloud — enviar arquivo
3. 〰️ Waveform — visualização de áudio
4. ✂️ Scissors — separar stems (IA)

**Conteúdo do set (linha 2):**
5. 🎛️ Sliders — mixer/ajustar volumes
6. 🎵 Nota musical — biblioteca
7. 📋▶️ Lista com play — fila/playlist
8. ☁️⬇️ Download cloud — baixar faixa

**Conteúdo do set (linha 3):**
9. 🎛️ Faders — controles avançados
10. 🎧 Headphones — modo escuta
11. ▶️⬛ YouTube — importar do YouTube
12. ☁️⬇️ Download — exportar

**Uso recomendado:**
- Botões de ação em cards de música no Dashboard
- Toolbar do Mixer
- Botões da página de Upload

---

## 🖼️ Ilustrações de Página

### Empty State — Biblioteca Vazia

![Ilustração empty state — nota musical saindo de pasta aberta vazia](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\empty_state_music_library_1789063293792.jpg)

**Uso:** Exibir quando o usuário não tem músicas na biblioteca. Adicionar texto abaixo:
> *"Sua biblioteca está vazia. Adicione sua primeira música!"*

---

### Ilustração — Página de Upload

![Ilustração da página de upload — laptop com notas musicais subindo para nuvem](C:\Users\Muril\.gemini\antigravity\brain\ad49180b-1eca-4e02-83d1-cb0812e8ac35\upload_page_illustration_1789063351544.jpg)

**Uso:** Banner ilustrativo no topo ou lateral da página de Upload para tornar o fluxo mais visual e acolhedor.

---

## 📐 Guia de Aplicação por Página

| Página | Background | Ilustração | Ícones |
|---|---|---|---|
| **Login** | Hero background (login_hero_background) | Logo + nome | — |
| **Dashboard** | Dashboard pattern | Empty state (se vazio) | Ícones de instrumento nos cards |
| **Upload** | Brand light (`#D1E8FF`) | Upload illustration | Upload cloud, YouTube, waveform |
| **Mixer** | Mixer background | — | Play, sliders, headphones, scissors |
| **Perfil** | Brand light | — | Ícone do instrumento principal |

---

## 💡 Próximos Passos

- [ ] Exportar os ícones individuais como SVG para uso inline no React
- [ ] Criar variantes dark/light do logo (para fundo escuro do Mixer)
- [ ] Gerar animação de loading com a nota musical do favicon girando
- [ ] Criar card visual de música com os ícones de instrumento
