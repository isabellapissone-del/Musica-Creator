/**
 * Utilitários para validação e extração de dados de vídeos do YouTube
 */

/**
 * Valida se a URL fornecida pertence ao YouTube (youtube.com ou youtu.be)
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtu.be' ||
      host === 'www.youtu.be' ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    );
  } catch {
    return false;
  }
}

/**
 * Extrai o ID do vídeo (11 caracteres) a partir de URLs curtas ou completas
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      return id && id.length >= 10 ? id : null;
    }

    if (parsed.pathname === '/watch') {
      const v = parsed.searchParams.get('v');
      return v && v.length >= 10 ? v : null;
    }

    const match = parsed.pathname.match(/\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Normaliza a URL para um formato limpo padrão do YouTube
 */
export function normalizeYouTubeUrl(url: string): string {
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
}

/**
 * Retorna URL de miniatura padrão de alta qualidade para um ID do YouTube
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
