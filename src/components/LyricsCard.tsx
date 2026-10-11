import React, { useState } from 'react';
import { Copy, Check, Music, AlignLeft, Languages } from 'lucide-react';

interface LyricsCardProps {
  lyrics: string;
  idiomaLetra?: string;
}

export const LyricsCard: React.FC<LyricsCardProps> = ({ lyrics, idiomaLetra }) => {
  const [copied, setCopied] = useState(false);

  const MAX_LETRA_CHARS = 4500;
  const charCount = lyrics ? lyrics.length : 0;
  const isOverLimit = charCount > MAX_LETRA_CHARS;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lyrics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar letra:', err);
    }
  };

  // Format lyrics to give distinct styling to bracketed sections like [Verso], [Refrão], [Ponte]
  const renderFormattedLyrics = () => {
    if (!lyrics) return null;

    const lines = lyrics.split('\n');

    return (
      <div className="space-y-1.5 text-zinc-300 font-normal leading-relaxed text-sm sm:text-base">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Section header detection (e.g. [Verso], [Refrão], [Ponte], etc.)
          const isSectionHeader = /^\[.*\]$/.test(trimmed);

          if (isSectionHeader) {
            return (
              <div key={idx} className="pt-4 first:pt-0 pb-1">
                <span className="inline-block text-xs font-semibold tracking-wider uppercase text-purple-300 bg-purple-950/60 border border-purple-500/40 px-2.5 py-0.5 rounded-md shadow-sm">
                  {trimmed}
                </span>
              </div>
            );
          }

          if (trimmed === '') {
            return <div key={idx} className="h-2" />;
          }

          return (
            <p key={idx} className="tracking-wide text-zinc-200 hover:text-white transition-colors">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/30 rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-950/10 flex flex-col h-full transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg">
                Letra alternativa
              </h3>
              {idiomaLetra && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded-md">
                  <Languages className="w-3 h-3 text-purple-400" />
                  {idiomaLetra}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate">
              Métrica, rimas e melodia original
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Character counter (e.g. "812 / 4500"), turns red if over limit */}
          <span
            className={`text-xs font-mono font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              isOverLimit
                ? 'text-red-400 bg-red-950/70 border-red-500/70 font-bold animate-pulse'
                : 'text-zinc-400 bg-zinc-950/60 border-zinc-800'
            }`}
            title={`Limite: ${charCount} / ${MAX_LETRA_CHARS} caracteres`}
          >
            {charCount} / {MAX_LETRA_CHARS}
          </span>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 hover:text-purple-300 hover:border-purple-500/40'
            }`}
            aria-label="Copiar letra"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar letra</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Guide & Language Note */}
      <div className="mb-3 space-y-1.5">
        {idiomaLetra && (
          <div className="sm:hidden flex items-center gap-1.5 text-xs text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2.5 py-1 rounded-md">
            <Languages className="w-3.5 h-3.5 text-purple-400" />
            <span>Idioma da letra: <strong className="text-white">{idiomaLetra}</strong></span>
          </div>
        )}
        <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-300/90 flex items-center gap-2">
          <AlignLeft className="w-3.5 h-3.5 shrink-0 text-purple-400" />
          <span>
            A cadência e o número de sílabas foram calibrados para cantares diretamente por cima da faixa original.
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-[500px] pr-2 custom-scroll">
        {renderFormattedLyrics()}
      </div>
    </div>
  );
};
