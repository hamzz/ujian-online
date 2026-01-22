import { createDatabaseClient } from '../src/db';

type QuestionSeed = {
  content: string;
  options: string[];
  correct: string;
  explanation?: string;
};

const questions: QuestionSeed[] = [
  {
    content: 'Alat untuk mengukur suhu disebut ...',
    options: ['Stopwatch', 'Termometer', 'Timbangan', 'Penggaris'],
    correct: 'Termometer',
    explanation: 'Suhu diukur menggunakan termometer.'
  },
  {
    content: 'Contoh perubahan wujud padat menjadi cair adalah ...',
    options: ['Air menjadi es', 'Es mencair', 'Air menguap', 'Uap menjadi air'],
    correct: 'Es mencair',
    explanation: 'Es mencair adalah perubahan dari padat ke cair.'
  },
  {
    content: 'Sumber energi utama bagi makhluk hidup di Bumi adalah ...',
    options: ['Angin', 'Bulan', 'Matahari', 'Bintang'],
    correct: 'Matahari',
    explanation: 'Matahari adalah sumber energi utama.'
  },
  {
    content: 'Bagian tumbuhan yang berfungsi menyerap air dan mineral adalah ...',
    options: ['Daun', 'Batang', 'Akar', 'Bunga'],
    correct: 'Akar',
    explanation: 'Akar menyerap air dan mineral dari tanah.'
  },
  {
    content: 'Hewan yang termasuk hewan pemakan tumbuhan adalah ...',
    options: ['Singa', 'Kelinci', 'Elang', 'Hiu'],
    correct: 'Kelinci',
    explanation: 'Kelinci adalah herbivora.'
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
    ['IPA']
  );
  let subjectId = subjectRows[0]?.id;
  if (!subjectId) {
    subjectId = crypto.randomUUID();
    await client.execute('INSERT INTO subjects (id, name) VALUES (?, ?)', [
      subjectId,
      'IPA'
    ]);
  }

  const topicRows = await client.query<{ id: string }>(
    'SELECT id FROM topics WHERE subject_id = ? AND name = ?',
    [subjectId, 'IPA Kelas 4']
  );
  let topicId = topicRows[0]?.id;
  if (!topicId) {
    topicId = crypto.randomUUID();
    await client.execute('INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)', [
      topicId,
      subjectId,
      'IPA Kelas 4'
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

  console.log(`Inserted ${inserted} questions for IPA Kelas 4.`);
} finally {
  await client.close();
}
