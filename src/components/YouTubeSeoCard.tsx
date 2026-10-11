import React, { useState } from 'react';
import {
  Youtube,
  Copy,
  Check,
  Tag,
  Hash,
  Image as ImageIcon,
  Clock,
  MessageSquare,
  KeyRound,
  FileText,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { YouTubeSeoPackage } from '../types';

interface YouTubeSeoCardProps {
  seo: YouTubeSeoPackage;
  idiomaLetra?: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export const YouTubeSeoCard: React.FC<YouTubeSeoCardProps> = ({
  seo,
  idiomaLetra,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isExpandedDesc, setIsExpandedDesc] = useState(false);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleCopyAll = async () => {
    try {
      const fullText = `=== PACOTE YOUTUBE SEO ===

--- TÍTULOS SUGERIDOS ---
${(seo.titulos || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}

--- DESCRIÇÃO ---
${seo.descricao || ''}

--- TAGS ---
${seo.tags || ''}

--- HASHTAGS ---
${(seo.hashtags || []).join(' ')}

--- TEXTO PARA MINIATURA (THUMBNAIL) ---
${(seo.textoMiniatura || []).map((m, i) => `Opção ${i + 1}: ${m}`).join('\n')}

${seo.capitulos && seo.capitulos.length > 0 ? `--- CAPÍTULOS ---\n${seo.capitulos.join('\n')}\n\n` : ''}--- COMENTÁRIO FIXADO ---
${seo.comentarioFixado || ''}

--- PALAVRAS-CHAVE ---
Principal: ${seo.palavrasChave?.principal || ''}
Secundárias: ${(seo.palavrasChave?.secundarias || []).join(', ')}
Cauda Longa: ${(seo.palavrasChave?.caudaLonga || []).join(', ')}
`;
      await navigator.clipboard.writeText(fullText.trim());
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar pacote completo:', err);
    }
  };

  const descLength = seo.descricao ? seo.descricao.length : 0;
  const tagsLength = seo.tags ? seo.tags.length : 0;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/30 rounded-2xl p-5 sm:p-7 shadow-xl shadow-purple-950/10 flex flex-col transition-all space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-md shadow-red-950/20">
            <Youtube className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-zinc-100 text-lg sm:text-xl">
                Pacote YouTube
              </h3>
              {idiomaLetra && (
                <span className="text-[11px] font-medium text-purple-300 bg-purple-950/70 border border-purple-500/30 px-2 py-0.5 rounded-md">
                  {idiomaLetra}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Otimização SEO estratégica: títulos, descrição, tags e retenção
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition-all cursor-pointer disabled:opacity-50"
              title="Gerar outra versão de SEO"
            >
              <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? 'A gerar...' : 'Outra variação'}</span>
            </button>
          )}

          <button
            onClick={handleCopyAll}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              copiedAll
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
            }`}
            aria-label="Copiar pacote YouTube completo"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Pacote copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar pacote completo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid: Títulos & Descrição */}
      <div className="space-y-6">
        {/* 1. Títulos (5 opções, máx 70 chars cada) */}
        <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-semibold text-zinc-200">
                Títulos sugeridos (5 opções)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-400">
              Palavra-chave no início · Sem clickbait · Máx 70 carateres
            </span>
          </div>

          <div className="space-y-2">
            {seo.titulos.map((titulo, idx) => {
              const len = titulo.length;
              const isOver = len > 70;
              const key = `titulo-${idx}`;
              const isCopied = copiedKey === key;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/70 border border-zinc-800 transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-purple-950/70 text-purple-300 font-mono text-[11px] flex items-center justify-center shrink-0 border border-purple-500/20">
                      {idx + 1}
                    </span>
                    <span className="text-zinc-200 font-medium group-hover:text-white transition-colors truncate">
                      {titulo}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                        isOver
                          ? 'text-red-400 bg-red-950/70 border-red-500/60 font-bold'
                          : 'text-zinc-400 bg-zinc-950/60 border-zinc-800'
                      }`}
                    >
                      {len} / 70
                    </span>
                    <button
                      onClick={() => handleCopy(titulo, key)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isCopied
                          ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                          : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 border-zinc-700/60'
                      }`}
                      title="Copiar título"
                      aria-label={`Copiar título ${idx + 1}`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Descrição (máx 5000 chars) */}
        <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">
                  Descrição do vídeo
                </h4>
                <p className="text-[11px] text-zinc-400">
                  As 2 primeiras linhas surgem antes do &quot;mostrar mais&quot;
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-xs px-2.5 py-1 rounded-lg border ${
                  descLength > 5000
                    ? 'text-red-400 bg-red-950/70 border-red-500/60 font-bold'
                    : 'text-zinc-400 bg-zinc-950/60 border-zinc-800'
                }`}
                title="Limite: 5000 caracteres"
              >
                {descLength} / 5000
              </span>

              <button
                onClick={() => handleCopy(seo.descricao, 'desc')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  copiedKey === 'desc'
                    ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                    : 'text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border-zinc-700/60 hover:text-purple-300'
                }`}
              >
                {copiedKey === 'desc' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar descrição</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative">
            <div
              className={`text-xs sm:text-sm text-zinc-300 font-mono leading-relaxed bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 overflow-y-auto whitespace-pre-line custom-scroll transition-all ${
                isExpandedDesc ? 'max-h-[500px]' : 'max-h-[160px]'
              }`}
            >
              {seo.descricao}
            </div>

            {seo.descricao && seo.descricao.length > 250 && (
              <button
                type="button"
                onClick={() => setIsExpandedDesc(!isExpandedDesc)}
                className="mt-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
              >
                {isExpandedDesc ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Recolher descrição</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Expandir descrição completa</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 3. Tags & Hashtags */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tags (máx 500 chars) */}
          <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Tags (YouTube Studio)
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs px-2.5 py-1 rounded-lg border ${
                    tagsLength > 500
                      ? 'text-red-400 bg-red-950/70 border-red-500/60 font-bold'
                      : 'text-zinc-400 bg-zinc-950/60 border-zinc-800'
                  }`}
                  title="Limite: 500 caracteres"
                >
                  {tagsLength} / 500
                </span>

                <button
                  onClick={() => handleCopy(seo.tags, 'tags')}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    copiedKey === 'tags'
                      ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                      : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 border-zinc-700/60'
                  }`}
                  title="Copiar tags separadas por vírgula"
                  aria-label="Copiar tags"
                >
                  {copiedKey === 'tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400">
              Prontas para colar no campo de tags do YouTube:
            </p>

            <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 max-h-[110px] overflow-y-auto custom-scroll">
              <p className="text-xs font-mono text-purple-300/90 leading-relaxed break-words">
                {seo.tags}
              </p>
            </div>
          </div>

          {/* Hashtags (3 a 5) */}
          <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Hashtags
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs px-2.5 py-1 rounded-lg border ${
                    (seo.hashtags?.length || 0) > 15 || (seo.hashtags?.length || 0) < 3
                      ? 'text-red-400 bg-red-950/70 border-red-500/60 font-bold'
                      : 'text-zinc-400 bg-zinc-950/60 border-zinc-800'
                  }`}
                  title="3 a 5 hashtags recomendadas (máximo 15)"
                >
                  {seo.hashtags?.length || 0} / 5
                </span>

                <button
                  onClick={() => handleCopy((seo.hashtags || []).join(' '), 'hashtags')}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    copiedKey === 'hashtags'
                      ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                      : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 border-zinc-700/60'
                  }`}
                  title="Copiar hashtags"
                  aria-label="Copiar hashtags"
                >
                  {copiedKey === 'hashtags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400">
              Adiciona ao título ou final da descrição (3 a 5 hashtags):
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {(seo.hashtags || []).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs font-medium text-purple-300 bg-purple-950/50 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-900/60 transition-colors"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Miniatura (Thumbnail) & Capítulos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Texto da Miniatura (3 opções com máx 4 palavras) */}
          <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Texto da miniatura (Thumbnail)
                </h4>
              </div>
              <span className="text-[11px] text-zinc-400">3 opções · Máx 4 palavras</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(seo.textoMiniatura || []).map((thumbText, idx) => {
                const words = thumbText.trim().split(/\s+/).filter(Boolean).length;
                const isOverWords = words > 4;
                const key = `thumb-${idx}`;
                const isCopied = copiedKey === key;

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-purple-500/40 transition-all flex flex-col justify-between text-center gap-2 group"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block">
                        Opção {idx + 1}
                      </span>
                      <p className="font-display font-bold text-zinc-100 text-sm leading-tight group-hover:text-purple-200 transition-colors">
                        &quot;{thumbText}&quot;
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isOverWords
                            ? 'text-red-400 bg-red-950/70 border-red-500/60 font-bold'
                            : 'text-zinc-400 bg-zinc-900 border-zinc-800'
                        }`}
                        title="Máximo 4 palavras"
                      >
                        {words} / 4 pal.
                      </span>
                      <button
                        onClick={() => handleCopy(thumbText, key)}
                        className={`p-1 rounded border transition-all cursor-pointer ${
                          isCopied
                            ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                            : 'text-zinc-400 hover:text-purple-300 border-zinc-800 hover:bg-zinc-800'
                        }`}
                        title="Copiar texto da miniatura"
                      >
                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capítulos (Marcas de tempo) */}
          <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Capítulos e marcas de tempo
                </h4>
              </div>

              {seo.capitulos && seo.capitulos.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded text-zinc-400 bg-zinc-950/60 border border-zinc-800">
                    {seo.capitulos.length} marcas
                  </span>
                  <button
                    onClick={() => handleCopy(seo.capitulos!.join('\n'), 'caps')}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      copiedKey === 'caps'
                        ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                        : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 border-zinc-700/60'
                    }`}
                    title="Copiar capítulos"
                    aria-label="Copiar capítulos"
                  >
                    {copiedKey === 'caps' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {seo.capitulos && seo.capitulos.length > 0 ? (
              <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 max-h-[110px] overflow-y-auto custom-scroll space-y-1">
                {seo.capitulos.map((cap, i) => (
                  <p key={i} className="text-xs font-mono text-zinc-300">
                    {cap}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 py-3">
                Estrutura contínua identificada. Podes adicionar marcas de tempo conforme a divisão da faixa.
              </p>
            )}
          </div>
        </div>

        {/* 5. Comentário Fixado & Palavras-chave */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Comentário Fixado */}
          <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Comentário fixado (Pinned comment)
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded text-zinc-400 bg-zinc-950/60 border border-zinc-800"
                  title="Caracteres do comentário"
                >
                  {seo.comentarioFixado ? seo.comentarioFixado.length : 0} carateres
                </span>
                <button
                  onClick={() => handleCopy(seo.comentarioFixado, 'comentario')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    copiedKey === 'comentario'
                      ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                      : 'text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border-zinc-700/60 hover:text-purple-300'
                  }`}
                >
                  {copiedKey === 'comentario' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800/80 text-xs sm:text-sm text-zinc-200 italic leading-relaxed">
              &quot;{seo.comentarioFixado}&quot;
            </div>
            <p className="text-[11px] text-zinc-400">
              Fixa este comentário no topo para incentivar respostas e engajamento algorítmico.
            </p>
          </div>

          {/* Palavras-Chave Estruturadas */}
          <div className="space-y-3 bg-zinc-950/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Estratégia de Palavras-Chave
                </h4>
              </div>

              <button
                onClick={() =>
                  handleCopy(
                    `Principal: ${seo.palavrasChave.principal}\nSecundárias: ${seo.palavrasChave.secundarias.join(
                      ', '
                    )}\nCauda Longa: ${seo.palavrasChave.caudaLonga.join(', ')}`,
                    'kw'
                  )
                }
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  copiedKey === 'kw'
                    ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                    : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 border-zinc-700/60'
                }`}
                title="Copiar palavras-chave"
                aria-label="Copiar palavras-chave"
              >
                {copiedKey === 'kw' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] text-zinc-400 block font-medium">Principal:</span>
                <span className="text-purple-300 font-semibold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30 inline-block mt-0.5">
                  {seo.palavrasChave.principal}
                </span>
              </div>

              {seo.palavrasChave.secundarias && seo.palavrasChave.secundarias.length > 0 && (
                <div>
                  <span className="text-[11px] text-zinc-400 block font-medium">Secundárias:</span>
                  <p className="text-zinc-200 mt-0.5">
                    {seo.palavrasChave.secundarias.join(' · ')}
                  </p>
                </div>
              )}

              {seo.palavrasChave.caudaLonga && seo.palavrasChave.caudaLonga.length > 0 && (
                <div>
                  <span className="text-[11px] text-zinc-400 block font-medium">Cauda Longa (Long-Tail):</span>
                  <p className="text-zinc-200 mt-0.5">
                    {seo.palavrasChave.caudaLonga.join(' · ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
