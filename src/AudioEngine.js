export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmTimer = null;
    this.rollTimer = null;
    this.bgmStep = 0;
    this.nextBgmTime = 0;
    this.bgmInterval = 0.21;
    this.nextRollTime = 0;
    this.rollInterval = 0.13;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }

  tone(freq, duration = 0.12, type = 'triangle', volume = 0.08, delay = 0) {
    this.ensure();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(this.master);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  noise(duration = 0.12, volume = 0.08, filterFreq = 700) {
    this.ensure();
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  startBgm() {
    this.ensure();
    if (this.bgmTimer) return;

    const bass = [110, 110, 146.83, 164.81, 196, 164.81, 146.83, 110];
    const lead = [440, 554.37, 659.25, 880];
    this.bgmStep = 0;
    this.nextBgmTime = this.ctx.currentTime;

    const scheduleBgm = () => {
      while (this.nextBgmTime < this.ctx.currentTime + 0.12) {
        const bassFreq = bass[this.bgmStep % bass.length];
        this._scheduleTone(bassFreq, 0.16, 'sawtooth', 0.035, this.nextBgmTime);

        if (this.bgmStep % 4 === 0) {
          const leadFreq = lead[(this.bgmStep / 4) % lead.length];
          this._scheduleTone(leadFreq, 0.18, 'square', 0.025, this.nextBgmTime + 0.02);
        }

        this.nextBgmTime += this.bgmInterval;
        this.bgmStep += 1;
      }
    };

    this.bgmTimer = window.setInterval(scheduleBgm, 80);
    scheduleBgm();
  }

  _scheduleTone(freq, duration, type, volume, startTime) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(this.master);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  stopBgm() {
    if (!this.bgmTimer) return;
    window.clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  startRolling() {
    this.ensure();
    if (this.rollTimer) return;
    this.nextRollTime = this.ctx.currentTime;

    const scheduleRoll = () => {
      while (this.nextRollTime < this.ctx.currentTime + 0.08) {
        this._scheduleRollTick(this.nextRollTime);
        this.nextRollTime += this.rollInterval;
      }
    };

    this.rollTimer = window.setInterval(scheduleRoll, 60);
    scheduleRoll();
  }

  _scheduleRollTick(time) {
    const sampleRate = this.ctx.sampleRate;
    const duration = 0.055;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.value = 0.026;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(time);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 70 + Math.random() * 32;
    oscGain.gain.value = 0.018;
    osc.connect(oscGain);
    oscGain.connect(this.master);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  stopRolling() {
    if (!this.rollTimer) return;
    window.clearInterval(this.rollTimer);
    this.rollTimer = null;
  }

  pick() {
    this.tone(520, 0.06, 'square', 0.04);
  }

  launch() {
    this.tone(180, 0.08, 'triangle', 0.05);
    this.noise(0.08, 0.035, 420);
  }

  ping() {
    this.tone(1046.5, 0.18, 'triangle', 0.1);
    this.tone(1568, 0.16, 'sine', 0.055, 0.025);
  }

  wrong() {
    this.tone(105, 0.22, 'sawtooth', 0.09);
    this.noise(0.22, 0.09, 320);
  }

  bumper() {
    this.tone(210, 0.055, 'square', 0.045);
  }

  mix() {
    this.tone(392, 0.08, 'triangle', 0.06);
    this.tone(523.25, 0.11, 'square', 0.045, 0.06);
    this.tone(659.25, 0.13, 'triangle', 0.05, 0.13);
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this.tone(freq, 0.18, 'triangle', 0.09, index * 0.12);
    });
  }

  lose() {
    this.tone(92.5, 0.45, 'sawtooth', 0.1);
  }
}
