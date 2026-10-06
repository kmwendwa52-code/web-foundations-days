-- School database: students, courses and enrolments
-- Runs in SQLite (for example on sqliteonline.com).

PRAGMA foreign_keys = ON;

-- Start clean so the script can be run again and again
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ---------- Tables ----------

CREATE TABLE students (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id      INTEGER PRIMARY KEY,
  title   TEXT NOT NULL,
  teacher TEXT NOT NULL
);

-- Join table: one row = one student enrolled on one course
CREATE TABLE enrolments (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  course_id   INTEGER NOT NULL,
  enrolled_on TEXT NOT NULL,
  grade       INTEGER CHECK (grade BETWEEN 0 AND 100),
  FOREIGN KEY (student_id) REFERENCES students (id),
  FOREIGN KEY (course_id)  REFERENCES courses (id),
  -- The same student cannot enrol on the same course twice
  UNIQUE (student_id, course_id)
);

-- Index to speed up "which students are on this course?" lookups
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);

-- ---------- Sample data ----------

INSERT INTO students (name, email) VALUES
  ('Amina Wanjiru', 'amina@school.example'),
  ('Brian Otieno',  'brian@school.example'),
  ('Cynthia Mwangi', 'cynthia@school.example'),
  ('David Kamau',   'david@school.example');

INSERT INTO courses (title, teacher) VALUES
  ('Mathematics',      'Mr Njoroge'),
  ('Computer Science', 'Ms Achieng'),
  ('English',          'Mrs Hassan'),
  ('History',          'Mr Kiplagat');

-- David has no enrolments and History has no students (on purpose, for the queries below)
INSERT INTO enrolments (student_id, course_id, enrolled_on, grade) VALUES
  (1, 1, '2026-01-12', 78),
  (1, 2, '2026-01-12', 91),
  (2, 1, '2026-01-13', 64),
  (2, 3, '2026-01-13', NULL),
  (3, 2, '2026-01-14', 88),
  (3, 3, '2026-01-14', 73),
  (3, 1, '2026-01-15', NULL);

-- ---------- Queries ----------
-- Tip: some playgrounds only show the result of the LAST query when you
-- run everything at once. Highlight one query and run it to see its result.

-- 1. All courses for one student (by name)
SELECT courses.title, courses.teacher, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses    ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Wanjiru';

-- 2. All students on one course
SELECT students.name, students.email
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students   ON students.id = enrolments.student_id
WHERE courses.title = 'Mathematics';

-- 3. Number of students per course (courses with no students show 0)
SELECT courses.title, COUNT(enrolments.id) AS number_of_students
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id, courses.title
ORDER BY number_of_students DESC;

-- 4. Students who have no enrolments
SELECT students.name, students.email
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.id IS NULL;

-- 5. Update one enrolment's grade (Brian's English grade was not entered yet)
UPDATE enrolments
SET grade = 82
WHERE student_id = (SELECT id FROM students WHERE name = 'Brian Otieno')
  AND course_id  = (SELECT id FROM courses  WHERE title = 'English');

-- Check the update worked
SELECT students.name, courses.title, enrolments.grade
FROM enrolments
JOIN students ON students.id = enrolments.student_id
JOIN courses  ON courses.id = enrolments.course_id
WHERE students.name = 'Brian Otieno';
