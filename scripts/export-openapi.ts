import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { createOpenApiDocument } from '../src/swagger/create-openapi-document';

(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/** 기본: dojeon-back/openapi/openapi.json */
const defaultOut = join(__dirname, '..', 'openapi', 'openapi.json');

async function main() {
  const out = process.env.OPENAPI_OUT ?? defaultOut;

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const document = createOpenApiDocument(app);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(document, null, 2), 'utf8');
  console.log(`OpenAPI written: ${out}`);

  await app.close();
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
