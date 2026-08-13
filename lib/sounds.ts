import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import receivedSound from '@/assets/sounds/message-received.wav';
import sentSound from '@/assets/sounds/message-sent.wav';

// Same shape as lib/haptics.ts: nothing returns a promise and nothing throws,
// so a message cannot fail to send because a speaker did not cooperate.

const sources = {
  sent: sentSound,
  received: receivedSound,
} as const;

export type SoundName = keyof typeof sources;

// Created once. createAudioPlayer decodes the file, so one per message would
// put a decode on the send path and leak a native player each time.
const players = new Map<SoundName, AudioPlayer>();

let muted = false;

export function setSoundsMuted(next: boolean): void {
  muted = next;
}

function playerFor(name: SoundName): AudioPlayer | null {
  const existing = players.get(name);

  if (existing) {
    return existing;
  }

  try {
    const player = createAudioPlayer(sources[name]);

    players.set(name, player);

    return player;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName): void {
  if (muted) {
    return;
  }

  const player = playerFor(name);

  if (!player) {
    return;
  }

  try {
    // A player left at the end of its own clip plays nothing on the second
    // call, which reads as the sound breaking after the first message.
    player.seekTo(0);
    player.play();
  } catch {
    // Ordinary on a browser or device that will not decode this.
  }
}
