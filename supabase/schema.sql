create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values ('cafe-photos', 'cafe-photos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "public read cafe photos" on storage.objects;
create policy "public read cafe photos"
on storage.objects
for select
using (bucket_id = 'cafe-photos');

drop policy if exists "public upload cafe photos" on storage.objects;
create policy "public upload cafe photos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'cafe-photos');

drop policy if exists "public update cafe photos" on storage.objects;
create policy "public update cafe photos"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'cafe-photos')
with check (bucket_id = 'cafe-photos');

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  location text not null,
  address text not null,
  maps_url text,
  latitude double precision,
  longitude double precision,
  vibe text not null default 'direkomendasikan',
  wifi text not null default 'stabil',
  price text not null default 'Variatif',
  open_hours text not null default 'Buka setiap hari',
  tags text[] not null default '{}',
  image text not null,
  thumbnail_image text,
  photo_urls text[] not null default '{}',
  photo_thumbnail_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null,
  likes_count integer not null default 0,
  photo_url text,
  photo_thumbnail_url text,
  photo_urls text[] not null default '{}',
  photo_thumbnail_urls text[] not null default '{}',
  recommendation_vote text check (recommendation_vote in ('like', 'dislike')),
  created_at timestamptz not null default now()
);

alter table public.cafes add column if not exists thumbnail_image text;
alter table public.cafes add column if not exists photo_thumbnail_urls text[] not null default '{}';
alter table public.cafes add column if not exists maps_url text;
alter table public.cafes add column if not exists latitude double precision;
alter table public.cafes add column if not exists longitude double precision;
alter table public.reviews add column if not exists likes_count integer not null default 0;
alter table public.reviews add column if not exists photo_thumbnail_url text;
alter table public.reviews add column if not exists photo_thumbnail_urls text[] not null default '{}';

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_accounts enable row level security;

drop policy if exists "no public admin reads" on public.admin_accounts;
drop policy if exists "no public admin writes" on public.admin_accounts;

