// Generates the two chat sounds as 16-bit PCM WAV files.
//
// Synthesized rather than downloaded, because an audio file off the internet
// carries a licence question into an AGPL repo. Arithmetic has none.
//
//   node scripts/generate-sounds.mjs
//
// The output is committed. This exists so the next person can change a number
// and hear why it was that number.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'sounds');

// These play through a phone speaker held next to a face. A message sound that
// makes someone flinch is one they switch off.
const PEAK = 0.22;

// A pure sine reads as a test tone. An octave up at a fifth of the amplitude
// makes it an instrument instead.
const HARMONIC_GAIN = 0.2;

// Starting or stopping a waveform mid-cycle is a click, which is the most
// common thing wrong with a hand-made UI sound.
const EDGE_SECONDS = 0.004;

function envelopeAt(time, duration) {
  if (time < EDGE_SECONDS) {
    return time / EDGE_SECONDS;
  }

  const remaining = duration - time;

  if (remaining < EDGE_SECONDS) {
    return Math.max(0, remaining / EDGE_SECONDS);
  }

  // A struck object loses energy exponentially, so it is what the ear expects
  // from anything that sounds like a chime.
  return Math.exp(-3.2 * (time / duration));
}

function render(notes) {
  const total = Math.max(...notes.map((note) => note.start + note.duration));
  const samples = new Float64Array(Math.ceil(total * SAMPLE_RATE));

  for (const note of notes) {
    const firstSample = Math.floor(note.start * SAMPLE_RATE);
    const noteSamples = Math.floor(note.duration * SAMPLE_RATE);

    for (let offset = 0; offset < noteSamples; offset += 1) {
      const time = offset / SAMPLE_RATE;
      const angle = 2 * Math.PI * note.frequency * time;
      const value = Math.sin(angle) + HARMONIC_GAIN * Math.sin(2 * angle);

      samples[firstSample + offset] += value * envelopeAt(time, note.duration);
    }
  }

  return samples;
}

function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');

  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);

  // Measured rather than assumed: two overlapping notes sum, so the peak is not
  // the peak of either one.
  const loudest = samples.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
  const scale = (loudest > 0 ? PEAK / loudest : 0) * 32767;

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(samples[index] * scale), 44 + index * 2);
  }

  return buffer;
}

// A5, one note, and lower than the incoming sound. This fires every time the
// user presses send, so it is a confirmation rather than an announcement.
const sent = render([{ frequency: 880, start: 0, duration: 0.09 }]);

// E5 then A5. Rising because somebody is arriving, and two notes because one is
// indistinguishable from the sound the user just made themselves.
const received = render([
  { frequency: 659.25, start: 0, duration: 0.16 },
  { frequency: 880, start: 0.075, duration: 0.19 },
]);

// Nobody can hear CI, so "it sounds fine" is checked as numbers. Each assertion
// is a way a hand-written WAV is silently wrong on a device.
function check(wav, samples, name) {
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(`${name}: ${message}`);
    }
  };

  assert(wav.toString('ascii', 0, 4) === 'RIFF', 'not a RIFF file');
  assert(wav.toString('ascii', 8, 12) === 'WAVE', 'not a WAVE file');
  assert(wav.readUInt32LE(4) === wav.length - 8, 'RIFF size does not match the file');
  assert(wav.readUInt32LE(40) === wav.length - 44, 'data size does not match the file');
  assert(wav.readUInt16LE(22) === 1, 'not mono');
  assert(wav.readUInt32LE(24) === SAMPLE_RATE, 'wrong sample rate');
  assert(wav.readUInt16LE(34) === 16, 'not 16-bit');

  let peak = 0;

  for (let offset = 44; offset < wav.length; offset += 2) {
    peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
  }

  const peakRatio = peak / 32767;

  assert(peakRatio < 0.999, 'clipping');
  assert(Math.abs(peakRatio - PEAK) < 0.01, `peak is ${peakRatio.toFixed(3)}, wanted ${PEAK}`);

  assert(Math.abs(wav.readInt16LE(44)) < 64, 'starts mid-waveform, which clicks');
  assert(Math.abs(wav.readInt16LE(wav.length - 2)) < 64, 'ends mid-waveform, which clicks');

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;

  assert(Math.abs(mean) < 0.02, `DC offset of ${mean.toFixed(4)}`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [name, samples] of [
  ['message-sent.wav', sent],
  ['message-received.wav', received],
]) {
  const wav = toWav(samples);

  check(wav, samples, name);
  writeFileSync(path.join(OUTPUT_DIR, name), wav);

  const seconds = (samples.length / SAMPLE_RATE).toFixed(3);

  console.log(`${name}: ${seconds}s, ${(wav.length / 1024).toFixed(1)}KB, checks passed`);
}
