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
   - A DESCRIÇÃO DO ESTILO MUSICAL ("estilo"), todos os seus detalhes e campos explicativos DEVEM FICAR SEMPRE EM PORTUGUÊS DE PORTUGAL (vocabulário europeu como "ficheiro", "ecrã", "bateria", "eco", "mistura", sintaxe e ortografia de Portugal, nunca brasileira), independentemente do idioma da música original.
   - IDIOMA DA LETRA ALTERNATIVA (quando houver letra):
     * Se a música original for em Português: escreve a letra obrigatoriamente em Português de Portugal (vocabulário, ortografia e expressões europeias, nunca brasileiras).
     * Se for em Inglês: escreve a letra em Inglês internacional neutro, fluído e poético, sem gíria regional.
     * Se for noutro idioma (ex: Francês, Espanhol, Italiano, Alemão, etc.): mantém exatamente esse idioma original da canção.
   - Devolve no campo "idiomaLetra" o nome do idioma detetado (ex: "Português (Portugal)", "Inglês (Internacional)", etc.).

2. DETEÇÃO OBRIGATÓRIA DE MODO INSTRUMENTAL (BATIDA / BEAT):
   - Ouve atentamente se a faixa possui canto lírico com letra contínua.
   - SE A MÚSICA NÃO TIVER VOZ NEM LETRA, OU TIVER APENAS VOZES PONTUAIS (como samples vocais cortados, ad-libs, repetições de palavras soltas ou efeitos de DJ):
     * Define OBRIGATORIAMENTE 'isInstrumental': true.
     * No campo 'letra': coloca EXATAMENTE o texto "Instrumental: sem letra".
     * No campo 'estilo': descreve a batida com o MÁXIMO DE FIDELIDADE POSSÍVEL:
       - BPM (ex: "130 BPM")
       - Compasso (ex: "4/4")
       - Tom e escala (ex: "Dó menor / Cm")
       - Swing / Groove (ex: "shuffle swingado com síncope", "reto e preciso", "trap bounce com hi-hats em tercinas")
       - Padrão de bateria (kick firme, snare/clap na 2ª e 4ª batidas, hi-hats com rolls, percussão com shakers)
       - Linha de baixo (ex: sub-grave 808 deslizante, baixo synth analógico Moog, slap bass funk)
       - Samples e sintetizadores (pads atmosféricos, chaves rhodes, leads com filtro)
       - Efeitos sonoros (sidechain acentuado, reverb de mola, delays estéreo, saturação de fita)
       - Atmosfera (ex: "noturna, enérgica, densa, urbana")
       - Estrutura da batida (intro de 8 compassos, drop/batida principal, break com filtro low-pass, build-up e outro)
     * Mantém frases compactas e etiquetas precisas, com o SOMATÓRIO TOTAL DO ESTILO A NÃO ULTRAPASSAR 950 CARACTERES.

3. QUANDO A MÚSICA TIVER LETRA CANTADA REAL ('isInstrumental': false):
   - Escreve uma letra nova que siga DE MUITO PERTO a original em:
     * Idioma: segundo a regra linguística acima.
     * Tema central e tom lírico da música.
     * Emoção e intensidade dramática a cada momento.
     * Narrativa e progressão da história ao longo das estrofes.
     * Número exato de versos por secção ([Verso], [Refrão], [Verso 2], [Refrão], [Ponte]).
     * Métrica aproximada de sílabas por verso para encaixar com precisão na melodia cantada original.
     * Esquema de rimas fiel ao da canção original.
     * REGRAS FUNDAMENTAIS: Palavras e imagens novas, NUNCA copiar frases da letra original.

4. LIMITES OBRIGATÓRIOS DE CARACTERES (RIGOROSAMENTE EXIGIDOS):
   - "letra": DEVE TER NO MÁXIMO 4500 CARACTERES.
   - "estilo": O estilo musical (descrição, etiquetas e parâmetros somados) DEVE TER NO MÁXIMO 950 CARACTERES.
   - ANTES DE DEVOLVER: Conta os caracteres de cada campo e confirma que cumprem rigorosamente estes limites.