create or replace function public.verify_admin_login(
  p_username text,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  stored_hash text;
begin
  select password_hash
    into stored_hash
  from public.admin_accounts
  where username = p_username
  limit 1;

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = md5(p_password);
end;
$func$;

grant execute on function public.verify_admin_login(text, text) to anon, authenticated;

create or replace function public.increment_review_like(
  p_review_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
begin
  update public.reviews
  set likes_count = coalesce(likes_count, 0) + 1
  where id = p_review_id;
end;
$func$;

grant execute on function public.increment_review_like(uuid) to anon, authenticated;

insert into public.admin_accounts (username, password_hash)
values ('arunika', md5('ar4925'))
on conflict (username) do update
set password_hash = excluded.password_hash;

create index if not exists cafes_created_at_idx on public.cafes (created_at desc);
create index if not exists reviews_cafe_id_created_at_idx on public.reviews (cafe_id, created_at desc);

alter table public.cafes enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "public can read cafes" on public.cafes;
create policy "public can read cafes"
on public.cafes
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert cafes" on public.cafes;
create policy "public can insert cafes"
on public.cafes
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update cafes" on public.cafes;
create policy "public can update cafes"
on public.cafes
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete cafes" on public.cafes;
create policy "public can delete cafes"
on public.cafes
for delete
to anon, authenticated
using (true);

drop policy if exists "public can read reviews" on public.reviews;
create policy "public can read reviews"
on public.reviews
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert reviews" on public.reviews;
create policy "public can insert reviews"
on public.reviews
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update reviews" on public.reviews;
create policy "public can update reviews"
on public.reviews
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete reviews" on public.reviews;
create policy "public can delete reviews"
on public.reviews
for delete
to anon, authenticated
using (true);

create or replace function public.add_recommendation(
  p_user_name text,
  p_coffee_shop_name text,
  p_location text,
  p_address text,
  p_maps_url text,
  p_latitude double precision,
  p_longitude double precision,
  p_open_hours text,
  p_price text,
  p_rating integer,
  p_checklist text[],
  p_review text,
  p_photo_urls text[],
  p_photo_thumbnail_urls text[],
  p_recommendation_vote text
)
returns void
language plpgsql
as $func$
declare
  new_cafe_id uuid := gen_random_uuid();
  first_photo text := coalesce(p_photo_urls[1], '');
  first_thumbnail text := coalesce(p_photo_thumbnail_urls[1], '');
  checklist_items text[] := coalesce(p_checklist, '{}'::text[]);
  photo_items text[] := coalesce(p_photo_urls, '{}'::text[]);
  thumbnail_items text[] := coalesce(p_photo_thumbnail_urls, '{}'::text[]);
begin
  insert into public.cafes (
    id,
    name,
    area,
    location,
    address,
    maps_url,
    latitude,
    longitude,
    vibe,
    wifi,
    price,
    open_hours,
    tags,
    image,
    thumbnail_image,
    photo_urls,
    photo_thumbnail_urls
  )
  values (
    new_cafe_id,
    p_coffee_shop_name,
    p_location,
    p_location,
    p_address,
    nullif(p_maps_url, ''),
    p_latitude,
    p_longitude,
    case when p_recommendation_vote = 'like' then 'direkomendasikan' else 'perlu dicek' end,
    case when 'wifi cepat' = any(checklist_items) then 'cepat' else 'stabil' end,
    coalesce(nullif(p_price, ''), case when 'harga terjangkau' = any(checklist_items) then 'Terjangkau' else 'Variatif' end),
    coalesce(nullif(p_open_hours, ''), 'Berdasarkan info user'),
    checklist_items,
    case
      when first_photo <> '' then first_photo
      else 'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=80'
    end,
    nullif(first_thumbnail, ''),
    photo_items,
    thumbnail_items
  );

  insert into public.reviews (
    id,
    cafe_id,
    name,
    rating,
    comment,
    likes_count,
    photo_url,
    photo_thumbnail_url,
    photo_urls,
    photo_thumbnail_urls,
    recommendation_vote
  )
  values (
    gen_random_uuid(),
    new_cafe_id,
    p_user_name,
    greatest(1, least(5, coalesce(p_rating, 5))),
    p_review,
    0,
    nullif(first_photo, ''),
    nullif(first_thumbnail, ''),
    photo_items,
    thumbnail_items,
    p_recommendation_vote
  );
end;
$func$;

grant execute on function public.add_recommendation(
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  integer,
  text[],
  text,
  text[],
  text[],
  text
) to anon, authenticated;

insert into public.cafes (
  id, name, area, location, address, vibe, wifi, price, open_hours, tags, image, photo_urls
)
values
(
  '11111111-1111-1111-1111-111111111111',
  'Sore Latte',
  'Batu',
  'Batu',
  'Jl. Raya Batu No. 10',
  'tenang',
  'stabil',
  'Rp25-45k',
  '08.00-22.00',
  array['Quiet corner', 'Colokan banyak', 'Cocok meeting'],
  'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=80',
  '{}'
),
(
  '22222222-2222-2222-2222-222222222222',
  'Hijau House',
  'Malang',
  'Malang',
  'Jl. Ijen No. 21',
  'hangat',
  'stabil',
  'Rp20-40k',
  '09.00-21.00',
  array['Natural light', 'Lantai dua', 'WFC friendly'],
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
  '{}'
),
(
  '33333333-3333-3333-3333-333333333333',
  'Kebun Pagi',
  'Surabaya',
  'Surabaya',
  'Jl. Tunjungan No. 88',
  'fresh',
  'cepat',
  'Rp30-55k',
  '07.30-23.00',
  array['Outdoor indoor', 'Banyak colokan', 'Cemilan enak'],
  'https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=1200&q=80',
  '{}'
),
(
  '44444444-4444-4444-4444-444444444444',
  'Ruang Tumbuh',
  'Bandung',
  'Bandung',
  'Jl. Dago No. 14',
  'minimal',
  'stabil',
  'Rp28-50k',
  '10.00-22.00',
  array['Silent zone', 'Minimal noise', 'Boarding meeting'],
  'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80',
  '{}'
)
on conflict (id) do nothing;

insert into public.reviews (
  id, cafe_id, name, rating, comment, photo_url, photo_urls, recommendation_vote, created_at
)
values
(
  'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '11111111-1111-1111-1111-111111111111',
  'Rina',
  5,
  'Meja lega, internet kencang, cocok buat ngerjain proposal.',
  null,
  '{}',
  'like',
  '2026-06-06T08:00:00.000Z'
),
(
  'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  '11111111-1111-1111-1111-111111111111',
  'Naufal',
  4,
  'Suasananya hening dan baristanya ramah.',
  null,
  '{}',
  'like',
  '2026-06-08T11:30:00.000Z'
),
(
  'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '22222222-2222-2222-2222-222222222222',
  'Dita',
  5,
  'Pencahayaan enak buat kerja lama dan fokus.',
  null,
  '{}',
  'like',
  '2026-06-05T13:20:00.000Z'
),
(
  'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  '22222222-2222-2222-2222-222222222222',
  'Bima',
  5,
  'Ada spot sepi dan menu kopinya konsisten.',
  null,
  '{}',
  'like',
  '2026-06-09T10:15:00.000Z'
),
(
  'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
  '22222222-2222-2222-2222-222222222222',
  'Salsa',
  4,
  'Bisa meeting santai tanpa terlalu ramai.',
  null,
  '{}',
  'like',
  '2026-06-10T09:05:00.000Z'
),
(
  'ccccccc1-cccc-cccc-cccc-ccccccccccc1',
  '33333333-3333-3333-3333-333333333333',
  'Yoga',
  4,
  'Tempatnya luas dan nyaman buat kerja berjam-jam.',
  null,
  '{}',
  'like',
  '2026-06-04T07:40:00.000Z'
),
(
  'ddddddd1-dddd-dddd-dddd-ddddddddddd1',
  '44444444-4444-4444-4444-444444444444',
  'Maya',
  5,
  'Rasanya seperti ruang kerja kecil yang tenang.',
  null,
  '{}',
  'like',
  '2026-06-02T16:00:00.000Z'
),
(
  'ddddddd2-dddd-dddd-dddd-ddddddddddd2',
  '44444444-4444-4444-4444-444444444444',
  'Farhan',
  4,
  'Bagus untuk deep work, tidak terlalu bising.',
  null,
  '{}',
  'like',
  '2026-06-07T15:10:00.000Z'
)
on conflict (id) do nothing;
