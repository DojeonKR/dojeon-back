export interface BareunMorpheme {
  surface: string;
  pos: string;
}

export interface BareunResult {
  morphemes: BareunMorpheme[];
  raw: unknown;
}

export async function analyzeBareun(text: string): Promise<BareunResult> {
  const apiUrl = process.env.BAREUNA_AI_API_URL;
  const apiKey = process.env.BAREUNA_AI_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('BAREUNA_AI_API_URL 또는 BAREUNA_AI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'API-KEY': apiKey,
    },
    body: JSON.stringify({ document: { content: text }, auto_spacing: false, auto_paragraph: false }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`바른 AI API 오류 (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    return_object?: {
      sentence?: Array<{
        morpheme?: Array<{ text?: { content?: string }; label?: string }>;
      }>;
    };
  };

  const morphemes: BareunMorpheme[] = [];
  for (const sentence of data?.return_object?.sentence ?? []) {
    for (const m of sentence?.morpheme ?? []) {
      morphemes.push({
        surface: m.text?.content ?? '',
        pos: m.label ?? '',
      });
    }
  }

  return { morphemes, raw: data };
}
