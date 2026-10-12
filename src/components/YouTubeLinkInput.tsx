/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Youtube,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  Music,
  Clock,
  Radio,
} from 'lucide-react';
import { YouTubeVideoInfo } from '../types';
import { isYouTubeUrl, normalizeYouTubeUrl } from '../utils/youtube';

interface YouTubeLinkInputProps {
  onVideoSelected: (video: YouTubeVideoInfo | null) => void;
  selectedVideo: YouTubeVideoInfo | null;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
  quotaCountdown?: number | null;
}

const PRESET_YOUTUBE_VIDEOS = [
  {
    title: 'Rick Astley - Never Gonna Give You Up',
    label: 'Pop / Dance 80s (Vocal)',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    title: 'Lofi Hip Hop Radio Beats (ChilledCow / Lofi Girl)',
    label: 'Lofi Chill Beat (Instrumental)',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    title: 'Amália Rodrigues - Cheira a Lisboa',
    label: 'Fado Tradicional Português (Vocal)',
    url: 'https://www.youtube.com/watch?v=k-wIeF9B2L8',
  },
];

export const YouTubeLinkInput: React.FC<YouTubeLinkInputProps> = ({
  onVideoSelected,
  selectedVideo,
  onSubmit,
  isLoading,
  onClear,
  quotaCountdown,
}) => {
  const [urlInput, setUrlInput] = useState(selectedVideo?.url || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localErrorDetails, setLocalErrorDetails] = useState<string | null>(null);
  const debounceTimerRef = React.useRef<any>(null);

  const verifyAndFetchVideo = async (rawUrl: string, autoSubmitAfter = false): Promise<YouTubeVideoInfo | null> => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setLocalError(null);
      setLocalErrorDetails(null);
      onVideoSelected(null);
      return null;
    }

    // Validação estrita se é um link do YouTube (youtube.com ou youtu.be)
    if (!isYouTubeUrl(trimmed)) {
      setLocalError('O link tem de ser do YouTube (youtube.com ou youtu.be). Por favor verifica o URL colado.');
      setLocalErrorDetails(null);
      onVideoSelected(null);
      return null;
    }

    setIsVerifying(true);
    setLocalError(null);
    setLocalErrorDetails(null);

    const cleanUrl = normalizeYouTubeUrl(trimmed);

    try {
      const res = await fetch('/api/youtube-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.'
        );
      }

      const videoData: YouTubeVideoInfo = {
        url: cleanUrl,
        title: data.title || 'Vídeo do YouTube',
        author: data.author || '',
        thumbnailUrl: data.thumbnailUrl,
        videoId: data.videoId,
      };

      onVideoSelected(videoData);
      if (autoSubmitAfter) {
        setTimeout(() => onSubmit(), 50);
      }
      return videoData;
    } catch (err: any) {
      console.warn('Verificação visual falhou:', err);
      // Lembrar: "A verificação (título e miniatura) é só visual e não substitui a análise."
      // Se o utilizador clicou diretamente para criar versão alternativa, avançamos com a URL original
      if (autoSubmitAfter) {
        const fallbackVideo: YouTubeVideoInfo = {
          url: cleanUrl,
          title: 'Vídeo do YouTube',
          thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
        };
        onVideoSelected(fallbackVideo);
        setTimeout(() => onSubmit(), 50);
        return fallbackVideo;
      } else {
        setLocalError(
          err.message || 'Não consegui aceder a este vídeo. Usa um vídeo público ou envia o ficheiro de áudio.'
        );
        setLocalErrorDetails(String(err));
        onVideoSelected(null);
        return null;
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);
    if (localError) {
      setLocalError(null);
      setLocalErrorDetails(null);
    }
    if (selectedVideo) {
      onVideoSelected(null);
    }

    // Auto-validação suave com debounce ao colar ou digitar
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const trimmed = val.trim();
    if (trimmed && isYouTubeUrl(trimmed)) {
      debounceTimerRef.current = setTimeout(() => {
        verifyAndFetchVideo(trimmed, false);
      }, 500);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      verifyAndFetchVideo(urlInput, false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        verifyAndFetchVideo(text, false);
      }
    } catch {
      // Ignora erro de permissões da área de transferência
    }
  };

  const handleSubmitClick = () => {
    if (isLoading || isVerifying) return;

    if (selectedVideo) {
      onSubmit();
      return;
    }

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setLocalError('Por favor cola o link de um vídeo do YouTube primeiro.');
      setLocalErrorDetails(null);
      return;
    }

    if (!isYouTubeUrl(trimmed)) {
      setLocalError('O link tem de ser do YouTube (youtube.com ou youtu.be). Por favor verifica o URL colado.');
      setLocalErrorDetails(null);
      return;
    }

    // Dispara a verificação e avança imediatamente para o processamento
    verifyAndFetchVideo(trimmed, true);
  };

  const handleClear = () => {
    setUrlInput('');
    setLocalError(null);
    onClear();
  };

  const handleSelectPreset = (presetUrl: string) => {
    setUrlInput(presetUrl);
    verifyAndFetchVideo(presetUrl);
  };

  return (
    <div className="space-y-6">
      {/* Input box */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-zinc-300">
          Link do vídeo público no YouTube
        </label>

        <div className="relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-red-500">
            <Youtube className="w-5 h-5" />
          </div>

          <input
            type="url"
            value={urlInput}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              if (urlInput.trim() && !selectedVideo && !isVerifying) {
                verifyAndFetchVideo(urlInput);
              }
            }}
            disabled={isLoading || isVerifying}
            placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
            className="w-full pl-11 pr-28 py-3.5 bg-zinc-900 border border-zinc-700/80 focus:border-red-500/80 focus:ring-2 focus:ring-red-500/20 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 transition-all outline-none"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {urlInput && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || isVerifying}
                className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                title="Limpar link"
              >
                Limpar
              </button>
            )}

            {!selectedVideo && (
              <button
                type="button"
                onClick={() => verifyAndFetchVideo(urlInput)}
                disabled={!urlInput.trim() || isVerifying || isLoading}
                className="px-3 py-1.5 bg-red-600/90 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-red-950/30"
              >
                {isVerifying ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>{isVerifying ? 'A validar...' : 'Verificar'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Small tips / quick clipboard paste */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1 text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>São analisados diretamente 60s (intervalo 20s a 80s) sem descarregar ficheiros</span>
          </div>

          {!urlInput && (
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer"
            >
              Colar da área de transferência
            </button>
          )}
        </div>
      </div>

      {/* Preset recommendations */}
      {!selectedVideo && (
        <div className="pt-1 space-y-2">
          <p className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            <span>Ou experimenta um exemplo público:</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_YOUTUBE_VIDEOS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset.url)}
                disabled={isVerifying || isLoading}
                className="px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-all text-left flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Youtube className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[260px]">{preset.title}</span>
                <span className="text-[10px] text-purple-400 font-medium shrink-0">({preset.label})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Local validation / access error */}
      {localError && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 flex flex-col gap-2 text-red-200 text-xs sm:text-sm animate-fade-in shadow-lg shadow-red-950/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold text-red-100">Não foi possível aceder ao vídeo</h5>
                <p className="text-red-300/90 mt-0.5">{localError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setLocalErrorDetails(null);
              }}
              className="text-red-400 hover:text-red-200 text-xs font-semibold px-2 py-1 rounded cursor-pointer"
            >
              Fechar
            </button>
          </div>
          {localErrorDetails && (
            <details className="mt-1 group text-xs">
              <summary className="text-[11px] font-medium text-red-300 hover:text-red-100 cursor-pointer select-none">
                Detalhes do erro
              </summary>
              <pre className="mt-1.5 p-2 rounded bg-black/60 border border-red-900/60 font-mono text-[10px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                {localErrorDetails}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Preview Card: mostra o título e a miniatura do vídeo antes de processar para confirmar */}
      {selectedVideo && (
        <div className="bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Vídeo público confirmado no YouTube</span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Trocar de vídeo</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Thumbnail */}
            <div className="relative w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800 shrink-0 group">
              <img
                src={selectedVideo.thumbnailUrl}
                alt={selectedVideo.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                onError={(e) => {
                  // Fallback placeholder if thumbnail fails to load
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                <span className="text-[10px] font-semibold text-white bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                  <Youtube className="w-3 h-3 text-red-500" />
                  <span>YouTube</span>
                </span>
              </div>
            </div>

            {/* Video metadata */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[10px] font-semibold">
                <Music className="w-3 h-3" />
                <span>Segmento: 20s – 80s (60 segundos)</span>
              </div>

              <h4
                className="font-display font-bold text-base sm:text-lg text-white leading-snug line-clamp-2"
                title={selectedVideo.title}
              >
                {selectedVideo.title}
              </h4>

              {selectedVideo.author && (
                <p className="text-xs text-zinc-400 font-medium">
                  Canal: <span className="text-zinc-200">{selectedVideo.author}</span>
                </p>
              )}

              <div className="pt-1 flex items-center gap-3">
                <a
                  href={selectedVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir no YouTube</span>
                </a>
                <span className="text-zinc-600">·</span>
                <span className="text-[11px] text-zinc-400">Resolução rápida otimizada</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão "Criar versão alternativa" específico do separador do link */}
      <div className="pt-2 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={isLoading || isVerifying || Boolean(quotaCountdown && quotaCountdown > 0)}
          className={`w-full sm:w-auto min-w-[280px] px-8 py-3.5 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
            isLoading || isVerifying || Boolean(quotaCountdown && quotaCountdown > 0)
              ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700/50'
              : 'bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white shadow-purple-600/30 hover:shadow-purple-500/40 border border-purple-400/30'
          }`}
        >
          {isLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>A processar áudio do vídeo...</span>
            </>
          ) : isVerifying ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>A validar vídeo...</span>
            </>
          ) : quotaCountdown && quotaCountdown > 0 ? (
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

        {!selectedVideo && (
          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>Cola um link ou escolhe um exemplo acima para confirmar o vídeo</span>
          </p>
        )}
      </div>
    </div>
  );
};
