import React, { useState } from 'react';
import { Copy, Check, FileText, Music } from 'lucide-react';

interface LyricsCardProps {
  lyrics: string;
}

export const LyricsCard: React.FC<LyricsCardProps> = ({ lyrics }) => {
  const [copied, setCopied] = useState(false);

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
                <span className="inline-block text-xs font-semibold tracking-wider uppercase text-purple-400 bg-purple-950/50 border border-purple-500/30 px-2.5 py-0.5 rounded-md">
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
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg">
              Letra alternativa
            </h3>
            <p className="text-xs text-zinc-400">
              Composição inédita inspirada na temática e emoção
            </p>
          </div>
        </div>

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-[480px] pr-2 custom-scroll">
        {renderFormattedLyrics()}
      </div>
    </div>
  );
};
