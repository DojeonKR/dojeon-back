import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy session revocation', () => {
  const config = {
    get: jest.fn().mockReturnValue('test-access-secret-at-least-32-characters'),
  };

  it('accepts a token whose session version matches the database', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          email: 'user@example.com',
          sessionVersion: 2,
        }),
      },
    };
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(
      strategy.validate({ sub: '1', email: 'user@example.com', sv: 2 }),
    ).resolves.toEqual({ userId: 1n, email: 'user@example.com' });
  });

  it('rejects a token issued before a session revocation', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          email: 'user@example.com',
          sessionVersion: 3,
        }),
      },
    };
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(
      strategy.validate({ sub: '1', email: 'user@example.com', sv: 2 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps pre-deployment tokens compatible only while the user version is zero', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          email: 'user@example.com',
          sessionVersion: 0,
        }),
      },
    };
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(strategy.validate({ sub: '1', email: 'user@example.com' })).resolves.toEqual({
      userId: 1n,
      email: 'user@example.com',
    });
  });
});
