import test from "node:test";
import assert from "node:assert/strict";
import { accessForEmail } from "@/lib/clerk-sync";

test("admin and owner access follow the current env, case-insensitively", () => {
  const saved = { admins: process.env.APP_ADMIN_EMAILS, owner: process.env.APP_OWNER_EMAIL };
  try {
    process.env.APP_ADMIN_EMAILS = " Admin@Example.com , other@example.com";
    process.env.APP_OWNER_EMAIL = "Owner@Example.com";
    assert.deepEqual(accessForEmail("admin@example.com"), { role: "admin", ownerPro: false });
    assert.deepEqual(accessForEmail(" OWNER@example.com "), { role: "member", ownerPro: true });
    assert.deepEqual(accessForEmail("someone@example.com"), { role: "member", ownerPro: false });
    process.env.APP_ADMIN_EMAILS = "";
    assert.equal(accessForEmail("admin@example.com").role, "member", "removing an email revokes admin");
  } finally {
    process.env.APP_ADMIN_EMAILS = saved.admins;
    process.env.APP_OWNER_EMAIL = saved.owner;
    if (saved.admins === undefined) delete process.env.APP_ADMIN_EMAILS;
    if (saved.owner === undefined) delete process.env.APP_OWNER_EMAIL;
  }
});
