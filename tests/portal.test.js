import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, t, missingKeys, LANGUAGES } from '../src/i18n.js';
import * as portal from '../src/portal.js';

test('every language carries every key', () => {
  assert.deepEqual(missingKeys(), {});
  assert.ok(LANGUAGES.length >= 8);
});

test('regional codes map to their language; unknown ones fall back to English', () => {
  assert.equal(setLanguage('pt-BR'), 'pt');
  assert.equal(setLanguage('uk_UA'), 'uk');
  assert.equal(setLanguage('ja'), 'en');
  assert.equal(setLanguage(undefined), 'en');
});

test('placeholders are filled', () => {
  setLanguage('en');
  assert.equal(t('wins', { name: 'VOLT' }), 'VOLT WINS');
  setLanguage('ru');
  assert.equal(t('vsCpuLevel', { level: t('hard') }), 'против компа · ЖЁСТКО');
  setLanguage('en');
});

test('without a portal the adapter stays out of the way', async () => {
  assert.equal(portal.isPortal(), false);
  assert.equal(await portal.init({ onPause() {}, onAudio() {} }), null);
  assert.equal(await portal.breakAd(), false);
  assert.doesNotThrow(() => portal.ready());
});
