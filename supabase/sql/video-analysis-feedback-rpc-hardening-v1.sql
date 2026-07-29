-- ENT-0012 follow-up: keep the shared-feedback RPC callable by authenticated
-- athletes only. This migration changes ACLs only; it does not replace the
-- function body, touch rows, or alter RLS.

begin;

revoke execute on function public.get_my_shared_video_analyses_v3(integer, integer)
  from public;
revoke execute on function public.get_my_shared_video_analyses_v3(integer, integer)
  from anon;
grant execute on function public.get_my_shared_video_analyses_v3(integer, integer)
  to authenticated;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_my_shared_video_analyses_v3(integer, integer)',
    'execute'
  ) then
    raise exception 'feedback RPC remains executable by anon';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_shared_video_analyses_v3(integer, integer)',
    'execute'
  ) then
    raise exception 'feedback RPC is not executable by authenticated';
  end if;
end
$$;

commit;
