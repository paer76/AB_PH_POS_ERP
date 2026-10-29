-- Run with: supabase test db
-- Uses the seed users: owner 1111..., secretary 2222...
begin;
select plan(41);

create or replace function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_owner() returns void language sql as $$
  select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
$$;
create or replace function pg_temp.as_secretary() returns void language sql as $$
  select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
$$;

-- Fixtures (looked up as postgres)
create temp table fx as
select (select id from public.products where name = '5-Gallon Slim Refill') as slim,
       (select id from public.products where name = 'Cap Seal') as cap,
       (select id from public.clients where name = 'Juan Dela Cruz') as juan,
       (select id from public.clients where name = 'Kainan sa Kanto (Resto)') as resto,
       (select id from public.riders where name = 'Kuya Ben') as rider;
grant select on fx to authenticated;

-- ---------- Roles ----------
select pg_temp.as_secretary();
select is(public.my_role(), 'secretary', 'secretary role resolved');
select ok(not public.is_owner(), 'secretary is not owner');

-- ---------- Shift required ----------
select throws_ok(
  $$ select public.create_order('walk_in', jsonb_build_array(jsonb_build_object('product_id', (select slim from fx), 'quantity', 1)), null, 30) $$,
  'Open a shift before making sales');

select lives_ok($$ select public.open_shift(1000) $$, 'secretary opens shift');
select throws_ok($$ select public.open_shift(500) $$, 'You already have an open shift');

-- ---------- Walk-in cash sale ----------
select lives_ok($$
  select public.create_order('walk_in',
    jsonb_build_array(jsonb_build_object('product_id', (select slim from fx), 'quantity', 3),
                      jsonb_build_object('product_id', (select cap from fx), 'quantity', 3)),
    null, 96, 'cash') $$, 'anonymous walk-in paid in full');
select is((select total_amount from public.orders order by order_no desc limit 1), 96.00::numeric(10,2), 'total = 3*30 + 3*2');
select is((select payment_status from public.orders order by order_no desc limit 1), 'paid', 'marked paid');
reset role;
select is((select stock_quantity from public.products where name = 'Cap Seal'), 497, 'cap seal stock decremented');
select pg_temp.as_secretary();

-- Anonymous utang is refused
select throws_ok($$
  select public.create_order('walk_in', jsonb_build_array(jsonb_build_object('product_id', (select slim from fx), 'quantity', 1)), null, 0) $$,
  'Unpaid or partial payments need a client (for utang tracking)');

-- ---------- Custom price + credit ----------
select lives_ok($$
  select public.create_order('delivery', jsonb_build_array(jsonb_build_object('product_id', (select slim from fx), 'quantity', 10)),
    (select resto from fx), 0) $$, 'commercial delivery on credit');
select is((select total_amount from public.orders order by order_no desc limit 1), 250.00::numeric(10,2), 'client price 25 applied');
select is((select status from public.orders order by order_no desc limit 1), 'pending_delivery', 'delivery starts pending');

-- Juan has a 500 limit
select lives_ok($$
  select public.create_order('walk_in', jsonb_build_array(jsonb_build_object('product_id', (select slim from fx), 'quantity', 15)),
    (select juan from fx), 0) $$, 'utang within limit (450)');
select throws_like($$
  select public.create_order('walk_in', jsonb_build_array(jsonb_build_object('product_id', (select slim from fx), 'quantity', 2)),
    (select juan from fx), 0) $$, 'Credit limit exceeded%', 'credit limit enforced');

-- ---------- Partial payments ----------
select lives_ok($$ select public.record_payment((select id from public.orders where client_id = (select juan from fx) limit 1), 200, 'cash') $$, 'partial payment');
select is((select payment_status from public.orders where client_id = (select juan from fx) limit 1), 'partially_paid', 'partially paid');
select throws_like($$ select public.record_payment((select id from public.orders where client_id = (select juan from fx) limit 1), 300, 'cash') $$,
  'Amount is more than the remaining balance%', 'no overpayment');
select lives_ok($$ select public.record_payment((select id from public.orders where client_id = (select juan from fx) limit 1), 250, 'e_wallet') $$, 'pay remainder by e-wallet');
select is((select payment_status from public.orders where client_id = (select juan from fx) limit 1), 'paid', 'now paid');

-- ---------- Delivery flow + containers ----------
select lives_ok($$ select public.update_delivery_status((select id from public.orders where client_id = (select resto from fx) limit 1), 'out_for_delivery', (select rider from fx)) $$, 'dispatch');
select lives_ok($$ select public.update_delivery_status((select id from public.orders where client_id = (select resto from fx) limit 1), 'completed', null, 10, 6) $$, 'complete with containers');
select is((select container_balance from public.clients where id = (select resto from fx)), 4, 'container balance +10 -6');
select throws_like($$ select public.update_delivery_status((select id from public.orders where client_id = (select resto from fx) limit 1), 'pending_delivery') $$,
  'This order is already completed%', 'completed orders are locked');

-- ---------- Direct writes are blocked ----------
select throws_ok($$ update public.orders set total_amount = 1 $$, '42501', null, 'secretary cannot update orders directly');
select throws_ok($$ delete from public.orders $$, '42501', null, 'nobody can delete orders');
select is_empty($$ update public.products set unit_price = 1 returning id $$, 'secretary cannot change prices (RLS)');
select throws_ok($$ update public.clients set credit_limit = 99999 where id = (select juan from fx) $$, 'Only the owner can change client terms');
select is((select count(*)::int from public.audit_log), 0, 'secretary cannot read audit log');
select throws_ok($$ select public.dashboard_summary() $$, 'Only the owner can do this');

-- ---------- Expenses & shift close ----------
select lives_ok($$ select public.log_cash_movement('expense', 50, 'Gas for delivery') $$, 'expense logged');
-- expected = 1000 open + 96 + 200 cash - 50 expense = 1246
select is(((public.shift_summary(public.my_open_shift_id())) ->> 'expected_cash')::numeric, 1246.00, 'expected drawer cash');

-- ---------- Void flow ----------
select lives_ok($$ select public.request_void((select id from public.orders where client_id is null order by order_no limit 1), 'Wrong item entered') $$, 'secretary requests void');
select pg_temp.as_owner();
select lives_ok($$ select public.review_void((select id from public.void_requests where status = 'pending' limit 1), true) $$, 'owner approves void');

select is((select status from public.orders where client_id is null order by order_no limit 1), 'voided', 'order voided');
select is((select stock_quantity from public.products where name = 'Cap Seal'), 500, 'void restocked cap seals');

-- ---------- SOA ----------
select lives_ok($$ select public.generate_soa((select resto from fx), public.manila_today() - 30, public.manila_today()) $$, 'SOA generated');
select is((select total_amount_due from public.monthly_soas limit 1), 250.00::numeric(10,2), 'SOA total = unpaid completed deliveries');
select throws_like($$ select public.generate_soa((select resto from fx), public.manila_today() - 30, public.manila_today()) $$,
  'No unbilled%', 'orders are never billed twice');
select lives_ok($$ select public.record_soa_payment((select id from public.monthly_soas limit 1), 100, 'bank_transfer') $$, 'owner records remote SOA payment');
select is((select balance from public.v_soas limit 1), 150.00::numeric(10,2), 'SOA balance updated');

select * from finish();
rollback;