5. MÓDULO SEO PARA YOUTUBE ("youtubeSeo"):
   - Gera um pacote completo e estratégico de SEO para publicação no YouTube, no idioma da música/letra (Português de Portugal ou Inglês Internacional conforme detetado):
     * "titulos": exatamente 5 opções de títulos com NO MÁXIMO 70 caracteres cada, com a palavra-chave principal no início, gancho emocional e sem clickbait enganoso.
     * "descricao": descrição completa com NO MÁXIMO 5000 caracteres. As duas primeiras linhas DEVEM conter a palavra-chave principal e o gancho emocional (aparecem antes de "mostrar mais"). Depois inclui: resumo, a letra completa (ou descrição da batida se instrumental), informações essenciais de estilo e apelo à ação (subscrever, comentar).
     * "tags": lista de tags separada por vírgulas com NO MÁXIMO 500 caracteres no total, da mais específica à mais geral, incluindo variações e erros comuns de escrita.
     * "hashtags": 3 a 5 hashtags (nunca mais de 15), começando com #.
     * "textoMiniatura": exatamente 3 opções curtas para miniatura (thumbnail), com NO MÁXIMO 4 palavras cada.
     * "capitulos": marcas de tempo sequenciais se a música tiver estrutura (ex: ["0:00 Intro", "0:20 Verso 1", "0:50 Refrão", "1:22 Verso 2", "1:54 Refrão", "2:26 Ponte", "2:52 Outro"]).
     * "comentarioFixado": uma pergunta envolvente para incentivar comentários.
     * "palavrasChave": objeto com "principal" (string), "secundarias" (array de strings) e "caudaLonga" (array de strings).
   - REGRA MANDATÓRIA: NUNCA uses o nome do artista original nem o título da música original nos títulos, tags ou descrição de forma enganosa para parecer a música dele.

Devolve estritamente o JSON com os campos "isInstrumental", "letra", "estilo", "idiomaLetra" e "youtubeSeo".`;

    const userPrompt = `Ouve atentamente o áudio (${fileName || 'faixa de áudio'}). 
