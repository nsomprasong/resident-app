# Phase 21 — ระบบจัดตารางงาน ลงเวลา และสรุปค่าจ้างแบบยืดหยุ่น

## สถานะ

```text
Phase: 21
Status: READY
Priority: HIGH
Scope: Employee Scheduling + Attendance + Payroll Summary
```

ให้ทำงานตามเอกสารนี้จนจบเฟส โดยไม่หยุดขออนุมัติในงานย่อย เว้นแต่พบความเสี่ยงที่อาจทำให้ข้อมูลเดิมสูญหาย หรือจำเป็นต้องเปลี่ยนโครงสร้างฐานข้อมูลเดิมแบบทำลายข้อมูล

---

## 1. เป้าหมายของเฟส

ปรับระบบจัดตารางงานให้รองรับการทำงานจริงของรีสอร์ต ได้แก่:

- จัดกะเป็นรายครึ่งเดือน
- เปลี่ยนกะระหว่างรอบ
- เข้างานแทนพนักงานคนอื่น
- ทำงานควบสองกะหรือหลายกะในวันเดียว
- เพิ่มกะพิเศษนอกตาราง
- เชื่อมตารางกะจริงกับการลงเวลาเข้า–ออก
- คำนวณขาด ลา มาสาย กลับก่อน และ OT
- สร้างสรุปค่าจ้างก่อนจ่าย
- ให้ผู้มีสิทธิ์ตรวจสอบและปรับยอดได้
- เก็บเหตุผลและประวัติการแก้ไข
- ล็อกรอบหลังอนุมัติหรือจ่ายเงินแล้ว

ระบบต้องยืดหยุ่น แต่หน้าจอต้องเรียบง่าย ดูแล้วเข้าใจทันที และไม่เพิ่มเมนูที่ซ้ำซ้อน

---

## 2. หลักการสำคัญ

### 2.1 แยก “แม่แบบกะ” ออกจาก “ตารางกะจริง”

ระบบเดิมที่เพิ่มและแก้ไขกะได้แล้วให้คงไว้เป็น `ShiftTemplate`

ตัวอย่าง:

```text
กะเช้า  06:00–14:00
กะบ่าย  14:00–22:00
กะดึก   22:00–06:00
```

แม่แบบกะใช้สำหรับสร้างตารางเริ่มต้นเท่านั้น

ห้ามใช้ `employee.shiftId` หรือกะประจำของพนักงานเป็นข้อมูลตัดสินขาด ลา มาสาย หรือคิดเงินโดยตรง

ข้อมูลที่ใช้จริงต้องมาจาก `ScheduledShift` รายพนักงาน รายวัน

### 2.2 ใช้ ScheduledShift เป็นศูนย์กลาง

ข้อมูลต้องเชื่อมกันตามลำดับ:

```text
ShiftTemplate
    ↓
ScheduledShift รายวัน
    ↓
AttendanceSession
    ↓
Attendance Summary
    ↓
Payroll Summary
```

### 2.3 ทำแบบ Additive และไม่กระทบระบบเดิม

- ห้ามแก้ migration เก่า
- ห้ามลบข้อมูลกะเดิม
- ห้ามลบ field หรือ API เดิมทันที
- ห้ามทำลายระบบ Employee, Auth, RBAC และ Permission ที่ทำงานแล้ว
- เพิ่มตารางและ field ใหม่เท่าที่จำเป็น
- รักษาหน้าเพิ่มกะและแก้ไขกะเดิมให้ใช้งานได้
- หากมีระบบลงเวลาเดิม ให้ปรับเชื่อมกับ ScheduledShift โดยมี fallback ที่ปลอดภัย
- ห้าม Refactor ใหญ่ทั้งโปรเจกต์

---

## 3. ขอบเขตการอ่านไฟล์

ก่อนเริ่ม ให้ตรวจเฉพาะไฟล์ที่เกี่ยวข้องกับ:

- Employee
- Shift และ Shift Template
- Schedule
- Attendance / Time Clock
- Leave
- OT
- Payroll หรือค่าจ้าง
- Employee wage settings
- RBAC และ Permissions
- Prisma schema และ migration
- API และ UI ที่เกี่ยวข้อง
- Tests ที่เกี่ยวข้อง
- `docs/CURRENT_TASK.md`

ห้ามสแกนทั้งโปรเจกต์โดยไม่จำเป็น

ให้ค้นหาคำสำคัญ:

```text
Shift
Schedule
Attendance
ClockIn
ClockOut
Leave
Overtime
Payroll
Wage
Salary
Employee
WorkShift
```

---

## 4. โครงสร้างระบบที่ต้องได้

ระบบบริหารพนักงานส่วนนี้ให้รวมเป็น 4 หน้าหลัก:

```text
1. แม่แบบกะ
2. ตารางงาน
3. เวลาเข้า–ออก
4. สรุปค่าจ้าง
```

หากระบบเดิมมีเมนูซ้ำ ให้ยุบรวมโดยไม่เปลี่ยน route ที่มีผู้ใช้งานอยู่ทันที สามารถใช้ redirect หรือ compatibility layer ได้

---

# ส่วน A — แม่แบบกะ

## 5. แม่แบบกะ

คงหน้าเพิ่มกะและแก้ไขกะเดิมไว้ และตรวจให้รองรับข้อมูลอย่างน้อย:

```text
ชื่อกะ
เวลาเริ่ม
เวลาเลิก
เวลาพัก
ชั่วโมงทำงานมาตรฐาน
นาทีผ่อนผันก่อนนับว่าสาย
ข้ามวันหรือไม่
สถานะใช้งาน
```

