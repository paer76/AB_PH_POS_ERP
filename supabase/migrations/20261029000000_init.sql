-- =============================================================================
-- Aqua Best — POS & Remote Monitoring ERP
-- Initial schema: tables, indexes, triggers, RLS, RPCs, views.
--
-- Design rules
--   * All money is numeric(10,2); all dates/day boundaries use Asia/Manila.
--   * Transactional writes (orders, payments, shifts, cash, containers, voids,
--     SOAs) happen ONLY through SECURITY DEFINER RPCs below, so each one is a
--     single atomic transaction with server-side validation. No table grants
--     UPDATE/DELETE on those tables to app users.
--   * Catalog/master data (products, client prices, riders, clients, profiles)
--     is edited directly by the owner, protected by RLS + guard triggers.
--   * Nothing is ever deleted: use is_active flags and voids.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers: time zone
-- -----------------------------------------------------------------------------
create or replace function public.manila_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Manila')::date
$$;

-- Start of a Manila calendar day as timestamptz (index-friendly range bounds).
create or replace function public.manila_day_start(d date)
returns timestamptz language sql immutable set search_path = '' as $$
  select (d::timestamp at time zone 'Asia/Manila')
$$;

-- -----------------------------------------------------------------------------
-- 1. Profiles & roles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'secretary' check (role in ('owner', 'secretary')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function public.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'owner', false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_role() is not null
$$;

create or replace function public.require_staff()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end $$;

create or replace function public.require_owner()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can do this' using errcode = '42501';
  end if;
end $$;

-- New auth user -> profile. Role comes from app_metadata (only settable with
-- the service-role key), never from user-editable user_metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case when new.raw_app_meta_data ->> 'role' = 'owner' then 'owner' else 'secretary' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the owner (or SQL console / service role, where auth.uid() is null)
-- may change roles or activation; nobody may demote/deactivate themselves.
create or replace function public.guard_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    if not public.is_owner() then
      raise exception 'Only the owner can change roles' using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role or deactivate yourself';
    end if;
  end if;
  return new;
end $$;

create trigger guard_profiles before update on public.profiles
  for each row execute function public.guard_profiles();

-- -----------------------------------------------------------------------------
-- 2. Shifts
-- -----------------------------------------------------------------------------
create table public.shifts (
  id             uuid primary key default gen_random_uuid(),
  secretary_id   uuid not null references public.profiles(id),
  opening_cash   numeric(10,2) not null check (opening_cash >= 0),
  closing_cash   numeric(10,2) check (closing_cash >= 0),
  expected_cash  numeric(10,2),
  variance       numeric(10,2),
  status         text not null default 'open' check (status in ('open', 'closed')),
  notes          text,
  opened_at      timestamptz not null default now(),
  closed_at      timestamptz
);
-- At most one open shift per person.
create unique index shifts_one_open_per_user on public.shifts (secretary_id) where status = 'open';
create index shifts_opened_at_idx on public.shifts (opened_at desc);

-- -----------------------------------------------------------------------------
-- 3. Clients, riders, products, client prices
-- -----------------------------------------------------------------------------
create table public.clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text,
  address             text,
  client_type         text not null default 'retail' check (client_type in ('retail', 'commercial')),
  billing_cycle       text not null default 'per_delivery' check (billing_cycle in ('per_delivery', 'monthly_soa')),
  credit_limit        numeric(10,2) check (credit_limit >= 0),   -- null = no limit
  payment_terms_days  int not null default 30 check (payment_terms_days between 0 and 365),
  container_balance   int not null default 0,                    -- maintained by container_logs trigger
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
create index clients_name_idx on public.clients (lower(name));

-- Secretaries may add/edit contact info but not commercial terms or balances.
create or replace function public.guard_clients()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_owner() then
    -- container_balance only changes via container_logs (trigger depth > 1)
    if tg_op = 'UPDATE' and new.container_balance is distinct from old.container_balance
       and pg_trigger_depth() = 1 and auth.uid() is not null then
      raise exception 'Container balance changes must be logged as a container movement';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.client_type := 'retail';
    new.billing_cycle := 'per_delivery';
    new.credit_limit := null;
    new.payment_terms_days := 30;
    new.container_balance := 0;
    new.is_active := true;
  else
    if new.client_type is distinct from old.client_type
       or new.billing_cycle is distinct from old.billing_cycle
       or new.credit_limit is distinct from old.credit_limit
       or new.payment_terms_days is distinct from old.payment_terms_days
       or new.is_active is distinct from old.is_active then
      raise exception 'Only the owner can change client terms' using errcode = '42501';
    end if;
    if new.container_balance is distinct from old.container_balance and pg_trigger_depth() = 1 then
      raise exception 'Container balance changes must be logged as a container movement';
    end if;
  end if;
  return new;
end $$;

create trigger guard_clients before insert or update on public.clients
  for each row execute function public.guard_clients();

create table public.riders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text not null check (category in ('refill', 'container', 'accessory')),
  unit_price      numeric(10,2) not null check (unit_price >= 0),
  track_stock     boolean not null default false,
  stock_quantity  int not null default 0,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.client_prices (
  client_id   uuid not null references public.clients(id),
  product_id  uuid not null references public.products(id),
  price       numeric(10,2) not null check (price >= 0),
  updated_at  timestamptz not null default now(),
  primary key (client_id, product_id)
);
create index client_prices_product_idx on public.client_prices (product_id);

-- -----------------------------------------------------------------------------
-- 4. SOAs (declared before orders because orders reference them)
-- -----------------------------------------------------------------------------
create table public.monthly_soas (
  id                uuid primary key default gen_random_uuid(),
  soa_no            bigint generated always as identity unique,
  client_id         uuid not null references public.clients(id),
  period_start      date not null,
  period_end        date not null,
  due_date          date not null,
  total_deliveries  int not null,
  total_amount_due  numeric(10,2) not null check (total_amount_due >= 0),
  notes             text,
  generated_by      uuid references public.profiles(id) default auth.uid(),
  generated_at      timestamptz not null default now(),
  check (period_end >= period_start)
);
create index monthly_soas_client_idx on public.monthly_soas (client_id, period_start desc);

-- -----------------------------------------------------------------------------
-- 5. Orders, items
-- -----------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_no          bigint generated always as identity unique,
  shift_id          uuid not null references public.shifts(id),
  client_id         uuid references public.clients(id),          -- null = anonymous walk-in
  order_type        text not null check (order_type in ('walk_in', 'delivery')),
  status            text not null check (status in ('pending_delivery', 'out_for_delivery', 'completed', 'voided')),
  rider_id          uuid references public.riders(id),
  delivery_address  text,
  total_amount      numeric(10,2) not null check (total_amount >= 0),
  amount_paid       numeric(10,2) not null default 0 check (amount_paid >= 0), -- maintained by payments trigger
  payment_status    text not null default 'unpaid' check (payment_status in ('paid', 'unpaid', 'partially_paid')),
  soa_id            uuid references public.monthly_soas(id),
  notes             text,
  created_by        uuid not null references public.profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  dispatched_at     timestamptz,
  completed_at      timestamptz,
  voided_at         timestamptz,
  check (amount_paid <= total_amount),
  check (order_type = 'delivery' or status in ('completed', 'voided'))
);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_shift_idx on public.orders (shift_id);
create index orders_client_created_idx on public.orders (client_id, created_at desc);
create index orders_open_deliveries_idx on public.orders (status) where status in ('pending_delivery', 'out_for_delivery');
create index orders_unpaid_idx on public.orders (client_id) where payment_status <> 'paid' and status <> 'voided';
create index orders_soa_idx on public.orders (soa_id) where soa_id is not null;
create index orders_rider_idx on public.orders (rider_id) where rider_id is not null;

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id),
  product_id  uuid not null references public.products(id),
  quantity    int not null check (quantity > 0),
  unit_price  numeric(10,2) not null check (unit_price >= 0),
  subtotal    numeric(10,2) generated always as (quantity * unit_price) stored
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- -----------------------------------------------------------------------------
-- 6. Payments
-- -----------------------------------------------------------------------------
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id),
  soa_id      uuid references public.monthly_soas(id),
  shift_id    uuid references public.shifts(id),     -- null when the owner records a remote payment
  amount      numeric(10,2) not null check (amount > 0),
  method      text not null check (method in ('cash', 'e_wallet', 'card', 'bank_transfer')),
  reference   text,
  created_by  uuid not null references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_shift_idx on public.payments (shift_id);
