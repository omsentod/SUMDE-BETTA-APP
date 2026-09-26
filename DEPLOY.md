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

> Wajib pakai `--schema=...last-source/...`. Folder `versions/<UUID>/nodejs/` tidak berisi `prisma/schema.prisma`, jadi `npm run db:push` biasa akan error `Could not find Prisma Schema`.
>
> Warning `package.json#prisma is deprecated` boleh diabaikan — itu cuma pemberitahuan untuk Prisma 7, **jangan** upgrade ke Prisma 7 (breaking change: wajib driver adapter + `prisma.config.ts`).

Sukses kalau muncul: `Your database is now in sync with your Prisma schema`.

Setelah push schema, restart app:
```bash
cd ~/domains/<DOMAIN>/hbuilds/versions/<UUID>/nodejs/
mkdir -p tmp && touch tmp/restart.txt
```

### Fallback: `db push` macet (diam setelah baris `Datasource "db": MySQL database ...`)

Schema engine Prisma kadang hang di shared env Hostinger. Tunggu 1–2 menit, `Ctrl+C`, retry sekali. Kalau tetap macet, ubah tabel manual lewat `mysql` CLI (env dari langkah 2 harus sudah di-load).

```bash
# 1. Cek user DB (password disamarkan)
echo "$DATABASE_URL" | sed 's/:[^:@]*@/:****@/'
#    → mysql://<DB_USER>:****@localhost/<DB_NAME>?socket=/var/lib/mysql/mysql.sock

# 2. Tes koneksi + lihat kolom tabel yang berubah (password diketik manual)
mysql -u <DB_USER> -p -S /var/lib/mysql/mysql.sock -e "SHOW COLUMNS FROM <Tabel>;" <DB_NAME>

# 3. Bandingkan dengan prisma/schema.prisma, lalu jalankan ALTER untuk yang kurang
mysql -u <DB_USER> -p -S /var/lib/mysql/mysql.sock -e "ALTER TABLE <Tabel> ADD COLUMN <kolom> <TIPE> NULL;" <DB_NAME>

# 4. Verifikasi, lalu restart app (lihat di atas)
mysql -u <DB_USER> -p -S /var/lib/mysql/mysql.sock -e "SHOW COLUMNS FROM <Tabel> LIKE '<kolom>';" <DB_NAME>
```

Mapping tipe Prisma → MySQL/MariaDB yang dipakai project ini:

| Prisma | SQL |
|---|---|
| `String` | `VARCHAR(191) NOT NULL` |
| `String @db.Text` | `TEXT NOT NULL` |
| `String?` | `VARCHAR(191) NULL` |
| `Int @default(1)` | `INT NOT NULL DEFAULT 1` |
| `Float` | `DOUBLE NOT NULL` |
| `Boolean @default(false)` | `TINYINT(1) NOT NULL DEFAULT 0` |
| `Json?` | `JSON NULL` (MariaDB tampil sebagai `longtext` — normal) |
| `DateTime @default(now())` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` |

Contoh nyata (galeri foto produk):
```sql
ALTER TABLE Product ADD COLUMN images JSON NULL AFTER image;
```

Tips:
- Kolom baru sebaiknya **nullable atau punya default** — aman untuk baris lama, tanpa data loss.
- Jangan `DROP COLUMN` / ubah tipe kolom tanpa backup dulu (hPanel → Databases → phpMyAdmin → Export).
- Kalau `mysql` CLI error `Access denied`, reset password DB user di hPanel sesuai `DATABASE_URL`.
- Alternatif tanpa SSH: jalankan SQL yang sama di **hPanel → Databases → phpMyAdmin → tab SQL**.

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

### `console.log` penuh "✓ Ready" berulang + `Error: Server is not running`
- Normal setelah restart: Passenger spawn beberapa worker (tiap worker log "Ready"), dan worker lama yang di-shutdown melempar `Server is not running`. Tidak berbahaya.
- Yang perlu diwaspadai: `PrismaClientKnownRequestError`, `Unknown column`, `P2022` → schema DB belum sync (lihat bagian perubahan schema di atas).

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
