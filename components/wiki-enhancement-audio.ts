export type EnhancementSoundKind =
  | 'charge'
  | 'success'
  | 'fail'
  | 'down'
  | 'destroy'
  | 'max'

let activeEnhancementAudioContext: AudioContext | null = null
let activeEnhancementAudioCloseTimer: number | null = null

export function closeEnhancementAudio() {
  if (activeEnhancementAudioCloseTimer !== null) {
    window.clearTimeout(activeEnhancementAudioCloseTimer)
    activeEnhancementAudioCloseTimer = null
  }

  if (
    activeEnhancementAudioContext &&
    activeEnhancementAudioContext.state !== 'closed'
  ) {
    void activeEnhancementAudioContext.close().catch(() => {})
  }

  activeEnhancementAudioContext = null
}

export function playEnhancementTone(
  kind: EnhancementSoundKind,
  level = 0,
  volume = 1
) {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return

    closeEnhancementAudio()

    const ctx = new AudioContextClass()
    activeEnhancementAudioContext = ctx
    const now = ctx.currentTime
    const intensity = Math.max(0, Math.min(15, level))
    const master = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()

    const normalizedVolume = Math.max(0, Math.min(1, volume))
    master.gain.setValueAtTime(1.32 * normalizedVolume, now)
    compressor.threshold.setValueAtTime(-20, now)
    compressor.knee.setValueAtTime(16, now)
    compressor.ratio.setValueAtTime(8, now)
    compressor.attack.setValueAtTime(0.0015, now)
    compressor.release.setValueAtTime(0.16, now)
    master.connect(compressor)
    compressor.connect(ctx.destination)

    const resonator = (
      frequency: number,
      start: number,
      duration: number,
      gainValue: number,
      type: OscillatorType = 'sine',
      endFrequency?: number
    ) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency, now + start)
      if (endFrequency) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(34, endFrequency),
          now + start + duration
        )
      }
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, gainValue),
        now + start + 0.004
      )
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + duration
      )
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + start)
      osc.stop(now + start + duration + 0.03)
    }

    const impactNoise = (
      start: number,
      duration: number,
      gainValue: number,
      frequency: number,
      filterType: BiquadFilterType = 'bandpass'
    ) => {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      for (let index = 0; index < frames; index += 1) {
        const decay = 1 - index / frames
        data[index] = (Math.random() * 2 - 1) * decay
      }

      const source = ctx.createBufferSource()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      source.buffer = buffer
      filter.type = filterType
      filter.frequency.setValueAtTime(frequency, now + start)
      filter.Q.setValueAtTime(
        filterType === 'bandpass' ? 1.7 : 0.8,
        now + start
      )
      gain.gain.setValueAtTime(Math.max(0.0002, gainValue), now + start)
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + duration
      )
      source.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      source.start(now + start)
      source.stop(now + start + duration + 0.025)
    }

    const hammerHit = (
      start = 0,
      strength = 1,
      ring = 1,
      dull = false
    ) => {
      const body = 74 + Math.min(18, intensity * 1.15)
      impactNoise(start, 0.045, 0.072 * strength, dull ? 610 : 980)
      impactNoise(start + 0.004, 0.09, 0.03 * strength, 250, 'lowpass')
      resonator(body, start, 0.2, 0.055 * strength, 'triangle')
      const metallicPartials = dull
        ? [238, 356, 514]
        : [286, 431, 638, 917]

      metallicPartials.forEach((frequency, index) => {
        resonator(
          frequency + intensity * (index + 1) * 1.8,
          start + 0.006 + index * 0.003,
          (0.22 + index * 0.07) * ring,
          (0.022 / (index + 1)) * strength,
          index % 2 ? 'triangle' : 'sine'
        )
      })
    }

    if (kind === 'charge') {
      const strikeDuration =
        intensity >= 14
          ? 1.45
          : intensity >= 12
            ? 1.2
            : intensity >= 8
              ? 0.98
              : intensity >= 5
                ? 0.8
                : 0.65
      const firstHit = strikeDuration * 0.24
      const mainHit = strikeDuration * 0.52
      const finalHit = strikeDuration * 0.8

      // Match the visible blacksmith swing: light setup hit, heavy main hit,
      // then a shorter finishing hit. Keeping all three in one audio context
      // prevents later hits from cutting the earlier metal resonance off.
      hammerHit(firstHit, 0.76, 0.5, false)
      hammerHit(mainHit, 1.12, 0.92, false)
      hammerHit(finalHit, 0.88, 0.62, false)
      impactNoise(mainHit + 0.006, 0.07, 0.032, 1780, 'highpass')
      resonator(846 + intensity * 4, mainHit + 0.012, 0.32, 0.014, 'sine')
      resonator(1260 + intensity * 6, mainHit + 0.026, 0.24, 0.009, 'sine')
    } else if (kind === 'success') {
      hammerHit(0, 1.18, 1.16, false)
      impactNoise(0.012, 0.07, 0.034, 1750, 'highpass')
      resonator(742 + intensity * 3, 0.015, 0.5, 0.022, 'sine')
      resonator(1110 + intensity * 5, 0.035, 0.43, 0.016, 'sine')
      resonator(1480 + intensity * 6, 0.055, 0.34, 0.011, 'sine')
    } else if (kind === 'max') {
      hammerHit(0, 1.3, 1.18, false)
      hammerHit(0.19, 1.18, 1.26, false)
      impactNoise(0.2, 0.1, 0.04, 2050, 'highpass')
      resonator(654, 0.205, 0.76, 0.026, 'sine')
      resonator(981, 0.225, 0.68, 0.019, 'sine')
      resonator(1472, 0.245, 0.56, 0.013, 'sine')
    } else if (kind === 'down') {
      hammerHit(0, 0.96, 0.34, true)
      impactNoise(0.035, 0.12, 0.034, 520, 'bandpass')
      resonator(232, 0.025, 0.48, 0.03, 'triangle', 78)
      resonator(138, 0.085, 0.46, 0.021, 'sine', 48)
    } else if (kind === 'destroy') {
      hammerHit(0, 1.42, 0.34, true)
      impactNoise(0.015, 0.13, 0.1, 1460, 'bandpass')
      impactNoise(0.075, 0.19, 0.065, 760, 'bandpass')
      impactNoise(0.145, 0.28, 0.052, 330, 'lowpass')
      resonator(76, 0.01, 0.72, 0.064, 'sine', 34)
      resonator(48, 0.07, 0.72, 0.042, 'triangle', 30)
    } else {
      hammerHit(0, 0.88, 0.2, true)
      impactNoise(0.01, 0.09, 0.046, 430, 'lowpass')
      resonator(92, 0.006, 0.22, 0.043, 'triangle', 58)
    }

    activeEnhancementAudioCloseTimer = window.setTimeout(() => {
      if (activeEnhancementAudioContext === ctx) {
        activeEnhancementAudioContext = null
      }
      void ctx.close().catch(() => {})
      activeEnhancementAudioCloseTimer = null
    }, 2300)
  } catch {}
}
