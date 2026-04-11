/** S3 객체 공개 읽기 URL. `CLOUDFRONT_BASE_URL`이 있으면 CDN 경로, 없으면 리전별 S3 URL. */
export function buildS3ObjectPublicUrl(params: {
  cloudfrontBaseUrl?: string;
  bucket: string;
  region: string;
  key: string;
}): string {
  const base = params.cloudfrontBaseUrl?.trim();
  if (base) {
    return `${base.replace(/\/$/, '')}/${params.key}`;
  }
  return `https://${params.bucket}.s3.${params.region}.amazonaws.com/${params.key}`;
}
