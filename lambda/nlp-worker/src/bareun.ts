import axios from 'axios';

export type BareunAnalyzeResult = {
  provider: 'bareun';
  raw: unknown;
};

/**
 * 바른 AI(Bareun) 형태소/분석 API 호출.
 * 환경변수: BAREUN_API_URL (기본: 공식 REST 베이스 URL), BAREUN_API_KEY
 * 실제 경로·바디는 계정/제품에 맞게 조정하세요.
 */
export async function analyzeWithBareun(inputText: string): Promise<BareunAnalyzeResult> {
  const baseUrl = (process.env.BAREUN_API_URL ?? '').replace(/\/$/, '');
  const apiKey = process.env.BAREUN_API_KEY?.trim() ?? '';

  if (!baseUrl || !apiKey) {
    return {
      provider: 'bareun',
      raw: {
        mode: 'stub',
        message: 'BAREUN_API_URL 또는 BAREUN_API_KEY 미설정 — 스텁 응답',
        inputLength: inputText.length,
      },
    };
  }

  const url = `${baseUrl}/analyze`;
  const { data } = await axios.post(
    url,
    { text: inputText },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 25_000,
    },
  );
  return { provider: 'bareun', raw: data };
}
