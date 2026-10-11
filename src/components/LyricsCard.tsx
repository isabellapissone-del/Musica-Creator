import React, { useState } from 'react';
import {
  Copy,
  Check,
  Music,
  AlignLeft,
  Languages,
  Disc3,
  Sparkles,
  Wand2,
  RefreshCw,
} from 'lucide-react';

interface LyricsCardProps {
  lyrics: string;
  idiomaLetra?: string;
  isInstrumental?: boolean;
  onGenerateLyricsForBeat?: (idioma: 'pt' | 'en') => Promise<void>;
  isGeneratingLyricsForBeat?: boolean;
  letraCriada?: boolean;
}

export const LyricsCard: React.FC<LyricsCardProps> = ({
  lyrics,
  idiomaLetra,
  isInstrumental = false,
  onGenerateLyricsForBeat,
  isGeneratingLyricsForBeat = false,
  letraCriada = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'pt' | 'en'>('pt');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const MAX_LETRA_CHARS = 4500;
  const charCount = lyrics ? lyrics.length : 0;
  const isOverLimit = charCount > MAX_LETRA_CHARS;

  const isInstrumentalState = isInstrumental && !letraCriada && lyrics === 'Instrumental: sem letra';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lyrics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar letra:', err);
    }
  };

  const handleTriggerGenerate = async () => {
    if (onGenerateLyricsForBeat && !isGeneratingLyricsForBeat) {
      await onGenerateLyricsForBeat(selectedLanguage);
      setShowLanguagePicker(false);
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
            {isInstrumentalState ? <Disc3 className="w-4 h-4 text-purple-400" /> : <Music className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg">
                {isInstrumentalState ? 'Modo instrumental' : 'Letra alternativa'}
              </h3>
              {idiomaLetra && !isInstrumentalState && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded-md">
                  <Languages className="w-3 h-3 text-purple-400" />
                  {idiomaLetra}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate">
              {isInstrumentalState
                ? 'Faixa ou batida sem voz contínua'
                : 'Métrica, rimas e melodia original'}
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

          {!isInstrumentalState && (
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
          )}
        </div>
      </div>

      {/* Guide & Language Note for Vocal Songs */}
      {!isInstrumentalState && (
        <div className="mb-3 space-y-1.5">
          {idiomaLetra && (
            <div className="sm:hidden flex items-center gap-1.5 text-xs text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2.5 py-1 rounded-md">
              <Languages className="w-3.5 h-3.5 text-purple-400" />
              <span>Idioma da letra: <strong className="text-white">{idiomaLetra}</strong></span>
            </div>
          )}
          <div className="px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-300/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlignLeft className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>
                {letraCriada
                  ? 'Letra adaptada ao ritmo e compasso da batida instrumental.'
                  : 'A cadência e o número de sílabas foram calibrados para cantares por cima da faixa original.'}
              </span>
            </div>
            {letraCriada && onGenerateLyricsForBeat && (
              <button
                type="button"
                onClick={() => setShowLanguagePicker(!showLanguagePicker)}
                className="text-[11px] text-purple-300 hover:text-purple-200 underline font-medium cursor-pointer shrink-0"
              >
                Gerar noutro idioma
              </button>
            )}
          </div>
        </div>
      )}

      {/* Optional language re-picker for generated beat lyrics */}
      {showLanguagePicker && onGenerateLyricsForBeat && (
        <div className="mb-3 p-3 bg-zinc-950/80 border border-purple-500/30 rounded-xl space-y-2">
          <p className="text-xs text-zinc-300 font-medium">Escolhe o idioma para a letra da batida:</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedLanguage('pt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedLanguage === 'pt'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Português de Portugal
            </button>
            <button
              type="button"
              onClick={() => setSelectedLanguage('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedLanguage === 'en'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Inglês Internacional
            </button>
            <button
              type="button"
              onClick={handleTriggerGenerate}
              disabled={isGeneratingLyricsForBeat}
              className="ml-auto px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isGeneratingLyricsForBeat ? 'animate-spin' : ''}`} />
              <span>Gerar</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {isInstrumentalState ? (
        <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 bg-zinc-950/50 rounded-xl border border-zinc-800/80 text-center space-y-4 my-auto">
          <div className="w-14 h-14 rounded-2xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
            <Disc3 className="w-7 h-7 animate-pulse text-purple-300" />
          </div>

          <div className="space-y-1">
            <h4 className="font-display font-bold text-zinc-100 text-base sm:text-lg">
              Instrumental: sem letra
            </h4>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Esta faixa foi identificada como batida instrumental. Não foram detetadas vozes contínuas com letra.
            </p>
          </div>

          {/* Action to create lyrics for this beat */}
          {onGenerateLyricsForBeat && (
            <div className="pt-2 w-full max-w-sm space-y-3">
              {/* Language Selector */}
              <div className="flex items-center justify-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('pt')}
                  disabled={isGeneratingLyricsForBeat}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedLanguage === 'pt'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Português de Portugal
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  disabled={isGeneratingLyricsForBeat}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedLanguage === 'en'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Inglês Internacional
                </button>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleTriggerGenerate}
                disabled={isGeneratingLyricsForBeat}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingLyricsForBeat ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>A compor letra para a batida...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-purple-200" />
                    <span>Criar letra para esta batida</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-zinc-400">
                A letra será criada no ritmo e tempo da batida (máx. 4500 caracteres).
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[500px] pr-2 custom-scroll">
          {renderFormattedLyrics()}
        </div>
      )}
    </div>
  );
};
