import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, FileAudio, Trash2 } from 'lucide-react';
import { AudioFileInfo } from '../types';
import { formatFileSize, formatTime } from '../utils/audioGenerator';

interface AudioPlayerProps {
  audioInfo: AudioFileInfo;
  onRemove: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioInfo, onRemove }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [audioInfo.url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error('Erro ao reproduzir áudio:', e);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Extension helper
  const ext = audioInfo.name.split('.').pop()?.toUpperCase() || 'AUDIO';

  return (
    <div className="w-full bg-zinc-900/90 border border-purple-500/20 rounded-2xl p-4 sm:p-5 shadow-xl shadow-purple-950/10 backdrop-blur-sm">
      <audio
        ref={audioRef}
        src={audioInfo.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Header Info */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <FileAudio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-zinc-100 truncate" title={audioInfo.name}>
              {audioInfo.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="text-purple-400 font-medium">{ext}</span>
              <span aria-hidden="true">·</span>
              <span>{formatFileSize(audioInfo.size)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onRemove}
          className="text-zinc-400 hover:text-red-400 p-2 rounded-lg hover:bg-zinc-800/80 transition-colors"
          title="Remover ficheiro"
          aria-label="Remover ficheiro de áudio"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Waveform / Visual Bars Animation */}
      <div className="h-10 bg-zinc-950/60 rounded-xl px-3 flex items-center justify-center gap-1 mb-4 border border-zinc-800/60 overflow-hidden">
        {Array.from({ length: 32 }).map((_, idx) => {
          // Calculate an aesthetic wave height
          const baseHeight = 15 + Math.sin(idx * 0.4) * 12 + ((idx % 3) * 6);
          const isBarPast = (idx / 32) * 100 <= progressPercent;
          return (
            <span
              key={idx}
              className={`w-1 rounded-full transition-all duration-150 ${
                isBarPast
                  ? 'bg-purple-500'
                  : 'bg-zinc-700/60'
              } ${isPlaying ? 'animate-pulse' : ''}`}
              style={{
                height: isPlaying ? `${Math.max(6, (baseHeight * (0.6 + Math.random() * 0.8)))}%` : `${baseHeight}%`,
                animationDelay: `${idx * 40}ms`,
              }}
            />
          );
        })}
      </div>

      {/* Progress Scrub Slider */}
      <div className="relative mb-3 group">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Barra de reprodução de áudio"
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
        />
        <div className="flex justify-between items-center text-[11px] text-zinc-400 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-600/30 transition-transform active:scale-95 cursor-pointer"
            aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleRestart}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer"
            title="Reiniciar áudio"
            aria-label="Reiniciar áudio desde o início"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
            aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            className="w-16 sm:w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
