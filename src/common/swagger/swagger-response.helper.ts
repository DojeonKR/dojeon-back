/**
 * 공통 성공 응답 래퍼 예시를 생성하는 헬퍼
 */
export function successExample(data: unknown, message = '요청이 성공했습니다.', code = '200') {
  return {
    isSuccess: true,
    code,
    message,
    data,
    timestamp: '2026-04-05T00:00:00.000Z',
  };
}

/**
 * 공통 에러 응답 예시를 생성하는 헬퍼
 */
export function errorExample(message: string, code: number, errorCode: string) {
  return {
    isSuccess: false,
    code: String(code),
    message,
    data: null,
    errorCode,
    timestamp: '2026-04-05T00:00:00.000Z',
  };
}
