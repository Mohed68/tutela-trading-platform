import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MISSION_STEP_LABELS } from "./presentation";
import type { DemoMissionView } from "./types";

export function GuidedProgress({ mission, onExit }: { mission: DemoMissionView; onExit?: () => void }) {
  const completed = new Set(mission.progress?.completedSteps ?? []);
  return <aside className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Your guided trade</p><h2 className="mt-1 font-semibold text-slate-950">{mission.definition.commodity}</h2></div>{onExit && <Button variant="ghost" size="sm" onClick={onExit}>Exit guided mode</Button>}</div>
    <div className="mt-5 space-y-3">{mission.definition.steps.map((step) => {
      const isDone = completed.has(step); const isCurrent = mission.progress?.currentStep === step;
      return <div key={step} className={`flex items-center gap-3 text-sm ${isDone ? "text-emerald-800" : isCurrent ? "font-semibold text-slate-950" : "text-slate-500"}`}>{isDone ? <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" /></span> : <Circle className={`h-5 w-5 ${isCurrent ? "fill-emerald-600 text-emerald-600" : "text-slate-300"}`} />}<span>{MISSION_STEP_LABELS[step]}</span></div>;
    })}</div>
  </aside>;
}
