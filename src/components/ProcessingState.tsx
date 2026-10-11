import React from 'react';
import { Sparkles, Music2, Cpu, Headphones, AlignLeft, Sliders, CheckCircle2 } from 'lucide-react';

interface ProcessingStateProps {
  currentStep?: string;
  stepMessage?: string;
  stepDetail?: string;
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({
  currentStep = 'listening',
  stepMessage = 'A ouvir os primeiros 3 minutos do áudio...',
  stepDetail = 'A analisar tom, BPM, ritmo e presença vocal com modelo Gemini Flash...',
}) => {
  const steps = [
    { id: 'listening', label: '1. A ouvir áudio (3 min)', icon: Headphones },
    { id: 'lyrics', label: '2. A compor a letra', icon: AlignLeft },
    { id: 'style', label: '3. A criar o estilo', icon: Sliders },
  ];

  const getStepIndex = () => {
    if (currentStep === 'listening') return 0;
    if (currentStep === 'lyrics') return 1;
    if (currentStep === 'style' || currentStep === 'condensing') return 2;
    if (currentStep === 'done') return 3;
    return 0;
  };

  const activeIndex = getStepIndex();

  return (
    <div className="w-full bg-zinc-900/90 border border-purple-500/30 rounded-2xl p-6 sm:p-10 text-center shadow-2xl shadow-purple-950/20 backdrop-blur-md transition-all">
      {/* Animated Glowing Ring & Visualizer */}
      <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-6 flex items-center justify-center">
        {/* Pulsing glow rings */}
        <div className="absolute inset-0 rounded-full bg-purple-600/20 animate-ping opacity-60" />
        <div className="absolute -inset-2 rounded-full bg-purple-500/10 blur-xl animate-pulse" />

        {/* Central Core */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-950 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-900/50">
          <Music2 className="w-8 h-8 sm:w-9 sm:h-9 animate-bounce text-purple-400" />
        </div>
      </div>

      {/* Progress Bars Visualizer */}
      <div className="flex items-center justify-center gap-1.5 h-7 mb-6">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 bg-gradient-to-t from-purple-700 to-purple-400 rounded-full animate-pulse"
            style={{
              height: `${25 + ((i % 5) * 15)}%`,
              animationDuration: `${0.5 + (i % 4) * 0.2}s`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>

      {/* Steps Pill Indicator */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto mb-5">
        {steps.map((st, idx) => {
          const Icon = st.icon;
          const isDone = activeIndex > idx;
          const isCurrent = activeIndex === idx;

          return (
            <div
              key={st.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isDone
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                  : isCurrent
                  ? 'bg-purple-900/70 text-purple-200 border border-purple-400 shadow-md shadow-purple-600/20 animate-pulse'
                  : 'bg-zinc-950/50 text-zinc-400 border border-zinc-800'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-purple-300' : 'text-zinc-400'}`} />
              )}
              <span>{st.label}</span>
            </div>
          );
        })}
      </div>

      {/* Active Step Message */}
      <div className="space-y-1.5 max-w-lg mx-auto">
        <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-100 flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400 animate-spin" />
          <span>{stepMessage}</span>
        </h3>
        {stepDetail && (
          <p className="text-xs sm:text-sm text-purple-300/80 font-medium leading-relaxed">
            {stepDetail}
          </p>
        )}
      </div>

      {/* Discrete note */}
      <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
        <Cpu className="w-3.5 h-3.5 text-purple-400/80" />
        <span>Gemini Flash com raciocínio otimizado e streaming em tempo real</span>
      </div>
    </div>
  );
};
