# School Database Design

This database stores which students are enrolled on which courses at a school. It has three tables: `students`, `courses` and `enrolments`. The SQL is in `school.sql`.

## Tables

### students

Stores one row for each student.

- `id`: primary key, a unique number for each student
- `name`: the student's full name (`NOT NULL`)
- `email`: the student's email address (`NOT NULL` and `UNIQUE`, so two students cannot share one email)

### courses

Stores one row for each course the school offers.

- `id`: primary key, a unique number for each course
- `title`: the course name, for example "Mathematics" (`NOT NULL`)
- `teacher`: the name of the teacher (`NOT NULL`)

### enrolments

Stores one row each time a student enrols on a course. It connects the other two tables.

- `id`: primary key for the enrolment
- `student_id`: foreign key pointing to `students(id)` (`NOT NULL`)
- `course_id`: foreign key pointing to `courses(id)` (`NOT NULL`)
- `enrolled_on`: the date the student enrolled (`NOT NULL`)
- `grade`: the student's grade from 0 to 100, which can be empty (`NULL`) until a grade is entered
- A `UNIQUE (student_id, course_id)` rule stops the same student enrolling on the same course twice

## Relationships

- **One student has many enrolments (one-to-many).** One row in `students` can match many rows in `enrolments`, because a student can take several courses. Each enrolment belongs to exactly one student.
- **One course has many enrolments (one-to-many).** One row in `courses` can match many rows in `enrolments`, because a course has many students. Each enrolment belongs to exactly one course.
- **Students and courses are many-to-many.** A student can take many courses, and a course can have many students.

### Why a join table is needed

A relational table cannot store a list in a single cell. If we put a list of course ids inside `students`, or a list of student ids inside `courses`, we could not use foreign keys, we could not search it reliably, and updating it would be messy and error-prone. The `enrolments` table solves this by turning one many-to-many relationship into two simple one-to-many relationships. Each row holds exactly one student and one course. It is also the natural place for facts about the pairing itself, such as the enrolment date and the grade, which belong to neither the student nor the course alone.

## Index I would add

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

**Reason:** the queries "all students on one course" and "number of students per course" look up enrolments by `course_id`. Without an index the database has to read every row in `enrolments`, which gets slow as the school grows. The `UNIQUE (student_id, course_id)` rule already creates an index that helps lookups by `student_id`, so `course_id` is the column that still needs one.

## SQL or NoSQL?

I would choose **SQL** for this system. The data is naturally structured and relational: students, courses and enrolments always have the same fields, and the links between them matter. A relational database lets me enforce those links with foreign keys, keep emails unique, block duplicate enrolments, and answer questions such as "which students have no enrolments?" with a single join. School records also need to be accurate and consistent, so the transaction guarantees of SQL are valuable, for example when updating a grade. A NoSQL document database would suit data with a flexible or changing shape, or traffic so large that it needs to be spread across many servers. A single school does not have either of those needs, so the structure and safety of SQL are the better fit.