create index payments_soa_idx on public.payments (soa_id) where soa_id is not null;
create index payments_created_at_idx on public.payments (created_at desc);

-- Keep orders.amount_paid / payment_status in sync with payments.
create or replace function public.sync_order_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_paid numeric(10,2);
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = new.order_id;
  update public.orders o
     set amount_paid = v_paid,
         payment_status = case when v_paid >= o.total_amount then 'paid'
                               when v_paid > 0 then 'partially_paid'
                               else 'unpaid' end
   where o.id = new.order_id;
  return new;
end $$;

create trigger payments_sync_order after insert on public.payments
  for each row execute function public.sync_order_payment();

-- -----------------------------------------------------------------------------
-- 7. Container logs (source of truth for client container balances)
-- -----------------------------------------------------------------------------
create table public.container_logs (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id),
  order_id           uuid references public.orders(id),
  gallons_delivered  int not null default 0 check (gallons_delivered >= 0),
  gallons_pulled_out int not null default 0 check (gallons_pulled_out >= 0),
  net_change         int generated always as (gallons_delivered - gallons_pulled_out) stored,
  notes              text,
  created_by         uuid references public.profiles(id) default auth.uid(),
  logged_at          timestamptz not null default now(),
  check (gallons_delivered > 0 or gallons_pulled_out > 0)
);
create index container_logs_client_idx on public.container_logs (client_id, logged_at desc);
create index container_logs_order_idx on public.container_logs (order_id) where order_id is not null;

create or replace function public.apply_container_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.clients set container_balance = container_balance + new.net_change
   where id = new.client_id;
  return new;
end $$;

create trigger container_logs_apply after insert on public.container_logs
  for each row execute function public.apply_container_log();