ตัวอย่าง:

```text
กะเช้า
เริ่ม 06:00
เลิก 14:00
พัก 60 นาที
ผ่อนผัน 10 นาที
```

### กฎสำคัญ

- การแก้แม่แบบกะต้องไม่แก้ ScheduledShift ในอดีต
- เมื่อสร้าง ScheduledShift ให้บันทึกเวลาเริ่มและเวลาสิ้นสุดแบบ snapshot
- หากแม่แบบกะถูกปิดใช้งาน ตารางเก่ายังต้องดูได้
- ห้ามลบแม่แบบกะที่เคยถูกใช้งาน ให้เปลี่ยนเป็น inactive

---

# ส่วน B — ตารางงาน

## 6. รอบตารางงาน

เพิ่ม `SchedulePeriod` เพื่อแบ่งรอบจัดตาราง

ค่าเริ่มต้นที่เหมาะกับรีสอร์ต:

```text
รอบวันที่ 1–15
รอบวันที่ 16–วันสุดท้ายของเดือน
```

ต้องรองรับช่วงวันที่กำหนดเองในอนาคต แต่ UI ค่าเริ่มต้นให้ใช้ครึ่งเดือน

สถานะ:

```text
DRAFT       ฉบับร่าง
PUBLISHED   ประกาศแล้ว
CLOSED      ปิดรอบ
```

ข้อมูลหลัก:

```text
id
name
startDate
endDate
status
publishedAt
closedAt
createdBy
updatedBy
createdAt
updatedAt
```

### พฤติกรรม

- DRAFT: ผู้มีสิทธิ์แก้ได้เต็มที่
- PUBLISHED: พนักงานเห็นตาราง และใช้เป็นฐานลงเวลา
- CLOSED: ห้ามแก้โดยตรง ต้องสร้าง adjustment หรือปลดล็อกพร้อมเหตุผล

---

## 7. ตารางกะจริงรายวัน

เพิ่ม `ScheduledShift` เป็นข้อมูลหลักสำหรับการทำงานจริง

ข้อมูลแนะนำ:

```text
id
schedulePeriodId
employeeId
shiftTemplateId nullable
workDate
plannedStart
plannedEnd
breakMinutes
assignmentType
status
replacedEmployeeId nullable
sourceScheduledShiftId nullable
note nullable
createdBy
updatedBy
createdAt
updatedAt
```

### assignmentType

```text
NORMAL          กะปกติ
REPLACEMENT     เข้างานแทน
DOUBLE_SHIFT    ทำควบกะ
EXTRA_SHIFT     กะพิเศษ
```

### status

```text
SCHEDULED
CANCELLED
COMPLETED
ABSENT
LEAVE
```

### ข้อกำหนด

- หนึ่งพนักงานหนึ่งวันมี ScheduledShift ได้หลายรายการ
- ต้องรองรับกะข้ามวัน
- เวลาของ ScheduledShift ต้องเป็น snapshot ไม่ขึ้นกับการแก้ ShiftTemplate ภายหลัง
- การยกเลิกกะให้เปลี่ยนสถานะ ห้ามลบข้อมูลที่ประกาศแล้ว
- ScheduledShift ทุกตัวต้องเก็บผู้สร้างและผู้แก้ไข

---

## 8. UI ตารางงาน

สร้างหน้าตารางแบบครึ่งเดือน

รูปแบบหลัก:

| พนักงาน | 1 | 2 | 3 | 4 | ... | 15 |
|---|---|---|---|---|---|---|
| สมชาย | เช้า | เช้า | หยุด | บ่าย | ... | ดึก |
| สมหญิง | บ่าย | ดึก | ดึก | หยุด | ... | เช้า |

### ในแต่ละช่องให้แสดงแบบสั้น

```text
เช้า
บ่าย
ดึก
แทน
ควบ
OT
ลา
หยุด
```

คลิกช่องเพื่อเปิด Drawer หรือ Modal ขนาดเล็ก ไม่เปิดฟอร์มยาวเต็มหน้า

### การทำงานที่ต้องมี

- เพิ่มกะ
- เปลี่ยนกะ
- ลบหรือยกเลิกกะ
- เพิ่มกะควบ
- กำหนดผู้ทำแทน
- กำหนดกะพิเศษ
- กำหนดวันหยุด
- กำหนดลา
- คัดลอกตาราง
- ประกาศตาราง
- ปิดรอบ

---

## 9. วิธีสร้างตารางให้ใช้ง่าย

ต้องมีอย่างน้อย 3 วิธี

### 9.1 ใช้กะประจำเป็นค่าเริ่มต้น

ปุ่ม:

```text
สร้างจากกะประจำ
```

ให้เลือกพนักงานหลายคนหรือทั้งหมด แล้วสร้าง ScheduledShift สำหรับรอบนั้น

กะประจำเป็นเพียงต้นแบบ หลังสร้างแล้ว ScheduledShift ต้องแก้แยกได้

### 9.2 คัดลอกจากรอบก่อน

ปุ่ม:

```text
คัดลอกจากรอบก่อน
```

ต้องเลือกได้ว่าจะ:

- คัดลอกทุกคน
- คัดลอกเฉพาะพนักงานที่เลือก
- คัดลอกเฉพาะบางวัน

ต้องไม่คัดลอกรายการลา ขาด หรือ Attendance จากรอบเก่า

### 9.3 แก้รายวัน

คลิกช่องของพนักงานและวันที่ แล้วเลือกกะได้ทันที

