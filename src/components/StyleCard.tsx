import React, { useState } from 'react';
import {
  Copy,
  Check,
  Radio,
  Gauge,
  KeyRound,
  Heart,
  Layers,
  Mic,
  Sliders,
  Sparkles,
  Cpu,
  Bookmark,
} from 'lucide-react';
import { MusicalStyle } from '../types';
import { formatStyleText, MAX_STYLE_LENGTH } from '../utils/styleFormatter';

interface StyleCardProps {
  styleData: MusicalStyle | string;
}

export const StyleCard: React.FC<StyleCardProps> = ({ styleData }) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

  // Normalize data whether it's an object or a string
  const isObject = typeof styleData === 'object' && styleData !== null;
  const description = isObject ? styleData.descricao : styleData;
  const tags = isObject && Array.isArray(styleData.tags) ? styleData.tags : [];
  const musicalStyle = isObject ? (styleData as MusicalStyle) : null;

  const styleText = formatStyleText(styleData);
  const charCount = styleText.length;
  const isOverLimit = charCount > MAX_STYLE_LENGTH;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(styleText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar estilo:', err);
    }
  };

  const handleCopyTags = async () => {
    try {
      if (tags.length > 0) {
        await navigator.clipboard.writeText(tags.join(', '));
        setCopiedTags(true);
        setTimeout(() => setCopiedTags(false), 2000);
      }
    } catch (err) {
      console.error('Falha ao copiar etiquetas:', err);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/30 rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-950/10 flex flex-col h-full transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg">
              Estilo musical
            </h3>
            <p className="text-xs text-zinc-400 truncate">
              Fidelidade sonora para recriação exata
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Character counter (e.g. "812 / 950"), turns red if over limit */}
          <span
            className={`text-xs font-mono font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              isOverLimit
                ? 'text-red-400 bg-red-950/70 border-red-500/70 font-bold animate-pulse'
                : 'text-zinc-400 bg-zinc-950/60 border-zinc-800'
            }`}
            title={`Limite: ${charCount} / ${MAX_STYLE_LENGTH} caracteres`}
          >
            {charCount} / {MAX_STYLE_LENGTH}
          </span>

          <button
            onClick={handleCopyAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              copiedAll
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 hover:text-purple-300 hover:border-purple-500/40'
            }`}
            aria-label="Copiar estilo"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar estilo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 overflow-y-auto max-h-[500px] pr-1 custom-scroll">
        {/* Short paragraph description */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400/90 mb-2 flex items-center justify-between">
            <span>Descrição fiel do som original</span>
          </h4>
          <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80">
            {description}
          </p>
        </div>

        {/* Tags list with quick copy button */}
        {tags.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400/90">
                Etiquetas de recriação de som
              </h4>
              <button
                type="button"
                onClick={handleCopyTags}
                className="text-[11px] text-zinc-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedTags ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Etiquetas copiadas</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar só etiquetas</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs text-purple-200 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 px-2.5 py-1 rounded-lg transition-colors font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Detailed parameters */}
        {musicalStyle && (
          <div className="pt-1 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400/90">
              Parâmetros de fidelidade acústica
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {musicalStyle.bpm && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <Gauge className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">BPM / Tempo</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.bpm}</span>
                  </div>
                </div>
              )}

              {musicalStyle.tom && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Tom & Escala</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.tom}</span>
                  </div>
                </div>
              )}

              {musicalStyle.genero && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Género</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.genero}</span>
                  </div>
                </div>
              )}

              {musicalStyle.emocao && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <Heart className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Emoção & Vibração</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.emocao}</span>
                  </div>
                </div>
              )}

              {musicalStyle.tipoVoz && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Mic className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Tipo de voz & Colocação</span>
                    <span className="font-medium text-zinc-200">{musicalStyle.tipoVoz}</span>
                  </div>
                </div>
              )}

              {musicalStyle.atmosfera && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Atmosfera & Espacialidade</span>
                    <span className="font-medium text-zinc-200">{musicalStyle.atmosfera}</span>
                  </div>
                </div>
              )}

              {musicalStyle.producao && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Cpu className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Produção, Mistura & Efeitos</span>
                    <span className="font-medium text-zinc-200">{musicalStyle.producao}</span>
                  </div>
                </div>
              )}

              {musicalStyle.instrumentos && musicalStyle.instrumentos.length > 0 && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Sliders className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Instrumentação identificada</span>
                    <span className="font-medium text-zinc-200">
                      {musicalStyle.instrumentos.join(' · ')}
                    </span>
                  </div>
                </div>
              )}

              {musicalStyle.esquemaRimas && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Bookmark className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Esquema de rimas & Métrica original</span>
                    <span className="font-medium text-zinc-200">{musicalStyle.esquemaRimas}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
