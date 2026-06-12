# Teman WFC

Web app minimal untuk mengumpulkan cafe rekomendasi Work From Cafe (WFC).

## Fitur

- Gallery grid cafe dengan ranking berdasarkan jumlah review dan rating.
- Detail cafe dengan review user terbaru.
- Form review dengan rating dan opsi foto.
- Data layer lokal default, bisa diarahkan ke Google Apps Script atau Supabase.

## Jalankan lokal

```bash
npm install
npm run dev
```

## Backend data

### Mode lokal

Default saat `VITE_WFC_BACKEND` tidak diisi. Data tersimpan di memori browser selama sesi aktif.

### Google Apps Script / Spreadsheet

Set `VITE_WFC_BACKEND=apps-script` dan `VITE_WFC_API_BASE_URL` ke URL web app Apps Script.

Endpoint yang diharapkan:

- `GET` mengembalikan array cafe.
- `POST` menerima JSON `{ action: "addReview", cafeId, review }` dan mengembalikan array cafe terbaru.

Spreadsheet yang disarankan:

- Sheet `cafes`: `id`, `name`, `area`, `location`, `address`, `vibe`, `wifi`, `price`, `openHours`, `tags`, `image`, `photoUrls`
- Sheet `reviews`: `id`, `cafeId`, `name`, `rating`, `comment`, `photoUrl`, `photoUrls`, `recommendationVote`, `createdAt`

Template Apps Script ada di `apps-script/Code.gs`.

Catatan foto:

- Foto sebaiknya disimpan sebagai URL/link di spreadsheet, bukan sebagai file biner di cell.
- Kalau ingin upload foto asli, simpan file ke Google Drive lalu tulis link Drive-nya ke sheet.
- Menyimpan base64 langsung ke spreadsheet tidak disarankan karena cepat berat dan mudah kena limit ukuran cell.

### Supabase

Set `VITE_WFC_BACKEND=supabase`, `VITE_SUPABASE_URL`, dan `VITE_SUPABASE_ANON_KEY`.

Schema SQL yang bisa langsung dijalankan ada di [`supabase/schema.sql`](./supabase/schema.sql).

Catatan foto:

- Data foto saat ini disimpan sebagai URL di kolom `photo_urls` dan `photo_url`.
- Untuk produksi, paling bagus pakai Supabase Storage lalu simpan URL file hasil upload ke database.

### Pilihan terbaik

- Spreadsheet + Apps Script: paling cepat, cocok untuk MVP, data mudah dilihat dan diedit orang non-teknis, tapi kurang ideal untuk foto dan skala besar.
- Supabase: lebih rapi untuk jangka panjang, lebih enak untuk foto via Storage, query lebih kuat, dan lebih aman kalau pengguna makin banyak.
