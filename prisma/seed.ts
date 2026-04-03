import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const badgeDefs = [
    {
      title: '첫 발걸음',
      description: '첫 레슨을 완료했습니다.',
      imageUrl: 'https://cdn.dojeon.local/badges/first.png',
    },
    {
      title: '7일 연속',
      description: '7일 연속으로 학습했습니다.',
      imageUrl: 'https://cdn.dojeon.local/badges/streak7.png',
    },
    {
      title: '30일 연속',
      description: '30일 연속으로 학습했습니다.',
      imageUrl: 'https://cdn.dojeon.local/badges/streak30.png',
    },
  ];

  for (const b of badgeDefs) {
    const existing = await prisma.badge.findFirst({ where: { title: b.title } });
    if (!existing) {
      await prisma.badge.create({ data: b });
    }
  }

  const plans = [
    {
      id: 'free',
      title: 'Free',
      priceText: '₩0',
      subText: '기본 학습',
      hasTrial: false,
      billingCycleMonths: 0,
    },
    {
      id: 'basic',
      title: 'Basic',
      priceText: '₩9,900/월',
      subText: null,
      hasTrial: true,
      billingCycleMonths: 1,
    },
    {
      id: 'pro',
      title: 'Pro',
      priceText: '₩19,900/월',
      subText: '전체 콘텐츠',
      hasTrial: true,
      billingCycleMonths: 1,
    },
    {
      id: 'annual',
      title: 'Annual',
      priceText: '₩199,000/년',
      subText: '2개월 무료',
      hasTrial: false,
      billingCycleMonths: 12,
    },
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: p.id },
      create: p,
      update: {
        title: p.title,
        priceText: p.priceText,
        subText: p.subText,
        hasTrial: p.hasTrial,
        billingCycleMonths: p.billingCycleMonths,
      },
    });
  }

  const courseCount = await prisma.course.count();
  if (courseCount === 0) {
    const course = await prisma.course.create({
      data: {
        title: '한국어 입문',
        description: '기초 표현과 발음',
        orderNum: 1,
        isActive: true,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        courseId: course.id,
        title: '인사하기',
        subtitle: 'Greetings',
        orderNum: 1,
      },
    });
    const section = await prisma.section.create({
      data: {
        lessonId: lesson.id,
        type: 'VOCAB',
        title: '기본 인사',
        totalPages: 3,
        orderNum: 1,
      },
    });
    await prisma.sectionCard.createMany({
      data: [
        {
          sectionId: section.id,
          wordFront: '안녕하세요',
          wordBack: 'Hello (formal)',
          sequence: 1,
        },
        {
          sectionId: section.id,
          wordFront: '감사합니다',
          wordBack: 'Thank you',
          sequence: 2,
        },
        {
          sectionId: section.id,
          wordFront: '죄송합니다',
          wordBack: 'Sorry',
          sequence: 3,
        },
      ],
    });
    await prisma.sectionMaterial.create({
      data: {
        sectionId: section.id,
        type: 'GRAMMAR_TABLE',
        sequence: 1,
        isExtra: false,
        contentText: { title: '기본 인사 표현', rows: [] },
      },
    });
  }

  const topicCount = await prisma.practiceTopic.count();
  if (topicCount === 0) {
    const topic = await prisma.practiceTopic.create({
      data: { titleEn: 'Greetings', isActive: true },
    });
    await prisma.practiceQuestion.create({
      data: {
        topicId: topic.id,
        type: 'MCQ',
        questionText: '“안녕하세요”의 뜻으로 맞는 것은?',
        options: ['Hello', 'Goodbye', 'Thanks'],
        answer: 'Hello',
        explanation: null,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
