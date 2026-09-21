import { z } from 'zod';

export type WidgetService = {
  id: string;
  title: string;
  durationMin: number;
  price: number;
  masterName: string;
};

export const bookPayloadSchema = z.object({
  publicKey: z.string().min(8),
  serviceId: z.string().min(1),
  clientName: z.string().min(2).max(80),
  phone: z.string().min(10).max(20),
  startsAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});

export type BookPayload = z.infer<typeof bookPayloadSchema>;

export const DEMO_SERVICES: WidgetService[] = [
  {
    id: 'ws1',
    title: 'Женская стрижка',
    durationMin: 60,
    price: 3500,
    masterName: 'Елена Воронова',
  },
  {
    id: 'ws2',
    title: 'Маникюр + покрытие',
    durationMin: 90,
    price: 2800,
    masterName: 'Мария Ким',
  },
  {
    id: 'ws3',
    title: 'Коррекция бровей',
    durationMin: 40,
    price: 1800,
    masterName: 'Софья Лебедева',
  },
];

export async function loadServices(publicKey: string, apiBase: string): Promise<WidgetService[]> {
  if (!publicKey) return [];
  if (!apiBase) {
    await wait(120);
    return DEMO_SERVICES;
  }
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/widget/services`, {
    headers: { 'X-Beauty-Public-Key': publicKey },
  });
  if (!res.ok) throw new Error(`Failed to load services (${res.status})`);
  const body = (await res.json()) as {
    services: {
      id: string;
      title: string;
      durationMin: number;
      masterName: string;
      price: { amount: number };
    }[];
  };
  return body.services.map((s) => ({
    id: s.id,
    title: s.title,
    durationMin: s.durationMin,
    price: s.price.amount,
    masterName: s.masterName,
  }));
}

export async function submitBooking(
  payload: BookPayload,
  apiBase: string,
): Promise<{ ok: true; appointmentId: string }> {
  const parsed = bookPayloadSchema.parse(payload);
  if (!apiBase) {
    await wait(200);
    return { ok: true, appointmentId: `demo-${crypto.randomUUID()}` };
  }
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/widget/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Beauty-Public-Key': parsed.publicKey,
    },
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw new Error(`Booking failed (${res.status})`);
  return (await res.json()) as { ok: true; appointmentId: string };
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
