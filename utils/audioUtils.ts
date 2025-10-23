export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  // The Gemini TTS API returns raw PCM data at 24000 Hz with 1 channel.
  const sampleRate = 24000;
  const numChannels = 1;

  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const concatAudioBuffers = (buffers: AudioBuffer[], ctx: AudioContext): AudioBuffer => {
    if (buffers.length === 0) {
        return ctx.createBuffer(1, 1, ctx.sampleRate);
    }
    const numberOfChannels = buffers[0].numberOfChannels;
    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);

    const result = ctx.createBuffer(numberOfChannels, totalLength, buffers[0].sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = result.getChannelData(channel);
        let offset = 0;
        for (const buffer of buffers) {
            channelData.set(buffer.getChannelData(channel), offset);
            offset += buffer.length;
        }
    }
    return result;
}

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}`;
};