1. Se a música não tiver voz nem letra, ou tiver apenas vozes pontuais (samples ou ad-libs), define 'isInstrumental': true, define a letra como "Instrumental: sem letra" e descreve a batida com o máximo de fidelidade (BPM, compasso, tom, swing/groove, padrão de bateria com kick/snare/hi-hats, linha de baixo, samples, sintetizadores, efeitos, atmosfera e estrutura).
2. Se a música tiver letra cantada real, define 'isInstrumental': false e compõe uma letra nova que siga de muito perto a original na mesma melodia, no idioma detetado (Português de Portugal se for português, Inglês internacional se for inglês, ou idioma original se for outro).
3. A descrição e parâmetros do estilo ficam SEMPRE em Português de Portugal.
4. Gera o Pacote SEO para YouTube completo (5 títulos <= 70 chars, descrição <= 5000 chars, tags <= 500 chars, 3-5 hashtags, 3 textos de miniatura <= 4 palavras, capítulos, comentário fixado, palavras-chave) no idioma da música e sem usar nomes ou títulos originais de forma enganosa.
5. CUMPRE RIGOROSAMENTE OS LIMITES DE CARACTERES: estilo no máximo 950 caracteres, letra no máximo 4500 caracteres, descrição YouTube no máximo 5000 caracteres, tags YouTube no máximo 500 caracteres.`;

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
            isInstrumental: {
              type: Type.BOOLEAN,
              description: 'Verdadeiro se a música for instrumental, batida/beat, ou tiver apenas samples/ad-libs pontuais.',
            },
            idiomaLetra: {
              type: Type.STRING,
              description: 'Idioma detetado na música ou aplicado à letra.',
            },
            letra: {
              type: Type.STRING,
              description: 'Letra alternativa ou "Instrumental: sem letra".',
            },
            estilo: {
              type: Type.OBJECT,
              properties: {
                descricao: {
                  type: Type.STRING,
                  description: 'Parágrafo detalhado sempre em Português de Portugal descrevendo a faixa ou batida.',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Etiquetas de estilo precisas e minuciosas sempre em Português de Portugal.',
                },
                tema: { type: Type.STRING, description: 'Tema lírico/conceptual ou tema da batida' },
                emocao: { type: Type.STRING, description: 'Emoção e vibração predominante' },
                genero: { type: Type.STRING, description: 'Género musical e subgéneros' },
                bpm: { type: Type.STRING, description: 'Tempo / BPM preciso' },
                compasso: { type: Type.STRING, description: 'Compasso da batida (ex: 4/4)' },
                tom: { type: Type.STRING, description: 'Tom ou tonalidade musical' },
                swingGroove: { type: Type.STRING, description: 'Swing e groove da batida' },
                padraoBateria: { type: Type.STRING, description: 'Padrão rítmico de bateria (kick, snare, hi-hats, percussão)' },
                linhaBaixo: { type: Type.STRING, description: 'Linha de baixo / sub-bass' },
                samplesSintetizadores: { type: Type.STRING, description: 'Samples e sintetizadores' },
                estruturaBatida: { type: Type.STRING, description: 'Estrutura da batida (intro, drop, break, outro)' },
                instrumentos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Instrumentos, texturas e timbres identificados',
                },
                tipoVoz: { type: Type.STRING, description: 'Tipo de voz ou indicação de instrumental' },
                atmosfera: { type: Type.STRING, description: 'Atmosfera e ambiência sonora' },
                producao: { type: Type.STRING, description: 'Técnicas de produção, mistura e efeitos de som' },
                esquemaRimas: { type: Type.STRING, description: 'Esquema de rimas seguido (se aplicável)' },
                estruturaMetrica: { type: Type.STRING, description: 'Métrica silábica e cadência (se aplicável)' },
              },
              required: ['descricao', 'tags'],
            },
            youtubeSeo: {
              type: Type.OBJECT,
              properties: {
                titulos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '5 opções de títulos com no máximo 70 caracteres cada, palavra-chave no início e gancho emocional.',
                },
                descricao: {
                  type: Type.STRING,
                  description: 'Descrição completa para YouTube com no máximo 5000 caracteres (gancho nas 2 primeiras linhas, resumo, letra, estilo, apelo à ação).',
                },
                tags: {
                  type: Type.STRING,
                  description: 'Tags separadas por vírgula com no máximo 500 caracteres, da mais específica à geral.',
                },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 a 5 hashtags começando por #.',
                },
                textoMiniatura: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 opções curtas para miniatura com no máximo 4 palavras cada.',
                },
                capitulos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Capítulos e marcas de tempo da música (ex: 0:00 Intro, etc.).',
                },
                comentarioFixado: {
                  type: Type.STRING,
                  description: 'Pergunta engajadora para fixar no topo dos comentários.',
                },
                palavrasChave: {
                  type: Type.OBJECT,
                  properties: {
                    principal: { type: Type.STRING },
                    secundarias: { type: Type.ARRAY, items: { type: Type.STRING } },
                    caudaLonga: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['principal', 'secundarias', 'caudaLonga'],
                },
              },
              required: ['titulos', 'descricao', 'tags', 'hashtags', 'textoMiniatura', 'comentarioFixado', 'palavrasChave'],
            },
          },
          required: ['isInstrumental', 'letra', 'estilo', 'youtubeSeo'],
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
      if (style.compasso) details.push(`Compasso: ${style.compasso}`);
      if (style.tom) details.push(`Tom: ${style.tom}`);
      if (style.genero) details.push(`Género: ${style.genero}`);
      if (style.swingGroove) details.push(`Groove: ${style.swingGroove}`);
      if (style.padraoBateria) details.push(`Bateria: ${style.padraoBateria}`);
      if (style.linhaBaixo) details.push(`Baixo: ${style.linhaBaixo}`);
      if (style.emocao) details.push(`Emoção: ${style.emocao}`);
      if (style.tipoVoz) details.push(`Voz: ${style.tipoVoz}`);
      if (style.atmosfera) details.push(`Atmosfera: ${style.atmosfera}`);
      if (style.producao) details.push(`Produção: ${style.producao}`);
      if (style.estruturaBatida) details.push(`Estrutura: ${style.estruturaBatida}`);
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

    const isInstrumental = Boolean(parsedResult.isInstrumental);
    let currentLetra = isInstrumental ? 'Instrumental: sem letra' : (parsedResult.letra || '');
    let currentEstilo = parsedResult.estilo;
    let styleText = formatStyleForCount(currentEstilo);

    // If either exceeds the limit, rewrite and summarize
    if ((!isInstrumental && currentLetra.length > MAX_LETRA_CHARS) || styleText.length > MAX_ESTILO_CHARS) {
      console.log(`Excedeu limites (Letra: ${currentLetra.length}/${MAX_LETRA_CHARS}, Estilo: ${styleText.length}/${MAX_ESTILO_CHARS}). A resumir...`);
      try {
        const rewriteRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              text: `O resultado anterior ultrapassou os limites estritos de caracteres.
