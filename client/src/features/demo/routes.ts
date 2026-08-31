function withMission(path: string, missionId?: string): string {
  return missionId ? `${path}?mission=${missionId}` : path;
}

export const demoRoutes = Object.freeze({
  offer: (offerId: string, missionId?: string) =>
    withMission(`/demo/offers/${offerId}`, missionId),
  organization: (organizationId: string, missionId?: string) =>
    withMission(`/demo/organizations/${organizationId}`, missionId),
  order: (orderId: string, missionId?: string) =>
    withMission(`/demo/orders/${orderId}`, missionId),
  contract: (contractId: string, missionId?: string) =>
    withMission(`/demo/contracts/${contractId}`, missionId),
});
