import { VRColorBowling } from './VRColorBowling.js';

const game = new VRColorBowling();

if (import.meta.env.DEV) {
  window.__vrColorBowling = game;
}
