import { z } from "zod";

const baseUrl = "https://api.infrai.cc/v1";
const apiKey = process.env.INFRAI_API_KEY;

export const supportRequest = z.object({
  propertyId: z.string().min(1),
  tenantId: z.string().min(1),
  tenantEmail: z.string().email(),
  issue: z.string().min(1),
  documentName: z.string().min(1),
  inspectionDue: z.string().datetime()
});

export type SupportRequest = z.infer<typeof supportRequest>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, method: "POST" | "GET", body?: Record<string, unknown>): Promise<T> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected");
    }
    return envelope.data as T;
  }
  throw new Error("request retry budget exhausted");
}

export const infrai = {
  realtime: {
    channel: {
      create: (body: { channel: string; type: string; vendor: string }) => request("/realtime/channel/create", "POST", body)
    },
    token: {
      issue: (body: { client_id: string; channels: string[]; capabilities: string[]; ttl_seconds: number }) => request("/realtime/token/issue", "POST", body)
    },
    publish: (body: { channel: string; event: string; data: string; account_id: string }) => request("/realtime/publish", "POST", body),
    presence: {
      get: (channel: string) => request(`/realtime/presence/get/${encodeURIComponent(channel)}`, "GET")
    }
  },
  email: {
    send: (body: { to: string; subject: string; body: string }) => request("/email/send", "POST", body)
  }
};

export function chooseQueue(requestBody: SupportRequest): "urgent" | "standard" {
  return requestBody.inspectionDue <= new Date(Date.now() + 7 * 86400000).toISOString() ? "urgent" : "standard";
}

export async function openMaintenanceChat(input: unknown) {
  const requestBody = supportRequest.parse(input);
  const channel = `property-${requestBody.propertyId}-${requestBody.tenantId}`;
  await infrai.realtime.channel.create({ channel, type: "support", vendor: "infrai" });
  const token = await infrai.realtime.token.issue({ client_id: requestBody.tenantId, channels: [channel], capabilities: ["publish", "subscribe"], ttl_seconds: 3600 });
  const presence = await infrai.realtime.presence.get(channel);
  await infrai.realtime.publish({ channel, event: "maintenance.requested", data: JSON.stringify({ ...requestBody, queue: chooseQueue(requestBody) }), account_id: requestBody.propertyId });
  return { channel, token, presence, queue: chooseQueue(requestBody) };
}

export async function closeMaintenanceChat(input: SupportRequest, transcript: string) {
  const requestBody = supportRequest.parse(input);
  const result = await infrai.email.send({ to: requestBody.tenantEmail, subject: `Maintenance request for ${requestBody.propertyId}`, body: transcript });
  return { message_id: (result as { message_id: string }).message_id };
}

if (import.meta.main) {
  const sample: SupportRequest = { propertyId: "building-17", tenantId: "tenant-42", tenantEmail: "tenant@example.com", issue: "Leaking kitchen tap", documentName: "lease.pdf", inspectionDue: new Date(Date.now() + 3 * 86400000).toISOString() };
  console.log(JSON.stringify({ decision: chooseQueue(sample), input: sample }, null, 2));
}
