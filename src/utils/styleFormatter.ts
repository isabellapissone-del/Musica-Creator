import { MusicalStyle } from '../types';

export const MAX_LYRICS_LENGTH = 4500;
export const MAX_STYLE_LENGTH = 950;

/**
 * Returns the canonical text representation of the musical style,
 * used for copying and character limit calculations.
 */
export function formatStyleText(style: MusicalStyle | string): string {
  if (!style) return '';
  if (typeof style === 'string') return style.trim();

  const parts: string[] = [];

  if (style.descricao) {
    parts.push(style.descricao.trim());
  }

  if (style.tags && style.tags.length > 0) {
    parts.push(`Etiquetas: ${style.tags.join(', ')}`);
  }

  const details: string[] = [];
  if (style.bpm) details.push(`BPM: ${style.bpm}`);
  if (style.tom) details.push(`Tom: ${style.tom}`);
  if (style.genero) details.push(`Género: ${style.genero}`);
  if (style.emocao) details.push(`Emoção: ${style.emocao}`);
  if (style.tipoVoz) details.push(`Voz: ${style.tipoVoz}`);
  if (style.atmosfera) details.push(`Atmosfera: ${style.atmosfera}`);
  if (style.producao) details.push(`Produção: ${style.producao}`);
  if (style.instrumentos && style.instrumentos.length > 0) {
    details.push(`Instrumentos: ${style.instrumentos.join(', ')}`);
  }

  if (details.length > 0) {
    parts.push(`Parâmetros: ${details.join(' · ')}`);
  }

  return parts.join('\n\n').trim();
}
