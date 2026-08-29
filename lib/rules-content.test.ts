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

  it.each(['es', 'en'] as const)('explains common word categories with accepted senses in %s', (language) => {
    const validWords = RULES_CONTENT[language].sections.find(({ number }) => number === '04');

    expect(validWords?.examples?.groups.length).toBeGreaterThanOrEqual(7);
    expect(validWords?.examples?.groups.every(({ allowed, rejected }) => allowed.length > 0 && rejected.length > 0)).toBe(true);
  });

  it('makes the proper-name homograph rule explicit in both languages', () => {
    const spanishExamples = RULES_CONTENT.es.sections.find(({ number }) => number === '04')?.examples;
    const englishExamples = RULES_CONTENT.en.sections.find(({ number }) => number === '04')?.examples;

    expect(spanishExamples?.groups.flatMap(({ allowed }) => allowed).some(({ word, note }) => word.includes('CHILE') && note.includes('país'))).toBe(true);
    expect(englishExamples?.groups.flatMap(({ allowed }) => allowed).some(({ word, note }) => word.includes('CHINA') && note.includes('country'))).toBe(true);
  });
});
