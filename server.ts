import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel, MediaResolution } from '@google/genai';

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

// Helper para mensagens amigáveis em Português
function cleanGeminiErrorMessage(err: any): string {
  const raw = String(err?.message || err || '');
  if (
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('429') ||
    raw.includes('quota') ||
    raw.includes('Quota exceeded')
  ) {
    return 'Limite de quota temporário atingido na API Gemini. Por favor aguarda alguns instantes ou tenta novamente mais tarde.';
  }
  if (
    raw.includes('URL_UNREACHABLE') ||
    raw.includes('Cannot fetch content') ||
    raw.includes('INVALID_ARGUMENT')
  ) {
    return 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.';
  }
  if (
    raw.includes('503') ||
    raw.includes('high demand') ||
    raw.includes('UNAVAILABLE')
  ) {
    return 'O modelo está atualmente com alta procura temporária. Por favor tenta novamente num instante.';
  }
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.error?.message) {
        return cleanGeminiErrorMessage(parsed.error.message);
      }
    }
  } catch {}
  return raw || 'Ocorreu um erro no processamento da música.';
}

function extractApiErrorDetails(err: any): { code: string | number; message: string; full: string } {
  const full = String(err?.message || err || '');
  let code: string | number = err?.status || err?.code || 'API_ERROR';
  let message: string = full;

  try {
    const match = full.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.error) {
        if (parsed.error.code) code = parsed.error.code;
        if (parsed.error.status) code = `${code !== 'API_ERROR' ? code + ' ' : ''}${parsed.error.status}`;
        if (parsed.error.message) message = parsed.error.message;
      }
    }
  } catch {}

  return { code, message, full };
}