-- -----------------------------------------------------------------------------
-- 8. Cash movements (petty cash / expenses)
-- -----------------------------------------------------------------------------
create table public.cash_movements (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null references public.shifts(id),
  type         text not null check (type in ('expense', 'cash_in', 'cash_out')),
  amount       numeric(10,2) not null check (amount > 0),
  category     text,
  description  text not null,
  created_by   uuid not null references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index cash_movements_shift_idx on public.cash_movements (shift_id);
create index cash_movements_created_at_idx on public.cash_movements (created_at desc);

-- -----------------------------------------------------------------------------
-- 9. Void requests
-- -----------------------------------------------------------------------------
create table public.void_requests (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id),
  requested_by  uuid not null references public.profiles(id) default auth.uid(),
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  review_notes  text,
  created_at    timestamptz not null default now()
);
create unique index void_requests_one_pending on public.void_requests (order_id) where status = 'pending';
create index void_requests_status_idx on public.void_requests (status, created_at desc);

-- -----------------------------------------------------------------------------
-- 10. Audit log
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  action      text not null,
  actor_id    uuid default auth.uid(),
  old_data    jsonb,
  new_data    jsonb,
  at          timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_table_idx on public.audit_log (table_name, at desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- Skip no-op updates (e.g. payment sync that changes nothing)
  if tg_op = 'UPDATE' and v_old = v_new then return new; end if;
  insert into public.audit_log (table_name, record_id, action, old_data, new_data)
  values (tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'client_id'),
          tg_op, v_old, v_new);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'shifts', 'clients', 'riders', 'products', 'client_prices',
                           'orders', 'payments', 'container_logs', 'cash_movements',
                           'void_requests', 'monthly_soas']
  loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles       enable row level security;
alter table public.shifts         enable row level security;
alter table public.clients        enable row level security;
alter table public.riders         enable row level security;
alter table public.products       enable row level security;
alter table public.client_prices  enable row level security;
alter table public.monthly_soas   enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.payments       enable row level security;
alter table public.container_logs enable row level security;
alter table public.cash_movements enable row level security;
alter table public.void_requests  enable row level security;
alter table public.audit_log      enable row level security;

-- Nobody but the service role writes/deletes directly unless a policy says so.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.clients, public.riders, public.products, public.client_prices to authenticated;
grant update (full_name, role, is_active) on public.profiles to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update on public.profiles for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- master data: everyone on staff reads; owner writes (clients: staff write, guarded)
create policy clients_select on public.clients for select to authenticated using ((select public.is_staff()));
create policy clients_insert on public.clients for insert to authenticated with check ((select public.is_staff()));
create policy clients_update on public.clients for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy riders_select on public.riders for select to authenticated using ((select public.is_staff()));
create policy riders_insert on public.riders for insert to authenticated with check ((select public.is_owner()));
create policy riders_update on public.riders for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy products_select on public.products for select to authenticated using ((select public.is_staff()));
create policy products_insert on public.products for insert to authenticated with check ((select public.is_owner()));
create policy products_update on public.products for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy client_prices_select on public.client_prices for select to authenticated using ((select public.is_staff()));
create policy client_prices_insert on public.client_prices for insert to authenticated with check ((select public.is_owner()));
create policy client_prices_update on public.client_prices for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- operational data (read-only for app users; writes go through RPCs)
create policy orders_select on public.orders for select to authenticated using ((select public.is_staff()));
create policy order_items_select on public.order_items for select to authenticated using ((select public.is_staff()));
create policy payments_select on public.payments for select to authenticated using ((select public.is_staff()));
create policy container_logs_select on public.container_logs for select to authenticated using ((select public.is_staff()));

-- secretaries only see their own shifts / cash movements / void requests
create policy shifts_select on public.shifts for select to authenticated
  using ((select public.is_owner()) or (secretary_id = (select auth.uid()) and (select public.is_staff())));
create policy cash_movements_select on public.cash_movements for select to authenticated
  using ((select public.is_owner()) or (created_by = (select auth.uid()) and (select public.is_staff())));
create policy void_requests_select on public.void_requests for select to authenticated
  using ((select public.is_owner()) or (requested_by = (select auth.uid()) and (select public.is_staff())));

-- owner-only
create policy monthly_soas_select on public.monthly_soas for select to authenticated using ((select public.is_owner()));
create policy audit_log_select on public.audit_log for select to authenticated using ((select public.is_owner()));

-- =============================================================================
-- VIEWS (security_invoker so RLS of the caller applies)
-- =============================================================================
create view public.v_client_balances with (security_invoker = true) as
select c.id as client_id,
       c.name,
       c.phone,
       c.address,
       c.is_active,
       c.client_type,
       c.billing_cycle,
       c.credit_limit,
       c.container_balance,
       coalesce(sum(o.total_amount - o.amount_paid), 0)::numeric(10,2) as outstanding,
       count(o.id)::int as unpaid_orders,
       min(o.created_at) as oldest_unpaid_at
  from public.clients c
  left join public.orders o
    on o.client_id = c.id and o.status <> 'voided' and o.payment_status <> 'paid'
 group by c.id;

create view public.v_soas with (security_invoker = true) as
select s.*,
       c.name as client_name,
       coalesce(p.paid, 0)::numeric(10,2) as amount_paid,
       (s.total_amount_due - coalesce(p.paid, 0))::numeric(10,2) as balance,
       case when coalesce(p.paid, 0) >= s.total_amount_due then 'paid'
            when s.due_date < public.manila_today() then 'overdue'
            else 'unpaid' end as status
  from public.monthly_soas s
  join public.clients c on c.id = s.client_id
  left join lateral (select sum(amount) as paid from public.payments where soa_id = s.id) p on true;

