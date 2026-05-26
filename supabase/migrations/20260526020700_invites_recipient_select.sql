-- Allow an authenticated recipient to read their own invite row.
-- This powers `/invite/:token` for the account matching the invited email.
drop policy if exists invites_recipient_select on public.invites;
create policy invites_recipient_select on public.invites
  for select using (
    auth.uid() is not null
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
