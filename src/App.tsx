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
  Sliders,
  CheckCircle2,
  Wand2,
  Info,
} from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { LyricsCard } from './components/LyricsCard';
import { StyleCard } from './components/StyleCard';
import { ProcessingState } from './components/ProcessingState';
import { AudioFileInfo, SongAlternativeResult } from './types';

export default function App() {
  const [audioInfo, setAudioInfo] = useState<AudioFileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SongAlternativeResult | null>(null);

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
        // Extract raw base64 after comma
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleCreateAlternative = async () => {
    if (!audioInfo) {
      setErrorMessage('Por favor seleciona um ficheiro de áudio primeiro.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Convert file to base64
      const base64Data = await fileToBase64(audioInfo.file);

      // Determine clean mimeType
      let mimeType = audioInfo.file.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = audioInfo.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mp3';
      }

      const res = await fetch('/api/create-alternative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: base64Data,
          mimeType,
          fileName: audioInfo.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ocorreu um erro ao processar a música.');
      }

      if (!data.letra || !data.estilo) {
        throw new Error('A resposta do modelo não contém a letra ou o estilo esperados.');
      }

      setResult({
        letra: data.letra,
        estilo: data.estilo,
      });

      // Scroll smoothly to results
      setTimeout(() => {
        const resultsEl = document.getElementById('results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Erro na criação da versão alternativa:', err);
      setErrorMessage(
        err.message || 'Falha ao comunicar com o servidor. Por favor tenta novamente.'
      );
    } finally {
      setIsLoading(false);
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
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="font-medium text-zinc-300">Gemini Audio AI</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Intro Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-500/30 text-purple-300 text-xs font-medium">
            <Wand2 className="w-3.5 h-3.5" />
            <span>Da tua música para uma obra totalmente nova</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-zinc-100">
            Cria uma versão alternativa <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-purple-200 bg-clip-text text-transparent">
              inspirada na tua música
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Envia uma faixa em MP3 ou WAV. A inteligência artificial ouve a música, identifica o
            tom, BPM, instrumentos e emoção, e compõe uma letra original inédita com descrição de estilo.
          </p>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="w-full bg-red-950/40 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 text-red-200 text-sm animate-fade-in shadow-lg shadow-red-950/20">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-100">Atenção</h4>
              <p className="text-red-300/90 text-xs sm:text-sm mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 text-xs font-semibold px-2 py-1 rounded hover:bg-red-900/40 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Audio Input & Player Card */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 sm:p-8 backdrop-blur-sm shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center">
                1
              </span>
              Ficheiro de áudio da música
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 pl-8">
              Carrega o ficheiro da canção que servirá de inspiração para a nova versão.
            </p>
          </div>

          {!audioInfo ? (
            <AudioUploader
              onAudioSelected={handleAudioSelected}
              onError={(msg) => setErrorMessage(msg)}
              isLoading={isLoading}
            />
          ) : (
            <div className="space-y-4">
              <AudioPlayer audioInfo={audioInfo} onRemove={handleRemoveAudio} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRemoveAudio}
                  disabled={isLoading}
                  className="text-xs text-zinc-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Escolher outro ficheiro de áudio</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Button: Criar versão alternativa */}
          <div className="pt-2 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleCreateAlternative}
              disabled={!audioInfo || isLoading}
              className={`w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                !audioInfo || isLoading
                  ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700/50'
                  : 'bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white shadow-purple-600/30 hover:shadow-purple-500/40 border border-purple-400/30'
              }`}
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A processar áudio...</span>
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
        </section>

        {/* Processing Indicator */}
        {isLoading && (
          <section className="animate-fade-in">
            <ProcessingState />
          </section>
        )}

        {/* Results Area with the two cards: "Letra alternativa" and "Estilo musical" */}
        {result && !isLoading && (
          <section id="results-section" className="space-y-6 pt-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Versão alternativa gerada com sucesso</span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-100">
                  Resultado da criação musical
                </h3>
              </div>

              <button
                onClick={handleCreateAlternative}
                className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Gerar outra variação</span>
              </button>
            </div>

            {/* Two Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Card 1: Letra alternativa */}
              <div className="h-full">
                <LyricsCard lyrics={result.letra} />
              </div>

              {/* Card 2: Estilo musical */}
              <div className="h-full">
                <StyleCard styleData={result.estilo} />
              </div>
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
            Processamento de áudio direto com o modelo multimodal Gemini.
          </p>
        </div>
      </footer>
    </div>
  );
}
