import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set payload limit to 50MB to support MP3 and WAV files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-memory cache for audio analysis to avoid re-processing audio files
interface CachedAnalysis {
  analysisId: string;
  isInstrumental: boolean;
  idiomaLetra: string;
  estilo: any;
  letra: string;
  fileName?: string;
  timestamp: number;
}
const audioAnalysisCache = new Map<string, CachedAnalysis>();

// Cleanup stale cache entries older than 2 hours
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, item] of audioAnalysisCache.entries()) {
    if (item.timestamp < twoHoursAgo) {
      audioAnalysisCache.delete(id);
    }
  }
}, 30 * 60 * 1000);

// Helper to calculate style text length for limit verification
function formatStyleForCount(style: any): string {
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
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    cachedAnalyses: audioAnalysisCache.size,
  });
});

/**
 * 1. CHAMADA 1 (Streaming SSE):
 * Análise dos primeiros 3 minutos do áudio + Letra alternativa + Estilo musical.
 * Otimizado com Gemini Flash mais recente, raciocínio reduzido (ThinkingLevel.LOW),
 * e contagem de caracteres estritamente no código com re-chamada rápida se necessário.
 */
app.post('/api/create-alternative', async (req, res) => {
  // Set up Server-Sent Events headers for progressive streaming feedback
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: { step: string; message: string; detail?: string; result?: any; error?: string }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const { audioBase64, mimeType, fileName } = req.body;

    if (!audioBase64) {
      sendEvent({
        step: 'error',
        message: 'Nenhum ficheiro de áudio foi enviado.',
        error: 'Nenhum ficheiro de áudio foi enviado. Por favor seleciona um ficheiro MP3 ou WAV.',
      });
      return res.end();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      sendEvent({
        step: 'error',
        message: 'Chave da API Gemini não configurada.',
        error: 'Chave da API Gemini não configurada no servidor.',
      });
      return res.end();
    }

    // Step 1: Listening
    sendEvent({
      step: 'listening',
      message: 'A ouvir os primeiros 3 minutos do áudio...',
      detail: 'A analisar tom, BPM, ritmo, instrumentação e presença vocal.',
    });

    const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, '');

    let geminiMime = (mimeType || 'audio/mp3').toLowerCase();
    if (geminiMime === 'audio/wave' || geminiMime === 'audio/x-wav') {
      geminiMime = 'audio/wav';
    } else if (geminiMime === 'audio/mpeg') {
      geminiMime = 'audio/mp3';
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `És um produtor musical consagrado, engenheiro de som e letrista profissional de altíssima precisão métrica.
A tua missão é ouvir com a máxima atenção os primeiros 3 minutos (0:00 a 3:00) do ficheiro de áudio fornecido e gerar uma versão alternativa em texto, de forma direta e rápida.

REGRAS OBRIGATÓRIAS:
1. IDIOMA:
   - A descrição do estilo musical e todos os seus campos DEVEM FICAR SEMPRE EM PORTUGUÊS DE PORTUGAL (vocabulário e sintaxe de Portugal: "ficheiro", "bateria", "mistura").
   - Letra alternativa (quando houver voz cantada):
     * Se for Português: Português de Portugal europeu.
     * Se for Inglês: Inglês internacional neutro.
     * Outro idioma: mantém o idioma original da canção.
2. DETEÇÃO DE MODO INSTRUMENTAL (BATIDA / BEAT):
   - Se a faixa NÃO tiver voz cantada contínua, ou tiver APENAS samples vocais curtos / ad-libs / efeitos DJ:
     * 'isInstrumental': true.
     * 'letra': EXATAMENTE "Instrumental: sem letra".
     * 'estilo': descreve a batida com máxima fidelidade (BPM, compasso, tom, swing/groove, bateria, baixo, sintetizadores, atmosfera e estrutura).
3. QUANDO A MÚSICA TIVER LETRA CANTADA REAL ('isInstrumental': false):
   - Escreve uma letra nova que siga de muito perto a original em tema, emoção, narrativa, número de versos por secção ([Verso], [Refrão], [Verso 2], [Refrão], [Ponte]), métrica e esquema de rimas.
   - NUNCA copies frases da letra original. Palavras e imagens 100% novas.
   - LIMITE OBRIGATÓRIO: A letra DEVE ter menos de 4000 caracteres no total.
4. ESTILO MUSICAL (LIMITE ESTRITO):
   - O estilo sonoro com todos os campos sumariados DEVE ter menos de 900 caracteres no total. Sê conciso, direto e cirúrgico em cada parâmetro.`;

    const userPrompt = `Analisa os primeiros 3 minutos do áudio (${fileName || 'faixa'}).
1. Identifica se é instrumental/batida ou se tem voz cantada.
2. Gera a letra alternativa ([Verso], [Refrão], [Ponte]) ou "Instrumental: sem letra" (< 4000 caracteres).
3. Descreve o estilo sonoro original com etiquetas em Português de Portugal (< 900 caracteres).`;

    // Stream generation with reduced thinking (ThinkingLevel.LOW) for lowest latency
    const stream = await ai.models.generateContentStream({
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
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isInstrumental: { type: Type.BOOLEAN },
            idiomaLetra: { type: Type.STRING },
            letra: { type: Type.STRING, description: 'Letra alternativa estruturada com [Verso] e [Refrão], ou Instrumental: sem letra. Máximo 4000 caracteres.' },
            estilo: {
              type: Type.OBJECT,
              properties: {
                descricao: { type: Type.STRING, description: 'Descrição compacta da produção e atmosfera sonora em Português de Portugal (1 a 2 parágrafos concisos).' },
                tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '5 a 8 etiquetas de estilo essenciais.' },
                tema: { type: Type.STRING },
                emocao: { type: Type.STRING },
                genero: { type: Type.STRING },
                bpm: { type: Type.STRING },
                compasso: { type: Type.STRING },
                tom: { type: Type.STRING },
                swingGroove: { type: Type.STRING },
                padraoBateria: { type: Type.STRING },
                linhaBaixo: { type: Type.STRING },
                samplesSintetizadores: { type: Type.STRING },
                estruturaBatida: { type: Type.STRING },
                instrumentos: { type: Type.ARRAY, items: { type: Type.STRING } },
                tipoVoz: { type: Type.STRING },
                atmosfera: { type: Type.STRING },
                producao: { type: Type.STRING },
              },
              required: ['descricao', 'tags'],
            },
          },
          required: ['isInstrumental', 'letra', 'estilo'],
        },
      },
    });

    let fullText = '';
    let hasSentLyricsStep = false;
    let hasSentStyleStep = false;

    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;

      // Progressively notify the client based on incoming stream content
      if (!hasSentLyricsStep && (fullText.includes('"letra"') || fullText.length > 80)) {
        hasSentLyricsStep = true;
        sendEvent({
          step: 'lyrics',
          message: 'A escrever a letra alternativa...',
          detail: 'A alinhar métrica silábica, rimas e estrutura [Verso]/[Refrão].',
        });
      }

      if (!hasSentStyleStep && (fullText.includes('"estilo"') || fullText.length > 500)) {
        hasSentStyleStep = true;
        sendEvent({
          step: 'style',
          message: 'A criar o estilo musical...',
          detail: 'A compilar etiquetas sonoras, timbres e parâmetros acústicos.',
        });
      }
    }

    if (!fullText) {
      throw new Error('O modelo não devolveu resposta de áudio.');
    }

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(fullText);
    } catch {
      const match = fullText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        throw new Error('Falha ao interpretar JSON gerado pelo modelo.');
      }
    }

    const isInstrumental = Boolean(parsedResult.isInstrumental);
    let currentLetra = isInstrumental ? 'Instrumental: sem letra' : (parsedResult.letra || '');
    let currentEstilo = parsedResult.estilo;
    let idiomaLetra = parsedResult.idiomaLetra || (isInstrumental ? 'Instrumental' : 'Português (Portugal)');

    // Contagem no código dos limites:
    const MAX_LETRA_CHARS = 4500;
    const MAX_ESTILO_CHARS = 950;

    let styleText = formatStyleForCount(currentEstilo);

    // Se a letra passar do limite (4500 caracteres), faz chamada dedicada super rápida só para encurtar
    if (!isInstrumental && currentLetra.length > MAX_LETRA_CHARS) {
      sendEvent({
        step: 'condensing',
        message: 'A encurtar letra para cumprir o limite...',
        detail: `Letra atingiu ${currentLetra.length} caracteres. A resumir para <= ${MAX_LETRA_CHARS}.`,
      });

      try {
        const shortenLetraRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `A seguinte letra tem ${currentLetra.length} caracteres e ultrapassa o limite de 4500 caracteres.
Resume e encurta a letra para que tenha rigorosamente MENOS DE 4500 caracteres no total, preservando a métrica, as rimas e as secções [Verso], [Refrão] e [Ponte]:

${currentLetra}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                letra: { type: Type.STRING },
              },
              required: ['letra'],
            },
          },
        });

        if (shortenLetraRes.text) {
          const parsedShort = JSON.parse(shortenLetraRes.text);
          if (parsedShort.letra) {
            currentLetra = parsedShort.letra;
          }
        }
      } catch (err) {
        console.warn('Erro ao encurtar letra via modelo, aplicando corte seguro:', err);
      }

      // Safeguard slice if still over
      if (currentLetra.length > MAX_LETRA_CHARS) {
        let cut = currentLetra.lastIndexOf('\n', MAX_LETRA_CHARS);
        if (cut < 4000) cut = MAX_LETRA_CHARS;
        currentLetra = currentLetra.slice(0, cut).trim();
      }
    }

    // Se o estilo passar do limite (950 caracteres), faz chamada dedicada rápida só para encurtar
    styleText = formatStyleForCount(currentEstilo);
    if (styleText.length > MAX_ESTILO_CHARS) {
      sendEvent({
        step: 'condensing',
        message: 'A encurtar estilo para cumprir o limite...',
        detail: `Estilo atingiu ${styleText.length} caracteres. A condensar para <= ${MAX_ESTILO_CHARS}.`,
      });

      try {
        const shortenStyleRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `O seguinte estilo musical tem ${styleText.length} caracteres e ultrapassa o limite estrito de 950 caracteres.
Resume a descrição e etiquetas em Português de Portugal de modo compacto para que o somatório total tenha rigorosamente MENOS DE 950 caracteres:

${JSON.stringify(currentEstilo)}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                descricao: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                bpm: { type: Type.STRING },
                tom: { type: Type.STRING },
                genero: { type: Type.STRING },
                emocao: { type: Type.STRING },
                tipoVoz: { type: Type.STRING },
              },
              required: ['descricao', 'tags'],
            },
          },
        });

        if (shortenStyleRes.text) {
          const parsedShortStyle = JSON.parse(shortenStyleRes.text);
          currentEstilo = {
            ...currentEstilo,
            ...parsedShortStyle,
          };
        }
      } catch (err) {
        console.warn('Erro ao encurtar estilo via modelo, aplicando condensação direta:', err);
      }

      // Safeguard slice
      if (formatStyleForCount(currentEstilo).length > MAX_ESTILO_CHARS) {
        if (typeof currentEstilo === 'object' && currentEstilo.descricao) {
          currentEstilo.descricao = currentEstilo.descricao.slice(0, 450).trim() + '...';
        }
        if (Array.isArray(currentEstilo.tags) && currentEstilo.tags.length > 5) {
          currentEstilo.tags = currentEstilo.tags.slice(0, 5);
        }
      }
    }

    // Guarda a análise em memória para que "Gerar outra versão" e "Pacote YouTube" não voltem a reprocessar o áudio
    const analysisId = 'ana_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    audioAnalysisCache.set(analysisId, {
      analysisId,
      isInstrumental,
      idiomaLetra,
      estilo: currentEstilo,
      letra: currentLetra,
      fileName,
      timestamp: Date.now(),
    });

    // Envia o resultado final imediatamente
    sendEvent({
      step: 'done',
      message: 'Versão alternativa gerada com sucesso!',
      result: {
        analysisId,
        isInstrumental,
        idiomaLetra,
        letra: currentLetra,
        estilo: currentEstilo,
      },
    });

    res.end();
  } catch (error: any) {
    console.error('Erro em /api/create-alternative:', error);
    sendEvent({
      step: 'error',
      message: error?.message || 'Falha ao processar áudio.',
      error: error?.message || 'Ocorreu um erro ao comunicar com o modelo Gemini.',
    });
    res.end();
  }
});

