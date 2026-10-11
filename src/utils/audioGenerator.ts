/**
 * Utility to generate pleasant procedural WAV audio tracks in-browser using Web Audio API.
 * Allows instant testing of "Music Creator" without requiring the user to upload a file first.
 */

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Write interleaved PCM samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clamp sample between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit PCM integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export async function generateSampleSong(type: 'synthwave' | 'acoustic' | 'lofi'): Promise<{ file: File; url: string }> {
  const duration = 12; // 12 seconds preview track
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  if (type === 'synthwave') {
    // Synthwave in A minor (A3, C4, E4, G4, F3)
    const chords = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [261.63, 329.63, 392.0], // C
      [196.0, 246.94, 293.66], // G
    ];

    const chordDuration = 3; // 4 chords = 12s

    chords.forEach((chord, chordIdx) => {
      const startTime = chordIdx * chordDuration;
      // Pad synth
      chord.forEach((freq) => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        const filter = offlineCtx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, startTime);
        filter.frequency.exponentialRampToValueAtTime(1600, startTime + 1.5);
        filter.frequency.exponentialRampToValueAtTime(600, startTime + chordDuration);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.08, startTime + 0.3);
        gain.gain.setValueAtTime(0.08, startTime + chordDuration - 0.4);
        gain.gain.linearRampToValueAtTime(0, startTime + chordDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + chordDuration);
      });

      // Bass pulse
      const bassFreq = chord[0] / 2;
      for (let beat = 0; beat < 6; beat++) {
        const beatTime = startTime + beat * 0.5;
        const bassOsc = offlineCtx.createOscillator();
        const bassGain = offlineCtx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, beatTime);

        bassGain.gain.setValueAtTime(0.18, beatTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.45);

        bassOsc.connect(bassGain);
        bassGain.connect(offlineCtx.destination);
        bassOsc.start(beatTime);
        bassOsc.stop(beatTime + 0.45);
      }
    });
  } else if (type === 'acoustic') {
    // Acoustic piano / gentle guitar in E minor
    const notes = [
      164.81, 246.94, 329.63, 392.0, 493.88, // Em
      146.83, 220.0, 293.66, 369.99, 440.0,  // D
      130.81, 196.0, 261.63, 329.63, 392.0,  // C
      123.47, 185.0, 246.94, 311.13, 369.99, // Bm
    ];

    for (let i = 0; i < 24; i++) {
      const time = i * 0.5;
      const freq = notes[i % notes.length];
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.14, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(time);
      osc.stop(time + 1.2);
    }
  } else {
    // Lo-Fi Melancholic with mellow Rhodes tones
    const chords = [
      [261.63, 311.13, 392.0, 466.16], // Cm7
      [220.0, 261.63, 329.63, 392.0],  // Am7
      [174.61, 207.65, 261.63, 311.13],// Fm7
      [196.0, 246.94, 293.66, 349.23], // G7
    ];

    chords.forEach((chord, chordIdx) => {
      const startTime = chordIdx * 3;
      chord.forEach((freq, noteIdx) => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime + noteIdx * 0.08);

        gain.gain.setValueAtTime(0.12, startTime + noteIdx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.8);

        osc.connect(gain);
        gain.connect(offlineCtx.destination);
        osc.start(startTime + noteIdx * 0.08);
        osc.stop(startTime + 2.9);
      });
    });
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = audioBufferToWav(renderedBuffer);
  const nameMap = {
    synthwave: 'exemplo_synthwave_80s.wav',
    acoustic: 'exemplo_acustico_melodico.wav',
    lofi: 'exemplo_lofi_melancolico.wav',
  };

  const file = new File([wavBlob], nameMap[type], { type: 'audio/wav' });
  const url = URL.createObjectURL(wavBlob);

  return { file, url };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
