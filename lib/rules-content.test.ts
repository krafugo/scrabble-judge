import { describe, expect, it } from 'vitest';
import { RULES_CONTENT } from './rules-content';

describe('bilingual rules content', () => {
  it.each(['es', 'en'] as const)('provides complete, sourced %s guidance', (language) => {
    const content = RULES_CONTENT[language];

    expect(content.facts).toHaveLength(3);
    expect(content.corrections.length).toBeGreaterThanOrEqual(3);
    expect(content.sections).toHaveLength(7);
    expect(new Set(content.sections.map(({ number }) => number)).size).toBe(content.sections.length);
    expect(content.sections.every(({ points }) => points.length >= 3)).toBe(true);
    expect(content.sources.length).toBeGreaterThanOrEqual(3);
    expect(content.sources.every(({ url }) => url.startsWith('https://'))).toBe(true);
  });

  it('keeps the Spanish and English editions independently selectable', () => {
    expect(RULES_CONTENT.es.title).not.toBe(RULES_CONTENT.en.title);
    expect(RULES_CONTENT.es.edition).toContain('FILE 2024');
    expect(RULES_CONTENT.en.edition).toContain('Hasbro');
  });
});