/**
 * 2. CHAMADA 2: "Gerar outra versão"
 * Reutiliza a análise do áudio em memória (analysisId), SEM re-enviar ou re-ouvir o ficheiro!
 * Ultra-rápido com Gemini Flash (texto puro).
 */
app.post('/api/regenerate-lyrics', async (req, res) => {
  try {
    const { analysisId, estilo, isInstrumental, idiomaLetra } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da API Gemini não configurada.' });
    }

    // Lookup cached analysis if available
    const cached = analysisId ? audioAnalysisCache.get(analysisId) : null;
    const finalEstilo = cached?.estilo || estilo;
    const finalIsInstrumental = cached ? cached.isInstrumental : Boolean(isInstrumental);
    const finalIdioma = cached?.idiomaLetra || idiomaLetra || 'Português (Portugal)';

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    if (finalIsInstrumental) {
      return res.json({
        letra: 'Instrumental: sem letra',
        idiomaLetra: finalIdioma,
        analysisId,
      });
    }

    const isEnglish = finalIdioma.toLowerCase().includes('ingl');

    const prompt = `Gera uma NOVA variação de letra alternativa completa baseada neste perfil musical já analisado:
Idioma: ${finalIdioma} (${isEnglish ? 'Inglês internacional neutro' : 'Português de Portugal europeu'}).
Perfil sonoro da música:
${typeof finalEstilo === 'string' ? finalEstilo : JSON.stringify(finalEstilo, null, 2)}

REGRAS:
- Escreve uma letra 100% inédita com nova poesia e imagens, mantendo as secções [Verso], [Refrão], [Verso 2], [Refrão], [Ponte].
- Mesma cadência e esquema de rimas para caber na mesma melodia.
- MÁXIMO ABSOLUTO DE 4500 CARACTERES.

Devolve estritamente um JSON com o campo "letra".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            letra: { type: Type.STRING },
          },
          required: ['letra'],
        },
      },
    });

    let newLetra = '';
    try {
      const parsed = JSON.parse(response.text || '{}');
      newLetra = parsed.letra || '';
    } catch {
      newLetra = response.text || '';
    }

    // Check code limit
    const MAX_LETRA_CHARS = 4500;
    if (newLetra.length > MAX_LETRA_CHARS) {
      try {
        const shortenRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Encurta esta letra para ter estritamente menos de 4500 caracteres, mantendo [Verso], [Refrão], [Ponte] e as rimas:\n\n${newLetra}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: { letra: { type: Type.STRING } },
              required: ['letra'],
            },
          },
        });
        const shortenParsed = JSON.parse(shortenRes.text || '{}');
        if (shortenParsed.letra) newLetra = shortenParsed.letra;
      } catch {
        newLetra = newLetra.slice(0, MAX_LETRA_CHARS).trim();
      }
    }

    // Update cache with the new lyrics
    if (analysisId && cached) {
      cached.letra = newLetra;
    }

    return res.json({
      letra: newLetra,
      idiomaLetra: finalIdioma,
      analysisId,
    });
  } catch (error: any) {
    console.error('Erro em /api/regenerate-lyrics:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao gerar outra versão de letra.' });
  }
});

/**
 * 3. CHAMADA 3: "Gerar pacote YouTube" (SEO)
 * Chamado APENAS quando o utilizador clica explicitamente em "Gerar pacote YouTube".
 * Usa a análise do áudio guardada em memória e a letra/estilo existentes (SEM áudio).
 */
app.post('/api/generate-youtube-seo', async (req, res) => {
  try {
    const { analysisId, letra, estilo, idiomaLetra } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da API Gemini não configurada no servidor.' });
    }

    const cached = analysisId ? audioAnalysisCache.get(analysisId) : null;
    const currentLetra = letra || cached?.letra || 'Instrumental: sem letra';
    const currentEstilo = estilo || cached?.estilo;
    const currentIdioma = idiomaLetra || cached?.idiomaLetra || 'Português (Portugal)';

    const isEnglish = currentIdioma.toLowerCase().includes('ingl');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `És um especialista sénior em YouTube SEO e marketing musical internacional.
A tua missão é gerar um pacote de SEO estratégico para o lançamento desta música no YouTube.
Idioma do pacote: ${isEnglish ? 'Inglês Internacional' : 'Português de Portugal'}.

REGRAS:
1. TÍTULOS: 5 opções, com palavra-chave principal no início, gancho emocional, sem clickbait enganoso, com no máximo 70 caracteres cada.
2. DESCRIÇÃO: até 5000 caracteres. As 2 primeiras linhas DEVEM conter palavra-chave e gancho (visíveis antes de "mostrar mais"). Depois inclui: resumo conceptual, a letra completa (ou descrição da batida), informações de estilo sonoro e apelo à ação (subscrever, comentar).
3. TAGS: lista separada por vírgulas, até 500 caracteres total, da mais específica à geral.
4. HASHTAGS: 3 a 5 hashtags começando por #.
5. TEXTO DA MINIATURA: 3 opções curtas com no máximo 4 palavras cada.
6. CAPÍTULOS: marcas de tempo sequenciais (ex: 0:00 Intro, etc.).
7. COMENTÁRIO FIXADO: pergunta envolvente para engajamento nos comentários.
8. PALAVRAS-CHAVE: principal, secundárias e de cauda longa.
9. NUNCA uses o nome do artista original ou da música original de forma enganosa.`;

    const userPrompt = `Gera o Pacote YouTube SEO completo para esta música:
Idioma: ${currentIdioma}
Estilo sonoro:
${typeof currentEstilo === 'string' ? currentEstilo : JSON.stringify(currentEstilo, null, 2)}

Letra da música:
${currentLetra}

Devolve estritamente o JSON com o pacote YouTube SEO.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titulos: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '5 opções de títulos com no máximo 70 caracteres cada.',
            },
            descricao: {
              type: Type.STRING,
              description: 'Descrição completa para YouTube com no máximo 5000 caracteres.',
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
              description: '3 opções curtas de thumbnail com no máximo 4 palavras cada.',
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
    });

    let seoResult: any;
    try {
      seoResult = JSON.parse(response.text || '{}');
    } catch {
      const match = response.text?.match(/\{[\s\S]*\}/);
      if (match) {
        seoResult = JSON.parse(match[0]);
      } else {
        throw new Error('Falha ao interpretar resposta JSON do pacote YouTube.');
      }
    }

    // Verificação estrita de limites no código (TypeScript):
    // 1. Títulos <= 70 chars
    if (Array.isArray(seoResult.titulos)) {
      seoResult.titulos = seoResult.titulos.slice(0, 5).map((t: string) => {
        if (typeof t !== 'string') return '';
        return t.length > 70 ? t.slice(0, 67).trim() + '...' : t;
      });
    }

    // 2. Descrição <= 5000 chars (se exceder, chamada rápida para condensar só a descrição)
    if (typeof seoResult.descricao === 'string' && seoResult.descricao.length > 5000) {
      try {
        const shortenDesc = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `A seguinte descrição de YouTube tem ${seoResult.descricao.length} caracteres e ultrapassa 5000 caracteres. Resume para ter estritamente menos de 5000 caracteres mantendo gancho, resumo e letra:\n\n${seoResult.descricao}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: { descricao: { type: Type.STRING } },
              required: ['descricao'],
            },
          },
        });
        const parsedDesc = JSON.parse(shortenDesc.text || '{}');
        if (parsedDesc.descricao) seoResult.descricao = parsedDesc.descricao;
      } catch {
        seoResult.descricao = seoResult.descricao.slice(0, 4990).trim() + '...';
      }
    }

    // 3. Tags <= 500 chars
    if (typeof seoResult.tags === 'string' && seoResult.tags.length > 500) {
      let trimmed = seoResult.tags.slice(0, 500);
      const comma = trimmed.lastIndexOf(',');
      if (comma > 250) trimmed = trimmed.slice(0, comma);
      seoResult.tags = trimmed.trim();
    }

    // 4. Hashtags 3-5
    if (Array.isArray(seoResult.hashtags)) {
      seoResult.hashtags = seoResult.hashtags.slice(0, 5).map((h: string) => (h.startsWith('#') ? h : `#${h}`));
    }

    // 5. Miniatura <= 4 palavras
    if (Array.isArray(seoResult.textoMiniatura)) {
      seoResult.textoMiniatura = seoResult.textoMiniatura.slice(0, 3).map((m: string) => {
        if (typeof m !== 'string') return '';
        const words = m.trim().split(/\s+/);
        return words.length > 4 ? words.slice(0, 4).join(' ') : m;
      });
    }

    return res.json({ youtubeSeo: seoResult });
  } catch (error: any) {
    console.error('Erro em /api/generate-youtube-seo:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao gerar o pacote YouTube SEO.' });
  }
});

