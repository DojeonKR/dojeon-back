import {
  currentGoalStreakFromDates,
  dateKeyToUtcDate,
  localDateKey,
  startOfIsoWeekDateKey,
} from './local-date.util';

describe('local date utilities', () => {
  it('uses the user timezone when the local day differs from UTC', () => {
    expect(localDateKey(new Date('2026-08-02T21:30:00.000Z'), 'Asia/Jerusalem')).toBe('2026-08-03');
  });

  it('calculates ISO weeks from Monday', () => {
    expect(startOfIsoWeekDateKey('2026-08-02')).toBe('2026-07-27');
  });

  it('keeps a streak active when the latest achieved goal was yesterday', () => {
    expect(
      currentGoalStreakFromDates(
        [dateKeyToUtcDate('2026-08-01'), dateKeyToUtcDate('2026-07-31')],
        '2026-08-02',
      ),
    ).toBe(2);
  });

  it('ends a streak when there is a calendar-day gap', () => {
    expect(currentGoalStreakFromDates([dateKeyToUtcDate('2026-07-31')], '2026-08-02')).toBe(0);
  });
});