-- =============================================================================
-- RPCs
-- =============================================================================

-- Caller's open shift id (or null).
create or replace function public.my_open_shift_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.shifts where secretary_id = auth.uid() and status = 'open'
$$;

create or replace function public.open_shift(p_opening_cash numeric)
returns public.shifts language plpgsql security definer set search_path = '' as $$
declare v_shift public.shifts;
begin
  perform public.require_staff();
  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'Opening cash must be zero or more';
  end if;
  if public.my_open_shift_id() is not null then
    raise exception 'You already have an open shift';
  end if;
  insert into public.shifts (secretary_id, opening_cash)
  values (auth.uid(), round(p_opening_cash, 2))
  returning * into v_shift;
  return v_shift;
end $$;

-- Cash summary of a shift (expected drawer amount).
create or replace function public.shift_summary(p_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_shift public.shifts;
  v_cash_sales numeric(10,2);
  v_noncash numeric(10,2);
  v_cash_in numeric(10,2);
  v_cash_out numeric(10,2);
  v_expense numeric(10,2);
  v_orders int;
  v_sales numeric(10,2);
begin
  perform public.require_staff();
  select * into v_shift from public.shifts where id = p_shift_id;
  if not found then raise exception 'Shift not found'; end if;
  if v_shift.secretary_id <> auth.uid() and not public.is_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(p.amount) filter (where p.method = 'cash'), 0),
         coalesce(sum(p.amount) filter (where p.method <> 'cash'), 0)
    into v_cash_sales, v_noncash
    from public.payments p join public.orders o on o.id = p.order_id
   where p.shift_id = p_shift_id and o.status <> 'voided';

  select coalesce(sum(amount) filter (where type = 'cash_in'), 0),
         coalesce(sum(amount) filter (where type = 'cash_out'), 0),
         coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_cash_in, v_cash_out, v_expense
    from public.cash_movements where shift_id = p_shift_id;

  select count(*), coalesce(sum(total_amount), 0) into v_orders, v_sales
    from public.orders where shift_id = p_shift_id and status <> 'voided';

  return jsonb_build_object(
    'shift_id', v_shift.id,
    'status', v_shift.status,
    'opened_at', v_shift.opened_at,
    'closed_at', v_shift.closed_at,
    'opening_cash', v_shift.opening_cash,
    'cash_payments', v_cash_sales,
    'non_cash_payments', v_noncash,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'expenses', v_expense,
    'orders', v_orders,
    'sales', v_sales,
    'expected_cash', v_shift.opening_cash + v_cash_sales + v_cash_in - v_cash_out - v_expense,
    'closing_cash', v_shift.closing_cash,
    'variance', v_shift.variance
  );
end $$;

create or replace function public.close_shift(p_shift_id uuid, p_closing_cash numeric, p_notes text default null)
returns public.shifts language plpgsql security definer set search_path = '' as $$
declare
  v_shift public.shifts;
  v_expected numeric(10,2);
begin
  perform public.require_staff();
  select * into v_shift from public.shifts where id = p_shift_id for update;
  if not found then raise exception 'Shift not found'; end if;
  if v_shift.secretary_id <> auth.uid() and not public.is_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_shift.status <> 'open' then raise exception 'Shift is already closed'; end if;
  if p_closing_cash is null or p_closing_cash < 0 then
    raise exception 'Closing cash must be zero or more';
  end if;

  v_expected := (public.shift_summary(p_shift_id) ->> 'expected_cash')::numeric;

  update public.shifts
     set status = 'closed',
         closing_cash = round(p_closing_cash, 2),
         expected_cash = v_expected,
         variance = round(p_closing_cash, 2) - v_expected,
         notes = nullif(trim(p_notes), ''),
         closed_at = now()
   where id = p_shift_id
  returning * into v_shift;
  return v_shift;
end $$;

-- Outstanding (unpaid) balance of a client across non-voided orders.
create or replace function public.client_outstanding(p_client_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(total_amount - amount_paid), 0)
    from public.orders
   where client_id = p_client_id and status <> 'voided' and payment_status <> 'paid'
$$;

-- Unit price for a client (custom price falls back to base price).
create or replace function public.price_for(p_client_id uuid, p_product_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select price from public.client_prices where client_id = p_client_id and product_id = p_product_id),
    (select unit_price from public.products where id = p_product_id)
  )
$$;