รองรับเลือกหลายช่องแล้วกำหนดกะครั้งเดียว เพื่อลดจำนวนคลิก

---

## 10. เปลี่ยนกะ

เมื่อเปลี่ยนกะหลังประกาศแล้ว ต้องเก็บประวัติ

เพิ่ม `ScheduleChangeLog` หรือใช้ AuditLog เดิม หากรองรับครบ

ข้อมูลอย่างน้อย:

```text
scheduledShiftId
changeType
beforeData
afterData
reason
changedBy
changedAt
```

UI ต้องขอเหตุผลเมื่อแก้ตารางที่ประกาศแล้ว

ตัวอย่าง:

```text
เดิม: กะเช้า 06:00–14:00
ใหม่: กะบ่าย 14:00–22:00
เหตุผล: สลับกะกับพนักงานอีกคน
```

---

## 11. เข้างานแทน

ต้องเก็บข้อมูลทั้ง:

- เจ้าของกะเดิม
- ผู้ที่มาทำแทน
- เหตุผล
- กะต้นทาง

แนวทาง:

```text
ScheduledShift เดิมของสมชาย → status CANCELLED หรือมีสถานะ REPLACED
สร้าง ScheduledShift ใหม่ของสมปอง → assignmentType REPLACEMENT
replacedEmployeeId = สมชาย
sourceScheduledShiftId = กะเดิม
```

ห้ามเปลี่ยน `employeeId` ของกะเดิมทับโดยไม่มีประวัติ

ผลลัพธ์:

- เจ้าของกะเดิมถูกสรุปลา ขาด หรือเหตุผลอื่นตามข้อมูลจริง
- ผู้ทำแทนได้ค่าจ้างตามกะที่ทำจริง
- ตารางแสดงป้าย “แทน”
- Payroll แยกจำนวนกะทำแทนได้

---

## 12. ทำงานควบกะ

ต้องรองรับ ScheduledShift หลายรายการในวันเดียว

ตัวอย่าง:

```text
06:00–14:00 กะเช้า
14:00–22:00 กะบ่าย
```

ระบบต้องตรวจและแจ้งเตือน:

- เวลากะชนกัน
- ทำงานต่อเนื่องนานเกินค่าที่กำหนด
- ไม่มีช่วงพัก
- กะข้ามวันชนกะถัดไป
- มีตารางมากกว่าหนึ่งกะในวันเดียว

คำเตือนต้องไม่บังคับห้ามในทุกกรณี ผู้มีสิทธิ์สามารถยืนยันพร้อมเหตุผลได้

ตัวอย่าง:

```text
พนักงานจะทำงานต่อเนื่อง 16 ชั่วโมง
[ยกเลิก] [ยืนยันและบันทึกเหตุผล]
```

---

# ส่วน C — เวลาเข้า–ออก

## 13. Attendance Session

การลงเวลาต้องผูกกับ ScheduledShift จริง ไม่ใช่กะประจำ

เพิ่มหรือปรับ `AttendanceSession` ให้รองรับ:

```text
id
employeeId
scheduledShiftId nullable
clockInAt
clockOutAt nullable
clockInLatitude
clockInLongitude
clockOutLatitude
clockOutLongitude
clockInDistanceMeters
clockOutDistanceMeters
source
status
note
createdAt
updatedAt
```

### source

```text
MOBILE
ADMIN
IMPORT
```

### status

```text
OPEN
COMPLETED
PENDING_REVIEW
REJECTED
```

### กฎ

- ลงเวลาด้วยมือถือภายในรัศมี 50 เมตรตาม requirement เดิม
- พนักงานหนึ่งคนมี AttendanceSession หลายรายการในวันเดียวได้
- ต้องรองรับพักแล้วกลับมาทำงานต่อ
- ต้องรองรับทำควบกะ
- Attendance ต้องผูกกับ ScheduledShift ที่เหมาะสม
- ถ้าไม่สามารถผูกได้ ให้เป็น `PENDING_REVIEW`

---

## 14. การเลือกกะตอนลงเวลา

เมื่อพนักงานกดเข้า:

```text
1. ตรวจ Session และ Employee
2. ตรวจพิกัด
3. ค้นหา ScheduledShift ที่ใกล้เวลาเริ่มมากที่สุด
4. หากมีเพียงหนึ่งกะ ให้เลือกอัตโนมัติ
5. หากมีหลายกะที่เป็นไปได้ ให้แสดงให้พนักงานเลือก
6. หากไม่มีกะ ให้สร้าง Attendance แบบนอกตารางและรอตรวจสอบ
```

พนักงานต้องเห็นข้อความง่าย ๆ:

```text
กำลังเข้างาน: กะเช้า 06:00–14:00
```

หากทำควบกะ:

```text
เลือกกะที่ต้องการลงเวลา
- กะเช้า 06:00–14:00
- กะบ่าย 14:00–22:00
```

---

## 15. ลงเวลานอกตาราง

ถ้าพนักงานลงเวลาแต่ไม่มี ScheduledShift:

```text
AttendanceSession.status = PENDING_REVIEW
scheduledShiftId = null
```

ผู้มีสิทธิ์ต้องเลือกได้:

```text
ผูกกับกะที่มีอยู่
สร้างกะพิเศษ
นับเป็น OT
ไม่นับเวลานี้
```

ห้ามนำ Attendance นอกตารางไปคิดเงินอัตโนมัติก่อนอนุมัติ

---

## 16. การสรุป Attendance

เพิ่ม service กลางสำหรับคำนวณผลรายกะหรือรายวัน

ผลลัพธ์อย่างน้อย:

