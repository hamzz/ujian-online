import { createDatabaseClient } from '../src/db';

type QuestionSeed = {
  content: string;
  options: string[];
  correct: string;
  explanation?: string;
};

const questions: QuestionSeed[] = [
  {
    content: '256 + 378 = ...',
    options: ['624', '634', '646', '648'],
    correct: '634',
    explanation: '256 + 378 = 634.'
  },
  {
    content: '900 - 465 = ...',
    options: ['435', '445', '455', '465'],
    correct: '435',
    explanation: '900 - 465 = 435.'
  },
  {
    content: '36 × 7 = ...',
    options: ['242', '252', '262', '272'],
    correct: '252',
    explanation: '36 × 7 = 252.'
  },
  {
    content: '144 ÷ 12 = ...',
    options: ['10', '11', '12', '13'],
    correct: '12',
    explanation: '144 ÷ 12 = 12.'
  },
  {
    content: 'Keliling persegi dengan sisi 9 cm adalah ...',
    options: ['18 cm', '27 cm', '36 cm', '45 cm'],
    correct: '36 cm',
    explanation: 'Keliling persegi = 4 × sisi = 36 cm.'
  },
  {
    content: 'Luas persegi panjang dengan panjang 12 cm dan lebar 5 cm adalah ...',
    options: ['17 cm²', '50 cm²', '60 cm²', '70 cm²'],
    correct: '60 cm²',
    explanation: 'Luas = 12 × 5 = 60 cm².'
  },
  {
    content: '3/4 + 1/4 = ...',
    options: ['1/2', '3/4', '1', '1 1/4'],
    correct: '1',
    explanation: '3/4 + 1/4 = 4/4 = 1.'
  },
  {
    content: '2/5 dari 50 adalah ...',
    options: ['10', '15', '20', '25'],
    correct: '20',
    explanation: '2/5 × 50 = 20.'
  },
  {
    content: 'Jika 1 lusin = 12, maka 5 lusin = ...',
    options: ['50', '55', '60', '65'],
    correct: '60',
    explanation: '5 × 12 = 60.'
  },
  {
    content: 'Sudut yang lebih kecil dari 90° disebut sudut ...',
    options: ['tumpul', 'siku-siku', 'lancip', 'lurus'],
    correct: 'lancip',
    explanation: 'Sudut lancip < 90°.'
  }
];

const client = createDatabaseClient();

try {
  const teachers = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1"
  );
  const creatorId = teachers[0]?.id;
  if (!creatorId) {
    throw new Error('Teacher user not found. Seed users terlebih dahulu.');
  }

  const subjectRows = await client.query<{ id: string }>(
    'SELECT id FROM subjects WHERE name = ?',
    ['Matematika']
  );
  let subjectId = subjectRows[0]?.id;
  if (!subjectId) {
    subjectId = crypto.randomUUID();
    await client.execute('INSERT INTO subjects (id, name) VALUES (?, ?)', [
      subjectId,
      'Matematika'
    ]);
  }

  const topicRows = await client.query<{ id: string }>(
    'SELECT id FROM topics WHERE subject_id = ? AND name = ?',
    [subjectId, 'Matematika Kelas 4']
  );
  let topicId = topicRows[0]?.id;
  if (!topicId) {
    topicId = crypto.randomUUID();
    await client.execute('INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)', [
      topicId,
      subjectId,
      'Matematika Kelas 4'
    ]);
  }

  let inserted = 0;

  for (const item of questions) {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM questions WHERE subject_id = ? AND content = ?',
      [subjectId, item.content]
    );
    if (existing.length > 0) continue;

    const id = crypto.randomUUID();
    await client.execute(
      'INSERT INTO questions (id, subject_id, topic_id, type, content, options, answer_key, explanation, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        subjectId,
        topicId,
        'multiple_choice',
        item.content,
        JSON.stringify(item.options),
        JSON.stringify({ correct: item.correct }),
        item.explanation ?? null,
        creatorId
      ]
    );
    inserted += 1;
  }

  console.log(`Inserted ${inserted} questions for Matematika Kelas 4.`);
} finally {
  await client.close();
}