/*
  create_order: one atomic sale.
  p_items: [{"product_id": "...", "quantity": 2}, ...]
  p_payment_amount: amount applied to this order now (change is handled at the counter).
  For walk-ins with a client, p_gallons_* are logged immediately; for deliveries they
  are logged when the delivery is completed (update_delivery_status).
*/
create or replace function public.create_order(
  p_order_type        text,
  p_items             jsonb,
  p_client_id         uuid default null,
  p_payment_amount    numeric default 0,
  p_payment_method    text default 'cash',
  p_payment_reference text default null,
  p_gallons_delivered int default 0,
  p_gallons_pulled_out int default 0,
  p_rider_id          uuid default null,
  p_delivery_address  text default null,
  p_notes             text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_shift_id uuid;
  v_client public.clients;
  v_order_id uuid;
  v_order_no bigint;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product public.products;
  v_qty int;
  v_price numeric(10,2);
  v_paid numeric(10,2);
  v_outstanding numeric(10,2);
begin
  perform public.require_staff();

  v_shift_id := public.my_open_shift_id();
  if v_shift_id is null then raise exception 'Open a shift before making sales'; end if;

  if p_order_type not in ('walk_in', 'delivery') then raise exception 'Invalid order type'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;
  if coalesce(p_gallons_delivered, 0) < 0 or coalesce(p_gallons_pulled_out, 0) < 0 then
    raise exception 'Gallon counts cannot be negative';
  end if;

  if p_client_id is not null then
    select * into v_client from public.clients where id = p_client_id;
    if not found or not v_client.is_active then raise exception 'Client not found or inactive'; end if;
  elsif p_order_type = 'delivery' then
    raise exception 'Deliveries need a client';
  end if;

  if p_rider_id is not null and not exists (select 1 from public.riders where id = p_rider_id and is_active) then
    raise exception 'Rider not found or inactive';
  end if;

  insert into public.orders (shift_id, client_id, order_type, status, rider_id, delivery_address, total_amount, notes)
  values (v_shift_id, p_client_id, p_order_type,
          case when p_order_type = 'walk_in' then 'completed' else 'pending_delivery' end,
          p_rider_id,
          case when p_order_type = 'delivery' then coalesce(nullif(trim(p_delivery_address), ''), v_client.address) end,
          0, nullif(trim(p_notes), ''))
  returning id, order_no into v_order_id, v_order_no;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Quantities must be at least 1'; end if;

    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    if not found or not v_product.is_active then raise exception 'Product not found or inactive'; end if;

    v_price := public.price_for(p_client_id, v_product.id);
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_qty, v_price);
    v_total := v_total + v_qty * v_price;

    if v_product.track_stock then
      update public.products set stock_quantity = stock_quantity - v_qty where id = v_product.id;
    end if;
  end loop;

  update public.orders
     set total_amount = v_total,
         completed_at = case when p_order_type = 'walk_in' then now() end
   where id = v_order_id;

  v_paid := least(greatest(coalesce(round(p_payment_amount, 2), 0), 0), v_total);

  -- Credit rules
  if v_paid < v_total then
    if p_client_id is null then
      raise exception 'Unpaid or partial payments need a client (for utang tracking)';
    end if;
    if v_client.credit_limit is not null then
      -- client_outstanding already counts this (still unpaid) order in full; take it out
      v_outstanding := public.client_outstanding(p_client_id) - v_total;
      if v_outstanding + (v_total - v_paid) > v_client.credit_limit then
        raise exception 'Credit limit exceeded: % owes %, limit is %',
          v_client.name, v_outstanding, v_client.credit_limit;
      end if;
    end if;
  end if;

  if v_paid > 0 then
    if p_payment_method not in ('cash', 'e_wallet', 'card', 'bank_transfer') then
      raise exception 'Invalid payment method';
    end if;
    insert into public.payments (order_id, shift_id, amount, method, reference)
    values (v_order_id, v_shift_id, v_paid, p_payment_method, nullif(trim(p_payment_reference), ''));
  end if;

  if p_order_type = 'walk_in' and p_client_id is not null
     and (coalesce(p_gallons_delivered, 0) > 0 or coalesce(p_gallons_pulled_out, 0) > 0) then
    insert into public.container_logs (client_id, order_id, gallons_delivered, gallons_pulled_out)
    values (p_client_id, v_order_id, coalesce(p_gallons_delivered, 0), coalesce(p_gallons_pulled_out, 0));
  end if;

  return jsonb_build_object('id', v_order_id, 'order_no', v_order_no, 'total', v_total, 'paid', v_paid);
end $$;

create or replace function public.update_delivery_status(
  p_order_id          uuid,
  p_status            text,
  p_rider_id          uuid default null,
  p_gallons_delivered int default 0,
  p_gallons_pulled_out int default 0
) returns public.orders language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  perform public.require_staff();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'delivery' then raise exception 'Not a delivery order'; end if;
  if v_order.status in ('completed', 'voided') then
    raise exception 'This order is already % and can no longer be changed', v_order.status;
  end if;

  if not ((v_order.status = 'pending_delivery' and p_status in ('out_for_delivery', 'completed'))
       or (v_order.status = 'out_for_delivery' and p_status in ('completed', 'pending_delivery'))) then
    raise exception 'Cannot move from % to %', v_order.status, p_status;
  end if;

  if p_rider_id is not null and not exists (select 1 from public.riders where id = p_rider_id and is_active) then
    raise exception 'Rider not found or inactive';
  end if;

  if p_status = 'completed' and (coalesce(p_gallons_delivered, 0) < 0 or coalesce(p_gallons_pulled_out, 0) < 0) then
    raise exception 'Gallon counts cannot be negative';
  end if;

  update public.orders
     set status = p_status,
         rider_id = coalesce(p_rider_id, rider_id),
         dispatched_at = case when p_status = 'out_for_delivery' then now()
                              when p_status = 'pending_delivery' then null
                              else dispatched_at end,
         completed_at = case when p_status = 'completed' then now() end
   where id = p_order_id
  returning * into v_order;

  if p_status = 'completed' and (coalesce(p_gallons_delivered, 0) > 0 or coalesce(p_gallons_pulled_out, 0) > 0) then
    insert into public.container_logs (client_id, order_id, gallons_delivered, gallons_pulled_out)
    values (v_order.client_id, v_order.id, coalesce(p_gallons_delivered, 0), coalesce(p_gallons_pulled_out, 0));
  end if;

  return v_order;