```text
scheduledMinutes
workedMinutes
lateMinutes
earlyLeaveMinutes
overtimeSuggestedMinutes
approvedOvertimeMinutes
absenceStatus
leaveType
reviewStatus
```

สถานะที่แสดง:

```text
ปกติ
มาสาย
กลับก่อน
ขาด
ลา
ทำแทน
ควบกะ
OT
นอกตาราง
ไม่มีเวลาออก
รอตรวจสอบ
```

หนึ่งวันสามารถมีหลายสถานะพร้อมกันได้

---

## 17. กฎขาด ลา มาสาย และกลับก่อน

### มาสาย

คำนวณจาก:

```text
clockInAt > plannedStart + graceMinutes
```

ตัวอย่าง:

```text
เริ่มงาน 08:00
ผ่อนผัน 10 นาที
เข้า 08:08 = ไม่สาย
เข้า 08:15 = สาย 5 นาที
```

### กลับก่อน

คำนวณจาก:

```text
clockOutAt < plannedEnd
```

ต้องหักเวลาพักตามกฎที่กำหนด

### ขาด

นับเป็นขาดเมื่อ:

- มี ScheduledShift
- ไม่มีเวลาทำงานที่ได้รับรอง
- ไม่มีใบลาที่อนุมัติ
- ไม่มีรายการทำแทนหรือการยกเลิกกะที่ถูกต้อง

### ลา

รองรับประเภท:

```text
ลาป่วย
ลากิจ
ลาพักร้อน
ลาไม่รับค่าจ้าง
อื่น ๆ
```

แต่ละประเภทต้องระบุได้ว่า:

```text
ได้รับค่าจ้าง
ไม่ได้รับค่าจ้าง
หักบางส่วน
```

หากระบบลายังไม่มี ให้ทำเฉพาะโครงสร้างขั้นต่ำที่จำเป็นกับ Attendance และ Payroll ไม่ขยายเป็นระบบ HR ขนาดใหญ่

---

## 18. OT

รองรับ OT 3 แหล่ง:

```text
1. กำหนดล่วงหน้าในตาราง
2. ระบบเสนอจากเวลาทำงานเกินกะ
3. ผู้มีสิทธิ์เพิ่มหรือแก้ภายหลัง
```

ห้ามนำเวลาที่เกินกะไปคิด OT อัตโนมัติทันที

Workflow:

```text
เวลาทำงานเกินกะ
→ ระบบสร้าง OT ที่เสนอ
→ ผู้มีสิทธิ์ตรวจ
→ อนุมัติจำนวนชั่วโมง
→ ส่งไป Payroll
```

เพิ่ม `OvertimeRecord` หรือปรับตารางเดิมให้มี:

```text
employeeId
scheduledShiftId nullable
attendanceSessionId nullable
workDate
suggestedMinutes
approvedMinutes
ratePerHour
status
reason
approvedBy
approvedAt
```

สถานะ:

```text
SUGGESTED
APPROVED
REJECTED
ADJUSTED
```

---

## 19. หน้าตรวจเวลา

หน้า “เวลาเข้า–ออก” ให้เน้นรายการที่ต้องตรวจ ไม่แสดงข้อมูลทุกอย่างจนรก

แท็บหรือ Filter:

```text
วันนี้
ต้องตรวจสอบ
มาสาย
ไม่มีเวลาออก
นอกตาราง
ขาด
ลา
OT
ทั้งหมด
```

ตัวอย่างรายการ:

```text
สมชาย · 8 ก.ค.
กะเช้า 06:00–14:00
เข้า 06:04
ไม่มีเวลาออก

[แก้เวลา] [ใช้เวลาเลิกกะ] [ไม่นับวันทำงาน]
```

ผู้มีสิทธิ์แก้ไขเวลาได้ แต่ต้อง:

- ระบุเหตุผล
- เก็บค่าก่อนและหลัง
- เก็บผู้แก้ไข
- เก็บเวลาแก้ไข

---

## 20. Attendance Adjustment

ห้ามแก้ค่าดิบโดยไม่มีประวัติ

เพิ่ม `AttendanceAdjustment` หรือใช้ AuditLog เดิมหากเพียงพอ

ข้อมูล:

```text
attendanceSessionId
fieldName หรือ adjustmentType
beforeValue
afterValue
reason
adjustedBy
adjustedAt
```

ประเภทตัวอย่าง:

```text
CLOCK_IN
CLOCK_OUT
LATE_MINUTES
EARLY_LEAVE
WORKED_MINUTES
ABSENCE
OVERTIME
```

---

# ส่วน D — สรุปค่าจ้าง

## 21. รอบจ่ายเงิน

เพิ่ม `PayrollPeriod`

รองรับ:

```text
ครึ่งเดือน
รายเดือน
ช่วงวันที่กำหนดเอง
```

ข้อมูลหลัก:

```text
id
name
startDate
endDate
paymentDate nullable
status
calculatedAt
approvedAt
paidAt
lockedAt
createdBy
approvedBy
createdAt
updatedAt
```

สถานะ:

```text
DRAFT
CALCULATED
REVIEWING
APPROVED
PAID
LOCKED
```

---

## 22. Workflow สรุปค่าจ้าง

```text
สร้างรอบจ่ายเงิน
→ ดึง ScheduledShift
→ ดึง Attendance ที่ได้รับรอง
→ ดึง Leave
→ ดึง OT ที่อนุมัติ
→ คำนวณยอดแนะนำ
→ ผู้มีสิทธิ์ตรวจสอบ
→ เพิ่ม/ลดรายการปรับยอด
→ อนุมัติ
→ บันทึกว่าจ่ายแล้ว
→ ล็อกรอบ
```

