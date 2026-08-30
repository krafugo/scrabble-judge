import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const serviceWorker = fs.readFileSync(path.resolve(import.meta.dirname, '../public/sw.js'), 'utf8');

describe('offline update strategy', () => {
  it('uses a fresh cache generation for the personalized judge messages', () => {
    expect(serviceWorker).toContain("const CACHE_NAME = 'palabra-justa-v9'");
  });

  it('checks the network first for page navigations', () => {
    expect(serviceWorker).toMatch(/request\.mode === 'navigate'[\s\S]+fetch\(request\)[\s\S]+caches\.match\(request\)/);
  });

  it('does not return the HTML shell when a static asset is unavailable', () => {
    expect(serviceWorker).not.toContain("cached ?? caches.match('/')");
  });

  it('resolves offline assets inside the service worker registration scope', () => {
    expect(serviceWorker).toContain('self.registration.scope');
    expect(serviceWorker).not.toContain("const APP_SHELL = ['/'");
  });
});
