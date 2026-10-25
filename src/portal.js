// The game's only contact with a hosting portal. Portal builds (made by
// tools/build_portal.mjs) set `window.RF_PORTAL` and load Playgama Bridge,
// which speaks to Playgama, Y8 and the other portals it supports. Everywhere
// else, GitHub Pages and local play included, every call here is a no-op and
// saves go to localStorage.
//
// What portals check during review, and where it happens:
// - wait for the SDK before anything else         → init()
// - language from the platform                    → init() returns it
// - saves through the SDK, never localStorage     → load() / save()
// - pause and mute when the host says so          → onPause / onAudio
// - `game_ready` once the first frame is playable → ready()
// - interstitials only at natural breaks          → breakAd()

const SDK_TIMEOUT = 8000;
const bridge = () => globalThis.bridge;

export const isPortal = () => !!globalThis.RF_PORTAL;

let live = false;

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

// Resolves with the platform language, or null without a portal. Never
// rejects: a portal SDK that fails to start must not stop the game.
export async function init({ onPause, onAudio } = {}) {
  if (!isPortal() || !bridge()) return null;
  try {
    await withTimeout(bridge().initialize(), SDK_TIMEOUT);
    live = true;
  } catch (e) {
    console.warn('portal: SDK did not start', e);
    return null;
  }
  const b = bridge();
  const E = b.EVENT_NAME || {};
  if (onPause && E.PAUSE_STATE_CHANGED) b.platform.on(E.PAUSE_STATE_CHANGED, (paused) => onPause(!!paused));
  if (onAudio && E.AUDIO_STATE_CHANGED) b.platform.on(E.AUDIO_STATE_CHANGED, (enabled) => onAudio(!!enabled));
  // The events only report changes; the state at start is applied by hand.
  if (onAudio && b.platform.isAudioEnabled === false) onAudio(false);
  if (onPause && b.platform.isPaused === true) onPause(true);
  return b.platform.language || null;
}

export function ready() {
  if (live) send('game_ready');
}

// Lifecycle hints some portals use for analytics (CrazyGames, Poki).
export const matchStarted = () => live && send('level_started');
export const matchEnded = (won) => live && send(won ? 'level_completed' : 'level_failed');

function send(message) {
  try {
    bridge().platform.sendMessage(message);
  } catch (e) {
    console.warn('portal: sendMessage', message, e);
  }
}

// An interstitial at a natural break (between matches). Resolves when the
// game may carry on: after the ad closes or fails, or straight away when the
// portal declines to show one (too soon after the last, no fill, no portal).
// The SDK keeps its own minimum interval, so calling this often is safe.
export function breakAd() {
  if (!live) return Promise.resolve(false);
  const b = bridge();
  if (!b.advertisement || b.advertisement.isInterstitialSupported === false) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    let opened = false;
    const done = (shown) => {
      if (settled) return;
      settled = true;
      try {
        b.advertisement.off?.(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
      } catch {}
      resolve(shown);
    };
    let quiet = 0;
    const wait = (ms) => {
      clearTimeout(quiet);
      quiet = setTimeout(() => !opened && done(false), ms);
    };
    const onState = (state) => {
      if (state === 'opened') {
        opened = true;
        clearTimeout(quiet);
      } else if (state === 'loading') wait(10000); // loading, but not forever
      else if (state === 'closed' || state === 'failed') done(opened);
    };
    b.advertisement.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
    // No reaction at all means the SDK skipped this one.
    wait(1200);
    // A stuck ad must never trap the player.
    setTimeout(() => done(opened), 90000);
    try {
      b.advertisement.showInterstitial();
    } catch (e) {
      console.warn('portal: showInterstitial', e);
      done(false);
    }
  });
}

/* ---------- saves ---------- */

const PREFIX = 'rainfight.';

export async function load(key) {
  if (live && bridge().storage) {
    try {
      const [v] = await bridge().storage.get([key]);
      return v ?? null;
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function save(key, value) {
  if (live && bridge().storage) {
    bridge().storage.set([key], [String(value)]).catch(() => {});
    return;
  }
  try {
    localStorage.setItem(PREFIX + key, String(value));
  } catch {}
}