ห้ามคำนวณจากกะประจำของ Employee

ต้องคำนวณจากตารางกะจริงและ Attendance ที่ผ่านการตรวจแล้วเท่านั้น

---

## 23. Payroll Employee Summary

เพิ่ม `PayrollEmployeeSummary`

ข้อมูลแนะนำ:

```text
id
payrollPeriodId
employeeId
employmentTypeSnapshot
baseWageSnapshot
overtimeRateSnapshot
scheduledShiftCount
workedShiftCount
workedMinutes
absenceCount
paidLeaveCount
unpaidLeaveCount
lateMinutes
earlyLeaveMinutes
approvedOvertimeMinutes
replacementShiftCount
doubleShiftCount
baseAmount
overtimeAmount
deductionAmount
adjustmentAmount
netAmount
status
calculatedAt
approvedAt
```

### Snapshot

ต้อง snapshot ค่าแรงและอัตรา OT ณ ตอนคำนวณ เพื่อป้องกันการแก้ค่าแรงปัจจุบันแล้วกระทบรอบเก่า

---

## 24. หลักการคำนวณ

ให้ใช้ service กลาง ไม่กระจายสูตรใน UI และ API หลายไฟล์

ต้องรองรับพนักงาน:

```text
รายวัน
รายเดือน
```

สูตรต้องอ่านค่าจาก employee employment settings ที่มีอยู่ และไม่ hardcode อัตราทางธุรกิจใน component

ก่อน implement ให้ตรวจระบบค่าแรงเดิมว่ามี field ใดอยู่แล้ว และ reuse เท่าที่ทำได้

### รายวัน

ตัวอย่างแนวทาง:

```text
ค่าจ้างพื้นฐาน = จำนวนวันที่ได้รับรอง × ค่าแรงรายวัน
```

### รายเดือน

ตัวอย่างแนวทาง:

```text
เงินเดือนฐาน
- รายการหักจากขาดหรือลาไม่รับค่าจ้าง
+ OT
+ รายการเพิ่ม
- รายการหัก
```

ห้ามกำหนดสูตรหักมาสายแบบตายตัว หากยังไม่มี requirement ชัดเจน

ให้ระบบคำนวณ `lateMinutes` และแสดงให้ผู้มีสิทธิ์ตัดสินใจหรือใช้ค่าตั้งค่าที่มีอยู่

---

## 25. หน้าสรุปค่าจ้าง

หน้าแรกแสดงเป็นตารางสั้น:

| พนักงาน | วันทำงาน | ขาด | ลา | สาย | OT | เพิ่ม/หัก | สุทธิ | สถานะ |
|---|---:|---:|---:|---:|---:|---:|---:|---|

คลิกพนักงานเพื่อเปิดรายละเอียด

ตัวอย่างรายละเอียด:

```text
ค่าจ้างพื้นฐาน             8,000 บาท
วันทำงาน                      14 วัน
ขาด                             1 วัน
ลาป่วยได้รับค่าจ้าง             1 วัน
ลาไม่รับค่าจ้าง                 0 วัน
มาสายรวม                      42 นาที
กลับก่อนรวม                    15 นาที
OT ที่อนุมัติ                   12 ชม.
กะทำแทน                         2 กะ
กะควบ                           1 ครั้ง
รายการเพิ่ม                    500 บาท
รายการหัก                     -300 บาท
---------------------------------------
ยอดสุทธิ                     9,240 บาท
```

ปุ่ม:

```text
ดูรายละเอียด
ปรับยอด
อนุมัติ
```

---

## 26. ผู้มีสิทธิ์แก้ไขสรุปขาด ลา มาสาย และ OT

ผู้มีสิทธิ์ต้องสามารถปรับข้อมูลที่ใช้คำนวณได้ แต่ห้ามเขียนทับค่าที่ระบบคำนวณโดยไม่มีประวัติ

### ต้องรองรับการปรับ

```text
จำนวนวันขาดที่ใช้คิดเงิน
จำนวนวันลาที่ได้รับค่าจ้าง
จำนวนวันลาไม่รับค่าจ้าง
นาทีมาสายที่ใช้หัก
นาทีกลับก่อนที่ใช้หัก
จำนวน OT ที่อนุมัติ
รายการเพิ่มเงิน
รายการหักเงิน
```

### รูปแบบที่แนะนำ

แสดงสองค่า:

```text
ค่าที่ระบบคำนวณ
ค่าที่อนุมัติให้ใช้จ่ายจริง
```

ตัวอย่าง:

```text
มาสายจากระบบ: 42 นาที
ใช้หักจริง: 20 นาที
เหตุผล: อนุโลมเนื่องจากฝนตกหนัก
```

ห้ามลบหรือแก้ค่าที่ระบบคำนวณต้นฉบับ

---

## 27. Payroll Adjustment

เพิ่ม `PayrollAdjustment`

ข้อมูล:

```text
id
payrollEmployeeSummaryId
type
category
amount
quantity nullable
unit nullable
reason
createdBy
createdAt
```

### type

```text
ADD
DEDUCT
OVERRIDE
```

### category

```text
ABSENCE
LEAVE
LATE
EARLY_LEAVE
OVERTIME
REPLACEMENT
DOUBLE_SHIFT
BONUS
OTHER
```

ตัวอย่าง:

```text
เพิ่ม 500 บาท
เหตุผล: ค่าทำงานแทนพิเศษ
```

หรือ:

