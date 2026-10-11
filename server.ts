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

    const systemInstruction = `És um produtor musical consagrado, compositor lírico e especialista em análise de áudio.
A tua missão é ouvir o ficheiro de áudio de uma música existente fornecido e:
1. OUVIR E IDENTIFICAR minuciosamente:
   - Tema lírico / conceptual
   - Emoção e vibração predominante (ex: melancolia nostálgica, euforia noturna, revolta íntima)
   - Género e subgéneros musicais (ex: Synthpop anos 80, Indie Rock, Afrobeat, Dream Pop)
   - Tempo aproximado em BPM (ex: "122 BPM")
   - Tom musical / escala (ex: "Lá menor (Am)", "Fá maior (F)")
   - Instrumentos e texturas identificados (ex: sintetizadores analógicos, guitarra acústica fingerpicking, bateria 808, cordas cinematográficas)
   - Estrutura musical percibida
   - Tipo e características da voz (ex: voz feminina etérea com reverberação, voz masculina rouca e intimista, ou instrumental)

2. GERAR UMA VERSÃO ALTERNATIVA EM TEXTO:
   a) "letra": Uma letra 100% original e inédita com a mesma temática e emoção da música ouvida.
      - Deve ser estritamente organizada nas seguintes secções:
        [Verso]
        [Refrão]
        [Verso 2]
        [Refrão]
        [Ponte]
      - Podes acrescentar um [Refrão Final] ou [Outro] no final se enriquecer a composição.
      - REGRA FUNDAMENTAL: NUNCA copies frases, rimas ou linhas da letra original. Escreve uma obra inteiramente nova inspirada pelo espírito e sentimento da faixa.
      - A letra deve estar em Português poético, cativante e pronto para ser cantado.

   b) "estilo":
      - "descricao": Um parágrafo curto, elegante e envolvente descrevendo a sonoridade da faixa alternativa inspirada, os arranjos e a atmosfera musical.
      - "tags": Uma lista de etiquetas curtas e diretas com as características essenciais (por exemplo: ["Pop eletrónico", "120 BPM", "Melancólico", "Sintetizadores analógicos", "Voz feminina emotiva"]).
      - Detalhes musicais individuais para os campos: "tema", "emocao", "genero", "bpm", "tom", "instrumentos", "tipoVoz".

Devolve apenas o JSON estritamente conforme o esquema fornecido.`;

    const userPrompt = `Ouve o ficheiro de áudio em anexo (${fileName || 'música'}). Analisa a canção com precisão e gera a versão alternativa com letra original e descrição do estilo musical.`;

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
            letra: {
              type: Type.STRING,
              description: 'Letra alternativa totalmente original organizada com [Verso], [Refrão], [Verso 2], [Refrão] e [Ponte].',
            },
            estilo: {
              type: Type.OBJECT,
              properties: {
                descricao: {
                  type: Type.STRING,
                  description: 'Parágrafo curto descrevendo o estilo musical, arranjo e vibração.',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Lista de etiquetas essenciais (ex: pop eletrónico, 120 BPM, melancólico, sintetizadores, voz feminina).',
                },
                tema: { type: Type.STRING, description: 'Tema identificado' },
                emocao: { type: Type.STRING, description: 'Emoção predominante' },
                genero: { type: Type.STRING, description: 'Género musical' },
                bpm: { type: Type.STRING, description: 'Tempo aproximado em BPM' },
                tom: { type: Type.STRING, description: 'Tom ou tonalidade musical' },
                instrumentos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Instrumentos e timbres principais',
                },
                tipoVoz: { type: Type.STRING, description: 'Tipo e características da voz' },
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