LIMITES OBRIGATÓRIOS:
1. "letra": ${isInstrumental ? 'Mantém exatamente "Instrumental: sem letra"' : `MÁXIMO 4500 CARACTERES (atualmente: ${currentLetra.length}). Resume a letra mantendo as secções [Verso], [Refrão], [Ponte], métrica e melodia, garantindo estritamente menos de 4500 caracteres.`}
2. "estilo": MÁXIMO 950 CARACTERES (atualmente: ${styleText.length}). Resume a descrição e parâmetros em Português de Portugal para garantir estritamente menos de 950 caracteres no total.

CONTEÚDO ANTERIOR:
${isInstrumental ? 'Faixa Instrumental/Batida' : `Letra:\n${currentLetra}`}

Estilo:
${JSON.stringify(currentEstilo)}

Devolve o JSON com "isInstrumental", "letra", "estilo" e "idiomaLetra" garantindo o cumprimento absoluto dos limites.`,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isInstrumental: { type: Type.BOOLEAN },
                idiomaLetra: { type: Type.STRING },
                letra: { type: Type.STRING },
                estilo: {
                  type: Type.OBJECT,
                  properties: {
                    descricao: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    bpm: { type: Type.STRING },
                    compasso: { type: Type.STRING },
                    tom: { type: Type.STRING },
                    genero: { type: Type.STRING },
                    swingGroove: { type: Type.STRING },
                    padraoBateria: { type: Type.STRING },
                    linhaBaixo: { type: Type.STRING },
                    samplesSintetizadores: { type: Type.STRING },
                    estruturaBatida: { type: Type.STRING },
                    emocao: { type: Type.STRING },
                    tipoVoz: { type: Type.STRING },
                    atmosfera: { type: Type.STRING },
                    producao: { type: Type.STRING },
                    instrumentos: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['descricao', 'tags'],
                },
              },
              required: ['isInstrumental', 'letra', 'estilo'],
            },
          },
        });

        if (rewriteRes.text) {
          const reParsed = JSON.parse(rewriteRes.text);
          if (!isInstrumental && reParsed.letra) currentLetra = reParsed.letra;
          if (reParsed.estilo) currentEstilo = reParsed.estilo;
          if (reParsed.idiomaLetra) parsedResult.idiomaLetra = reParsed.idiomaLetra;
        }
      } catch (err) {
        console.warn('Erro ao condensar com modelo:', err);
      }
    }

    if (isInstrumental) {
      currentLetra = 'Instrumental: sem letra';
    } else if (currentLetra.length > MAX_LETRA_CHARS) {
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

    // Ensure strict limits for YouTube SEO package
    if (parsedResult.youtubeSeo) {
      if (Array.isArray(parsedResult.youtubeSeo.titulos)) {
        parsedResult.youtubeSeo.titulos = parsedResult.youtubeSeo.titulos.slice(0, 5).map((t: string) => {
          if (typeof t !== 'string') return '';
          return t.length > 70 ? t.slice(0, 67).trim() + '...' : t;
        });
      }
      if (typeof parsedResult.youtubeSeo.descricao === 'string' && parsedResult.youtubeSeo.descricao.length > 5000) {
        parsedResult.youtubeSeo.descricao = parsedResult.youtubeSeo.descricao.slice(0, 4990).trim() + '...';
      }
      if (typeof parsedResult.youtubeSeo.tags === 'string' && parsedResult.youtubeSeo.tags.length > 500) {
        let tagsTrimmed = parsedResult.youtubeSeo.tags.slice(0, 500);
        const lastComma = tagsTrimmed.lastIndexOf(',');
        if (lastComma > 250) {
          tagsTrimmed = tagsTrimmed.slice(0, lastComma);
        }
        parsedResult.youtubeSeo.tags = tagsTrimmed.trim();
      }
      if (Array.isArray(parsedResult.youtubeSeo.hashtags)) {
        parsedResult.youtubeSeo.hashtags = parsedResult.youtubeSeo.hashtags.slice(0, 5).map((h: string) =>
          h.startsWith('#') ? h : `#${h}`
        );
      }
      if (Array.isArray(parsedResult.youtubeSeo.textoMiniatura)) {
        parsedResult.youtubeSeo.textoMiniatura = parsedResult.youtubeSeo.textoMiniatura.slice(0, 3).map((m: string) => {
          if (typeof m !== 'string') return '';
          const words = m.trim().split(/\s+/);
          return words.length > 4 ? words.slice(0, 4).join(' ') : m;
        });
      }
    }

    parsedResult.isInstrumental = isInstrumental;
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

