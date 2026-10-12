export interface MusicalStyle {
  descricao: string;
  tags: string[];
  tema?: string;
  emocao?: string;
  genero?: string;
  bpm?: string;
  tom?: string;
  instrumentos?: string[];
  tipoVoz?: string;
  atmosfera?: string;
  producao?: string;
  esquemaRimas?: string;
  estruturaMetrica?: string;
  // Campos específicos para modo instrumental / batida
  compasso?: string;
  swingGroove?: string;
  padraoBateria?: string;
  linhaBaixo?: string;
  samplesSintetizadores?: string;
  estruturaBatida?: string;
}

export interface YouTubeSeoPackage {
  titulos: string[]; // 5 opções (máx 70 caracteres cada)
  descricao: string; // máx 5000 caracteres
  tags: string; // lista separada por vírgulas (máx 500 caracteres)
  hashtags: string[]; // 3 a 5
  textoMiniatura: string[]; // 3 opções com máx 4 palavras cada
  capitulos?: string[]; // marcas de tempo
  comentarioFixado: string; // pergunta para incentivar comentários
  palavrasChave: {
    principal: string;
    secundarias: string[];
    caudaLonga: string[];
  };
}

export type ProcessingStep = 'listening' | 'lyrics' | 'style' | 'condensing' | 'done';

export interface SongAlternativeResult {
  analysisId?: string;
  letra: string;
  estilo: MusicalStyle | string;
  idiomaLetra?: string;
  isInstrumental?: boolean;
  letraCriada?: boolean;
  youtubeSeo?: YouTubeSeoPackage;
  sourceType?: 'file' | 'youtube';
  sourceTitle?: string;
  sourceThumbnail?: string;
}

export interface AudioFileInfo {
  file: File;
  name: string;
  size: number;
  type: string;
  url: string;
  base64?: string;
}

export interface YouTubeVideoInfo {
  url: string;
  title: string;
  author?: string;
  thumbnailUrl: string;
  videoId?: string;
}

export interface ErrorDetails {
  code?: string | number;
  message?: string;
  full?: string;
}

