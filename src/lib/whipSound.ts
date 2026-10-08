// Sound effect engine for OpenWhip (Hybrid: Audio files + Web Audio API Synthesizer)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isWhipMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('elios_openwhip_muted') === 'true';
}

export function setWhipMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('elios_openwhip_muted', muted ? 'true' : 'false');
}

/**
 * Synthétiseur de claquement de fouet réaliste via Web Audio API.
 * Garantit un effet sonore percutant même si les fichiers audio sont bloqués ou indisponibles.
 */
function playSynthesizedWhipCrack(volume = 0.85): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Transient click initial (l'impact supersonique)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(3200, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
  
  oscGain.gain.setValueAtTime(volume * 0.9, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);

  // 2. White noise burst (l'onde de choc et le frottement du fouet)
  const bufferSize = ctx.sampleRate * 0.15; // 150ms
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1);
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;

  // Filtre passe-bande dynamique balayant les hautes fréquences
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(6500, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + 0.08);
  filter.Q.setValueAtTime(3.0, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 1.0, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  whiteNoise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  whiteNoise.start(now);
  whiteNoise.stop(now + 0.1);

  // 3. Slap-back reverb / écho bref (résonance dans la pièce)
  const echoGain = ctx.createGain();
  echoGain.gain.setValueAtTime(volume * 0.28, now + 0.045);
  echoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  filter.connect(echoGain);
  echoGain.connect(ctx.destination);
}

/**
 * Joue le son de claquement de fouet (OpenWhip)
 */
export function playWhipSound(): void {
  if (isWhipMuted()) return;

  const sounds = ['/sounds/whip1.mp3', '/sounds/whip2.mp3', '/sounds/whip3.mp3'];
  const chosenSound = sounds[Math.floor(Math.random() * sounds.length)];

  try {
    const audio = new Audio(chosenSound);
    audio.volume = 0.95;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // En cas de blocage d'autoplay ou de fichier indisponible, fallback synthétiseur Web Audio
        console.warn('Audio element play failed, falling back to Web Audio synth:', err);
        playSynthesizedWhipCrack(0.9);
      });
    }
  } catch {
    playSynthesizedWhipCrack(0.9);
  }
}

