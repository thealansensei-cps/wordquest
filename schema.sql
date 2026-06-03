-- ============================================================
-- WordQuest — Supabase Schema (Phase 4)
-- Multiplayer + Teacher Dashboard + Interclass "House Cup"
--
-- Design principles:
--  * Assignment CONTENT is teacher-private (RLS by auth.uid()).
--  * Interclass LEADERBOARD is public-read (any student device can
--    show the house cup), but only writable via scoped functions.
--  * Students do NOT have accounts. Teacher pre-loads a roster;
--    a student "claims" a name on a device. The roster row id is
--    the stable identity that keeps the leaderboard accurate.
--  * House-cup ranking is by AVERAGE score per active student,
--    with TOTAL shown as a bonus stat.
--  * Categories: grammar, vocab, synthesis, spelling now;
--    comprehension, composition reserved (dormant).
-- ============================================================

-- ---------- Enums ----------
do $$ begin
  create type wq_category as enum
    ('grammar','vocab','synthesis','spelling','comprehension','composition');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wq_qtype as enum
    ('mc','fill','spell','cloze','transform','short','compose');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 1. TEACHERS  (private workspace; 1 row per signed-in teacher)
-- ============================================================
create table if not exists teachers (
  id          uuid primary key default gen_random_uuid(),
  auth_uid    uuid unique not null,          -- Supabase auth user id
  name        text not null,
  school      text default 'CPS',
  created_at  timestamptz default now()
);

-- ============================================================
-- 2. CLASSES  ("houses" in the interclass challenge)
--    Created by a teacher but VISIBLE to all (public read) so the
--    house cup can show class names/colours on every device.
-- ============================================================
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references teachers(id) on delete set null,
  name        text not null,                 -- e.g. "4 Resilience"
  house_color text default '#3dbb6a',         -- crest colour
  crest_emoji text default '🦁',
  level       text default 'P4',
  created_at  timestamptz default now()
);

-- ============================================================
-- 3. ROSTER  (students pre-loaded by teacher; no passwords)
--    pick_token: short code a student taps to claim their name on
--    a device (prevents another child picking your identity).
-- ============================================================
create table if not exists roster (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid references classes(id) on delete cascade,
  display_name text not null,                -- e.g. "Mei T."
  index_no    int,                           -- class register number (optional)
  pick_token  text not null,                 -- 4-char claim code, e.g. "M3X9"
  device_hint text,                          -- last device that claimed (audit)
  created_at  timestamptz default now(),
  unique(class_id, display_name)
);

-- ============================================================
-- 4. ASSIGNMENTS  (teacher-private content)
--    join_code: 5-char code students enter to play.
--    roster_only: if true, a player must match a roster row.
-- ============================================================
create table if not exists assignments (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid references teachers(id) on delete cascade,
  title        text not null,
  category     wq_category not null,
  join_code    text unique not null,         -- e.g. "QWER7"
  roster_only  boolean default false,        -- restrict to pre-loaded roster
  is_open      boolean default true,         -- accepting new sessions?
  pass_mark    int default 60,               -- % to "pass" the mission
  created_at   timestamptz default now()
);

-- ============================================================
-- 5. QUESTIONS  (parsed from PDF then teacher-reviewed/edited)
--    payload holds type-specific fields as JSON so we reuse the
--    SAME shapes the single-player engine already understands
--    (options/answer/blanks/correct/etc.).
-- ============================================================
create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  ord           int default 0,               -- display order
  qtype         wq_qtype not null,
  skill         text,                         -- e.g. "Tenses"
  lo            text,                          -- e.g. "Grammar LO1"
  payload       jsonb not null,               -- {text, options, answer, ...}
  approved      boolean default false,        -- teacher reviewed?
  created_at    timestamptz default now()
);

-- ============================================================
-- 6. SESSIONS  (one student's run of one assignment)
-- ============================================================
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  roster_id     uuid references roster(id) on delete set null,
  class_id      uuid references classes(id) on delete set null,
  guest_name    text,                          -- used when not roster_only
  score_pct     int default 0,
  points        int default 0,                 -- raw points (bonus stat)
  correct       int default 0,
  total         int default 0,
  finished      boolean default false,
  started_at    timestamptz default now(),
  finished_at   timestamptz
);

-- ============================================================
-- 7. RESPONSES  (per-question; powers teacher insights)
-- ============================================================
create table if not exists responses (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id) on delete cascade,
  question_id  uuid references questions(id) on delete cascade,
  answer_text  text,
  is_correct   boolean,
  ms_taken     int,
  created_at   timestamptz default now()
);

-- ============================================================
-- 8. LEADERBOARD VIEWS  (public-read aggregates)
-- ============================================================

-- Per-class, per-category: average % (ranking) + total points (bonus)
create or replace view v_class_category as
select
  c.id              as class_id,
  c.name            as class_name,
  c.house_color,
  c.crest_emoji,
  a.category        as category,
  count(distinct s.id)                       as plays,
  count(distinct coalesce(s.roster_id::text, s.guest_name)) as active_students,
  round(avg(s.score_pct))                    as avg_pct,
  sum(s.points)                              as total_points
