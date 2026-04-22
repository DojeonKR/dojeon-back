export class LessonCompletedEvent {
  constructor(
    public readonly userId: bigint,
    public readonly lessonId: number,
  ) {}
}
