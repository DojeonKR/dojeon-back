export const SECTION_EVENT_QUEUE = 'section-events';

export interface SectionCompletedJobData {
  /** BigInt를 JSON 직렬화 위해 string으로 전달 */
  userId: string;
  sectionId: number;
  lessonSectionIds: number[];
  isFirstCompletion: boolean;
  totalStaySeconds: number;
}

export interface LessonCompletedJobData {
  userId: string;
  lessonId: number;
}

export type SectionEventJobData =
  | ({ type: 'section.completed' } & SectionCompletedJobData)
  | ({ type: 'lesson.completed' } & LessonCompletedJobData);
