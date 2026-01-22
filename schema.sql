CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(191) UNIQUE NOT NULL,
  email VARCHAR(191) UNIQUE NULL,
  password_hash VARCHAR(191) NOT NULL,
  role ENUM('admin','teacher','student') NOT NULL,
  profile_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id CHAR(36) PRIMARY KEY,
  level VARCHAR(50) NOT NULL,
  major VARCHAR(80) NOT NULL,
  rombel VARCHAR(50) NOT NULL,
  homeroom_teacher_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (homeroom_teacher_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teacher_subject_classes (
  id CHAR(36) PRIMARY KEY,
  teacher_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  class_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_assignment (teacher_id, subject_id, class_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS topics (
  id CHAR(36) PRIMARY KEY,
  subject_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id CHAR(36) PRIMARY KEY,
  subject_id CHAR(36) NOT NULL,
  topic_id CHAR(36) NULL,
  type ENUM('multiple_choice','multiple_select','true_false','short_answer','essay') NOT NULL,
  content TEXT NOT NULL,
  options JSON NULL,
  image_urls JSON NULL,
  answer_key JSON NOT NULL,
  explanation TEXT NULL,
  metadata JSON NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exams (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(12) UNIQUE NOT NULL,
  title VARCHAR(160) NOT NULL,
  instructions TEXT NULL,
  subject_id CHAR(36) NOT NULL,
  start_time DATETIME NULL,
  duration_minutes INT NOT NULL,
  deadline DATETIME NULL,
  settings JSON NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  position INT NOT NULL,
  weight DECIMAL(6,2) NOT NULL DEFAULT 1,
  PRIMARY KEY (exam_id, question_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id CHAR(36) PRIMARY KEY,
  exam_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  status ENUM('in_progress','submitted','graded') NOT NULL,
  logs JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS answers (
  session_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  response JSON NOT NULL,
  score DECIMAL(6,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, question_id),
  FOREIGN KEY (session_id) REFERENCES exam_sessions(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS grades (
  session_id CHAR(36) PRIMARY KEY,
  total_score DECIMAL(8,2) NOT NULL,
  grade_letter CHAR(1) NOT NULL,
  graded_by CHAR(36) NULL,
  feedback TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES exam_sessions(id)
);

CREATE TABLE IF NOT EXISTS school_profile (
  id INT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  tagline VARCHAR(191) NULL,
  logo_url VARCHAR(255) NULL,
  banner_url VARCHAR(255) NULL,
  theme_color VARCHAR(20) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY,
  registration_settings JSON NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NOT NULL,
  actor_role ENUM('admin','teacher','student') NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id CHAR(36) NULL,
  detail JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(191) NOT NULL,
  message TEXT NOT NULL,
  target_role ENUM('admin','teacher','student','all') NOT NULL DEFAULT 'all',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  target_role ENUM('admin','teacher','student','all') NULL,
  title VARCHAR(191) NOT NULL,
  body TEXT NOT NULL,
  channel ENUM('in_app','email','whatsapp') NOT NULL DEFAULT 'in_app',
  status ENUM('pending','sent','read') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at);
CREATE INDEX idx_questions_subject_id ON questions (subject_id);
CREATE INDEX idx_questions_created_at ON questions (created_at);
CREATE INDEX idx_exams_subject_id ON exams (subject_id);
CREATE INDEX idx_exams_created_at ON exams (created_at);
CREATE INDEX idx_exam_questions_exam_id ON exam_questions (exam_id);
CREATE INDEX idx_exam_sessions_exam_id ON exam_sessions (exam_id);
CREATE INDEX idx_exam_sessions_user_id ON exam_sessions (user_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions (status);
CREATE INDEX idx_exam_sessions_created_at ON exam_sessions (created_at);
CREATE INDEX idx_answers_session_id ON answers (session_id);
CREATE INDEX idx_grades_session_id ON grades (session_id);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_status ON notifications (status);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);