// Endpoint to create lyrics specifically for an instrumental beat
app.post('/api/create-lyrics-for-beat', async (req, res) => {
  try {
    const { audioBase64, mimeType, beatStyle, idioma } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Chave da API Gemini não configurada no servidor.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const isEnglish = idioma === 'en' || (typeof idioma === 'string' && idioma.toLowerCase().includes('ingl'));
    const targetLanguageLabel = isEnglish ? 'Inglês (Internacional)' : 'Português (Portugal)';

    const systemInstruction = `És um letrista profissional e compositor musical de elite.
A tua missão é compor uma letra 100% original que encaixe com perfeição métrica, rítmica e cadencial nesta batida instrumental, e gerar um pacote YouTube SEO atualizado refletindo a nova canção lírica.

REGRAS OBRIGATÓRIAS:
1. IDIOMA DA LETRA E DO PACOTE YOUTUBE:
${
  isEnglish
    ? '   - Escreve estritamente em Inglês Internacional neutro, cantável e melódico, sem gíria regional.'
    : '   - Escreve estritamente em Português de Portugal (vocabulário europeu, ortografia e expressões de Portugal, nunca brasileiras).'
}
2. ENCAIXE NA BATIDA:
   - A letra deve respeitar o tempo (BPM), compasso, swing e dinamismo da batida.
   - Organiza em secções líricas bem definidas:
     [Verso]
     [Refrão]
     [Verso 2]
     [Refrão]
     [Ponte]
     (podes incluir [Refrão Final] ou [Outro]).
   - Rimas fluidas e acentuação silábica sincronizada com o ritmo do kick e snare.
3. LIMITE DE TAMANHO DA LETRA:
   - MÁXIMO ABSOLUTO DE 4500 CARACTERES (incluindo marcações [Verso], quebras de linha e pontuação).
   - NUNCA ultrapasses 4500 caracteres.
4. PACOTE YOUTUBE SEO ATUALIZADO:
   - Gera um pacote YouTube SEO correspondente à nova versão com letra:
     * 5 títulos <= 70 chars cada, sem clickbait
     * Descrição <= 5000 chars com as duas primeiras linhas de gancho, resumo, a letra completa inserida e apelo à ação
     * Tags <= 500 chars separadas por vírgula
     * 3-5 hashtags
     * 3 opções de miniatura <= 4 palavras
     * Capítulos com marcas de tempo
     * Comentário fixado para engajamento
     * Palavras-chave estruturadas
   - Nunca uses nomes originais de artistas ou músicas de forma enganosa.

Devolve estritamente um JSON com os campos "letra" e "youtubeSeo".`;

    const userPrompt = `Cria uma letra inédita e cativante para esta batida instrumental e o pacote de SEO para YouTube.
Idioma selecionado: ${targetLanguageLabel}.
Detalhes da batida:
${typeof beatStyle === 'string' ? beatStyle : JSON.stringify(beatStyle, null, 2)}
Garante que a letra encaixa perfeitamente no ritmo (máx 4500 caracteres) e gera o pacote YouTube SEO correspondente (títulos <= 70 chars, descrição <= 5000 chars, tags <= 500 chars).`;

    const contents: any[] = [];
    if (audioBase64) {
      const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType || 'audio/mp3',
          data: cleanBase64,
        },
      });
    }
    contents.push({ text: userPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            letra: {
              type: Type.STRING,
              description: 'Letra original adaptada à batida, estruturada com [Verso], [Refrão] e [Ponte], com no máximo 4500 caracteres.',
            },
            youtubeSeo: {
              type: Type.OBJECT,
              properties: {
                titulos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '5 opções de títulos com no máximo 70 caracteres cada.',
                },
                descricao: {
                  type: Type.STRING,
                  description: 'Descrição completa para YouTube com no máximo 5000 caracteres, contendo a nova letra.',
                },
                tags: {
                  type: Type.STRING,
                  description: 'Tags separadas por vírgula com no máximo 500 caracteres.',
                },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 a 5 hashtags.',
                },
                textoMiniatura: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 opções curtas com no máximo 4 palavras cada.',
                },
                capitulos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                comentarioFixado: {
                  type: Type.STRING,
                },
                palavrasChave: {
                  type: Type.OBJECT,
                  properties: {
                    principal: { type: Type.STRING },
                    secundarias: { type: Type.ARRAY, items: { type: Type.STRING } },
                    caudaLonga: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['principal', 'secundarias', 'caudaLonga'],
                },
              },
              required: ['titulos', 'descricao', 'tags', 'hashtags', 'textoMiniatura', 'comentarioFixado', 'palavrasChave'],
            },
          },
          required: ['letra'],
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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Falha ao interpretar resposta JSON da letra.');
      }
    }

    let letra = parsedResult.letra || '';
    if (letra.length > 4500) {
      let cutPoint = letra.lastIndexOf('\n', 4500);
      if (cutPoint === -1 || cutPoint < 4200) {
        cutPoint = letra.lastIndexOf('.', 4500);
      }
      if (cutPoint === -1) cutPoint = 4500;
      letra = letra.slice(0, cutPoint).trim();
    }

    if (parsedResult.youtubeSeo) {
      if (Array.isArray(parsedResult.youtubeSeo.titulos)) {
        parsedResult.youtubeSeo.titulos = parsedResult.youtubeSeo.titulos.slice(0, 5).map((t: string) => {
          if (typeof t !== 'string') return '';
          return t.length > 70 ? t.slice(0, 67).trim() + '...' : t;
        });
      }
      if (typeof parsedResult.youtubeSeo.descricao === 'string' && parsedResult.youtubeSeo.descricao.length > 5000) {
        parsedResult.youtubeSeo.descricao = parsedResult.youtubeSeo.descricao.slice(0, 4990).trim() + '...';
      }
      if (typeof parsedResult.youtubeSeo.tags === 'string' && parsedResult.youtubeSeo.tags.length > 500) {
        let tagsTrimmed = parsedResult.youtubeSeo.tags.slice(0, 500);
        const lastComma = tagsTrimmed.lastIndexOf(',');
        if (lastComma > 250) {
          tagsTrimmed = tagsTrimmed.slice(0, lastComma);
        }
        parsedResult.youtubeSeo.tags = tagsTrimmed.trim();
      }
      if (Array.isArray(parsedResult.youtubeSeo.hashtags)) {
        parsedResult.youtubeSeo.hashtags = parsedResult.youtubeSeo.hashtags.slice(0, 5).map((h: string) =>
          h.startsWith('#') ? h : `#${h}`
        );
      }
      if (Array.isArray(parsedResult.youtubeSeo.textoMiniatura)) {
        parsedResult.youtubeSeo.textoMiniatura = parsedResult.youtubeSeo.textoMiniatura.slice(0, 3).map((m: string) => {
          if (typeof m !== 'string') return '';
          const words = m.trim().split(/\s+/);
          return words.length > 4 ? words.slice(0, 4).join(' ') : m;
        });
      }
    }

    return res.json({
      letra,
      idiomaLetra: targetLanguageLabel,
      youtubeSeo: parsedResult.youtubeSeo,
    });
  } catch (error: any) {
    console.error('Erro ao gerar letra para batida:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao compor letra para a batida.',
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
