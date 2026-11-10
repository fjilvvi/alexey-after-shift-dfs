type Track = 'shop' | 'gym' | 'win';
type Cue = 'tap' | 'good' | 'bad' | 'step' | 'win' | 'transition';

/** Original three-voice, synthesized retro soundtrack; no remote audio required. */
export class RetroAudio {
  muted = false;
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private scene: Track = 'shop';
  private beat = 0;
  private nextNote = 0;
  private disposed = false;

  constructor() {
    try { this.muted = localStorage.getItem('alexey-audio-muted') === '1'; } catch { /* Storage may be unavailable in private browsing. */ }
  }

  unlock() {
    if (this.disposed) return;
    if (!this.context) {
      const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
      this.nextNote = this.context.currentTime + 0.04;
      this.timer = setInterval(() => this.schedule(), 60);
    }
    if (this.context.state === 'suspended') void this.context.resume().then(() => {
      if (this.context) this.nextNote = this.context.currentTime + 0.04;
    }).catch(() => undefined);
    this.schedule();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem('alexey-audio-muted', this.muted ? '1' : '0'); } catch { /* Optional preference only. */ }
    this.unlock();
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.22, this.context.currentTime, 0.025);
    return this.muted;
  }

  setScene(scene: Track) {
    if (this.scene === scene) return;
    this.scene = scene;
    this.beat = 0;
    if (this.context) this.nextNote = this.context.currentTime + 0.04;
  }

  sfx(name: Cue) {
    this.unlock();
    const ctx = this.context;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const cue: Record<Cue, number[]> = {
      tap: [740, 988], good: [523, 659, 784, 1047], bad: [185, 139, 110],
      step: [95], win: [523, 659, 784, 1047, 784, 1047, 1319, 1568],
      transition: [262, 330, 392, 523, 659, 784],
    };
    const notes = cue[name];
    notes.forEach((frequency, index) => this.tone(frequency, now + index * (name === 'win' ? 0.12 : 0.065), name === 'step' ? 0.045 : 0.11, name === 'bad' ? 'sawtooth' : 'square', name === 'step' ? 0.12 : 0.2));
    if (name === 'good' || name === 'win') this.noise(now, 0.12, 0.1);
  }

  private schedule() {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || document.hidden) return;
    if (this.nextNote < ctx.currentTime - 0.2) this.nextNote = ctx.currentTime + 0.03;
    const step = this.scene === 'gym' ? 0.175 : this.scene === 'win' ? 0.16 : 0.21;
    while (this.nextNote < ctx.currentTime + 0.13) {
      if (!this.muted) this.musicStep(this.beat, this.nextNote, step);
      this.beat++;
      this.nextNote += step;
    }
  }

  private musicStep(index: number, when: number, step: number) {
    // Eight-bar original E-minor arcade loop, with separate bass and arpeggio voices.
    const shop = [76, 0, 79, 83, 81, 79, 76, 74, 72, 0, 76, 79, 78, 76, 74, 71, 69, 0, 72, 76, 74, 72, 71, 69, 71, 74, 78, 81, 79, 78, 74, 0];
    const gym = [64, 76, 67, 79, 71, 83, 67, 79, 62, 74, 66, 78, 69, 81, 66, 78, 60, 72, 64, 76, 67, 79, 64, 76, 59, 71, 62, 74, 66, 78, 69, 78];
    const win = [76, 79, 83, 88, 83, 79, 76, 0, 74, 78, 81, 86, 81, 78, 74, 0, 72, 76, 79, 84, 79, 76, 72, 0, 74, 78, 83, 86, 88, 0, 88, 0];
    const melody = this.scene === 'shop' ? shop : this.scene === 'gym' ? gym : win;
    const note = melody[index % melody.length];
    if (note) this.tone(this.frequency(note), when, step * 0.65, 'square', 0.075);
    const root = [40, 38, 36, 35][Math.floor(index / 8) % 4];
    if (index % 2 === 0) this.tone(this.frequency(root + (index % 8 === 6 ? 7 : 0)), when, step * 1.15, 'triangle', 0.32);
    if (index % 4 === 0) this.kick(when);
    if (index % 4 === 2) this.noise(when, 0.055, 0.09);
    if (index % 2) this.noise(when, 0.015, 0.035);
  }

  private frequency(note: number) { return 440 * Math.pow(2, (note - 69) / 12); }

  private tone(frequency: number, when: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const envelope = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(volume, when + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(envelope); envelope.connect(this.master);
    osc.start(when); osc.stop(when + duration + 0.01);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }

  private kick(when: number) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator(), envelope = this.context.createGain();
    osc.frequency.setValueAtTime(130, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.08);
    envelope.gain.setValueAtTime(0.35, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    osc.connect(envelope); envelope.connect(this.master); osc.start(when); osc.stop(when + 0.11);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }

  private noise(when: number, duration: number, volume: number) {
    if (!this.context || !this.master) return;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 1700;
    source.buffer = buffer; envelope.gain.value = volume;
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master); source.start(when);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  destroy() {
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = undefined;
    this.master = undefined;
  }
}
