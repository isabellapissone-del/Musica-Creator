import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set payload limit to 50MB to comfortably support MP3 and WAV files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Endpoint to process audio and create alternative song version
app.post('/api/create-alternative', async (req, res) => {
  try {
    const { audioBase64, mimeType, fileName } = req.body;

    if (!audioBase64) {
      return res.status(400).json({
        error: 'Nenhum ficheiro de áudio foi enviado. Por favor seleciona um ficheiro MP3 ou WAV.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Chave da API Gemini não configurada no servidor. Por favor verifica as variáveis de ambiente.',
      });
    }

    // Validate MIME type
    const validMimes = [
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/m4a',
      'audio/aac',
      'audio/x-m4a',
      'audio/webm',
    ];

    const normalizedMime = (mimeType || 'audio/mp3').toLowerCase();
    const isMimeValid = validMimes.includes(normalizedMime) || normalizedMime.startsWith('audio/');
    if (!isMimeValid) {
      return res.status(400).json({
        error: 'Formato de áudio não suportado. Por favor envia um ficheiro MP3 ou WAV válido.',
      });
    }

    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, '');

    // Size sanity check (max ~25MB of binary data, which is ~35MB in base64)
    if (cleanBase64.length > 36 * 1024 * 1024) {
      return res.status(413).json({
        error: 'O ficheiro de áudio é demasiado grande. O tamanho máximo permitido é de 25 MB.',
      });
    }

    // Initialize Gemini client with telemetry header
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `És um produtor musical consagrado, engenheiro de som e letrista profissional de altíssima precisão métrica.
A tua missão é ouvir com a máxima atenção o ficheiro de áudio da música original fornecida e gerar uma versão alternativa em texto com fidelidade milimétrica às características musicais e métricas da obra.

1. IDIOMA E REGRA LINGUÍSTICA INEGOCIÁVEL:
   - A DESCRIÇÃO DO ESTILO MUSICAL ("estilo"), todos os seus detalhes e campos explicativos DEVEM FICAR SEMPRE EM PORTUGUÊS DE PORTUGAL (vocabulário europeu como "ficheiro", "ecrã", "bateria", "eco", sintaxe e ortografia de Portugal, nunca brasileira), independentemente do idioma da música original.
   - IDIOMA DA LETRA ALTERNATIVA: Deteta o idioma cantado na música original:
     * Se for Português: escreve a letra obrigatoriamente em Português de Portugal (vocabulário, ortografia e expressões europeias, nunca brasileiras).
     * Se for Inglês: escreve a letra em Inglês internacional neutro, fluído e poético, sem gíria regional.
     * Se for outro idioma (ex: Francês, Espanhol, Italiano, Alemão, etc.): mantém exatamente esse idioma original da canção.
     * Se a música for estritamente instrumental: escreve a letra em Português de Portugal.
   - Devolve no campo "idiomaLetra" o nome do idioma detetado e utilizado (ex: "Português (Portugal)", "Inglês (Internacional)", "Francês", "Espanhol", etc.).

2. ANÁLISE E DESCRIÇÃO DO ESTILO MUSICAL COM MÁXIMA FIDELIDADE (SEMPRE EM PORTUGUÊS DE PORTUGAL):
   - Descreve o estilo da música original com o máximo de fidelidade possível, cobrindo:
     * Género musical principal e subgéneros estilísticos minuciosos.
     * BPM exato ou estimado com precisão (ex: "124 BPM").
     * Tom musical e escala (ex: "Fá menor / Fm", "Dó Maior / C").
     * Instrumentação minuciosa (especifica tipos de instrumentos, timbres, sintetizadores, guitarras acústicas/elétricas, percussão, baixo e linhas melódicas).
     * Tipo de voz e performance vocal (tessitura, colocação, dinâmica, respirações, técnica vocal, se masculina, feminina, dueto ou instrumental).
     * Atmosfera e ambiência sonora (ex: "cinematográfica e melancólica, nostálgica, envolvente").
     * Produção e engenharia de áudio (mixagem, posicionamento estéreo, reverberação, delays de fita, compressão, saturação harmónica, estética analógica ou digital limpa).
   - "tags": Gera uma lista rica e especializada de etiquetas de estilo que permitam a um produtor musical ou ferramenta de síntese de áudio (como Suno, Udio, etc.) recriar o som de forma quase idêntica (exemplo: ["indie pop nostálgico", "116 BPM", "Lá menor (Am)", "guitarra elétrica com chorus límpido", "baixo elétrico com palheta", "bateria acústica quente", "voz feminina intimista e sussurrada com delay", "atmosfera melancólica de outono", "produção analógica vintage"]).

3. CRIAÇÃO DA NOVA LETRA COM ENCAIXE MELÓDICO E MÉTRICO PERFEITO:
   - Escreve uma letra nova que siga DE MUITO PERTO a original em:
     * Idioma: segundo a regra linguística acima.
     * Tema central e tom lírico da música.
     * Emoção e intensidade dramática a cada momento.
     * Narrativa e progressão da história ao longo das estrofes.
     * Número exato de versos por secção:
       [Verso]
       [Refrão]
       [Verso 2]
       [Refrão]
       [Ponte]
       (podes incluir [Refrão Final] ou [Outro] se a música original tiver essa estrutura).
     * Número aproximado de sílabas métricas por verso, para que a nova letra encaixe com perfeição na melodia original (mesmo compasso rítmico, pausas e acentuações tónicas).
     * Esquema de rimas fiel ao da canção original (ex: AABB, ABAB, ABCB).
   - REGRAS FUNDAMENTAIS E INEGOCIÁVEIS:
     * Usa palavras, imagens poéticas e metáforas completamente diferentes da música original.
     * NUNCA copies frases, expressões ou linhas da letra original.

4. LIMITES OBRIGATÓRIOS DE CARACTERES (RIGOROSAMENTE EXIGIDOS):
   - "letra": DEVE TER NO MÁXIMO 4500 CARACTERES (incluindo as marcações de secção [Verso], [Refrão], [Ponte], quebras de linha e pontuação).
   - "estilo": O estilo musical (descrição, etiquetas e parâmetros somados) DEVE TER NO MÁXIMO 950 CARACTERES.
   - ANTES DE DEVOLVER: Conta os caracteres de cada campo e confirma que cumprem rigorosamente estes limites. Se ultrapassar, resume e reescreve até caber.

Devolve estritamente o JSON com os campos "letra", "estilo" e "idiomaLetra".`;

    const userPrompt = `Ouve atentamente a música (${fileName || 'faixa de áudio'}). 
1. Descreve o estilo da música original sempre em Português de Portugal com o máximo de fidelidade possível (género, BPM, tom, instrumentos, tipo de voz, atmosfera, produção) e gera etiquetas que permitam recriar o som quase idêntico.
2. Deteta o idioma da música original e escreve a letra alternativa nesse mesmo idioma:
   - Se for português, usa português de Portugal (vocabulário, ortografia e expressões europeias, nunca brasileiras).
   - Se for inglês, usa inglês internacional neutro, sem gíria regional.
   - Se for outro idioma, mantém o idioma original da canção.
3. Escreve a letra nova para seguir de muito perto a original em tema, emoção, narrativa, número de versos por secção, número aproximado de sílabas por verso e esquema de rimas, para que encaixe na mesma melodia cantada, usando palavras e imagens diferentes e sem copiar frases da original.
4. CUMPRE RIGOROSAMENTE OS LIMITES DE CARACTERES: A letra deve ter no máximo 4500 caracteres e o estilo musical no máximo 950 caracteres. Conta os caracteres e resume antes de devolver.`;

    // Audio MIME type mapping for Gemini
    let geminiMime = normalizedMime;
    if (geminiMime === 'audio/wave' || geminiMime === 'audio/x-wav') {
      geminiMime = 'audio/wav';
    } else if (geminiMime === 'audio/mpeg') {
      geminiMime = 'audio/mp3';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: geminiMime,
            data: cleanBase64,
          },
        },
        {
          text: userPrompt,
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            idiomaLetra: {
              type: Type.STRING,
              description: 'Idioma detetado na música e aplicado à letra (ex: "Português (Portugal)", "Inglês (Internacional)", "Francês", etc.).',
            },
            letra: {
              type: Type.STRING,
              description: 'Letra alternativa totalmente original no idioma detetado da música, estruturada em [Verso], [Refrão], [Verso 2], [Refrão], [Ponte], que segue de muito perto o tema, emoção, narrativa, número de versos por secção, contagem de sílabas métricas e esquema de rimas da canção original.',
            },
            estilo: {
              type: Type.OBJECT,
              properties: {
                descricao: {
                  type: Type.STRING,
                  description: 'Parágrafo detalhado sempre em Português de Portugal descrevendo o estilo da música original com o máximo de fidelidade (género, BPM, tom, instrumentos, tipo de voz, atmosfera e produção).',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Etiquetas de estilo precisas e minuciosas sempre em Português de Portugal que permitem recriar o som quase idêntico.',
                },
                tema: { type: Type.STRING, description: 'Tema lírico e conceptual identificado (em Português de Portugal)' },
                emocao: { type: Type.STRING, description: 'Emoção e vibração predominante (em Português de Portugal)' },
                genero: { type: Type.STRING, description: 'Género musical e subgéneros (em Português de Portugal)' },
                bpm: { type: Type.STRING, description: 'Tempo / BPM preciso' },
                tom: { type: Type.STRING, description: 'Tom ou tonalidade musical (ex: Fá menor)' },
                instrumentos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Instrumentos, texturas e timbres identificados (em Português de Portugal)',
                },
                tipoVoz: { type: Type.STRING, description: 'Tipo, timbre e características da voz (em Português de Portugal)' },
                atmosfera: { type: Type.STRING, description: 'Atmosfera e ambiência sonora (em Português de Portugal)' },
                producao: { type: Type.STRING, description: 'Técnicas de produção, mixagem e efeitos de som (em Português de Portugal)' },
                esquemaRimas: { type: Type.STRING, description: 'Esquema de rimas seguido (ex: ABAB)' },
                estruturaMetrica: { type: Type.STRING, description: 'Métrica silábica e cadência para encaixe na melodia' },
              },
              required: ['descricao', 'tags'],
            },
          },
          required: ['letra', 'estilo'],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('O modelo não devolveu texto.');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      // Fallback: search for JSON block
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Falha ao interpretar a resposta JSON do modelo.');
      }
    }

    // Helper to calculate total character count of the style text representation
    const formatStyleForCount = (style: any): string => {
      if (!style) return '';
      if (typeof style === 'string') return style.trim();
      const parts: string[] = [];
      if (style.descricao) parts.push(style.descricao.trim());
      if (style.tags && Array.isArray(style.tags) && style.tags.length > 0) {
        parts.push(`Etiquetas: ${style.tags.join(', ')}`);
      }
      const details: string[] = [];
      if (style.bpm) details.push(`BPM: ${style.bpm}`);
      if (style.tom) details.push(`Tom: ${style.tom}`);
      if (style.genero) details.push(`Género: ${style.genero}`);
      if (style.emocao) details.push(`Emoção: ${style.emocao}`);
      if (style.tipoVoz) details.push(`Voz: ${style.tipoVoz}`);
      if (style.atmosfera) details.push(`Atmosfera: ${style.atmosfera}`);
      if (style.producao) details.push(`Produção: ${style.producao}`);
      if (style.instrumentos && Array.isArray(style.instrumentos) && style.instrumentos.length > 0) {
        details.push(`Instrumentos: ${style.instrumentos.join(', ')}`);
      }
      if (details.length > 0) {
        parts.push(`Parâmetros: ${details.join(' · ')}`);
      }
      return parts.join('\n\n').trim();
    };

    const MAX_LETRA_CHARS = 4500;
    const MAX_ESTILO_CHARS = 950;

    let currentLetra = parsedResult.letra || '';
    let currentEstilo = parsedResult.estilo;
    let styleText = formatStyleForCount(currentEstilo);

    // If either exceeds the limit, rewrite and summarize
    if (currentLetra.length > MAX_LETRA_CHARS || styleText.length > MAX_ESTILO_CHARS) {
      console.log(`Excedeu limites (Letra: ${currentLetra.length}/${MAX_LETRA_CHARS}, Estilo: ${styleText.length}/${MAX_ESTILO_CHARS}). A resumir...`);
      try {
        const rewriteRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              text: `O resultado anterior ultrapassou os limites estritos de caracteres.
LIMITES OBRIGATÓRIOS:
1. "letra": MÁXIMO 4500 CARACTERES (atualmente: ${currentLetra.length}). Resume a letra mantendo as secções [Verso], [Refrão], [Ponte], métrica e melodia, garantindo estritamente menos de 4500 caracteres.
2. "estilo": MÁXIMO 950 CARACTERES (atualmente: ${styleText.length}). Resume a descrição e parâmetros em Português de Portugal para garantir estritamente menos de 950 caracteres no total.

CONTEÚDO ANTERIOR:
Letra:
${currentLetra}

Estilo:
${JSON.stringify(currentEstilo)}

Devolve o JSON com "letra", "estilo" e "idiomaLetra" garantindo o cumprimento absoluto dos limites.`,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                idiomaLetra: { type: Type.STRING },
                letra: { type: Type.STRING },
                estilo: {
                  type: Type.OBJECT,
                  properties: {
                    descricao: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    bpm: { type: Type.STRING },
                    tom: { type: Type.STRING },
                    genero: { type: Type.STRING },
                    emocao: { type: Type.STRING },
                    tipoVoz: { type: Type.STRING },
                    atmosfera: { type: Type.STRING },
                    producao: { type: Type.STRING },
                    instrumentos: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['descricao', 'tags'],
                },
              },
              required: ['letra', 'estilo'],
            },
          },
        });

        if (rewriteRes.text) {
          const reParsed = JSON.parse(rewriteRes.text);
          if (reParsed.letra) currentLetra = reParsed.letra;
          if (reParsed.estilo) currentEstilo = reParsed.estilo;
          if (reParsed.idiomaLetra) parsedResult.idiomaLetra = reParsed.idiomaLetra;
        }
      } catch (err) {
        console.warn('Erro ao condensar com modelo:', err);
      }
    }

    // Safety fallback: guarantee 100% compliance with character limits
    if (currentLetra.length > MAX_LETRA_CHARS) {
      let cutIdx = currentLetra.lastIndexOf('\n', MAX_LETRA_CHARS);
      if (cutIdx === -1 || cutIdx < MAX_LETRA_CHARS - 300) {
        cutIdx = currentLetra.lastIndexOf('.', MAX_LETRA_CHARS);
      }
      if (cutIdx === -1 || cutIdx < 2000) cutIdx = MAX_LETRA_CHARS;
      currentLetra = currentLetra.slice(0, cutIdx).trim();
    }

    let finalStyleLen = formatStyleForCount(currentEstilo).length;
    if (finalStyleLen > MAX_ESTILO_CHARS) {
      if (typeof currentEstilo === 'object' && currentEstilo !== null) {
        const excess = finalStyleLen - MAX_ESTILO_CHARS;
        const desc = currentEstilo.descricao || '';
        if (desc.length > excess + 40) {
          currentEstilo.descricao = desc.slice(0, desc.length - excess - 10).trim() + '...';
        } else if (Array.isArray(currentEstilo.tags) && currentEstilo.tags.length > 4) {
          currentEstilo.tags = currentEstilo.tags.slice(0, 4);
        }
      } else if (typeof currentEstilo === 'string') {
        currentEstilo = currentEstilo.slice(0, MAX_ESTILO_CHARS).trim();
      }
    }

    parsedResult.letra = currentLetra;
    parsedResult.estilo = currentEstilo;

    return res.json(parsedResult);
  } catch (error: any) {
    console.error('Erro ao processar música com Gemini:', error);

    const errorMessage = error?.message || '';
    if (errorMessage.includes('API key not valid') || errorMessage.includes('invalid api key')) {
      return res.status(401).json({
        error: 'Chave da API Gemini inválida ou não autorizada. Verifica as tuas credenciais.',
      });
    }

    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      return res.status(429).json({
        error: 'Limite de quota do modelo Gemini atingido. Por favor aguarda alguns momentos antes de tentar novamente.',
      });
    }

    if (errorMessage.includes('SAFETY') || errorMessage.includes('blocked')) {
      return res.status(400).json({
        error: 'O áudio foi filtrado pelos critérios de segurança do modelo.',
      });
    }

    return res.status(500).json({
      error: errorMessage || 'Falha ao processar o áudio com o modelo Gemini. Por favor tenta novamente.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Music Creator server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
