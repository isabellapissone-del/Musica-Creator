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
}

export interface SongAlternativeResult {
  letra: string;
  estilo: MusicalStyle | string;
}

export interface AudioFileInfo {
  file: File;
  name: string;
  size: number;
  type: string;
  url: string;
  base64?: string;
}
