# PlayTopUp Store 🎮

Toko top up game instan — mobile-first dengan **desain desktop terpisah** (bukan sekadar responsive).

## Fitur
- Katalog game, kategori, pencarian, detail produk + varian denominasi
- Keranjang, checkout, voucher (mis. `BONUS10`), pembayaran QRIS & transfer bank + upload bukti
- Lacak pesanan (tanpa login), wallet/promo, tiket bantuan/CS, profil, wishlist
- Admin: dashboard, produk & varian, pesanan, voucher, banner, tiket, user, pengaturan
- **Mobile**: desain app-shell (bottom nav) seperti mockup
- **Desktop** (≥1024px): header khusus + search bar lebar, carousel banner, grid 5 kolom, footer

## Jalankan lokal
```bash
npm install
node seed.js   # isi data contoh (sekali saja)
node server.js # http://localhost:3000
```

## Deploy ke Railway
1. Buat project baru di [railway.app](https://railway.app) → **Deploy from GitHub repo** → pilih repo ini.
2. Railway otomatis menjalankan `npm install` dan `npm start` (port diambil dari `PORT`).
3. (Opsional) Tambah variable:
   - `JWT_SECRET` — ganti dengan string acak yang panjang
   - `BASE_URL` — URL publik Railway (untuk link reset password)
4. Jalankan sekali via Railway shell/CLI untuk seed data: `node seed.js`
5. **Wajib sebelum production**: ganti password admin default & pasang QRIS merchant asli via menu Admin → Settings.

Akun demo: `admin@playtopup.id` / `admin123` · `user@playtopup.id` / `user123`

> Catatan: database SQLite & folder uploads tersimpan di disk ephemeral Railway
> (hilang saat redeploy). Untuk production serius, pindahkan ke Postgres + object storage.
