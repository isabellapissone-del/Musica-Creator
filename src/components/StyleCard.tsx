import React, { useState } from 'react';
import { Copy, Check, Radio, Gauge, KeyRound, Heart, Layers, Mic, Sliders } from 'lucide-react';
import { MusicalStyle } from '../types';

interface StyleCardProps {
  styleData: MusicalStyle | string;
}

export const StyleCard: React.FC<StyleCardProps> = ({ styleData }) => {
  const [copied, setCopied] = useState(false);

  // Normalize data whether it's an object or a string
  const isObject = typeof styleData === 'object' && styleData !== null;
  const description = isObject ? styleData.descricao : styleData;
  const tags = isObject && Array.isArray(styleData.tags) ? styleData.tags : [];
  const musicalStyle = isObject ? (styleData as MusicalStyle) : null;

  const getCopyText = () => {
    if (typeof styleData === 'string') return styleData;
    let text = `${styleData.descricao || ''}\n\n`;
    if (styleData.tags && styleData.tags.length > 0) {
      text += `Etiquetas: ${styleData.tags.join(', ')}\n\n`;
    }
    const details = [];
    if (styleData.bpm) details.push(`Tempo: ${styleData.bpm}`);
    if (styleData.tom) details.push(`Tom: ${styleData.tom}`);
    if (styleData.genero) details.push(`Género: ${styleData.genero}`);
    if (styleData.emocao) details.push(`Emoção: ${styleData.emocao}`);
    if (styleData.tipoVoz) details.push(`Tipo de voz: ${styleData.tipoVoz}`);
    if (styleData.instrumentos && styleData.instrumentos.length > 0) {
      details.push(`Instrumentos: ${styleData.instrumentos.join(', ')}`);
    }
    if (details.length > 0) {
      text += `Detalhes técnicos:\n- ${details.join('\n- ')}`;
    }
    return text.trim();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getCopyText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar estilo:', err);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/30 rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-950/10 flex flex-col h-full transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-zinc-100 text-base sm:text-lg">
              Estilo musical
            </h3>
            <p className="text-xs text-zinc-400">
              Sonoridade, arranjos e caraterísticas identificadas
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
          aria-label="Copiar estilo"
        >
          {copied ? (
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

      {/* Content */}
      <div className="flex-1 space-y-5 overflow-y-auto max-h-[480px] pr-1 custom-scroll">
        {/* Short paragraph description */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400/90 mb-2">
            Descrição do estilo
          </h4>
          <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/80">
            {description}
          </p>
        </div>

        {/* Tags list */}
        {tags.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400/90 mb-2">
              Etiquetas musicais
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs text-purple-200 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 px-3 py-1 rounded-lg transition-colors font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Technical musical breakdown */}
        {musicalStyle && (
          <div className="pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400/90 mb-2.5">
              Parâmetros identificados
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {musicalStyle.bpm && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <Gauge className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Tempo</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.bpm}</span>
                  </div>
                </div>
              )}

              {musicalStyle.tom && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Tom</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.tom}</span>
                  </div>
                </div>
              )}

              {musicalStyle.emocao && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                  <Heart className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Emoção</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.emocao}</span>
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

              {musicalStyle.tipoVoz && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Mic className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Tipo de voz</span>
                    <span className="font-semibold text-zinc-100">{musicalStyle.tipoVoz}</span>
                  </div>
                </div>
              )}

              {musicalStyle.instrumentos && musicalStyle.instrumentos.length > 0 && (
                <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 col-span-2 flex items-start gap-2">
                  <Sliders className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Instrumentos</span>
                    <span className="font-medium text-zinc-200">
                      {musicalStyle.instrumentos.join(' · ')}
                    </span>
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
