/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Music,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Wand2,
  Info,
  Youtube,
  Zap,
  Upload,
  ChevronDown,
  Copy,
  Check,
  Languages,
} from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { YouTubeLinkInput } from './components/YouTubeLinkInput';
import { LyricsCard } from './components/LyricsCard';
import { StyleCard } from './components/StyleCard';
import { YouTubeSeoCard } from './components/YouTubeSeoCard';
import { ProcessingState } from './components/ProcessingState';
import { AudioFileInfo, YouTubeVideoInfo, SongAlternativeResult, ErrorDetails } from './types';
import { trimAudioToMax3Minutes } from './utils/audioTrimmer';

export default function App() {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');
  const [audioInfo, setAudioInfo] = useState<AudioFileInfo | null>(null);
  const [selectedYouTubeVideo, setSelectedYouTubeVideo] = useState<YouTubeVideoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('listening');
  const [stepMessage, setStepMessage] = useState<string>('A ouvir o áudio...');
  const [stepDetail, setStepDetail] = useState<string>('A analisar tom, BPM, ritmo e presença vocal com modelo Gemini Flash...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [result, setResult] = useState<SongAlternativeResult | null>(null);

  const [quotaCountdown, setQuotaCountdown] = useState<number | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Quota countdown timer
  useEffect(() => {
    if (quotaCountdown === null || quotaCountdown <= 0) return;
    const interval = setInterval(() => {
      setQuotaCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quotaCountdown]);

  // States for secondary fast actions (no audio re-upload)
  const [isRegeneratingLyrics, setIsRegeneratingLyrics] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [isGeneratingLyricsForBeat, setIsGeneratingLyricsForBeat] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);

  const handleUpdateLanguage = async (novoIdioma: string) => {
    if (!result?.analysisId) return;
    setIsUpdatingLanguage(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/update-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result.analysisId,
          novoIdioma,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao atualizar o idioma.');
      }
      setResult((prev) => prev ? {
        ...prev,
        letra: data.letra,
        estilo: data.estilo,
        idiomaLetra: data.idiomaLetra,
      } : null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao atualizar o idioma.');
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  // Clean up object URLs when audio changes
  useEffect(() => {
    return () => {
      if (audioInfo?.url && audioInfo.url.startsWith('blob:')) {
        URL.revokeObjectURL(audioInfo.url);
      }
    };
  }, [audioInfo]);

  const handleAudioSelected = (file: File, url: string) => {
    setErrorMessage(null);
    setResult(null);
    setAudioInfo({
      file,
      name: file.name,
      size: file.size,
      type: file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mp3'),
      url,
    });
  };

  const handleRemoveAudio = () => {
    if (audioInfo?.url && audioInfo.url.startsWith('blob:')) {
      URL.revokeObjectURL(audioInfo.url);
    }
    setAudioInfo(null);
    setResult(null);
    setErrorMessage(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Executa a análise no servidor via Streaming SSE.
   * Suporta tanto ficheiro de áudio como link direto do YouTube.
   */
  const executeCreateAlternative = async (
    requestPayload: any,
    sourceMetadata: {
      sourceType: 'file' | 'youtube';
      sourceTitle: string;
      sourceThumbnail?: string;
    }
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);
    setProcessingStep('listening');

    if (sourceMetadata.sourceType === 'youtube') {
      setStepMessage('A aceder ao vídeo do YouTube (segundos 20s a 80s)...');
      setStepDetail('A analisar 60 segundos com resolução leve e foco no áudio musical...');
    } else {
      setStepMessage('A ouvir os primeiros 3 minutos do áudio...');
      setStepDetail('A analisar tom, BPM, ritmo e presença vocal com modelo Gemini Flash...');
    }

    try {
      const response = await fetch('/api/create-alternative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok && !response.body) {
        throw new Error('Falha ao comunicar com o servidor.');
      }

      // Leitura do fluxo SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';
      let receivedFinalResult = false;
      let encounteredStreamError = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n\n');
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const event = JSON.parse(trimmed.slice(6));
                if (event.step === 'error') {
                  encounteredStreamError = true;
                  const rawErr = event.error || event.message || '';
                  const fullStr = event.errorDetails?.full || rawErr;
                  const isQuota =
                    rawErr.includes('429') ||
                    rawErr.includes('RESOURCE_EXHAUSTED') ||
                    rawErr.toLowerCase().includes('quota') ||
                    fullStr.includes('429') ||
                    fullStr.includes('RESOURCE_EXHAUSTED');

                  if (isQuota) {
                    setErrorMessage('Limite de utilização atingido. Aguarda um minuto e tenta novamente.');
                    setQuotaCountdown(60);
                  } else {
                    setErrorMessage(rawErr || 'Não consegui processar o áudio.');
                  }

                  if (event.errorDetails) {
                    setErrorDetails(event.errorDetails);
                  } else {
                    setErrorDetails({ message: rawErr, full: rawErr, code: isQuota ? 429 : 'ERROR' });
                  }
                  setIsLoading(false);
                  return;
                }

                if (event.step && event.step !== 'done') {
                  setProcessingStep(event.step);
                  if (event.message) setStepMessage(event.message);
                  if (event.detail) setStepDetail(event.detail);
                }

                if (event.step === 'done' && event.result) {
                  receivedFinalResult = true;
                  setResult({
                    analysisId: event.result.analysisId,
                    letra: event.result.letra,
                    estilo: event.result.estilo,
                    idiomaLetra: event.result.idiomaLetra,
                    isInstrumental: Boolean(event.result.isInstrumental),
                    letraCriada: false,
                    youtubeSeo: undefined, // O Pacote YouTube é gerado apenas sob pedido
                    sourceType: sourceMetadata.sourceType,
                    sourceTitle: sourceMetadata.sourceTitle,
                    sourceThumbnail: sourceMetadata.sourceThumbnail,
                  });
                }
              } catch (parseErr: any) {
                console.warn('Erro ao processar linha do stream:', parseErr);
              }
            }
          }
        }
      }

      if (!encounteredStreamError && !receivedFinalResult && streamBuffer.includes('data: ')) {
        const jsonStr = streamBuffer.replace(/^data:\s*/, '').trim();
        try {
          const event = JSON.parse(jsonStr);
          if (event.step === 'error') {
            const rawErr = event.error || event.message || '';
            const isQuota = rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.toLowerCase().includes('quota');
            if (isQuota) {
              setErrorMessage('Limite de utilização atingido. Aguarda um minuto e tenta novamente.');
              setQuotaCountdown(60);
            } else {
              setErrorMessage(rawErr || 'Não consegui processar o áudio.');
            }
            if (event.errorDetails) setErrorDetails(event.errorDetails);
            return;
          }
          if (event.result) {
            setResult({
              analysisId: event.result.analysisId,
              letra: event.result.letra,
              estilo: event.result.estilo,
              idiomaLetra: event.result.idiomaLetra,
              isInstrumental: Boolean(event.result.isInstrumental),
              letraCriada: false,
              sourceType: sourceMetadata.sourceType,
              sourceTitle: sourceMetadata.sourceTitle,
              sourceThumbnail: sourceMetadata.sourceThumbnail,
            });
          }
        } catch {}
      }

      // Rola suavemente até aos resultados
      setTimeout(() => {
        const resultsEl = document.getElementById('results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Erro na criação da versão alternativa:', err);
      const errStr = String(err?.message || err);
      const isQuota = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.toLowerCase().includes('quota');
      if (isQuota) {
        setErrorMessage('Limite de utilização atingido. Aguarda um minuto e tenta novamente.');
        setQuotaCountdown(60);
      } else {
        setErrorMessage(err.message || 'Falha ao comunicar com o servidor. Por favor tenta novamente.');
      }
      setErrorDetails((prev) => prev || { message: errStr, full: errStr, code: isQuota ? 429 : 'ERROR' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Chamada 1 via Ficheiro: Análise do áudio (máx. 3 minutos)
   */
  const handleCreateAlternativeFromFile = async () => {
    if (!audioInfo) {
      setErrorMessage('Por favor seleciona um ficheiro de áudio primeiro.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProcessingStep('listening');
    setStepMessage('A otimizar áudio no navegador...');
    setStepDetail('A converter para 16kHz mono (máx. 3 minutos) para envio rápido...');

    try {
      const { file: processedFile } = await trimAudioToMax3Minutes(audioInfo.file, (detail) => {
        setStepDetail(detail);
      });
      const base64Data = await fileToBase64(processedFile);

      let mimeType = processedFile.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = processedFile.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mp3';
      }

      await executeCreateAlternative(
        {
          audioBase64: base64Data,
          mimeType,
          fileName: audioInfo.name,
        },
        {
          sourceType: 'file',
          sourceTitle: audioInfo.name,
        }
      );
    } catch (err: any) {
      console.error('Erro ao processar ficheiro de áudio:', err);
      setErrorMessage(err.message || 'Erro ao processar ficheiro de áudio.');
      setIsLoading(false);
    }
  };

  /**
   * Chamada 1 via Link do YouTube: Análise direta de vídeo (20s a 80s) sem download
   */
  const handleCreateAlternativeFromYouTube = async () => {
    if (!selectedYouTubeVideo) {
      setErrorMessage('Por favor insere e confirma um link do YouTube antes de continuar.');
      return;
    }

    await executeCreateAlternative(
      {
        youtubeUrl: selectedYouTubeVideo.url,
        fileName: selectedYouTubeVideo.title,
      },
      {
        sourceType: 'youtube',
        sourceTitle: selectedYouTubeVideo.title,
        sourceThumbnail: selectedYouTubeVideo.thumbnailUrl,
      }
    );
  };

  /**
   * "Gerar outra versão":
   * Reutiliza a análise do áudio em memória (analysisId), SEM re-processar o áudio.
   */
  const handleRegenerateLyrics = async () => {
    if (!result) return;
    setIsRegeneratingLyrics(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/regenerate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result.analysisId,
          estilo: result.estilo,
          isInstrumental: result.isInstrumental,
          idiomaLetra: result.idiomaLetra,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar outra versão.');
      }

      setResult((prev) =>
        prev
          ? {
              ...prev,
              letra: data.letra,
              idiomaLetra: data.idiomaLetra || prev.idiomaLetra,
            }
          : null
      );
    } catch (err: any) {
      console.error('Erro ao gerar outra versão:', err);
      setErrorMessage(err.message || 'Falha ao gerar outra versão de letra.');
    } finally {
      setIsRegeneratingLyrics(false);
    }
  };

  /**
   * Chamada 2: "Gerar pacote YouTube"
   * Chamado APENAS quando o utilizador clica explicitamente no botão.
   * Não reprocessa áudio, usa a análise e a letra existentes.
   */
  const handleGenerateYouTubeSeo = async () => {
    if (!result) return;
    setIsGeneratingSeo(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/generate-youtube-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result.analysisId,
          letra: result.letra,
          estilo: result.estilo,
          idiomaLetra: result.idiomaLetra,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar pacote YouTube SEO.');
      }

      setResult((prev) =>
        prev
          ? {
              ...prev,
              youtubeSeo: data.youtubeSeo,
            }
          : null
      );

      // Smooth scroll to YouTube card
      setTimeout(() => {
        const seoCardEl = document.getElementById('youtube-seo-card');
        if (seoCardEl) {
          seoCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Erro ao gerar pacote YouTube:', err);
      setErrorMessage(err.message || 'Falha ao gerar o pacote YouTube.');
    } finally {
      setIsGeneratingSeo(false);
    }
  };

  /**
   * "Criar letra para esta batida":
   * Para faixas instrumentais, cria letra rápida sem reprocessar áudio.
   */
  const handleCreateLyricsForBeat = async (idioma: 'pt' | 'en') => {
    if (!result) return;
    setIsGeneratingLyricsForBeat(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/create-lyrics-for-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result.analysisId,
          beatStyle: result.estilo,
          idioma,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao compor letra para a batida.');
      }

      setResult((prev) =>
        prev
          ? {
              ...prev,
              letra: data.letra,
              idiomaLetra: data.idiomaLetra,
              letraCriada: true,
            }
          : null
      );
    } catch (err: any) {
      console.error('Erro ao compor letra para batida:', err);
      setErrorMessage(err.message || 'Falha ao compor letra para a batida.');
    } finally {
      setIsGeneratingLyricsForBeat(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-purple-600/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/3 -right-40 w-[450px] h-[350px] bg-violet-600/5 blur-[120px] rounded-full" />
      </div>

      {/* Navigation / Header */}
      <header className="relative border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-md shadow-purple-900/20">
              <Music className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
                Music Creator
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Versões alternativas inspiradas no teu áudio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-medium text-zinc-300">Gemini Flash · Streaming</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Intro Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-500/30 text-purple-300 text-xs font-medium">
            <Wand2 className="w-3.5 h-3.5" />
            <span>Processamento rápido em streaming por etapas</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-zinc-100">
            Cria uma versão alternativa <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-purple-200 bg-clip-text text-transparent">
              inspirada na tua música
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Carrega uma faixa em MP3 ou WAV. O modelo analisa um trecho de 60 segundos com raciocínio otimizado,
            descreve o estilo original e compõe uma letra nova que encaixa na melodia.
          </p>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="w-full bg-red-950/40 border border-red-500/40 rounded-xl p-4 flex flex-col gap-3 text-red-200 text-sm animate-fade-in shadow-lg shadow-red-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-100">Atenção</h4>
                <p className="text-red-300/90 text-xs sm:text-sm mt-0.5">
                  {errorMessage}
                  {quotaCountdown !== null && quotaCountdown > 0 && (
                    <span className="block font-bold text-amber-300 mt-1">
                      Aguarda {quotaCountdown} segundos antes de tentar novamente...
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setErrorDetails(null);
                }}
                className="text-red-400 hover:text-red-200 text-xs font-semibold px-2 py-1 rounded hover:bg-red-900/40 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {errorDetails && (
              <div className="border-t border-red-500/30 pt-3 mt-1">
                <button
                  type="button"
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="text-xs font-medium text-red-300 hover:text-red-100 flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showErrorDetails ? 'rotate-180' : ''}`} />
                  <span>Detalhes do erro</span>
                </button>
                {showErrorDetails && (
                  <div className="mt-2 bg-red-950/80 border border-red-500/40 rounded-lg p-3 font-mono text-[11px] text-red-200 overflow-x-auto space-y-1">
                    {errorDetails.code && (
                      <div><strong className="text-red-300">Código:</strong> {errorDetails.code}</div>
                    )}
                    {errorDetails.message && (
                      <div><strong className="text-red-300">Mensagem:</strong> {errorDetails.message}</div>
                    )}
                    {errorDetails.full && errorDetails.full !== errorDetails.message && (
                      <div><strong className="text-red-300">Completo:</strong> {errorDetails.full}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Audio / Video Input Card with Two Tabs */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl backdrop-blur-sm shadow-xl overflow-hidden">
          {/* Two Tabs: Enviar ficheiro / Colar link do YouTube */}
          <div className="flex border-b border-zinc-800 bg-zinc-950/60 p-1.5 sm:p-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('file');
                setErrorMessage(null);
              }}
              disabled={isLoading || (quotaCountdown !== null && quotaCountdown > 0)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm shadow-purple-950/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 border border-transparent'
              }`}
            >
              <Upload className="w-4 h-4 text-purple-400" />
              <span>Enviar ficheiro</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('youtube');
                setErrorMessage(null);
              }}
              disabled={isLoading || (quotaCountdown !== null && quotaCountdown > 0)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'youtube'
                  ? 'bg-red-600/20 text-red-200 border border-red-500/40 shadow-sm shadow-red-950/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 border border-transparent'
              }`}
            >
              <Youtube className="w-4 h-4 text-red-500" />
              <span>Colar link do YouTube</span>
            </button>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {activeTab === 'file' ? (
              /* Separador 1: Enviar ficheiro */
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    Ficheiro de áudio da música
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 pl-8">
                    Carrega o ficheiro da canção em MP3 ou WAV (são analisados os primeiros 3 minutos).
                  </p>
                </div>

                {!audioInfo ? (
                  <AudioUploader
                    onAudioSelected={handleAudioSelected}
                    onError={(msg) => setErrorMessage(msg)}
                    isLoading={isLoading || (quotaCountdown !== null && quotaCountdown > 0)}
                  />
                ) : (
                  <div className="space-y-4">
                    <AudioPlayer audioInfo={audioInfo} onRemove={handleRemoveAudio} />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleRemoveAudio}
                        disabled={isLoading || (quotaCountdown !== null && quotaCountdown > 0)}
                        className="text-xs text-zinc-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Escolher outro ficheiro de áudio</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Botão de ação: Criar versão alternativa */}
                <div className="pt-2 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCreateAlternativeFromFile}
                    disabled={!audioInfo || isLoading || (quotaCountdown !== null && quotaCountdown > 0)}
                    className={`w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                      !audioInfo || isLoading || (quotaCountdown !== null && quotaCountdown > 0)
                        ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700/50'
                        : 'bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white shadow-purple-600/30 hover:shadow-purple-500/40 border border-purple-400/30'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>A processar áudio...</span>
                      </>
                    ) : quotaCountdown !== null && quotaCountdown > 0 ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span>Aguardar ({quotaCountdown}s)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 text-purple-200" />
                        <span>Criar versão alternativa</span>
                      </>
                    )}
                  </button>

                  {!audioInfo && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Carrega uma música ou seleciona um exemplo para desbloquear</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Separador 2: Colar link do YouTube */
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    Música através de link do YouTube
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 pl-8">
                    Cola o link de um vídeo público. O Gemini analisa diretamente o áudio dos 60 segundos (de 20s a 80s) sem descarregar nada.
                  </p>
                </div>

                <YouTubeLinkInput
                  onVideoSelected={setSelectedYouTubeVideo}
                  selectedVideo={selectedYouTubeVideo}
                  onSubmit={handleCreateAlternativeFromYouTube}
                  isLoading={isLoading}
                  onClear={() => setSelectedYouTubeVideo(null)}
                  quotaCountdown={quotaCountdown}
                />
              </div>
            )}
          </div>
        </section>

        {/* Processing Indicator com Streaming de Etapas */}
        {isLoading && (
          <section className="animate-fade-in">
            <ProcessingState
              currentStep={processingStep}
              stepMessage={stepMessage}
              stepDetail={stepDetail}
            />
          </section>
        )}

        {/* Results Area with the two cards: "Letra alternativa" and "Estilo musical" */}
        {result && !isLoading && (
          <section id="results-section" className="space-y-6 pt-4 animate-fade-in">
            {/* Header com indicador de fonte da música */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Versão alternativa gerada com sucesso</span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-100">
                  Resultado da criação musical
                </h3>

                {/* Badge da fonte da música */}
                {result.sourceType === 'youtube' && result.sourceTitle && (
                  <div className="inline-flex items-center gap-2 pt-1">
                    {result.sourceThumbnail && (
                      <img
                        src={result.sourceThumbnail}
                        alt=""
                        className="w-8 h-6 rounded object-cover border border-zinc-700 shrink-0"
                      />
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-300">
                      <Youtube className="w-3.5 h-3.5 text-red-500" />
                      <strong className="text-white font-medium truncate max-w-[280px] sm:max-w-md">
                        {result.sourceTitle}
                      </strong>
                      <span className="text-zinc-500 text-[11px]">(20s a 80s analisados)</span>
                    </span>
                  </div>
                )}

                {result.sourceType === 'file' && result.sourceTitle && (
                  <div className="inline-flex items-center gap-1.5 pt-1 text-xs text-zinc-300">
                    <Music className="w-3.5 h-3.5 text-purple-400" />
                    <span>Faixa:</span>
                    <strong className="text-white font-medium truncate max-w-[280px] sm:max-w-md">
                      {result.sourceTitle}
                    </strong>
                    <span className="text-zinc-500 text-[11px]">(primeiros 3 min analisados)</span>
                  </div>
                )}
              </div>

              {/* Botão "Gerar outra versão" que reutiliza a análise em memória sem re-enviar o áudio */}
              <button
                onClick={handleRegenerateLyrics}
                disabled={isRegeneratingLyrics}
                className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer disabled:opacity-50"
                title="Gera uma nova letra com base na análise musical em memória (instantâneo)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingLyrics ? 'animate-spin' : ''}`} />
                <span>{isRegeneratingLyrics ? 'A gerar nova versão...' : 'Gerar outra versão'}</span>
              </button>
            </div>

            {/* Idioma detetado & Correcção manual */}
            <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-zinc-400 block">Idioma cantado detetado automaticamente</span>
                  <span className="font-semibold text-white text-sm sm:text-base">
                    Idioma detetado: <span className="text-purple-300">{result.idiomaLetra || 'Português (Portugal)'}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-zinc-400 shrink-0">Corrigir idioma:</span>
                <select
                  value={result.idiomaLetra || 'Português (Portugal)'}
                  onChange={(e) => handleUpdateLanguage(e.target.value)}
                  disabled={isUpdatingLanguage}
                  className="bg-zinc-900 border border-zinc-700 hover:border-purple-500/50 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                >
                  <option value="Detetar automaticamente">Detetar automaticamente</option>
                  <option value="Português (Portugal)">Português (Portugal)</option>
                  <option value="Inglês">Inglês</option>
                  <option value="Africâner (Afrikaans)">Africâner (Afrikaans)</option>
                  <option value="Chewa">Chewa</option>
                  <option value="Espanhol">Espanhol</option>
                  <option value="Francês">Francês</option>
                  <option value="Italiano">Italiano</option>
                  <option value="Alemão">Alemão</option>
                  <option value="isiNdebele (Norte/Sul)">isiNdebele (Norte/Sul)</option>
                  <option value="isiXhosa (Xhosa)">isiXhosa (Xhosa)</option>
                  <option value="isiZulu (Zulu)">isiZulu (Zulu)</option>
                  <option value="Kalanga">Kalanga</option>
                  <option value="Nambya">Nambya</option>
                  <option value="Sepedi (Sotho do Norte)">Sepedi (Sotho do Norte)</option>
                  <option value="Sesotho (Sotho)">Sesotho (Sotho)</option>
                  <option value="Setswana (Tswana)">Setswana (Tswana)</option>
                  <option value="Shona">Shona</option>
                  <option value="siSwati">siSwati</option>
                  <option value="Tonga">Tonga</option>
                  <option value="Tshivenda (Venda)">Tshivenda (Venda)</option>
                  <option value="Xitsonga (Xangane)">Xitsonga (Xangane)</option>
                  <option value="Outro">Outro idioma original</option>
                </select>
                {isUpdatingLanguage && (
                  <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                )}
              </div>
            </div>

            {/* Two Cards Grid: Letra alternativa & Estilo musical */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Card 1: Letra alternativa */}
              <div className="h-full">
                <LyricsCard
                  lyrics={result.letra}
                  idiomaLetra={result.idiomaLetra}
                  isInstrumental={result.isInstrumental}
                  letraCriada={result.letraCriada}
                  onGenerateLyricsForBeat={handleCreateLyricsForBeat}
                  isGeneratingLyricsForBeat={isGeneratingLyricsForBeat}
                />
              </div>

              {/* Card 2: Estilo musical */}
              <div className="h-full">
                <StyleCard styleData={result.estilo} />
              </div>
            </div>

            {/* Card 3: Pacote YouTube SEO (Chamada 2 sob pedido explícito) */}
            <div id="youtube-seo-card" className="pt-2">
              {result.youtubeSeo ? (
                <YouTubeSeoCard
                  seo={result.youtubeSeo}
                  idiomaLetra={result.idiomaLetra}
                  onRegenerate={handleGenerateYouTubeSeo}
                  isRegenerating={isGeneratingSeo}
                />
              ) : (
                <div className="bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/30 rounded-2xl p-6 sm:p-7 shadow-xl shadow-purple-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0 shadow-md shadow-red-950/20">
                      <Youtube className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display font-semibold text-zinc-100 text-lg">
                          Pacote YouTube (SEO)
                        </h4>
                        <span className="text-[10px] font-semibold text-purple-300 bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 rounded">
                          Sob pedido
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                        Cria 5 títulos com gancho emocional, descrição otimizada com a letra completa, tags, hashtags, textos de miniatura e comentário fixado. Reutiliza a análise em memória instantaneamente.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateYouTubeSeo}
                    disabled={isGeneratingSeo}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:shadow-purple-500/40 border border-purple-400/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingSeo ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>A criar pacote YouTube...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-200" />
                        <span>Gerar pacote YouTube</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-6 mt-12 text-center text-xs text-zinc-400">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-zinc-300">Music Creator</span>
            <span>—</span>
            <span>Composição alternativa inteligente</span>
          </div>
          <p className="text-zinc-400">
            Processamento de áudio direto com o modelo multimodal Gemini Flash.
          </p>
        </div>
      </footer>
    </div>
  );
}
