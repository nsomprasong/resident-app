# Performance Guide

## Rendering

ใช้ Server Component เป็นค่าเริ่มต้นและลด client boundary. Data สำคัญควร server-fetch เพื่อ initial render; ใช้ Suspense/streaming เมื่อมีหลายส่วนอิสระ.

## Caching

กำหนด freshness ต่อข้อมูล: transaction/availability ใช้ no-store; Product, InspectionCatalog และ PaymentChannel อาจ cache/revalidate พร้อม invalidation. ห้าม cache ข้ามสิทธิ์ผู้ใช้.

## Database Query

ใช้ `select`, pagination และ index; หลีกเลี่ยง nested graph ใหญ่และ computation ซ้ำ. Query ใหม่ที่เสี่ยงต้องตรวจ explain plan/จำนวน row. Financial aggregate ควรรวมใน service/query กลาง.

## Component Size

แยกเมื่อเกินหนึ่ง responsibility, มี state/effect หลายกลุ่ม หรือ render section ใหญ่. ห้ามแยกเพียงเพื่อจำนวนบรรทัดโดยไม่เพิ่ม cohesion.

## Lazy Loading

ใช้ dynamic import กับ UI หนัก/ไม่อยู่ initial viewport; รูปใช้ `next/image`; preload เฉพาะ critical resource. วัด bundle ก่อนและหลัง.

## Performance Definition of Done

ไม่มี query unbounded, ไม่มี obvious N+1, pagination พร้อม dataset โต, cache policy ระบุชัด, loading/empty/error ไม่ block ทั้งหน้า และไม่มี regression จาก baseline ที่ตกลง.