```text
ลด 200 บาท
เหตุผล: ปรับ OT จาก 4 ชั่วโมงเป็น 2 ชั่วโมง
```

ยอดสุทธิ:

```text
ยอดที่ระบบคำนวณ
+/- รายการปรับ
= ยอดสุทธิ
```

---

## 28. การอนุมัติและล็อกรอบ

เมื่อ PayrollPeriod เป็น `APPROVED`, `PAID` หรือ `LOCKED`:

- ห้ามคำนวณทับอัตโนมัติ
- ห้ามแก้ ScheduledShift ที่เกี่ยวข้องโดยตรง
- ห้ามแก้ Attendance ที่เกี่ยวข้องโดยตรง
- ห้ามแก้ OT ที่อนุมัติแล้วโดยไม่มีการปลดล็อก
- การปลดล็อกต้องใช้ Permission และระบุเหตุผล
- เก็บ Audit Log

หากต้องแก้หลังจ่ายแล้ว ให้สร้างรายการปรับในรอบถัดไปเป็นค่าเริ่มต้น แทนการแก้ประวัติเดิม

---

# ส่วน E — สิทธิ์และความปลอดภัย

## 29. Permissions

เพิ่ม Permission โดยใช้ระบบ RBAC เดิม:

```text
schedule.view
schedule.manage
schedule.publish
schedule.close

attendance.view
attendance.adjust
attendance.approve

payroll.view
payroll.calculate
payroll.adjust
payroll.approve
payroll.mark_paid
payroll.unlock
```

ภาษาไทย:

```text
ดูตารางงาน
จัดตารางงาน
ประกาศตารางงาน
ปิดรอบตารางงาน

ดูเวลาเข้าออก
แก้ไขเวลาเข้าออก
อนุมัติเวลาเข้าออก

ดูสรุปค่าจ้าง
คำนวณค่าจ้าง
ปรับยอดค่าจ้าง
อนุมัติค่าจ้าง
บันทึกว่าจ่ายแล้ว
ปลดล็อกรอบค่าจ้าง
```

ต้องเพิ่มคำแปลภาษาไทยในหน้าจัดการ Role/Permission ตามมาตรฐานระบบเดิม

ห้ามใช้ role name แบบ hardcode ใน API ให้ตรวจ permission ตามระบบ RBAC ปัจจุบัน

---

## 30. Audit Log

ใช้ AuditLog เดิมถ้ามี หากไม่มีให้สร้างแบบกลางและใช้เฉพาะเหตุการณ์สำคัญ:

```text
เปลี่ยนกะหลังประกาศ
ยกเลิกกะ
จัดผู้ทำแทน
ยืนยันกะควบ
แก้เวลาเข้าออก
อนุมัติ OT
ปรับขาด ลา มาสาย
เพิ่มหรือลดค่าจ้าง
อนุมัติ Payroll
ปลดล็อก Payroll
บันทึกว่าจ่ายแล้ว
```

เก็บ:

```text
entityType
entityId
action
beforeData
afterData
reason
performedBy
performedAt
```

---

# ส่วน F — Database และ Migration

## 31. Prisma Models

ก่อนเพิ่ม model ให้ตรวจ model เดิมและ reuse ให้มากที่สุด

โครงสร้างเป้าหมายโดยรวม:

```text
ShiftTemplate
SchedulePeriod
ScheduledShift
ScheduleChangeLog หรือ AuditLog
AttendanceSession
AttendanceAdjustment
LeaveRequest หรือ LeaveRecord
OvertimeRecord
PayrollPeriod
PayrollEmployeeSummary
PayrollAdjustment
PayrollApproval หรือใช้ข้อมูลใน PayrollPeriod
```

ไม่จำเป็นต้องสร้างทุกตารางแยก หาก model เดิมรองรับอย่างเหมาะสม แต่ต้องรักษาความสามารถตามเอกสารนี้

---

## 32. Migration Safety

Migration ต้องเป็นแบบ additive

อนุญาต:

```text
CREATE TABLE
ADD COLUMN
ADD INDEX
ADD FOREIGN KEY
ADD ENUM
```

หลีกเลี่ยง:

```text
DROP TABLE
DROP COLUMN
DELETE DATA
RENAME ที่ทำให้ระบบเดิมพัง
ALTER เป็น NOT NULL ทันทีเมื่อข้อมูลเก่ายังไม่ครบ
```

หากเพิ่ม field ให้ข้อมูลเดิม ต้อง nullable หรือมี safe default ก่อน

ห้ามแก้ migration ที่ apply แล้ว

---

# ส่วน G — API และ Services

## 33. Service Layer

แยก logic ธุรกิจออกจาก UI และ route อย่างน้อย:

```text
schedule service
attendance matching service
attendance summary service
overtime service
payroll calculation service
payroll locking service
```

ไม่จำเป็นต้องสร้างโครงสร้างซับซ้อน แต่ห้ามใส่สูตรทั้งหมดไว้ใน component

ใช้ transaction เมื่อแก้หลายตารางที่ต้องสำเร็จพร้อมกัน

---

## 34. Validation

ใช้ validation กลาง เช่น Zod

ตรวจอย่างน้อย:

- ช่วงวันที่ของรอบตาราง
- วันที่ไม่ซ้อนรอบอย่างผิดปกติ
- plannedStart < plannedEnd โดยรองรับข้ามวัน
- Employee active
- ShiftTemplate active
- การจัดกะชนกัน
- Attendance clockOut มากกว่า clockIn
- OT ไม่ติดลบ
- Adjustment ต้องมีเหตุผล
- Payroll ที่ล็อกแล้วห้ามแก้
- จำนวนเงินต้องเป็นตัวเลขที่ถูกต้อง

