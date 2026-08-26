import {
  DEMO_MISSION_STEPS,
  type DemoHeroMissionDefinition,
} from "./contracts.js";

function mission(
  value: Omit<DemoHeroMissionDefinition, "steps">,
): DemoHeroMissionDefinition {
  return Object.freeze({ ...value, steps: DEMO_MISSION_STEPS });
}

export const DEMO_HERO_MISSIONS: readonly DemoHeroMissionDefinition[] =
  Object.freeze([
    mission({
      missionId: "demo:mission:wti-complete-trade",
      title: "Complete a WTI crude oil trade",
      purpose: "Experience the baseline TUTELA lifecycle from marketplace review to a non-binding contract.",
      commodity: "WTI Crude Oil",
      offerId: "demo:offer:wti-houston",
      estimatedMinutes: 8,
    }),
    mission({
      missionId: "demo:mission:urea-progressive-trust",
      title: "Review progressive trust for Urea 46%",
      purpose: "Understand organization verification, documentary evidence, and progressive assurance presentation.",
      commodity: "Urea 46%",
      offerId: "demo:offer:urea-mombasa",
      estimatedMinutes: 7,
    }),
    mission({
      missionId: "demo:mission:copper-inspection-assurance",
      title: "Explore inspected copper assurance",
      purpose: "Compare stronger independently inspected evidence in a second trade scenario.",
      commodity: "Copper Cathode",
      offerId: "demo:offer:copper-cathode-shanghai",
      estimatedMinutes: 7,
    }),
  ]);

export const DEMO_ENTRY_EXPERIENCE = Object.freeze({
  title: "Experience a complete TUTELA trade",
  body: "Follow a simulated transaction from a verified organization and eligible offer through order acceptance and a non-binding contract.",
  actions: Object.freeze(["Start guided trade", "Explore marketplace"] as const),
  guidedScenarioLabel: "Guided Scenario",
  completionTitle: "Trade simulation complete",
  completionActions: Object.freeze([
    "Try another scenario",
    "Explore marketplace",
  ] as const),
});
