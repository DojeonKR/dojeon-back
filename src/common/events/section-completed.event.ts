export class SectionCompletedEvent {
  constructor(
    public readonly userId: bigint,
    public readonly sectionId: number,
    public readonly lessonSectionIds: number[],
    public readonly isFirstCompletion: boolean,
    public readonly totalStaySeconds: number,
  ) {}
}