ข้อความ Error ต้องเป็นภาษาไทย และห้ามแสดง Prisma/Supabase error ดิบให้ผู้ใช้เห็น

---

# ส่วน H — UI/UX

## 35. หลักการออกแบบ

- ใช้ DESIGN.md และ token กลางของระบบ
- Mobile responsive
- ลด Modal ยาว
- ใช้ Drawer/Popover สำหรับการแก้ช่องตาราง
- แสดงข้อมูลสำคัญก่อน รายละเอียดกดขยาย
- ใช้ Badge สั้นสำหรับสถานะ
- ไม่ใส่ปุ่มจำนวนมากพร้อมกันในแต่ละช่อง
- ต้องดูตารางครึ่งเดือนได้ง่าย
- ใช้สีตาม semantic token กลาง ห้าม hardcode สีใหม่กระจายหลายไฟล์
- มี Skeleton loading ตามมาตรฐานระบบ
- มี Empty state และ Error state

---

## 36. Dashboard ย่อยในแต่ละหน้า

### ตารางงาน

แสดง:

```text
พนักงานทั้งหมด
จัดกะแล้ว
ยังไม่มีกะ
กะควบ
กะทำแทน
รายการเตือน
```

### เวลาเข้า–ออก

แสดง:

```text
เข้างานแล้ว
ยังไม่เข้า
มาสาย
ไม่มีเวลาออก
นอกตาราง
รอตรวจสอบ
```

### สรุปค่าจ้าง

แสดง:

```text
พนักงานในรอบ
รอตรวจสอบ
ยอดค่าจ้างรวม
OT รวม
รายการปรับเพิ่ม
รายการปรับลด
```

---

# ส่วน I — Tests

## 37. Unit Tests

เพิ่มหรือแก้ Test อย่างน้อย:

1. สร้าง ScheduledShift จาก ShiftTemplate
2. แก้ ShiftTemplate แล้ว ScheduledShift เก่าไม่เปลี่ยน
3. พนักงานมีสองกะในวันเดียวได้
4. ตรวจพบกะชนกัน
5. กะข้ามวันคำนวณเวลาได้
6. จัดผู้ทำแทนแล้วเก็บกะเดิม
7. Attendance ผูกกับ ScheduledShift ที่ใกล้ที่สุด
8. Attendance นอกตารางเป็น PENDING_REVIEW
9. คำนวณมาสายหลังหัก graceMinutes
10. คำนวณกลับก่อน
11. มีตารางแต่ไม่มี Attendance และไม่มีลาเป็นขาด
12. OT ที่เสนอไม่เข้า Payroll จนกว่าจะอนุมัติ
13. Payroll ใช้ค่าจ้างแบบ snapshot
14. Payroll Adjustment เปลี่ยนยอดสุทธิแต่ไม่เปลี่ยนค่าต้นฉบับ
15. Payroll ล็อกแล้วแก้ไม่ได้
16. ผู้ไม่มี permission ปรับเวลาไม่ได้
17. ผู้ไม่มี permission ปรับเงินไม่ได้

---

## 38. Integration/Regression Tests

ตรวจอย่างน้อย:

1. หน้าเพิ่มและแก้ไขแม่แบบกะเดิมยังใช้งานได้
2. Employee และ Auth เดิมไม่เสีย
3. RBAC เดิมยังทำงาน
4. สร้างรอบ 1–15 ได้
5. สร้างตารางจากกะประจำได้
6. คัดลอกรอบก่อนได้
7. เปลี่ยนกะหลังประกาศต้องมีเหตุผล
8. ทำงานแทนได้
9. ทำควบกะได้
10. ลงเวลาด้วยมือถือและผูกกะได้
11. ลงเวลานอกตารางเข้าสู่รายการตรวจสอบ
12. แก้เวลาแล้วมี Audit Log
13. คำนวณขาด ลา มาสาย OT ได้
14. ผู้มีสิทธิ์ปรับยอดได้
15. อนุมัติและล็อกรอบได้
16. ระบบเก่าที่ไม่เกี่ยวข้องไม่ถูกกระทบ

---

# ส่วน J — ลำดับการทำงานในเฟส

## 39. Task 21.1 — ตรวจระบบเดิมและออกแบบ Mapping

- ตรวจ model, route, component และ permission เดิม
- ระบุสิ่งที่ reuse
- ระบุ compatibility risk
- อัปเดต `docs/CURRENT_TASK.md`
- ห้ามแก้โค้ดกว้างเกินจำเป็น

## 40. Task 21.2 — Schema และ Migration

- เพิ่ม SchedulePeriod
- เพิ่ม ScheduledShift
- ปรับ Attendance ให้ผูก ScheduledShift
- เพิ่ม OT และ Payroll models ที่จำเป็น
- เพิ่ม Audit/Adjustment
- สร้าง migration แบบ additive
- validate schema

## 41. Task 21.3 — Schedule Services และ API

- สร้างรอบ
- สร้างจากกะประจำ
- คัดลอกรอบ
- เพิ่ม/แก้/ยกเลิกกะ
- ทำแทน
- ทำควบกะ
- publish/close
- permission enforcement

## 42. Task 21.4 — UI ตารางงาน

- ตารางครึ่งเดือน
- filter พนักงาน
- multi-select
- drawer แก้กะ
- badges
- warnings
- publish/close

## 43. Task 21.5 — Attendance Integration

- จับคู่ Attendance กับ ScheduledShift
- รองรับหลายกะ
- รองรับนอกตาราง
- ตรวจพิกัดเดิม 50 เมตร
- หน้า exception review
- adjustment พร้อมเหตุผล

