// Audio analysis for OpenCut mobile: waveforms + beat detection.
// Web Audio based, fully guarded for offline/headless environments.
// Ideas inspired by LumoCut/OpenReel (spectral-flux onset, peak bars);
// all code written from scratch.

export interface WaveformPeaks {
  peaks: number[]; // 0..1 normalized, length === bars
  duration: number;
}

/** Pure: downsample channel data to N normalized peak bars. */
export function computePeaks(channelData: ArrayLike<number>, bars: number): number[] {
  const n = Math.max(1, Math.floor(bars));
  const len = channelData.length;
  if (len === 0) return new Array(n).fill(0);
  const out: number[] = [];
  const per = len / n;
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * per);
    const to = Math.max(from + 1, Math.floor((i + 1) * per));
    let peak = 0;
    for (let j = from; j < to && j < len; j++) {
      const v = Math.abs(channelData[j] ?? 0);
      if (v > peak) peak = v;
    }
    out.push(Math.min(1, peak));
  }
  return out;
}

/** Pure: energy-onset beat detection over peaks. Returns times in seconds. */
export function detectBeats(
  peaks: number[],
  duration: number,
  opts?: { threshold?: number; minGapSec?: number },
): number[] {
  const threshold = opts?.threshold ?? 0.45;
  const minGap = opts?.minGapSec ?? 0.35;
  if (peaks.length < 3 || duration <= 0) return [];
  const beats: number[] = [];
  let last = -minGap;
  for (let i = 1; i < peaks.length - 1; i++) {
    const prev = peaks[i - 1] ?? 0;
    const cur = peaks[i] ?? 0;
    const next = peaks[i + 1] ?? 0;
    const t = (i / peaks.length) * duration;
    if (cur > threshold && cur >= prev && cur >= next && t - last >= minGap) {
      beats.push(Number(t.toFixed(2)));
      last = t;
    }
  }
  return beats;
}

async function decodeFirstChannel(blob: Blob): Promise<{ data: Float32Array; duration: number } | null> {
  try {
    const Ctx =
      (globalThis as unknown as {
        AudioContext?: new () => AudioContext;
        webkitAudioContext?: new () => AudioContext;
      }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    try {
      const bytes = await blob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes);
      const data = buffer.getChannelData(0);
      return { data, duration: buffer.duration };
    } finally {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
  } catch {
    return null;
  }
}

/** Waveform bars for a media blob. Null when decoding is unavailable. */
export async function getWaveform(blob: Blob, bars = 48): Promise<WaveformPeaks | null> {
  const decoded = await decodeFirstChannel(blob);
  if (!decoded) return null;
  return { peaks: computePeaks(decoded.data, bars), duration: decoded.duration };
}

/** Beat times (seconds) for a media blob. Empty array when unavailable. */
export async function detectBeatsInBlob(
  blob: Blob,
  opts?: { threshold?: number; minGapSec?: number },
): Promise<number[]> {
  const decoded = await decodeFirstChannel(blob);
  if (!decoded) return [];
  return detectBeats(computePeaks(decoded.data, 128), decoded.duration, opts);
}
