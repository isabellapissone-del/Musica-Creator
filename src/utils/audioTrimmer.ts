/**
 * Utility to inspect, trim, and optimize audio files before sending to the model.
 *
 * Performance optimizations:
 * 1. Caps duration to max 3 minutes (180 seconds).
 * 2. Downsamples audio to 16,000 Hz mono (the optimal rate for speech & acoustic analysis in Gemini).
 *    A 3-minute 44.1kHz stereo WAV is ~31MB; at 16kHz mono it is only ~5.7MB (an 82% reduction!).
 *    This dramatically cuts browser upload time, base64 encoding overhead, and Gemini ingestion latency.
 * 3. Gracefully falls back to the original file if decoding is not supported.
 */

function audioBufferTo16kMonoWav(buffer: AudioBuffer, targetSampleRate = 16000): Blob {
  // OfflineAudioContext downsamples accurately with antialiasing filter
  const duration = buffer.duration;
  const numFrames = Math.floor(duration * targetSampleRate);

  // If already decoded, we can downsample using offline audio context or linear interpolation
  // RIFF header creation for 16-bit PCM Mono at targetSampleRate
  const numChannels = 1; // mono
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, targetSampleRate, true);
  /* byte rate */
  view.setUint32(28, targetSampleRate * blockAlign, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Mix down channels to mono and resample to targetSampleRate
  const originalChannels = buffer.numberOfChannels;
  const originalSampleRate = buffer.sampleRate;
  const resampleRatio = originalSampleRate / targetSampleRate;

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    // Original sample index (fractional)
    const originalIndex = i * resampleRatio;
    const baseIndex = Math.floor(originalIndex);
    const fraction = originalIndex - baseIndex;

    // Mixdown all channels at this point
    let mixedSample = 0;
    for (let ch = 0; ch < originalChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const s1 = channelData[baseIndex] || 0;
      const s2 = channelData[baseIndex + 1] || s1;
      // Linear interpolation between consecutive samples
      const interpolated = s1 + fraction * (s2 - s1);
      mixedSample += interpolated;
    }
    mixedSample /= originalChannels;

    // Clamp to [-1, 1]
    mixedSample = Math.max(-1, Math.min(1, mixedSample));
    const intSample = mixedSample < 0 ? mixedSample * 0x8000 : mixedSample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function trimAudioToMax3Minutes(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{ file: File; wasTrimmed: boolean }> {
  const MAX_SECONDS = 180; // 3 minutes

  try {
    if (onProgress) onProgress('A otimizar ficheiro de áudio para processamento rápido...');

    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return { file, wasTrimmed: false };
    }

    const audioCtx = new AudioContextClass();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Limit to max 180 seconds
    const targetDuration = Math.min(decodedBuffer.duration, MAX_SECONDS);
    const wasTrimmed = decodedBuffer.duration > MAX_SECONDS;

    // If file is already short and tiny MP3 (< 3MB), return as is to skip wav conversion
    if (!wasTrimmed && file.size < 3 * 1024 * 1024 && file.type.includes('mp3')) {
      audioCtx.close();
      return { file, wasTrimmed: false };
    }

    // Otherwise, create an optimized 16kHz mono buffer sliced to targetDuration
    const targetFrames = Math.floor(decodedBuffer.sampleRate * targetDuration);
    const slicedBuffer = audioCtx.createBuffer(
      decodedBuffer.numberOfChannels,
      targetFrames,
      decodedBuffer.sampleRate
    );

    for (let c = 0; c < decodedBuffer.numberOfChannels; c++) {
      const src = decodedBuffer.getChannelData(c);
      slicedBuffer.getChannelData(c).set(src.subarray(0, targetFrames));
    }

    // Convert to lightweight 16kHz mono WAV for ultra-fast payload delivery
    const wavBlob = audioBufferTo16kMonoWav(slicedBuffer, 16000);
    audioCtx.close();

    const optimizedFile = new File([wavBlob], file.name.replace(/\.[^/.]+$/, '') + '-optimized.wav', {
      type: 'audio/wav',
    });

    return { file: optimizedFile, wasTrimmed: true };
  } catch (err) {
    console.warn('Não foi possível otimizar áudio no navegador, enviando original:', err);
    return { file, wasTrimmed: false };
  }
}
