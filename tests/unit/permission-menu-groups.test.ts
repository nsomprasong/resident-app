import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { permissions } from "@/lib/auth/authorization";
import {
  assertPermissionMenuGroupsCoverAll,
  groupPermissionsByMenu,
  permissionMenuGroups,
} from "@/lib/auth/permission-menu-groups";

describe("permissionMenuGroups", () => {
  it("covers every permission code (shared menu codes allowed)", () => {
    const result = assertPermissionMenuGroupsCoverAll();
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.unexpectedDuplicates, []);
    assert.equal(result.ok, true);
  });

  it("follows daily ops then HR menu order", () => {
    const titles = permissionMenuGroups.map((group) => group.title);
    assert.equal(titles[0], "ภาพรวมวันนี้");
    assert.equal(titles[1], "รายการจอง");
    assert.equal(titles[2], "สั่งอาหาร");
    assert.equal(titles[3], "ครัว");
    assert.equal(titles[4], "แม่บ้านและตรวจสอบห้องพัก");
    assert.ok(titles.includes("บัญชีและแดชบอร์ด"));
    assert.ok(titles.includes("รายงานรวม"));
    assert.ok(
      titles.indexOf("รายงานรวม") > titles.indexOf("ล้างข้อมูลเริ่มต้นใหม่"),
    );
    assert.ok(titles.includes("ตั้งค่าข้อมูลหลัก"));
    assert.ok(titles.includes("ตารางงาน"));
    assert.equal(titles.at(-1), "ตั้งค่าบุคลากร");
  });

  it("groups catalog rows without dropping codes", () => {
    const catalog = permissions.map((code, index) => ({
      id: String(index),
      code,
      description: null,
    }));
    const groups = groupPermissionsByMenu(catalog);
    const groupedCodes = groups.flatMap((group) =>
      group.items.map((item) => item.code),
    );
    assert.equal(new Set(groupedCodes).size, permissions.length);
    assert.equal(
      groups.some((group) => group.id === "other"),
      false,
    );
    const reportGroup = groups.find((group) => group.id === "report");
    assert.ok(reportGroup);
    assert.deepEqual(
      reportGroup.items.map((item) => item.code),
      ["report.read", "payment.report.view"],
    );
  });

  it("keeps manage/write before read within booking and settings", () => {
    const booking = permissionMenuGroups.find((group) => group.id === "booking");
    const settings = permissionMenuGroups.find((group) => group.id === "settings");
    assert.ok(booking);
    assert.ok(settings);
    assert.ok(
      booking.permissions.indexOf("booking.write") <
        booking.permissions.indexOf("booking.read"),
    );
    assert.ok(
      settings.permissions.indexOf("settings.manage") <
        settings.permissions.indexOf("employee.read"),
    );
    assert.ok(
      settings.permissions.indexOf("payment.promptpay_settings.manage") <
        settings.permissions.indexOf("payment.promptpay_settings.view"),
    );
  });
});