end $$;

create or replace function public.record_payment(
  p_order_id  uuid,
  p_amount    numeric,
  p_method    text default 'cash',
  p_reference text default null
) returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_shift_id uuid;
  v_payment public.payments;
begin
  perform public.require_staff();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'voided' then raise exception 'Order is voided'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if round(p_amount, 2) > v_order.total_amount - v_order.amount_paid then
    raise exception 'Amount is more than the remaining balance (%)', v_order.total_amount - v_order.amount_paid;
  end if;
  if p_method not in ('cash', 'e_wallet', 'card', 'bank_transfer') then raise exception 'Invalid payment method'; end if;

  v_shift_id := public.my_open_shift_id();
  if v_shift_id is null and not public.is_owner() then
    raise exception 'Open a shift before recording payments';
  end if;

  insert into public.payments (order_id, soa_id, shift_id, amount, method, reference)
  values (p_order_id, v_order.soa_id, v_shift_id, round(p_amount, 2), p_method, nullif(trim(p_reference), ''))
  returning * into v_payment;
  return v_payment;
end $$;

create or replace function public.log_cash_movement(
  p_type        text,
  p_amount      numeric,
  p_description text,
  p_category    text default null
) returns public.cash_movements language plpgsql security definer set search_path = '' as $$
declare
  v_shift_id uuid;
  v_row public.cash_movements;
begin
  perform public.require_staff();
  v_shift_id := public.my_open_shift_id();
  if v_shift_id is null then raise exception 'Open a shift first'; end if;
  if p_type not in ('expense', 'cash_in', 'cash_out') then raise exception 'Invalid type'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Add a short description'; end if;

  insert into public.cash_movements (shift_id, type, amount, category, description)
  values (v_shift_id, p_type, round(p_amount, 2), nullif(trim(p_category), ''), trim(p_description))
  returning * into v_row;
  return v_row;
end $$;

-- Standalone container movement (e.g. client returns empties, owner correction).
create or replace function public.log_container_movement(
  p_client_id          uuid,
  p_gallons_delivered  int,
  p_gallons_pulled_out int,
  p_notes              text default null
) returns public.container_logs language plpgsql security definer set search_path = '' as $$
declare v_row public.container_logs;
begin
  perform public.require_staff();
  if not exists (select 1 from public.clients where id = p_client_id) then raise exception 'Client not found'; end if;
  if coalesce(p_gallons_delivered, 0) < 0 or coalesce(p_gallons_pulled_out, 0) < 0 then
    raise exception 'Gallon counts cannot be negative';
  end if;
  if coalesce(p_gallons_delivered, 0) = 0 and coalesce(p_gallons_pulled_out, 0) = 0 then
    raise exception 'Enter gallons delivered or pulled out';
  end if;
  insert into public.container_logs (client_id, gallons_delivered, gallons_pulled_out, notes)
  values (p_client_id, coalesce(p_gallons_delivered, 0), coalesce(p_gallons_pulled_out, 0), nullif(trim(p_notes), ''))
  returning * into v_row;
  return v_row;
end $$;

-- Internal: perform the void (restock, reverse containers). Not exposed.
create or replace function public._void_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_del int;
  v_pull int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.status = 'voided' then raise exception 'Order is already voided'; end if;
  if v_order.soa_id is not null then
    raise exception 'Order is already billed on SOA; it cannot be voided';
  end if;

  update public.products p
     set stock_quantity = p.stock_quantity + i.quantity
    from public.order_items i
   where i.order_id = p_order_id and i.product_id = p.id and p.track_stock;

  select coalesce(sum(gallons_delivered), 0), coalesce(sum(gallons_pulled_out), 0)
    into v_del, v_pull from public.container_logs where order_id = p_order_id;
  if v_del > 0 or v_pull > 0 then
    insert into public.container_logs (client_id, order_id, gallons_delivered, gallons_pulled_out, notes)
    values (v_order.client_id, p_order_id, v_pull, v_del, 'Reversal: order voided');
  end if;

  update public.orders set status = 'voided', voided_at = now() where id = p_order_id;
end $$;
revoke all on function public._void_order(uuid) from public, anon, authenticated;

-- Secretary requests a void; the owner's own request is approved immediately.
create or replace function public.request_void(p_order_id uuid, p_reason text)
returns public.void_requests language plpgsql security definer set search_path = '' as $$
declare
  v_req public.void_requests;
  v_status text;
