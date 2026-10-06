create table if not exists public.inspector_attempts (
  id text primary key,
  user_id text not null,
  quiz_id text not null,
  attempt_number integer not null,
  completed boolean not null default false,
  passed boolean not null default false,
  submitted_at bigint not null,
  attempt_token uuid not null,
  data jsonb not null,
  constraint inspector_attempts_user_quiz_number_key unique (user_id, quiz_id, attempt_number)
);

create index if not exists inspector_attempts_user_quiz_idx
  on public.inspector_attempts (user_id, quiz_id);

create table if not exists public.inspector_profiles (
  id text primary key,
  email text not null unique,
  profile jsonb not null
);

alter table public.inspector_attempts enable row level security;
alter table public.inspector_profiles enable row level security;

create or replace function public.start_inspector_attempt(
  p_user_id text,
  p_user_name text,
  p_quiz_id text,
  p_quiz_title text,
  p_now_ms bigint,
  p_imported_passed boolean default false,
  p_imported_latest_completed_at bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.inspector_attempts%rowtype;
  v_attempt_number integer;
  v_latest_completed_at bigint;
  v_retake_available_at timestamptz;
  v_attempt_id text;
  v_attempt_token uuid;
  v_started_at bigint := p_now_ms;
  v_attempt_data jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_quiz_id, 0));

  if p_imported_passed or exists (
    select 1
    from public.inspector_attempts
    where user_id = p_user_id
      and quiz_id = p_quiz_id
      and completed = true
      and passed = true
  ) then
    return jsonb_build_object('errorCode', 'already_competent');
  end if;

  select *
  into v_pending
  from public.inspector_attempts
  where user_id = p_user_id
    and quiz_id = p_quiz_id
    and completed = false
  order by attempt_number desc
  limit 1;

  if found then
    return jsonb_build_object(
      'attemptId', v_pending.id,
      'attemptNumber', v_pending.attempt_number,
      'attemptToken', v_pending.attempt_token
    );
  end if;

  select greatest(
    coalesce(max(submitted_at), 0),
    coalesce(p_imported_latest_completed_at, 0)
  )
  into v_latest_completed_at
  from public.inspector_attempts
  where user_id = p_user_id
    and quiz_id = p_quiz_id
    and completed = true;

  if v_latest_completed_at > 0 then
    v_retake_available_at :=
      to_timestamp(v_latest_completed_at::double precision / 1000) + interval '3 months';
    if clock_timestamp() < v_retake_available_at then
      return jsonb_build_object(
        'errorCode', 'retake_not_available',
        'retakeAvailableAt', (extract(epoch from v_retake_available_at) * 1000)::bigint
      );
    end if;
  end if;

  select coalesce(max(attempt_number), 0) + 1
  into v_attempt_number
  from public.inspector_attempts
  where user_id = p_user_id
    and quiz_id = p_quiz_id;

  v_attempt_id := 'a-' || p_now_ms::text || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6);
  v_attempt_token := gen_random_uuid();
  v_attempt_data := jsonb_build_object(
    'id', v_attempt_id,
    'quizId', p_quiz_id,
    'quizTitle', p_quiz_title,
    'userId', p_user_id,
    'userName', p_user_name,
    'attemptNumber', v_attempt_number,
    'answers', '{}'::jsonb,
    'score', 0,
    'maxScore', 0,
    'percentage', 0,
    'passed', false,
    'startedAt', v_started_at,
    'timeSpent', 0,
    'submittedAt', v_started_at
  );

  insert into public.inspector_attempts (
    id, user_id, quiz_id, attempt_number, completed, passed,
    submitted_at, attempt_token, data
  ) values (
    v_attempt_id, p_user_id, p_quiz_id, v_attempt_number, false, false,
    v_started_at, v_attempt_token, v_attempt_data
  );

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'attemptNumber', v_attempt_number,
    'attemptToken', v_attempt_token
  );
end;
$$;

revoke all on function public.start_inspector_attempt(text, text, text, text, bigint, boolean, bigint)
  from public, anon, authenticated;
grant execute on function public.start_inspector_attempt(text, text, text, text, bigint, boolean, bigint)
  to service_role;
