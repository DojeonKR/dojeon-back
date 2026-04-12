import { normalizeQuizAnswer } from './quiz-answer.util';

describe('normalizeQuizAnswer', () => {
  it('should trim leading and trailing spaces', () => {
    expect(normalizeQuizAnswer('  hello  ')).toBe('hello');
  });

  it('should convert multiple spaces into a single space', () => {
    expect(normalizeQuizAnswer('hello     world')).toBe('hello world');
  });

  it('should convert to lowercase', () => {
    expect(normalizeQuizAnswer('HeLlO WoRlD')).toBe('hello world');
  });

  it('should handle all transformations at once', () => {
    expect(normalizeQuizAnswer('  THANK     you  ')).toBe('thank you');
  });

  it('should handle empty strings', () => {
    expect(normalizeQuizAnswer('')).toBe('');
    expect(normalizeQuizAnswer('   ')).toBe('');
  });
});
