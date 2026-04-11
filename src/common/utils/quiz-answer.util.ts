/** 퀴즈 답안 비교용 정규화 */
export function normalizeQuizAnswer(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}
