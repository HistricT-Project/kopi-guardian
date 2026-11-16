// Procedural sound effects, synthesised with WebAudio: no audio files, no
// network. Every effect is a short oscillator or filtered-noise burst, so the
// game stays fully offline. The context is created lazily on the first user
// gesture (browsers block audio before that) and M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** A short tone that slides from `from` Hz to `to` Hz over `seconds`. */
  function tone({ type = 'sine', from = 440, to = 440, seconds = 0.12, volume = 0.5, delay = 0 }) {
    if (muted || !ensure()) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  /** A burst of filtered noise, for impacts and pops. */
  function noise({ seconds = 0.08, volume = 0.4, frequency = 1200, delay = 0 }) {
    if (muted || !ensure()) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call from any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 720, to: 380, seconds: 0.07, volume: 0.16 });
    },
    hit() {
      noise({ seconds: 0.05, volume: 0.25, frequency: 2000 });
    },
    pop() {
      tone({ type: 'sine', from: 320, to: 70, seconds: 0.14, volume: 0.4 });
      noise({ seconds: 0.06, volume: 0.2, frequency: 900 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 180, to: 70, seconds: 0.22, volume: 0.4 });
    },
    cherry() {
      tone({ type: 'sine', from: 880, to: 880, seconds: 0.08, volume: 0.3 });
      tone({ type: 'sine', from: 1318, to: 1318, seconds: 0.1, volume: 0.3, delay: 0.07 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((note, i) => {
        tone({ type: 'triangle', from: note, to: note, seconds: 0.14, volume: 0.35, delay: i * 0.09 });
      });
    },
    waveClear() {
      [392, 523, 659].forEach((note, i) => {
        tone({ type: 'triangle', from: note, to: note, seconds: 0.16, volume: 0.3, delay: i * 0.1 });
      });
    },
    dash() {
      noise({ seconds: 0.12, volume: 0.2, frequency: 3000 });
    },
    roast() {
      noise({ seconds: 0.35, volume: 0.5, frequency: 700 });
      tone({ type: 'sawtooth', from: 220, to: 40, seconds: 0.4, volume: 0.45 });
      tone({ type: 'sine', from: 1047, to: 1568, seconds: 0.25, volume: 0.3, delay: 0.05 });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((note, i) => {
        tone({ type: 'triangle', from: note, to: note, seconds: 0.28, volume: 0.35, delay: i * 0.18 });
      });
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((note, i) => {
        tone({ type: 'triangle', from: note, to: note, seconds: 0.22, volume: 0.35, delay: i * 0.12 });
      });
    },
  };
}
