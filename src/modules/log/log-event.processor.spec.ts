import { Job } from 'bullmq';
import { LogEventProcessor } from './log-event.processor';
import { SectionEventJobData } from './log-event.queue';

describe('LogEventProcessor', () => {
  const mockPrisma = {
    scrap: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const mockAchievementService = {};
  let processor: LogEventProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new LogEventProcessor(mockPrisma as never, mockAchievementService as never);
  });

  function scrapJob(stateChangedAt: string): Job<SectionEventJobData> {
    return {
      data: {
        type: 'scrap.state.settled',
        scrapId: '9',
        stateChangedAt,
      },
    } as Job<SectionEventJobData>;
  }

  it('increments only the final stable add state', async () => {
    const stateChangedAt = '2026-08-02T12:00:00.000Z';
    mockPrisma.scrap.findUnique.mockResolvedValue({
      isActive: true,
      countedIsActive: false,
    });
    mockPrisma.scrap.updateMany.mockResolvedValue({ count: 1 });

    await processor.process(scrapJob(stateChangedAt));

    expect(mockPrisma.scrap.updateMany).toHaveBeenCalledWith({
      where: {
        id: 9n,
        isActive: true,
        countedIsActive: false,
        lastStateChangedAt: new Date(stateChangedAt),
      },
      data: {
        countedIsActive: true,
        addCount: { increment: 1 },
        removeCount: undefined,
      },
    });
  });

  it('does not count when rapid toggles return to the original state', async () => {
    mockPrisma.scrap.findUnique.mockResolvedValue({
      isActive: false,
      countedIsActive: false,
    });

    await processor.process(scrapJob('2026-08-02T12:00:00.000Z'));

    expect(mockPrisma.scrap.updateMany).not.toHaveBeenCalled();
  });

  it('increments only the final stable remove state', async () => {
    mockPrisma.scrap.findUnique.mockResolvedValue({
      isActive: false,
      countedIsActive: true,
    });
    mockPrisma.scrap.updateMany.mockResolvedValue({ count: 1 });

    await processor.process(scrapJob('2026-08-02T12:00:00.000Z'));

    expect(mockPrisma.scrap.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          countedIsActive: false,
          addCount: undefined,
          removeCount: { increment: 1 },
        },
      }),
    );
  });
});
