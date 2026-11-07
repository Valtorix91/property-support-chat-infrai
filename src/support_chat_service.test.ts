import assert from "node:assert/strict";
import { chooseQueue, supportRequest } from "./support_chat_service.ts";

const input = { propertyId: "building-17", tenantId: "tenant-42", tenantEmail: "tenant@example.com", issue: "Leaking tap", documentName: "lease.pdf", inspectionDue: "2030-01-03T00:00:00.000Z" };
assert.equal(supportRequest.parse(input).tenantId, "tenant-42");
assert.equal(chooseQueue({ ...input, inspectionDue: new Date(Date.now() + 2 * 86400000).toISOString() }), "urgent");
assert.equal(chooseQueue({ ...input, inspectionDue: new Date(Date.now() + 30 * 86400000).toISOString() }), "standard");
console.log("support queue decision: passed");