// YouTube helpers
function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtu.be' ||
      host === 'www.youtu.be' ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    );
  } catch {
    return false;
  }
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      return id && id.length >= 10 ? id : null;
    }

    if (parsed.pathname === '/watch') {
      const v = parsed.searchParams.get('v');
      return v && v.length >= 10 ? v : null;
    }

    const match = parsed.pathname.match(/\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Endpoint para obter informações do vídeo do YouTube (título e miniatura)
 * antes do processamento, permitindo que o utilizador confirme a música certa.
 */
app.post('/api/youtube-info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !isYouTubeUrl(url)) {
      return res.status(400).json({
        error: 'O link tem de ser do YouTube (youtube.com ou youtu.be). Por favor verifica o URL colado.',
      });
    }

    const videoId = extractYouTubeVideoId(url);
    const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url.trim();

    // Consulta o oEmbed oficial do YouTube (funciona para vídeos públicos sem precisar de API Key)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return res.status(400).json({
        error: 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.',
      });
    }

    const data = (await response.json()) as any;
    const title = data.title || 'Vídeo do YouTube';
    const author = data.author_name || '';
    const thumbnailUrl =
      data.thumbnail_url ||
      (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '');

    return res.json({
      title,
      author,
      thumbnailUrl,
      videoId,
      cleanUrl,
    });
  } catch (err: any) {
    console.error('Erro em /api/youtube-info:', err);
    return res.status(400).json({
      error: 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.',
    });
  }
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
    const { audioBase64, mimeType, fileName, youtubeUrl } = req.body;

    if (!audioBase64 && !youtubeUrl) {
      sendEvent({
        step: 'error',
        message: 'Nenhum ficheiro de áudio ou link do YouTube foi enviado.',
        error: 'Por favor seleciona um ficheiro de áudio ou cola um link do YouTube.',
      });
      return res.end();
    }

    if (youtubeUrl && !isYouTubeUrl(youtubeUrl)) {
      sendEvent({
        step: 'error',
        message: 'Link do YouTube inválido.',
        error: 'O link tem de ser do YouTube (youtube.com ou youtu.be). Por favor verifica o URL colado.',
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

    // Step 1: Listening / Accessing
    if (youtubeUrl) {
      sendEvent({
        step: 'listening',
        message: 'A aceder ao vídeo do YouTube (segundos 20s a 80s)...',
        detail: 'A analisar 60 segundos com resolução leve e foco no áudio musical.',
      });
    } else {
      sendEvent({
        step: 'listening',
        message: 'A ouvir os primeiros 3 minutos do áudio...',
        detail: 'A analisar tom, BPM, ritmo, instrumentação e presença vocal.',
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

    const targetDesc = youtubeUrl
      ? `vídeo do YouTube "${fileName || 'música'}" (segmento de 20s a 80s)`
      : `ficheiro de áudio "${fileName || 'faixa'}" (primeiros 3 minutos)`;

    const systemInstruction = `És um produtor musical consagrado, engenheiro de som e letrista profissional de altíssima precisão métrica.
A tua missão é analisar com a máxima atenção o ${targetDesc} e gerar uma versão alternativa em texto, de forma direta e rápida. Foca-te primordialmente na melodia, letra vocal, ritmo e instrumentação.

REGRAS OBRIGATÓRIAS:
1. IDIOMA E DETETOR:
   - Deteta o idioma cantado na música ou no vídeo.
   - Escreve a letra alternativa E a descrição do estilo musical (incluindo todas as etiquetas de estilo) nesse mesmo idioma detetado.
   - Se for Português: estritamente português de Portugal (vocabulário, ortografia e expressões europeias, nunca brasileiras).
   - Se for Inglês: inglês internacional neutro, sem gíria regional.
   - Outro idioma: mantém o idioma original.
   - Músicas com mais de um idioma: usa o idioma predominante.
   - Música instrumental ou sem idioma identificável: escreve o estilo em português de Portugal, e a letra como "Instrumental: sem letra".
   - Devolve no campo "idiomaLetra" o nome do idioma detetado.
   - Se houver pouca certeza do idioma ou do significado de uma expressão (especialmente em idiomas africanos), mantém a expressão original em vez de a inventar, e adiciona o aviso: "Este idioma pode ter menos precisão. Revê a letra antes de publicar." ao final da letra.
2. QUANDO A MÚSICA TIVER LETRA CANTADA REAL ('isInstrumental': false):
   - Escreve uma letra nova que siga de muito perto a original em tema, emoção, narrativa, número de versos por secção ([Verso], [Refrão], [Verso 2], [Refrão], [Ponte]), métrica e esquema de rimas.
   - NUNCA copies frases da letra original. Palavras e imagens 100% novas.
   - LIMITE OBRIGATÓRIO: A letra DEVE ter menos de 4500 caracteres no total.
3. ESTILO MUSICAL (LIMITE ESTRITO):
   - O estilo sonoro com todos os campos sumariados DEVE ter menos de 950 caracteres no total. Sê conciso, direto e cirúrgico em cada parâmetro.`;

    const userPrompt = youtubeUrl
      ? `Analisa os 60 segundos deste vídeo do YouTube (de 20s a 80s: ${fileName || 'faixa'}). Foca-te estritamente no áudio, ritmo, melodia, letra e instrumentação musical.
1. Identifica se é instrumental/batida ou se tem voz cantada.
2. Gera a letra alternativa ([Verso], [Refrão], [Ponte]) ou "Instrumental: sem letra" (< 4000 caracteres).
3. Descreve o estilo sonoro original com etiquetas em Português de Portugal (< 900 caracteres).`
      : `Analisa os primeiros 3 minutos do áudio (${fileName || 'faixa'}).
1. Identifica se é instrumental/batida ou se tem voz cantada.
2. Gera a letra alternativa ([Verso], [Refrão], [Ponte]) ou "Instrumental: sem letra" (< 4000 caracteres).
3. Descreve o estilo sonoro original com etiquetas em Português de Portugal (< 900 caracteres).`;

    // Converte links youtu.be para o formato canónico youtube.com/watch?v=ID antes de enviar
    const videoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;
    const standardYoutubeUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : (youtubeUrl ? youtubeUrl.trim() : '');

    const streamConfig: any = {
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
    };

    // Para YouTube, usa resolução de média baixa (MEDIA_RESOLUTION_LOW) para ser mais rápido
    // e NÃO usa ferramentas nem pesquisa na mesma chamada
    if (youtubeUrl) {
      streamConfig.mediaResolution = MediaResolution.MEDIA_RESOLUTION_LOW;
    }

    let fullText = '';
    let hasSentLyricsStep = false;
    let hasSentStyleStep = false;

    const processStreamChunks = async (streamInstance: any): Promise<string> => {
      let accumulated = '';
      for await (const chunk of streamInstance) {
        const chunkText = chunk.text || '';
        accumulated += chunkText;

        // Notificação progressiva no stream
        if (!hasSentLyricsStep && (accumulated.includes('"letra"') || accumulated.length > 80)) {
          hasSentLyricsStep = true;
          sendEvent({
            step: 'lyrics',
            message: 'A escrever a letra alternativa...',
            detail: 'A alinhar métrica silábica, rimas e estrutura [Verso]/[Refrão].',
          });
        }

        if (!hasSentStyleStep && (accumulated.includes('"estilo"') || accumulated.length > 500)) {
          hasSentStyleStep = true;
          sendEvent({
            step: 'style',
            message: 'A criar o estilo musical...',
            detail: 'A compilar etiquetas sonoras, timbres e parâmetros acústicos.',
          });
        }
      }
      return accumulated;
    };

    if (youtubeUrl) {
      // 1. TENTATIVA 1: com videoMetadata (20s a 80s)
      const contentsWithOffsets = [
        {
          fileData: {
            fileUri: standardYoutubeUrl,
            mimeType: 'video/*',
          },
          videoMetadata: {
            startOffset: '20s',
            endOffset: '80s',
          },
        },
        {
          text: userPrompt,
        },
      ];

      // 2. TENTATIVA 2: sem offsets (vídeo completo se tiver menos de 80s ou falha de offset)
      const contentsWithoutOffsets = [
        {
          fileData: {
            fileUri: standardYoutubeUrl,
            mimeType: 'video/*',
          },
        },
        {
          text: userPrompt,
        },
      ];

      let streamSuccess = false;
      let lastApiError: any = null;

      try {
        const stream1 = await ai.models.generateContentStream({
          model: 'gemini-3.5-flash-lite',
          contents: contentsWithOffsets,
          config: streamConfig,
        });
        fullText = await processStreamChunks(stream1);
        streamSuccess = true;
      } catch (err1: any) {
        lastApiError = err1;
        console.warn('Tentativa 1 (gemini-3.5-flash-lite) falhou:', err1?.message || err1);

        try {
          const stream2 = await ai.models.generateContentStream({
            model: 'gemini-3.8-flash',
            contents: contentsWithOffsets,
            config: streamConfig,
          });
          fullText = await processStreamChunks(stream2);
          streamSuccess = true;
        } catch (err2: any) {
          lastApiError = err2;
          console.error('Tentativa 2 (gemini-3.8-flash fallback) falhou:', err2?.message || err2);
        }
      }

      if (!streamSuccess || !fullText) {
        // Ambas as tentativas falharam: reporta o erro com detalhes reais da API
        const details = extractApiErrorDetails(lastApiError);
        const errMsg = details.full;

        const isYoutubeAccessIssue =
          errMsg.includes('URL_UNREACHABLE') ||
          errMsg.includes('Cannot fetch content') ||
          errMsg.includes('INVALID_ARGUMENT') ||
          errMsg.includes('PERMISSION_DENIED') ||
          errMsg.includes('private') ||
          errMsg.includes('restricted') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('NOT_FOUND');

        const friendlyMessage = isYoutubeAccessIssue
          ? 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.'
          : cleanGeminiErrorMessage(lastApiError);

        sendEvent({
          step: 'error',
          message: friendlyMessage,
          error: friendlyMessage,
          errorDetails: details,
        } as any);
        return res.end();
      }
    } else {
      // Fluxo de ficheiro de áudio local
      const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, '');
      let geminiMime = (mimeType || 'audio/mp3').toLowerCase();
      if (geminiMime === 'audio/wave' || geminiMime === 'audio/x-wav') {
        geminiMime = 'audio/wav';
      } else if (geminiMime === 'audio/mpeg') {
        geminiMime = 'audio/mp3';
      }

      const contents = [
        {
          inlineData: {
            mimeType: geminiMime,
            data: cleanBase64,
          },
        },
        {
          text: userPrompt,
        },
      ];

      try {
        const stream = await ai.models.generateContentStream({
          model: 'gemini-3.5-flash-lite',
          contents,
          config: streamConfig,
        });
        fullText = await processStreamChunks(stream);
      } catch (audioErr: any) {
        throw audioErr;
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
          model: 'gemini-3.5-flash-lite',
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
          model: 'gemini-3.5-flash-lite',
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
    const details = extractApiErrorDetails(error);
    const errMsg = details.full;
    const isYoutubeAccessIssue =
      req.body?.youtubeUrl &&
      (errMsg.includes('URL_UNREACHABLE') ||
        errMsg.includes('Cannot fetch content') ||
        errMsg.includes('INVALID_ARGUMENT') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('private') ||
        errMsg.includes('restricted') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('NOT_FOUND'));

    const friendlyError = isYoutubeAccessIssue
      ? 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.'
      : cleanGeminiErrorMessage(error);

    sendEvent({
      step: 'error',
      message: isYoutubeAccessIssue ? 'Não consegui aceder a este vídeo.' : friendlyError,
      error: friendlyError,
      errorDetails: details,
    } as any);
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
      model: 'gemini-3.5-flash-lite',
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
          model: 'gemini-3.5-flash-lite',
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
 * Endpoint para atualizar o idioma manualmente e traduzir/adaptar letra e estilo.
 */
app.post('/api/update-language', async (req, res) => {
  try {
    const { analysisId, novoIdioma } = req.body;
    if (!novoIdioma) {
      return res.status(400).json({ error: 'Idioma não especificado.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da API Gemini não configurada.' });
    }

    const cached = analysisId ? audioAnalysisCache.get(analysisId) : null;
    if (!cached) {
      return res.status(404).json({ error: 'Análise não encontrada na memória.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const isEnglish = novoIdioma.toLowerCase().includes('ingl');
    const isPortuguese = novoIdioma.toLowerCase().includes('portugu');
    const isAuto = novoIdioma === 'Detetar automaticamente';

    const prompt = `Adapta, traduz e reescreve a letra alternativa E a descrição do estilo musical (incluindo etiquetas) ${isAuto ? 'para o idioma original da música (deteta-o novamente a partir da letra atual).' : 'para o seguinte idioma escolhido pelo utilizador: "' + novoIdioma + '".'}
${isPortuguese ? '- Usa estritamente português de Portugal (vocabulário, ortografia e expressões europeias, nunca brasileiras).' : ''}
${isEnglish ? '- Usa inglês internacional neutro, sem gíria regional.' : ''}

Perfil musical anterior:
Letra:
${cached.letra}

Estilo:
${typeof cached.estilo === 'string' ? cached.estilo : JSON.stringify(cached.estilo)}

REGRAS:
1. Mantém a estrutura com [Verso], [Refrão], [Ponte] e a mesma métrica/rimas no idioma "${novoIdioma}".
2. A descrição do estilo e etiquetas devem também estar em "${novoIdioma}" (ou Português se for instrumental).
3. Letra < 4500 caracteres. Estilo < 950 caracteres.

Devolve estritamente um JSON com a estrutura:
{
  "letra": "...",
  "estilo": { "descricao": "...", "tags": ["..."], "bpm": "...", "tom": "...", "genero": "...", "emocao": "...", "tipoVoz": "..." },
  "idiomaLetra": "${novoIdioma}"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
      },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      const match = response.text?.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Falha ao interpretar JSON.');
    }

    const updatedLetra = parsed.letra || cached.letra;
    const updatedEstilo = parsed.estilo || cached.estilo;

    cached.letra = updatedLetra;
    cached.estilo = updatedEstilo;
    cached.idiomaLetra = novoIdioma;

    return res.json({
      letra: updatedLetra,
      estilo: updatedEstilo,
      idiomaLetra: novoIdioma,
      analysisId,
    });
  } catch (error: any) {
    console.error('Erro em /api/update-language:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao atualizar o idioma.' });
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
      model: 'gemini-3.5-flash-lite',
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
          model: 'gemini-3.5-flash-lite',
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
      model: 'gemini-3.5-flash-lite',
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
