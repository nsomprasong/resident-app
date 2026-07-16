import assert from "node:assert/strict";
import test from "node:test";

import {
  createPasswordResetTicket,
  ticketMatchesEmployee,
  verifyPasswordResetTicket,
} from "@/lib/auth/password-reset-ticket";

test("password reset ticket round-trips and rejects tampering", () => {
  process.env.PASSWORD_RESET_TICKET_SECRET =
    process.env.PASSWORD_RESET_TICKET_SECRET ?? "unit-test-ticket-secret";

  const ticket = createPasswordResetTicket({
    employeeId: "11111111-1111-1111-1111-111111111111",
    authUserId: "22222222-2222-2222-2222-222222222222",
    email: "Staff@Example.com",
  });

  const payload = verifyPasswordResetTicket(ticket);
  assert.ok(payload);
  assert.equal(payload.email, "staff@example.com");
  assert.equal(payload.employeeId, "11111111-1111-1111-1111-111111111111");

  assert.equal(verifyPasswordResetTicket(`${ticket}x`), null);
  assert.equal(verifyPasswordResetTicket("not-a-ticket"), null);
});

test("password reset ticket supports phone-only first login", () => {
  process.env.PASSWORD_RESET_TICKET_SECRET =
    process.env.PASSWORD_RESET_TICKET_SECRET ?? "unit-test-ticket-secret";

  const ticket = createPasswordResetTicket({
    employeeId: "11111111-1111-1111-1111-111111111111",
    authUserId: "22222222-2222-2222-2222-222222222222",
    phone: "+66812345678",
  });
  const payload = verifyPasswordResetTicket(ticket);
  assert.ok(payload);
  assert.equal(payload.phone, "+66812345678");
  assert.equal(payload.email, "");
  assert.equal(
    ticketMatchesEmployee(payload, {
      email: null,
      phone: "+66812345678",
    }),
    true,
  );
});

test("password reset ticket expires", () => {
  process.env.PASSWORD_RESET_TICKET_SECRET =
    process.env.PASSWORD_RESET_TICKET_SECRET ?? "unit-test-ticket-secret";

  const ticket = createPasswordResetTicket(
    {
      employeeId: "11111111-1111-1111-1111-111111111111",
      authUserId: "22222222-2222-2222-2222-222222222222",
      email: "staff@example.com",
    },
    -10,
  );

  assert.equal(verifyPasswordResetTicket(ticket), null);
});