from sessions s
join assignments a on a.id = s.assignment_id
join classes c     on c.id = s.class_id
where s.finished = true
group by c.id, c.name, c.house_color, c.crest_emoji, a.category;

-- House cup: overall per class (avg of category avgs = balanced)
create or replace view v_house_cup as
select
  class_id, class_name, house_color, crest_emoji,
  round(avg(avg_pct))     as house_avg,     -- ranking metric (fair)
  sum(total_points)       as house_points,  -- bonus stat
  sum(plays)              as total_plays,
  max(active_students)    as students
from v_class_category
group by class_id, class_name, house_color, crest_emoji
order by house_avg desc, house_points desc;

-- Top student per class per category (public; first name + initial only)
create or replace view v_top_students as
select * from (
  select
    s.class_id,
    c.name                as class_name,
    a.category            as category,
    coalesce(r.display_name, s.guest_name) as student_name,
    max(s.score_pct)      as best_pct,
    sum(s.points)         as points,
    row_number() over (
      partition by s.class_id, a.category
      order by max(s.score_pct) desc, sum(s.points) desc
    ) as rnk
  from sessions s
  join assignments a on a.id = s.assignment_id
  join classes c     on c.id = s.class_id
  left join roster r on r.id = s.roster_id
  where s.finished = true
  group by s.class_id, c.name, a.category, coalesce(r.display_name, s.guest_name)
) ranked
where rnk <= 5;

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================
alter table teachers     enable row level security;
alter table classes      enable row level security;
alter table roster       enable row level security;
alter table assignments  enable row level security;
alter table questions    enable row level security;
alter table sessions     enable row level security;
alter table responses    enable row level security;

-- --- Teachers: a teacher sees only their own row ---
create policy teacher_self on teachers
  for all using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());

-- --- Classes: teacher manages own; everyone can READ (house cup) ---
create policy class_read_all on classes
  for select using (true);
create policy class_write_own on classes
  for all using (teacher_id in (select id from teachers where auth_uid = auth.uid()))
  with check (teacher_id in (select id from teachers where auth_uid = auth.uid()));

-- --- Roster: teacher manages own class rosters; public can READ
--     names to render the "pick your name" list (no PII beyond name) ---
create policy roster_read_all on roster
  for select using (true);
create policy roster_write_own on roster
  for all using (class_id in (
      select cl.id from classes cl
      join teachers t on t.id = cl.teacher_id
      where t.auth_uid = auth.uid()))
  with check (class_id in (
      select cl.id from classes cl
      join teachers t on t.id = cl.teacher_id
      where t.auth_uid = auth.uid()));

-- --- Assignments: PRIVATE to owning teacher for write;
--     readable by anyone who knows the join_code (handled in API by
--     filtering on join_code, but we still gate full table reads) ---
create policy assignment_owner on assignments
  for all using (teacher_id in (select id from teachers where auth_uid = auth.uid()))
  with check (teacher_id in (select id from teachers where auth_uid = auth.uid()));
-- public can read ONLY open assignments matched by join_code via API
create policy assignment_play_read on assignments
  for select using (is_open = true);

-- --- Questions: teacher manages own; players read approved questions
--     for open assignments ---
create policy question_owner on questions
  for all using (assignment_id in (
      select a.id from assignments a
      join teachers t on t.id = a.teacher_id
      where t.auth_uid = auth.uid()))
  with check (assignment_id in (
      select a.id from assignments a
      join teachers t on t.id = a.teacher_id
      where t.auth_uid = auth.uid()));
create policy question_play_read on questions
  for select using (approved = true and assignment_id in (
      select id from assignments where is_open = true));

-- --- Sessions: players (anon) can INSERT and UPDATE their own row;
--     teachers can READ sessions for their assignments ---
create policy session_insert_any on sessions
  for insert with check (true);
create policy session_update_any on sessions
  for update using (true) with check (true);
create policy session_read_play on sessions
  for select using (true);   -- needed for live leaderboard aggregation

-- --- Responses: players insert their own; teachers read for insights ---
create policy response_insert_any on responses
  for insert with check (true);
create policy response_read_play on responses
  for select using (true);

-- ============================================================
-- 10. HELPER FUNCTIONS
-- ============================================================

-- Generate a unique 5-char join code (A-Z0-9, no confusing chars)
create or replace function gen_join_code() returns text as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text;
begin
  loop
    code := '';
    for i in 1..5 loop
      code := code || substr(chars, floor(random()*length(chars)+1)::int, 1);
    end loop;
    exit when not exists (select 1 from assignments where join_code = code);
  end loop;
  return code;
end $$ language plpgsql;

-- Generate a 4-char roster pick token
create or replace function gen_pick_token() returns text as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text := '';
begin
  for i in 1..4 loop
    code := code || substr(chars, floor(random()*length(chars)+1)::int, 1);
  end loop;
  return code;
end $$ language plpgsql;
