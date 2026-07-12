# Resident Hotel Management

ระบบจัดการที่พักสำหรับงานจองห้อง อาหาร มินิบาร์ ค่าใช้จ่าย พนักงาน และรายงาน พัฒนาด้วย Next.js, Tailwind CSS, Supabase Postgres และ Prisma ORM

## เทคโนโลยีหลัก

- Next.js 15 และ React 19
- TypeScript
- Tailwind CSS 4 สำหรับ UI และ responsive layout ทั้งหมด
- Supabase Postgres สำหรับฐานข้อมูล
- Prisma ORM 7 และ PostgreSQL driver adapter
- Redux Toolkit สำหรับ client state ของ flow เดิม

## เริ่มต้นใช้งาน

ต้องใช้ Node.js 20.19 ขึ้นไป จากนั้นติดตั้ง dependency:

```bash
npm install
```

คัดลอก `.env.example` เป็น `.env` และใส่ connection string จากหน้า **Connect** ใน Supabase Dashboard:

```env
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://...:5432/postgres?sslmode=require"
NEXT_PUBLIC_PROMPTPAY_ID=""
```

- `DATABASE_URL` ใช้ Supavisor transaction pooler สำหรับ runtime ของ Next.js
- `DIRECT_URL` ใช้ direct connection หรือ session pooler สำหรับ Prisma migrations
- ห้ามนำรหัสผ่านหรือ connection string จริง commit เข้า Git

ดาวน์โหลด Server root certificate จาก **Supabase Dashboard → Database → Settings → SSL Configuration** แล้ววางไว้ที่:

```text
certs/prod-ca-2021.crt
```

Prisma runtime จะตรวจสอบ certificate ด้วย CA นี้ (`rejectUnauthorized: true`) ก่อนเปิด connection ทุกครั้ง

สร้าง Prisma Client และสร้างตารางครั้งแรก:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

เริ่ม development server:

```bash
npm run dev
```

เปิด `http://localhost:3000`

## คำสั่งสำคัญ

```bash
npm run lint          # ตรวจคุณภาพ source code
npm run build         # ตรวจ production build
npm run db:validate   # ตรวจ Prisma schema
npm run db:migrate    # สร้างและรัน migration ใน development
npm run db:deploy     # รัน migration ที่มีอยู่ใน production
npm run db:studio     # เปิด Prisma Studio
```

## โครงสร้างฐานข้อมูล

Schema เริ่มต้นอยู่ใน `prisma/schema.prisma` ครอบคลุม:

- โซน ประเภทห้อง และห้องพัก
- แพหลายหลังและการตรวจแพว่างตามช่วงวันที่
- ลูกค้ารายบุคคลและกรุ๊ปทัวร์
- การจองและห้องในรายการจอง
- อาหาร มินิบาร์ ออเดอร์ และรายการออเดอร์
- ค่าใช้จ่ายและการชำระเงิน
- พนักงาน ตารางกะ และค่าแรงรายชั่วโมง

Prisma ต้องถูกเรียกจาก Server Components, Server Actions หรือ Route Handlers เท่านั้น ห้าม import `lib/prisma.ts` ใน Client Components

## สถานะปัจจุบัน

UI หลักของรายการจอง รายละเอียดบิล สั่งอาหาร และตะกร้าใช้ Tailwind ทั้งหมดแล้ว ระบบรองรับราคาเหมากลุ่มแบบจำนวนคน × ราคาต่อหัว โดยห้อง แพ และอาหารหลักที่เลือกตอนสร้างกรุ๊ปรวมอยู่ในราคาเหมา ส่วนห้อง แพ และอาหารที่เพิ่มภายหลังถูกแยกเป็นค่าใช้จ่ายเพิ่ม แบบเดี่ยวคิดค่าบริการตามราคาจริงทั้งหมด ทุก flow บันทึกผ่าน Prisma Route Handlers ไปยัง Supabase ส่วนหน้าครัว แม่บ้าน พนักงาน และรายงานยังรอเชื่อม workflow จริงในขั้นถัดไป

ขั้นตอนเช็กเอาต์ต้องผ่านการตรวจห้องของแม่บ้านทุกห้องก่อน แม่บ้านบันทึกมินิบาร์ คราบเปื้อน ของชำรุด ของหาย และค่าใช้จ่ายอื่นลงบิลได้ เมื่อยืนยันการตรวจครบ Front Desk จึงเช็กเอาต์ได้ และห้องจะกลับเป็น `AVAILABLE` ทันทีโดยไม่ต้องรอการชำระเงิน
