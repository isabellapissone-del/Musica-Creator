import React, { useState, useRef } from 'react';
import { Upload, Music, Sparkles, AlertCircle, Disc } from 'lucide-react';
import { generateSampleSong } from '../utils/audioGenerator';

interface AudioUploaderProps {
  onAudioSelected: (file: File, url: string) => void;
  onError: (message: string) => void;
  isLoading: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onAudioSelected,
  onError,
  isLoading,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateAndProcessFile = (file: File) => {
    // Check format
    const validExtensions = ['.mp3', '.wav'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));
    const isAudioType = file.type.startsWith('audio/') || hasValidExt;

    if (!isAudioType && !hasValidExt) {
      onError('Formato inválido. Por favor envia um ficheiro de áudio nos formatos MP3 ou WAV.');
      return;
    }

    // Size limit check (25 MB)
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      onError('Ficheiro demasiado grande. O limite máximo permitido é de 25 MB.');
      return;
    }

    if (file.size === 0) {
      onError('O ficheiro selecionado está vazio.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    onAudioSelected(file, objectUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcessFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcessFile(file);
    }
    // Reset value so re-selecting same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSampleClick = async (type: 'synthwave' | 'acoustic' | 'lofi') => {
    if (isLoading || isGeneratingSample) return;
    try {
      setIsGeneratingSample(type);
      const sample = await generateSampleSong(type);
      onAudioSelected(sample.file, sample.url);
    } catch (err) {
      console.error('Erro ao gerar áudio de demonstração:', err);
      onError('Não foi possível carregar a música de demonstração.');
    } finally {
      setIsGeneratingSample(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative w-full border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all duration-200 cursor-pointer group ${
          isDragging
            ? 'border-purple-400 bg-purple-950/30 scale-[1.01]'
            : 'border-zinc-800 hover:border-purple-500/50 bg-zinc-900/40 hover:bg-zinc-900/70'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mp3,audio/mpeg,audio/wav,audio/x-wav"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 group-hover:bg-purple-600/20 border border-zinc-700/60 group-hover:border-purple-500/40 flex items-center justify-center text-zinc-300 group-hover:text-purple-300 transition-colors shadow-inner">
            <Upload className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
          </div>

          <div>
            <p className="text-base font-semibold text-zinc-100 group-hover:text-purple-200 transition-colors">
              Arrasta o teu ficheiro de áudio para aqui
            </p>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              ou clica para procurar no teu dispositivo
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1">
            <span className="inline-flex items-center gap-1 font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/40">
              MP3 ou WAV
            </span>
            <span aria-hidden="true">·</span>
            <span>Até 25 MB</span>
          </div>
        </div>
      </div>

      {/* Quick Test Demo Presets */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-zinc-400">
          <Disc className="w-3.5 h-3.5 text-purple-400" />
          <span>Ou testa imediatamente com um exemplo de demonstração:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isLoading || isGeneratingSample !== null}
            onClick={() => handleSampleClick('synthwave')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/90 border border-zinc-800 hover:border-purple-500/40 text-left transition-all text-xs group cursor-pointer disabled:opacity-50"
          >
            <div>
              <p className="font-semibold text-zinc-200 group-hover:text-purple-300">Synthwave 80s</p>
              <p className="text-[11px] text-zinc-400">Eletrónico · Sintetizadores</p>
            </div>
            {isGeneratingSample === 'synthwave' ? (
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-400/60 group-hover:text-purple-400 transition-colors" />
            )}
          </button>

          <button
            type="button"
            disabled={isLoading || isGeneratingSample !== null}
            onClick={() => handleSampleClick('acoustic')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/90 border border-zinc-800 hover:border-purple-500/40 text-left transition-all text-xs group cursor-pointer disabled:opacity-50"
          >
            <div>
              <p className="font-semibold text-zinc-200 group-hover:text-purple-300">Pop Acústico</p>
              <p className="text-[11px] text-zinc-400">Melódico · Piano & Violão</p>
            </div>
            {isGeneratingSample === 'acoustic' ? (
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-400/60 group-hover:text-purple-400 transition-colors" />
            )}
          </button>

          <button
            type="button"
            disabled={isLoading || isGeneratingSample !== null}
            onClick={() => handleSampleClick('lofi')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/90 border border-zinc-800 hover:border-purple-500/40 text-left transition-all text-xs group cursor-pointer disabled:opacity-50"
          >
            <div>
              <p className="font-semibold text-zinc-200 group-hover:text-purple-300">Lo-Fi Melancólico</p>
              <p className="text-[11px] text-zinc-400">Jazz chords · Noturno</p>
            </div>
            {isGeneratingSample === 'lofi' ? (
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-400/60 group-hover:text-purple-400 transition-colors" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
