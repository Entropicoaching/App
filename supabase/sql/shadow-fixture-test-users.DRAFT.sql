-- SHADOW PROJECT TEST FIXTURE ONLY. Never run against production.
-- Stable IDs make the RLS checks repeatable in the Supabase SQL editor.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'sub-free@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'sub-member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'sub-self-coach@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'athlete'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'athlete'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'coach');

insert into public.sub_entitlements (user_id, tier, source, valid_until)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', 'manual', now() + interval '7 days');

-- A=free. B=member. C=free but self-declared coach. No athlete row is inserted:
-- sub_my_access_v1() must return has_coaching=false for all three.
