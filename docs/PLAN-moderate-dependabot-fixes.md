# PLAN: Moderate Dependabot 취약점 수정

> 작성일: 2026-05-24  
> 선행 작업: High 15건 — `overrides` + 커밋 `259b14f`

## 목표

사용자 보고 Moderate 11건 중 **런타임 영향이 큰 transitive 패키지**를 `package.json` `overrides`로 고정하고, `@nestjs/core` Injection은 NestJS 11 마이그레이션으로 분리한다.

## 1단계 — overrides (이번 구현)

| 패키지 | override | 비고 |
|--------|----------|------|
| fast-xml-parser | `>=5.7.0` | AWS SDK |
| js-yaml | `>=4.1.1` | Swagger 중첩 4.1.0 |
| uuid | `11.1.1` (고정) | 루트 uuid@9; `>=11.1.1`은 v14 ESM-only로 Jest 충돌 |
| qs | `>=6.14.3` | Express body-parser |
| file-type | `>=21.3.4` | @nestjs/common |
| ip-address | `>=10.2.0` | pm2 |
| brace-expansion | `>=5.0.6` | 5.0.2–5.0.5 취약 |
| ajv | `>=8.17.1` | dev (@nestjs/cli) |

## 3단계 — 별도 (미구현)

- **@nestjs/core** GHSA-36xv-jgw5-4q75: 패치는 `@nestjs/core@11.1.18+`만 해당
- 후속: `docs/PLAN-nestjs-11-migration.md` (선택)

## 검증 체크리스트

- [ ] `npm audit --audit-level=high` — 0건
- [ ] Moderate 알림 대부분 감소 (@nestjs/core Injection 제외 가능)
- [ ] `npm run build` 성공
- [ ] `npm run test` 성공
- [ ] `npm run openapi:export` 성공

## 실행 명령

```bash
npm install
npm audit --audit-level=moderate
npm run build
npm test
npm run openapi:export
```
