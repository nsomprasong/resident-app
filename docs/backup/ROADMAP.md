# Roadmap

แผน Phase, Acceptance Criteria และ dependency โดยละเอียดอยู่ใน [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

## Current (0.1.0)

Core booking, room/raft availability, package/extra pricing, food order creation, partial payment/refund, housekeeping inspection และ close job ใช้งานระดับ prototype. Security boundary และ automated testing ยังไม่พร้อม production.

## Short Term — Phase 0–7

1. Phase 0 และ Phase 1 VERIFIED; งานถัดไปคือ Phase 2 Authorization/RBAC planning และ approval gate
2. Authentication, RBAC และ RLS/least privilege
3. Runtime validation/error contract/audit log
4. Financial calculation service และ payment/refund ledger ที่ตรวจสอบย้อนหลังได้
5. Unit/integration/E2E + CI build/lint/typecheck/test
6. DB invariants, concurrency tests และ pagination

## Medium Term — Phase 8–12

- Admin Settings สำหรับ Zone/RoomType/Room/Raft/Product/Catalog/Channel
- Kitchen order workflow
- Employee Schedule และ Wage
- Dashboard/Report/export
- Observability, backup/restore และ deployment runbook

## Long Term — Phase 13 และหลัง Production Baseline

- Invoice/receipt/tax/reconciliation
- Inventory/stock และ notification
- Caching/read model/background jobs ตามข้อมูลจริง
- Multi-property/tenant เฉพาะเมื่อมี requirement และ security design
- Analytics/load testing/disaster recovery maturity

ทุกรายการต้องผ่าน Requirement, ADR เมื่อจำเป็น, security review, test และ documentation update; roadmap ไม่ใช่คำยืนยันว่าจะมี feature หากยังไม่ได้อนุมัติ.
