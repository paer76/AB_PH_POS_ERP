-- =============================================================================
-- Security hardening (audit 2026-10-29)
-- =============================================================================

-- 1. Internal helpers. These are called only from inside the SECURITY DEFINER
--    RPCs (which check the role first). Called directly they skipped the role
--    check, so any signed-in account could read a client's balance or price.
revoke execute on function public.client_outstanding(uuid) from public, anon, authenticated;
revoke execute on function public.price_for(uuid, uuid) from public, anon, authenticated;

-- 2. The views were created after the blanket "revoke from anon" in the init
--    migration, so Supabase's default privileges granted them to anon. RLS on
--    the underlying tables already returned nothing, but don't expose them.
revoke all on public.v_client_balances, public.v_soas from anon;

-- 3. Future tables, views, sequences and functions are no longer granted to
--    anon (or, for functions, to everyone) automatically. A new RPC needs an
--    explicit `grant execute on function ... to authenticated;`.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
