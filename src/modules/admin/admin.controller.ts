import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from './admin-role.guard';
import {
  AdminAudioPresignedDto,
  BulkCardsDto,
  CreateCardDto,
  CreateCourseDto,
  CreateLessonDto,
  CreateMaterialDto,
  CreateQuestionDto,
  CreateSectionDto,
  PatchCardDto,
  PatchCourseDto,
  PatchLessonDto,
  PatchMaterialDto,
  PatchQuestionDto,
  PatchSectionDto,
} from './admin.dto';

@ApiTags('관리자 (Admin)')
@ApiBearerAuth('access-token')
@UseGuards(AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('courses')
  @ApiOperation({ summary: '코스 생성' })
  createCourse(@Body() dto: CreateCourseDto) {
    return this.adminService.createCourse(dto);
  }

  @Patch('courses/:courseId')
  @ApiOperation({ summary: '코스 수정' })
  patchCourse(@Param('courseId', ParseIntPipe) courseId: number, @Body() dto: PatchCourseDto) {
    return this.adminService.patchCourse(courseId, dto);
  }

  @Delete('courses/:courseId')
  @ApiOperation({ summary: '코스 삭제' })
  deleteCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.adminService.deleteCourse(courseId);
  }

  @Post('courses/:courseId/lessons')
  @ApiOperation({ summary: '레슨 생성' })
  createLesson(@Param('courseId', ParseIntPipe) courseId: number, @Body() dto: CreateLessonDto) {
    return this.adminService.createLesson(courseId, dto);
  }

  @Patch('lessons/:lessonId')
  @ApiOperation({ summary: '레슨 수정' })
  patchLesson(@Param('lessonId', ParseIntPipe) lessonId: number, @Body() dto: PatchLessonDto) {
    return this.adminService.patchLesson(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @ApiOperation({ summary: '레슨 삭제' })
  deleteLesson(@Param('lessonId', ParseIntPipe) lessonId: number) {
    return this.adminService.deleteLesson(lessonId);
  }

  @Post('lessons/:lessonId/sections')
  @ApiOperation({ summary: '섹션 생성' })
  createSection(@Param('lessonId', ParseIntPipe) lessonId: number, @Body() dto: CreateSectionDto) {
    return this.adminService.createSection(lessonId, dto);
  }

  @Patch('sections/:sectionId')
  @ApiOperation({ summary: '섹션 수정' })
  patchSection(@Param('sectionId', ParseIntPipe) sectionId: number, @Body() dto: PatchSectionDto) {
    return this.adminService.patchSection(sectionId, dto);
  }

  @Delete('sections/:sectionId')
  @ApiOperation({ summary: '섹션 삭제' })
  deleteSection(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.adminService.deleteSection(sectionId);
  }

  @Post('sections/:sectionId/cards')
  @ApiOperation({ summary: '단어 카드 단건 추가' })
  createCard(@Param('sectionId', ParseIntPipe) sectionId: number, @Body() dto: CreateCardDto) {
    return this.adminService.createCard(sectionId, dto);
  }

  @Post('sections/:sectionId/cards/bulk')
  @ApiOperation({ summary: '단어 카드 일괄 추가' })
  createCardsBulk(@Param('sectionId', ParseIntPipe) sectionId: number, @Body() dto: BulkCardsDto) {
    return this.adminService.createCardsBulk(sectionId, dto);
  }

  @Patch('cards/:cardId')
  @ApiOperation({ summary: '카드 수정' })
  patchCard(@Param('cardId', ParseIntPipe) cardId: number, @Body() dto: PatchCardDto) {
    return this.adminService.patchCard(cardId, dto);
  }

  @Delete('cards/:cardId')
  @ApiOperation({ summary: '카드 삭제' })
  deleteCard(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.adminService.deleteCard(cardId);
  }

  @Post('sections/:sectionId/materials')
  @ApiOperation({ summary: '학습 자료 추가' })
  createMaterial(@Param('sectionId', ParseIntPipe) sectionId: number, @Body() dto: CreateMaterialDto) {
    return this.adminService.createMaterial(sectionId, dto);
  }

  @Patch('materials/:materialId')
  @ApiOperation({ summary: '학습 자료 수정' })
  patchMaterial(@Param('materialId', ParseIntPipe) materialId: number, @Body() dto: PatchMaterialDto) {
    return this.adminService.patchMaterial(materialId, dto);
  }

  @Delete('materials/:materialId')
  @ApiOperation({ summary: '학습 자료 삭제' })
  deleteMaterial(@Param('materialId', ParseIntPipe) materialId: number) {
    return this.adminService.deleteMaterial(materialId);
  }

  @Post('sections/:sectionId/questions')
  @ApiOperation({ summary: '문제 추가' })
  createQuestion(@Param('sectionId', ParseIntPipe) sectionId: number, @Body() dto: CreateQuestionDto) {
    return this.adminService.createQuestion(sectionId, dto);
  }

  @Patch('questions/:questionId')
  @ApiOperation({ summary: '문제 수정' })
  patchQuestion(@Param('questionId', ParseIntPipe) questionId: number, @Body() dto: PatchQuestionDto) {
    return this.adminService.patchQuestion(questionId, dto);
  }

  @Delete('questions/:questionId')
  @ApiOperation({ summary: '문제 삭제' })
  deleteQuestion(@Param('questionId', ParseIntPipe) questionId: number) {
    return this.adminService.deleteQuestion(questionId);
  }

  @Post('badges/refresh')
  @ApiOperation({ summary: '배지 캐시 갱신 (Redis Hash 재동기화)' })
  refreshBadgeCache() {
    return this.adminService.refreshBadgeCache();
  }

  @Post('sections/:sectionId/audio-upload-url')
  @ApiOperation({ summary: '오디오 S3 presigned URL 발급' })
  presignedAudio(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: AdminAudioPresignedDto,
  ) {
    return this.adminService.presignedAudioUpload(sectionId, dto);
  }
}
