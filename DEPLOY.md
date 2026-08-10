# Deploy Guide

Panduan deploy production. Setup: Next.js 16 + Prisma 6 + MySQL, di-hosting via **Hostinger Deployments** (auto-deploy dari GitHub).

> **📝 Placeholder** — ganti dengan value kamu sendiri saat run command:
> - `<USER>` → username hosting (contoh Hostinger: `u12345678`)
> - `<DOMAIN>` → domain website
> - `<DB_USER>` → MySQL user (biasanya `<USER>_xxx`)
> - `<DB_NAME>` → MySQL database name (biasanya `<USER>_xxx`)
> - `<UUID>` → deployment UUID terbaru (dari `ls hbuilds/versions/`)
> - `<SERVER_IP>` dan `<SSH_PORT>` → info SSH dari hPanel

---

## Alur Deploy Normal (kode-only)

Untuk perubahan kode biasa (tambah fitur, fix bug, styling, dll):

```bash
git add .
git commit -m "feat/fix: deskripsi singkat"
git push origin main
```

**Selesai.** Hostinger auto-deploy dalam ~10-30 detik. Tunggu ~2 menit sampai build+deploy selesai. Cek status:
- **hPanel → Websites → <DOMAIN> → Deployments** — lihat entry paling atas

---

## Kalau ada perubahan schema Prisma (tabel baru / kolom baru)

Push kode dulu (seperti di atas), lalu setelah deploy sukses, SSH ke server dan sync schema:

```bash
# 1. SSH ke server
ssh <USER>@<SERVER_IP> -p <SSH_PORT>

# 2. Load env & Node
set -a && source ~/domains/<DOMAIN>/hbuilds/config/.env && set +a
export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH

# 3. Cari UUID versions terbaru
ls ~/domains/<DOMAIN>/hbuilds/versions/

# 4. Push schema (ganti <UUID> dengan hasil di atas)
npx prisma@6.19.3 db push --schema=$HOME/domains/<DOMAIN>/hbuilds/last-source/prisma/schema.prisma
```

Setelah push schema, restart app:
```bash
cd ~/domains/<DOMAIN>/hbuilds/versions/<UUID>/nodejs/
mkdir -p tmp && touch tmp/restart.txt
```

---

## Kalau perlu isi seed data

Seed script menambah admin, user demo, dan produk contoh. Aman dijalankan berulang (pakai upsert).

```bash
# 1. Cd ke folder versions terbaru
cd ~/domains/<DOMAIN>/hbuilds/versions/<UUID>/nodejs/

# 2. Load env & Node
set -a && source ~/domains/<DOMAIN>/hbuilds/config/.env && set +a
export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH

# 3. Copy seed.js ke folder ini (WAJIB, tidak bisa symlink)
cp $HOME/domains/<DOMAIN>/hbuilds/last-source/prisma/seed.js ./seed-run.js

# 4. Jalankan
node ./seed-run.js

# 5. Cleanup
rm ./seed-run.js
```

⚠️ **Ganti password admin lewat UI setelah seed** — script pakai plaintext password default.

---

## Kalau update Environment Variables

Contoh: ganti DOKU credentials, RAJAONGKIR API key, dll.

1. **hPanel → Deployments → Environment Variables**
2. Edit / add variable → Save
3. **Trigger redeploy** — bisa push commit kosong:
   ```bash
   git commit --allow-empty -m "chore: reload env vars" && git push origin main
   ```
   (Env var baru cuma efektif setelah rebuild.)

---

## Verify deploy berhasil

Setelah deploy selesai:

```bash
# Cek console.log runtime app
tail -30 ~/domains/<DOMAIN>/hbuilds/versions/<UUID>/nodejs/console.log

# Cek website
curl -sI https://<DOMAIN> | head -3
curl -s https://<DOMAIN>/api/health
```

Kalau ada error di console.log → cek kolom error dan fix di kode → push ulang.

---

## Troubleshooting

### Build gagal tanpa error jelas
- Cek log build di **hPanel → Deployments → deployment terbaru → Log**
- Kalau log cuma sampai build sukses tapi status "Build gagal", cek `console.log` runtime untuk error post-build

### App error `Cannot find module @prisma/client-<hash>`
- Bug Turbopack + Prisma. Pastikan `package.json` build script: `"next build --webpack"` (bukan `next build`)

### Prisma auth error di runtime
- Password DB user tidak match `DATABASE_URL`
- Fix: **hPanel → Databases → MySQL Databases** → reset password DB user sesuai env

### Seed script error `Named export 'PrismaClient' not found`
- File `prisma/seed.js` harus pakai default import (bukan named):
  ```js
  import pkg from '@prisma/client';
  const { PrismaClient } = pkg;
  ```

### Seed script panic "timer has gone away"
- Bug Prisma engine di Hostinger shared env. Coba retry, kalau tetap gagal, insert data manual via phpMyAdmin SQL.

### `npx` / `node` command not found di SSH
- PATH belum load Node. Jalankan:
  ```bash
  export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH
  ```
- Untuk permanent: `echo 'export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH' >> ~/.bashrc`

### Log runtime kosong di hPanel tapi ada di file
- Log runtime UI Hostinger kadang lag. File `console.log` di server selalu real-time:
  ```bash
  tail -f ~/domains/<DOMAIN>/hbuilds/versions/<UUID>/nodejs/console.log
  ```

---

## File & Folder Penting (Hostinger structure)

| Path | Fungsi |
|---|---|
| `~/domains/<DOMAIN>/hbuilds/config/.env` | Env vars (di-write otomatis oleh Hostinger dari UI) |
| `~/domains/<DOMAIN>/hbuilds/last-source/` | Source code dari git pull terakhir |
| `~/domains/<DOMAIN>/hbuilds/versions/<UUID>/nodejs/` | Deployment aktif — running app |
| `.../nodejs/console.log` | Runtime log app (Next.js + Prisma errors) |
| `.../nodejs/stderr.log` | Stderr Passenger |
| `.../nodejs/tmp/restart.txt` | Touch file ini untuk trigger restart tanpa redeploy |

---

## Environment Variables Reference

Yang ada di Hostinger Deployments UI (10 vars):

| Key | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string (via socket untuk Hostinger) |
| `AUTH_SECRET` | JWT session signing (generate: `openssl rand -base64 48`) |
| `DOKU_CLIENT_ID` | Payment gateway client ID |
| `DOKU_SECRET_KEY` | Payment gateway secret key |
| `DOKU_BASE_URL` | `https://api.doku.com` (production) atau `https://api-sandbox.doku.com` |
| `RAJAONGKIR_API_KEY` | Shipping cost API key |
| `RAJAONGKIR_BASE` | `https://rajaongkir.komerce.id/api/v1` |
| `SHIPPING_ORIGIN_CITY_ID` | ID kota asal pengiriman |
| `SHIPPING_COURIERS` | Ekspedisi tersedia (`jne,pos,tiki`) |
| `SHIPPING_ITEMS_PER_KG` | Kalkulasi berat kg per item |

Values disimpan di catatan pribadi (jangan commit ke repo).

---

## Rollback ke Deploy Sebelumnya

Kalau deploy baru bermasalah dan mau balik ke versi sebelumnya:

**hPanel → Deployments → History** → cari deployment sukses sebelumnya → klik menu titik tiga → **Redeploy** / **Rollback**.

Atau via git (revert commit lalu push):
```bash
git revert HEAD
git push origin main
```

---

## Kontak Support

Kalau deploy gagal tanpa error yang jelas dan config sudah benar, submit tiket engineering ke Hostinger (bukan live chat) via **hPanel → Help & Support → Contact Us**.