begin
  perform public.require_staff();
  select status into v_status from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_status = 'voided' then raise exception 'Order is already voided'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Give a reason for the void'; end if;
  if exists (select 1 from public.void_requests where order_id = p_order_id and status = 'pending') then
    raise exception 'A void request for this order is already pending';
  end if;

  if public.is_owner() then
    perform public._void_order(p_order_id);
    insert into public.void_requests (order_id, reason, status, reviewed_by, reviewed_at)
    values (p_order_id, trim(p_reason), 'approved', auth.uid(), now())
    returning * into v_req;
  else
    insert into public.void_requests (order_id, reason)
    values (p_order_id, trim(p_reason))
    returning * into v_req;
  end if;
  return v_req;
end $$;

create or replace function public.review_void(p_request_id uuid, p_approve boolean, p_notes text default null)
returns public.void_requests language plpgsql security definer set search_path = '' as $$
declare v_req public.void_requests;
begin
  perform public.require_owner();
  select * into v_req from public.void_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request was already reviewed'; end if;

  if p_approve then perform public._void_order(v_req.order_id); end if;

  update public.void_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_notes = nullif(trim(p_notes), '')
   where id = p_request_id
  returning * into v_req;
  return v_req;
end $$;

-- Generate a Statement of Account for completed, unbilled, unpaid-balance orders in a period.
create or replace function public.generate_soa(
  p_client_id    uuid,
  p_period_start date,
  p_period_end   date,
  p_due_date     date default null,
  p_notes        text default null
) returns public.monthly_soas language plpgsql security definer set search_path = '' as $$
declare
  v_client public.clients;
  v_soa public.monthly_soas;
  v_ids uuid[];
  v_count int;
  v_due numeric(10,2);
begin
  perform public.require_owner();
  select * into v_client from public.clients where id = p_client_id;
  if not found then raise exception 'Client not found'; end if;
  if p_period_end < p_period_start then raise exception 'Period end is before start'; end if;

  select array_agg(id), count(*), coalesce(sum(total_amount - amount_paid), 0)
    into v_ids, v_count, v_due
    from (select id, total_amount, amount_paid
            from public.orders
           where client_id = p_client_id
             and status = 'completed'
             and soa_id is null
             and payment_status <> 'paid'
             and created_at >= public.manila_day_start(p_period_start)
             and created_at <  public.manila_day_start(p_period_end + 1)
             for update) o;
  if v_count = 0 then
    raise exception 'No unbilled unpaid completed orders for this client in that period';
  end if;

  insert into public.monthly_soas (client_id, period_start, period_end, due_date, total_deliveries, total_amount_due, notes)
  values (p_client_id, p_period_start, p_period_end,
          coalesce(p_due_date, p_period_end + v_client.payment_terms_days),
          v_count, v_due, nullif(trim(p_notes), ''))
  returning * into v_soa;

  update public.orders set soa_id = v_soa.id where id = any (v_ids);
  return v_soa;
end $$;

-- Pay an SOA: allocates the amount across its orders, oldest first.
create or replace function public.record_soa_payment(
  p_soa_id    uuid,
  p_amount    numeric,
  p_method    text default 'cash',
  p_reference text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_left numeric(10,2) := round(p_amount, 2);
  v_balance numeric(10,2);
  v_shift_id uuid;
  r record;
  v_apply numeric(10,2);
begin
  perform public.require_staff();
  if not exists (select 1 from public.monthly_soas where id = p_soa_id) then raise exception 'SOA not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if p_method not in ('cash', 'e_wallet', 'card', 'bank_transfer') then raise exception 'Invalid payment method'; end if;

  v_shift_id := public.my_open_shift_id();
  if v_shift_id is null and not public.is_owner() then raise exception 'Open a shift before recording payments'; end if;

  select coalesce(sum(total_amount - amount_paid), 0) into v_balance
    from public.orders where soa_id = p_soa_id and status <> 'voided';
  if v_left > v_balance then raise exception 'Amount is more than the SOA balance (%)', v_balance; end if;

  for r in select id, total_amount - amount_paid as bal
             from public.orders
            where soa_id = p_soa_id and status <> 'voided' and amount_paid < total_amount
            order by created_at
            for update
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, r.bal);
    insert into public.payments (order_id, soa_id, shift_id, amount, method, reference)
    values (r.id, p_soa_id, v_shift_id, v_apply, p_method, nullif(trim(p_reference), ''));
    v_left := v_left - v_apply;
  end loop;

  return jsonb_build_object('applied', round(p_amount, 2), 'remaining_balance', v_balance - round(p_amount, 2));
end $$;

