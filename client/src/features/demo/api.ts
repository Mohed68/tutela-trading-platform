import type {
  DemoAcceptance,
  DemoContract,
  DemoEvidence,
  DemoMissionProgress,
  DemoMissionView,
  DemoOffer,
  DemoOrganization,
  DemoOrder,
  DemoQualification,
  DemoSessionView,
} from "./types";

export class DemoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

async function demoRequest<T>(path: `/api/demo/${string}`, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await response.json().catch(() => ({})) as { message?: string; code?: string };
  if (!response.ok) {
    throw new DemoApiError(response.status, body.code, body.message ?? "The demo request could not be completed.");
  }
  return body as T;
}

const post = <T>(path: `/api/demo/${string}`, body?: unknown) =>
  demoRequest<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const demoApi = Object.freeze({
  requestAccess: (input: DemoQualification) => post<{ accepted: true; message: string }>("/api/demo/access/request", input),
  verifyAccess: (token: string) => post<{ verified: true; next: string }>("/api/demo/access/verify", { token }),
  createSession: () => post<DemoSessionView>("/api/demo/sessions"),
  getSession: () => demoRequest<DemoSessionView>("/api/demo/session"),
  resetSession: () => post<DemoSessionView>("/api/demo/session/reset"),
  listOffers: (query = "") => demoRequest<DemoOffer[]>(`/api/demo/offers${query}` as `/api/demo/${string}`),
  getOffer: (offerId: string) => demoRequest<DemoOffer>(`/api/demo/offers/${encodeURIComponent(offerId)}`),
  getEvidence: (offerId: string) => demoRequest<DemoEvidence>(`/api/demo/offers/${encodeURIComponent(offerId)}/evidence`),
  getOrganization: (organizationId: string) => demoRequest<DemoOrganization>(`/api/demo/organizations/${encodeURIComponent(organizationId)}`),
  listMissions: () => demoRequest<DemoMissionView[]>("/api/demo/missions"),
  getMission: (missionId: string) => demoRequest<DemoMissionView>(`/api/demo/missions/${encodeURIComponent(missionId)}`),
  startMission: (missionId: string) => post<DemoMissionProgress>(`/api/demo/missions/${encodeURIComponent(missionId)}/start`),
  createOrder: (offerId: string, quantity: string) => post<DemoOrder>("/api/demo/orders", { offerId, quantity }),
  getOrder: (orderId: string) => demoRequest<DemoOrder>(`/api/demo/orders/${encodeURIComponent(orderId)}`),
  acceptOrder: (orderId: string) => post<DemoAcceptance>(`/api/demo/orders/${encodeURIComponent(orderId)}/accept`),
  createContract: (orderId: string) => post<DemoContract>(`/api/demo/orders/${encodeURIComponent(orderId)}/contract`),
  getContract: (contractId: string) => demoRequest<DemoContract>(`/api/demo/contracts/${encodeURIComponent(contractId)}`),
});
