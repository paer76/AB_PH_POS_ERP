-- Local development seed. Do NOT run against production.
-- Logins (password: password123):
--   owner@aquabest.local      (owner)
--   secretary@aquabest.local  (secretary)

do $$
declare
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_sec   uuid := '22222222-2222-2222-2222-222222222222';
  u record;
begin
  for u in select * from (values
      (v_owner, 'owner@aquabest.local', 'Tita Owner', 'owner'),
      (v_sec, 'secretary@aquabest.local', 'Counter Staff', 'secretary')
    ) as t(id, email, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', u.role),
      jsonb_build_object('full_name', u.full_name), now(), now(), '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

insert into public.products (name, category, unit_price, track_stock, stock_quantity, sort_order) values
  ('5-Gallon Slim Refill',  'refill',    30.00, false, 0,  1),
  ('5-Gallon Round Refill', 'refill',    30.00, false, 0,  2),
  ('1-Gallon Refill',       'refill',    10.00, false, 0,  3),
  ('New Slim Container',    'container', 250.00, true, 20, 10),
  ('New Round Container',   'container', 220.00, true, 15, 11),
  ('Cap Seal',              'accessory',  2.00, true, 500, 20),
  ('Faucet',                'accessory', 35.00, true, 30, 21);

insert into public.clients (name, phone, address, client_type, billing_cycle, credit_limit, payment_terms_days) values
  ('Juan Dela Cruz',          '0917 123 4567', 'Blk 3 Lot 5, Sampaguita St.', 'retail',     'per_delivery', 500.00,  7),
  ('Maria Santos',            '0918 765 4321', '12 Mabini Ave.',              'retail',     'per_delivery', null,    7),
  ('Kainan sa Kanto (Resto)', '0920 555 0101', 'Corner Rizal & Luna',         'commercial', 'monthly_soa',  10000.00, 30),
  ('Bright Minds School',     '(02) 8123 4567','45 Katipunan Rd.',            'commercial', 'monthly_soa',  null,     30);

-- Commercial negotiated price
insert into public.client_prices (client_id, product_id, price)
select c.id, p.id, 25.00
  from public.clients c, public.products p
 where c.name = 'Kainan sa Kanto (Resto)' and p.name in ('5-Gallon Slim Refill', '5-Gallon Round Refill');

insert into public.riders (name, phone) values ('Kuya Ben', '0919 000 1111'), ('Jojo', '0919 000 2222');