-- Owner dashboard snapshot for a Manila day.
create or replace function public.dashboard_summary(p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  d date := coalesce(p_date, public.manila_today());
  t0 timestamptz := public.manila_day_start(d);
  t1 timestamptz := public.manila_day_start(d + 1);
  v jsonb;
begin
  perform public.require_owner();
  select jsonb_build_object(
    'date', d,
    'sales', (select coalesce(sum(total_amount), 0) from public.orders
               where created_at >= t0 and created_at < t1 and status <> 'voided'),
    'orders', (select count(*) from public.orders
                where created_at >= t0 and created_at < t1 and status <> 'voided'),
    'walk_ins', (select count(*) from public.orders
                  where created_at >= t0 and created_at < t1 and status <> 'voided' and order_type = 'walk_in'),
    'deliveries', (select count(*) from public.orders
                    where created_at >= t0 and created_at < t1 and status <> 'voided' and order_type = 'delivery'),
    'refills', (select coalesce(sum(i.quantity), 0) from public.order_items i
                  join public.orders o on o.id = i.order_id
                  join public.products p on p.id = i.product_id
                 where o.created_at >= t0 and o.created_at < t1 and o.status <> 'voided' and p.category = 'refill'),
    'collected', (select coalesce(sum(p.amount), 0) from public.payments p join public.orders o on o.id = p.order_id
                   where p.created_at >= t0 and p.created_at < t1 and o.status <> 'voided'),
    'collected_by_method', (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) from (
                              select p.method, sum(p.amount) as total from public.payments p
                                join public.orders o on o.id = p.order_id
                               where p.created_at >= t0 and p.created_at < t1 and o.status <> 'voided'
                               group by p.method) m),
    'expenses', (select coalesce(sum(amount), 0) from public.cash_movements
                  where created_at >= t0 and created_at < t1 and type = 'expense'),
    'pending_deliveries', (select count(*) from public.orders where status = 'pending_delivery'),
    'out_for_delivery', (select count(*) from public.orders where status = 'out_for_delivery'),
    'receivables', (select coalesce(sum(total_amount - amount_paid), 0) from public.orders
                     where status <> 'voided' and payment_status <> 'paid'),
    'pending_voids', (select count(*) from public.void_requests where status = 'pending'),
    'open_shifts', (select coalesce(jsonb_agg(jsonb_build_object(
                        'shift_id', s.id,
                        'secretary', pr.full_name,
                        'opened_at', s.opened_at,
                        'summary', public.shift_summary(s.id)) order by s.opened_at), '[]'::jsonb)
                      from public.shifts s join public.profiles pr on pr.id = s.secretary_id
                     where s.status = 'open')
  ) into v;
  return v;
end $$;

-- Daily series for reports.
create or replace function public.sales_report(p_start date, p_end date)
returns table (day date, sales numeric, collected numeric, orders bigint, refills bigint, expenses numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_owner();
  if p_end < p_start or p_end - p_start > 400 then raise exception 'Choose a range of up to ~13 months'; end if;
  return query
  with days as (select generate_series(p_start, p_end, interval '1 day')::date as day),
  o as (
    select (created_at at time zone 'Asia/Manila')::date as day, sum(total_amount) as sales, count(*) as orders
      from public.orders
     where created_at >= public.manila_day_start(p_start) and created_at < public.manila_day_start(p_end + 1)
       and status <> 'voided'
     group by 1),
  r as (
    select (o2.created_at at time zone 'Asia/Manila')::date as day, sum(i.quantity) as refills
      from public.order_items i
      join public.orders o2 on o2.id = i.order_id
      join public.products p on p.id = i.product_id
     where o2.created_at >= public.manila_day_start(p_start) and o2.created_at < public.manila_day_start(p_end + 1)
       and o2.status <> 'voided' and p.category = 'refill'
     group by 1),
  pay as (
    select (p.created_at at time zone 'Asia/Manila')::date as day, sum(p.amount) as collected
      from public.payments p join public.orders o3 on o3.id = p.order_id
     where p.created_at >= public.manila_day_start(p_start) and p.created_at < public.manila_day_start(p_end + 1)
       and o3.status <> 'voided'
     group by 1),
  ex as (
    select (created_at at time zone 'Asia/Manila')::date as day, sum(amount) as expenses
      from public.cash_movements
     where created_at >= public.manila_day_start(p_start) and created_at < public.manila_day_start(p_end + 1)
       and type = 'expense'
     group by 1)
  select days.day,
         coalesce(o.sales, 0)::numeric, coalesce(pay.collected, 0)::numeric,
         coalesce(o.orders, 0)::bigint, coalesce(r.refills, 0)::bigint, coalesce(ex.expenses, 0)::numeric
    from days
    left join o using (day) left join r using (day) left join pay using (day) left join ex using (day)
   order by days.day;
end $$;

-- High-volume / commercial account report.
create or replace function public.client_volume_report(p_start date, p_end date)
returns table (client_id uuid, name text, client_type text, orders bigint, refills bigint,
               sales numeric, outstanding numeric, container_balance int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_owner();
  return query
  select c.id, c.name, c.client_type,
         count(distinct o.id)::bigint,
         coalesce(sum(i.quantity) filter (where p.category = 'refill'), 0)::bigint,
         coalesce((select sum(o2.total_amount) from public.orders o2
                    where o2.client_id = c.id and o2.status <> 'voided'
                      and o2.created_at >= public.manila_day_start(p_start)
                      and o2.created_at < public.manila_day_start(p_end + 1)), 0)::numeric,
         public.client_outstanding(c.id)::numeric,
         c.container_balance
    from public.clients c
    join public.orders o on o.client_id = c.id and o.status <> 'voided'
         and o.created_at >= public.manila_day_start(p_start)
         and o.created_at < public.manila_day_start(p_end + 1)
    left join public.order_items i on i.order_id = o.id
    left join public.products p on p.id = i.product_id
   group by c.id
   order by 6 desc;
end $$;

-- Execute rights: only signed-in users; each function checks the role itself.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public._void_order(uuid) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

-- =============================================================================
-- REALTIME
-- =============================================================================
alter publication supabase_realtime add table
  public.orders, public.payments, public.shifts, public.cash_movements, public.void_requests;
