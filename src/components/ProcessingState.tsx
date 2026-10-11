import React, { useState, useEffect } from 'react';
import { Sparkles, Music2, Cpu } from 'lucide-react';

export const ProcessingState: React.FC = () => {
  const steps = [
    'A enviar o ficheiro de áudio para o modelo Gemini...',
    'A analisar estilo sonoro: género, BPM exato, tom, instrumentos e tipo de voz...',
    'A examinar atmosfera, mistura de áudio e técnicas de produção sonora...',
    'A analisar se a faixa é cantada ou batida instrumental (groove, kick, snare, baixo)...',
    'A estruturar a versão alternativa no idioma adequado com fidelidade máxima...',
    'A gerar etiquetas hiper-fidelizadas e a confirmar limites de caracteres (máx. 4500 letra, máx. 950 estilo)...',
  ];

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 3800);

    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="w-full bg-zinc-900/90 border border-purple-500/30 rounded-2xl p-8 sm:p-10 text-center shadow-2xl shadow-purple-950/20 backdrop-blur-md">
      {/* Animated Glowing Ring & Visualizer */}
      <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center">
        {/* Pulsing glow rings */}
        <div className="absolute inset-0 rounded-full bg-purple-600/20 animate-ping opacity-60" />
        <div className="absolute -inset-2 rounded-full bg-purple-500/10 blur-xl animate-pulse" />
        
        {/* Central Core */}
        <div className="relative w-20 h-20 rounded-full bg-zinc-950 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-900/50">
          <Music2 className="w-9 h-9 animate-bounce text-purple-400" />
        </div>
      </div>

      {/* Progress Bars Visualizer */}
      <div className="flex items-center justify-center gap-1.5 h-8 mb-6">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 bg-gradient-to-t from-purple-700 to-purple-400 rounded-full animate-pulse"
            style={{
              height: `${25 + ((i % 5) * 14)}%`,
              animationDuration: `${0.6 + (i % 4) * 0.25}s`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>

      {/* Status Title */}
      <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-100 mb-2 flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400 animate-spin" />
        A criar versão alternativa de alta fidelidade
      </h3>

      {/* Active Step Indicator */}
      <p className="text-sm sm:text-base text-purple-300 font-medium max-w-lg mx-auto min-h-[3rem] transition-all duration-300">
        {steps[currentStepIdx]}
      </p>

      {/* Discrete note */}
      <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-xs text-zinc-400">
        <Cpu className="w-3.5 h-3.5 text-purple-400/80" />
        <span>Análise multimodal nativa em Português de Portugal com modelo Gemini</span>
      </div>
    </div>
  );
};