/**
 * 4. Letra para batida instrumental:
 * Reutiliza a análise em memória sem re-enviar áudio.
 */
app.post('/api/create-lyrics-for-beat', async (req, res) => {
  try {
    const { analysisId, beatStyle, idioma } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da API Gemini não configurada no servidor.' });
    }

    const cached = analysisId ? audioAnalysisCache.get(analysisId) : null;
    const finalStyle = cached?.estilo || beatStyle;

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

    const prompt = `És um compositor profissional. Compõe uma letra inédita que encaixe com precisão rítmica nesta batida instrumental:
Idioma: ${targetLanguageLabel} (${isEnglish ? 'Inglês neutro' : 'Português de Portugal'}).
Detalhes da batida:
${typeof finalStyle === 'string' ? finalStyle : JSON.stringify(finalStyle, null, 2)}

REGRAS:
- Estrutura com [Verso], [Refrão], [Verso 2], [Refrão], [Ponte].
- Rimas fluidas e acentuação sincronizada com a batida.
- Máximo 4500 caracteres.

Devolve estritamente um JSON com o campo "letra".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            letra: { type: Type.STRING },
          },
          required: ['letra'],
        },
      },
    });

    let letra = '';
    try {
      const parsed = JSON.parse(response.text || '{}');
      letra = parsed.letra || '';
    } catch {
      letra = response.text || '';
    }

    // Limit check in code
    if (letra.length > 4500) {
      let cutPoint = letra.lastIndexOf('\n', 4500);
      if (cutPoint === -1 || cutPoint < 4200) {
        cutPoint = letra.lastIndexOf('.', 4500);
      }
      if (cutPoint === -1) cutPoint = 4500;
      letra = letra.slice(0, cutPoint).trim();
    }

    // Update cache
    if (analysisId && cached) {
      cached.letra = letra;
      cached.idiomaLetra = targetLanguageLabel;
    }

    return res.json({
      letra,
      idiomaLetra: targetLanguageLabel,
      analysisId,
    });
  } catch (error: any) {
    console.error('Erro em /api/create-lyrics-for-beat:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao compor letra para a batida.' });
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
