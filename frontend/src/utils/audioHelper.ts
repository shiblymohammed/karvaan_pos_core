export const playAudioTone = (tone: string, customData?: string | null) => {
  if (tone === 'custom' && customData) {
    const audio = new Audio(customData);
    audio.play().catch(e => console.error("Audio playback failed:", e));
    return;
  }

  // Fallback to Web Audio API synthesized tones for built-in sounds
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();

  const playOscillator = (freq: number, type: OscillatorType, startTime: number, duration: number, vol = 1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = ctx.currentTime;

  if (tone === 'bell') {
    playOscillator(880, 'sine', now, 1.5, 0.8);
    playOscillator(1760, 'sine', now, 1.0, 0.3);
  } else if (tone === 'chime') {
    playOscillator(523.25, 'sine', now, 0.5, 0.5); // C5
    playOscillator(659.25, 'sine', now + 0.15, 0.5, 0.5); // E5
    playOscillator(783.99, 'sine', now + 0.3, 1.2, 0.6); // G5
  } else if (tone === 'digital') {
    playOscillator(1200, 'square', now, 0.1, 0.2);
    playOscillator(1200, 'square', now + 0.15, 0.1, 0.2);
  } else {
    // default to chime
    playOscillator(523.25, 'sine', now, 0.5, 0.5);
  }
}

export const playTtsAnnouncement = (text: string, voiceName: string) => {
  if (!('speechSynthesis' in window)) return;
  
  // Create the utterance
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set the voice if a specific one was requested
  if (voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }
  
  // Play the announcement
  window.speechSynthesis.speak(utterance);
};;