## 44. Task 21.6 — Attendance Summary และ OT

- ขาด
- ลา
- มาสาย
- กลับก่อน
- OT suggested/approved
- daily summary
- tests

## 45. Task 21.7 — Payroll Calculation

- PayrollPeriod
- snapshot ค่าแรง
- สรุปรายคน
- รองรับรายวัน/รายเดือน
- ใช้ Attendance ที่อนุมัติ
- payroll adjustments

## 46. Task 21.8 — Payroll UI และ Locking

- ตารางสรุป
- รายละเอียดรายคน
- แก้จำนวนขาด ลา มาสาย OT ที่ใช้จ่ายจริง
- เพิ่ม/ลดเงินพร้อมเหตุผล
- approve
- mark paid
- lock/unlock
- audit

## 47. Task 21.9 — Regression และ Documentation

- รัน tests
- รัน build
- ตรวจ RBAC
- ตรวจระบบเดิม
- อัปเดต CURRENT_TASK
- สรุปไฟล์และ migration

ทำ Task ตามลำดับ และทำต่อเนื่องจนจบเฟส ไม่ต้องขออนุมัติระหว่าง Task หากไม่มีความเสี่ยงต่อข้อมูลจริง

---

# ส่วน K — Acceptance Criteria

## 48. ตารางงาน

- [ ] สร้างรอบครึ่งเดือนได้
- [ ] สร้างตารางจากกะประจำได้
- [ ] คัดลอกจากรอบก่อนได้
- [ ] แก้รายวันได้
- [ ] พนักงานมีหลายกะในวันเดียวได้
- [ ] จัดผู้ทำแทนได้
- [ ] มีประวัติการเปลี่ยน
- [ ] ประกาศและปิดรอบได้

## 49. เวลาเข้า–ออก

- [ ] ลงเวลาผูกกับ ScheduledShift
- [ ] รองรับหลาย Attendance Session
- [ ] รองรับกะข้ามวัน
- [ ] รองรับนอกตาราง
- [ ] ตรวจรัศมี 50 เมตร
- [ ] สรุปมาสายและกลับก่อนได้
- [ ] สรุปขาดและลาได้
- [ ] แก้ไขพร้อมเหตุผลและประวัติได้

## 50. OT

- [ ] ระบบเสนอ OT ได้
- [ ] ผู้มีสิทธิ์อนุมัติหรือแก้ OT ได้
- [ ] OT ที่ไม่อนุมัติไม่เข้า Payroll
- [ ] เก็บอัตรา OT แบบ snapshot

## 51. สรุปค่าจ้าง

- [ ] สร้างรอบจ่ายเงินได้
- [ ] รองรับรายวันและรายเดือน
- [ ] แสดงขาด ลา มาสาย กลับก่อน OT
- [ ] แสดงกะทำแทนและกะควบ
- [ ] ผู้มีสิทธิ์แก้ค่าที่ใช้จ่ายจริงได้
- [ ] ทุกการแก้ต้องมีเหตุผล
- [ ] แยกยอดระบบคำนวณกับยอดปรับ
- [ ] อนุมัติ จ่าย และล็อกรอบได้
- [ ] ปลดล็อกต้องมีสิทธิ์และเหตุผล

## 52. Compatibility

- [ ] ระบบเพิ่มและแก้กะเดิมยังทำงาน
- [ ] Employee/Auth/RBAC เดิมไม่เสีย
- [ ] ไม่มี migration ทำลายข้อมูล
- [ ] ไม่มี API breaking change ที่ไม่จำเป็น
- [ ] ระบบอื่นนอกขอบเขตไม่ถูกแก้
- [ ] Build และ tests ผ่าน

---

# ส่วน L — คำสั่งตรวจสอบก่อนจบ

## 53. รันคำสั่ง

ใช้ script ที่มีในโปรเจกต์ และอย่างน้อย:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

รัน Unit/Integration tests ที่เกี่ยวข้อง

หาก migration ต่อกับฐานข้อมูลจริง ให้ใช้วิธี deploy ตามมาตรฐานโปรเจกต์ ห้าม reset ฐานข้อมูล

---

## 54. รายงานเมื่อจบเฟส

สรุปเป็นภาษาไทยแบบกระชับ:

```text
1. ไฟล์ที่เพิ่มและแก้
2. Models และ migration ที่เพิ่ม
3. Workflow ตารางงาน
4. Workflow ทำแทนและควบกะ
5. การเชื่อม Attendance
6. วิธีสรุปขาด ลา มาสาย และ OT
7. วิธีคำนวณ Payroll
8. วิธีปรับยอดและ Audit
9. Permissions ที่เพิ่ม
10. ผล Unit Test
11. ผล Regression Test
12. ผล TypeScript
13. ผล Lint
14. ผล Build
15. ความเสี่ยงหรือสิ่งที่ยังต้องตั้งค่า
```

ผลลัพธ์สุดท้ายต้องยืนยันว่า:

```text
ตารางงานรองรับการเปลี่ยนกะทุกครึ่งเดือน
รองรับเข้างานแทนและทำงานควบกะ
เวลาเข้าออกผูกกับกะจริง
สรุปขาด ลา มาสาย และ OT ได้
ผู้มีสิทธิ์ปรับค่าที่ใช้จ่ายจริงได้พร้อมเหตุผล
Payroll อนุมัติ จ่าย และล็อกรอบได้
ระบบเดิมที่ทำงานแล้วไม่ถูกกระทบ
```