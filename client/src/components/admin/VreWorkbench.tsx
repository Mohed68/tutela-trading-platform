import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TotpCodeInput } from "@/components/security/TotpCodeInput";
import { apiRequest } from "@/lib/queryClient";

type Module = "verification" | "risk" | "enforcement";
type Row = Record<string, unknown>;
type Field = { key: string; label: string; options?: readonly string[]; type?: "datetime-local" | "textarea" | "restrictions"; optional?: boolean };
const restrictionOptions=["offer.create","offer.edit","offer.submit","order.create","order.accept","contract.create"] as const;
type Action = { id: string; label: string; permission: string; path: string; fields: Field[]; warning: string };
const reason: Field = {key:"reason",label:"Reason / supporting context",type:"textarea"};
const scopes: Field = {key:"scope",label:"Scope",options:["ORGANIZATION","USER"]};
const actions: Record<Module,Action[]> = {
  verification:[
    {id:"review",label:"Record independent review",permission:"verification.review.submit",path:"verification/reviews",
      fields:[{key:"outcome",label:"Review outcome",options:["confirmed","revision_requested","inconclusive"]},
        {key:"sourceReference",label:"Independent source reference (not confidential evidence)"},reason],
      warning:"Confirm only after independent verification. You must not be an Organization member or the evidence submitter. This records a review artifact; it does not approve the Organization or set Trust."},
    {id:"reevaluate",label:"Initiate re-verification",permission:"verification.reevaluate",path:"verification/reevaluate",
      fields:[{key:"trigger",label:"Legitimate re-evaluation trigger",options:["reverification","verification_expiry","material_evidence_change","material_organization_change","remediation"]},reason],
      warning:"Creates a new Policy V2 decision through the canonical engine. Existing history remains intact. An independent review is required for approval."},
  ],
  risk:[
    {id:"signal",label:"Record signal",permission:"risk.signal.create",path:"risk/signals",fields:[scopes,{key:"subjectId",label:"Subject"},
      {key:"signalType",label:"Signal type"},{key:"severity",label:"Severity",options:["low","medium","high","critical"]},
      {key:"sourceReference",label:"Observation source reference"},{key:"evidenceReference",label:"Evidence reference"},
      {key:"observedAt",label:"Observed at (your local time)",type:"datetime-local"},reason],
      warning:"Manual analyst observation only. Lack of Verification is not misconduct. A signal never imposes an enforcement state."},
    {id:"assess",label:"Assess selected signal",permission:"risk.assess",path:"risk/assessments",fields:[
      {key:"conclusion",label:"Assessment conclusion",options:["unsubstantiated","needs_review","substantiated"]},reason],
      warning:"Assessment is separate from Enforcement. Explain the evidence supporting your conclusion."},
    {id:"dispose",label:"Review assessment",permission:"risk.dispose",path:"risk/dispositions",fields:[
      {key:"disposition",label:"Disposition",options:["closed","monitor","refer_for_case_review"]},reason],
      warning:"A referral does not open a case or impose a restriction. Those require separate explicit commands."},
  ],
  enforcement:[
    {id:"case",label:"Open governed case",permission:"enforcement.case.open",path:"enforcement/cases",fields:[scopes,
      {key:"subjectId",label:"Subject"},{key:"riskAssessmentId",label:"Linked risk assessment ID (optional)",optional:true},
      {key:"evidenceReference",label:"Case evidence reference"},reason],
      warning:"An explicit case records context, not a punishment. Linked assessments must match this exact scope and subject."},
    {id:"decide",label:"Decide selected case",permission:"enforcement.decide",path:"enforcement/decisions",fields:[
      {key:"state",label:"New scoped state",options:["MONITORED","RESTRICTED","SUSPENDED","BLOCKED","TERMINATED","NORMAL"]},
      {key:"restrictedActions",label:"Explicitly restricted V2 actions",type:"restrictions",optional:true},
      {key:"remediation",label:"Remediation / lifting conditions",type:"textarea"},
      {key:"reviewAt",label:"Next review (your local time)",type:"datetime-local"},reason],
      warning:"Appends a decision and scoped action. RESTRICTED requires explicit actions; MONITORED does not deny. SUSPENDED, BLOCKED and TERMINATED deny new V2 trade mutations while preserving history. Trust and Verification are never rewritten."},
  ],
};
const display = (value: unknown) => value == null ? "—" : String(value).replaceAll("_"," ");
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString() : "—";
const rowId = (row: Row) => String(row.id ?? row.organizationId);
async function read(path: string,signal?: AbortSignal) {
  const response = await fetch(`/admin/vre/${path}`,{credentials:"include",signal});
  if(!response.ok) throw new Error(response.status === 403 ? "Permission or MFA assurance required." : "The requested records are unavailable.");
  return response.json();
}

export function VreWorkbench({module,permissions}:{module:Module;permissions:readonly string[]}) {
  const [rows,setRows]=useState<Row[]>([]), [selected,setSelected]=useState<Row|null>(null);
  const [details,setDetails]=useState<Row|null>(null), [evidence,setEvidence]=useState<Row|null>(null);
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [notice,setNotice]=useState("");
  const [filter,setFilter]=useState(""), [actionId,setActionId]=useState(""), [values,setValues]=useState<Record<string,string>>({});
  const [confirmed,setConfirmed]=useState(false), [code,setCode]=useState(""), [revision,setRevision]=useState(0);
  const [subjects,setSubjects]=useState<{id:string;label:string}[]>([]);
  const viewPermission=module==="verification"?"verification.queue.view":`${module}.view`;
  const allowed=permissions.includes(viewPermission);
  const action=actions[module].find(item=>item.id===actionId);
  useEffect(()=>{
    const abort=new AbortController(); setLoading(true);setNotice("");setSelected(null);setDetails(null);setEvidence(null);setActionId("");
    if(!allowed){setRows([]);setLoading(false);return()=>abort.abort();}
    read(module,abort.signal).then(setRows).catch(error=>{if(!abort.signal.aborted)setNotice(error.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[module,revision,allowed]);
  useEffect(()=>{
    setDetails(null);setEvidence(null);setActionId("");
    if(!selected)return;
    const abort=new AbortController();
    const path=module==="verification"?`verification/${encodeURIComponent(String(selected.organizationId))}/history`:
      module==="risk"?`risk/${selected.id}/history`:`enforcement/${selected.scope}/${encodeURIComponent(String(selected.subjectId))}/history`;
    read(path,abort.signal).then(data=>setDetails(Array.isArray(data)?{actions:data}:data)).catch(error=>{if(!abort.signal.aborted)setNotice(error.message);});
    if(module==="verification" && permissions.includes("verification.evidence.view") && selected.evidenceId)
      read(`verification/${encodeURIComponent(String(selected.organizationId))}/profiles/${encodeURIComponent(String(selected.profileRevisionId))}/evidence`,abort.signal)
        .then(setEvidence).catch(error=>{if(!abort.signal.aborted)setNotice(error.message);});
    return()=>abort.abort();
  },[selected,module,permissions]);
  useEffect(()=>{
    if(actionId!=="signal"&&actionId!=="case")return;
    const abort=new AbortController();setSubjects([]);
    read(`subjects?scope=${values.scope??"ORGANIZATION"}`,abort.signal).then(setSubjects).catch(error=>{if(!abort.signal.aborted)setNotice(error.message);});
    return()=>abort.abort();
  },[actionId,values.scope]);

  function choose(item: Action) {
    setActionId(item.id);setConfirmed(false);setNotice("");
    setValues(Object.fromEntries(item.fields.map(field=>[field.key,field.options?.[0]??""])));
  }
  async function submit() {
    if(!action||!confirmed||busy)return;
    const body: Row={...values};
    for(const field of action.fields) {
      if(field.type==="datetime-local" && values[field.key]) body[field.key]=new Date(values[field.key]).toISOString();
      if(field.optional && !values[field.key]) body[field.key]=null;
    }
    if(action.id==="decide")body.restrictedActions=values.state==="RESTRICTED"?(values.restrictedActions??"").split(",").filter(Boolean):[];
    if(action.id==="review")Object.assign(body,{organizationId:selected?.organizationId,profileRevisionId:selected?.profileRevisionId,
      evidenceId:evidence?.evidenceId,evidenceVersion:evidence?.evidenceVersion,evidenceDigest:evidence?.evidenceDigest});
    if(action.id==="reevaluate")Object.assign(body,{organizationId:selected?.organizationId,profileRevisionId:selected?.profileRevisionId});
    if(action.id==="assess")body.signalId=selected?.id;
    if(action.id==="dispose")body.assessmentId=selected?.assessmentId;
    if(action.id==="decide")Object.assign(body,{caseId:selected?.id,expectedActionId:selected?.currentActionId??null});
    setBusy(true);
    try {await apiRequest("POST",`/admin/vre/${action.path}`,body);setRevision(n=>n+1);setNotice("Recorded with Security Audit. Refreshing authoritative records.");}
    catch(error){const message=String(error);setNotice(message.includes("assurance")||message.includes("step_up")||message.includes("mfa_required")
      ?"Additional session assurance is required. Verify below, then explicitly submit again."
      :message.includes("independent_reviewer_required")?"An Organization member or evidence submitter cannot independently review this Organization."
      :"Not recorded. Check the case, scope, supporting evidence and authority; refresh if another operator changed the state.");}
    finally{setBusy(false);setConfirmed(false);}
  }
  async function stepUp() {
    if(busy)return;setBusy(true);
    try{await apiRequest("POST","/api/auth/mfa/step-up",{code});setNotice("Step-up verified. Review and explicitly submit your action when ready.");}
    catch{setNotice("The code could not be verified. Wait for a new authenticator code and try again.");}
    finally{setCode("");setBusy(false);}
  }
  const visible=rows.filter(row=>[row.legalName,row.subjectName,row.organizationId,row.subjectId,row.signalType,row.severity,row.reviewOutcome,row.currentState]
    .some(value=>String(value??"").toLowerCase().includes(filter.toLowerCase())));
  const requiresSelection=action && !["signal","case"].includes(action.id);
  const missingContext=!!requiresSelection && (!selected || (action?.id==="review"&&!evidence) || (action?.id==="dispose"&&!selected.assessmentId) || (action?.id==="decide"&&!!selected.decisionId));
  return <section className="space-y-4" aria-label={`${module} operations`}>
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      {module==="verification"?"Policy V2 · Self-attestation is Evidence. Independent confirmation is required before the canonical engine may approve. V1 history remains intact.":
        module==="risk"?"Signals → assessments → dispositions. Risk does not impose Enforcement, and lack of Verification is not misconduct.":
        "Cases → explicit decisions → scoped actions. The Current V2 command guard consumes only matching authoritative actions; read/history and Trust remain intact."}
    </div>
    <div className="flex flex-wrap gap-2"><Input aria-label={`Filter ${module} queue`} placeholder="Filter name, identifier or status…" value={filter} onChange={e=>setFilter(e.target.value)} className="max-w-sm"/>
      <Button variant="outline" disabled={busy||loading} onClick={()=>setRevision(n=>n+1)}>Refresh</Button>
      {actions[module].filter(item=>permissions.includes(item.permission)).map(item=><Button key={item.id} variant="outline" disabled={busy} onClick={()=>choose(item)}>{item.label}</Button>)}
    </div>
    {notice&&<p role="status" className="rounded border bg-white p-3 text-sm">{notice}</p>}
    {!allowed?<p>You do not have access to this module.</p>:loading?<p role="status">Loading operational records…</p>:
      visible.length===0?<div className="rounded border border-dashed p-5 text-sm"><strong>{rows.length?"No matching records.":"No records yet."}</strong><p className="mt-1 text-slate-600">{rows.length?"Change the filter to see other records.":"Only legitimate activity appears here. No sample cases or inferred historical decisions have been created."}</p></div>:
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><caption className="sr-only">Latest {module} records, up to 100</caption><thead className="bg-slate-100"><tr><th className="p-3">Subject</th><th className="p-3">Status / context</th><th className="p-3">Recorded</th><th className="p-3">Review</th></tr></thead><tbody>{visible.map(row=><tr key={rowId(row)} className={`border-t ${selected&&rowId(selected)===rowId(row)?"bg-emerald-50":"bg-white"}`}>
        <td className="p-3"><div className="font-medium">{display(row.legalName??row.subjectName??row.scope??"Organization")}</div><div className="break-all text-xs text-slate-500">{display(row.organizationId??row.subjectId)}</div></td>
        <td className="p-3">{module==="verification"?display(!row.evidenceId?"Evidence missing":row.reviewMatchesEvidence?row.reviewOutcome:"Independent review needed"):
          module==="risk"?<>{display(row.severity)} · {display(row.signalType)}<div className="text-xs">{display(row.conclusion??"not assessed")} · {display(row.disposition??"open")}</div></>:
          <>{display(row.currentState)}<div className="text-xs">{row.decisionId?"Case decided":"Case open"} · {display(row.integrationStatus)}</div></>}</td>
        <td className="p-3 whitespace-nowrap">{date(row.createdAt??row.submittedAt)}</td><td className="p-3"><Button variant="outline" size="sm" disabled={busy} aria-label={`Inspect ${display(row.legalName??row.subjectName??rowId(row))}`} onClick={()=>setSelected(row)}>Inspect</Button></td>
      </tr>)}</tbody></table></div>}
    {selected&&<section className="space-y-3 rounded-lg border bg-white p-4" aria-label="Selected record details"><h2 className="font-semibold">Record context & history</h2>
      <p className="break-all text-xs text-slate-500">{rowId(selected)}</p>
      {!!selected.reason&&<p className="text-sm">{String(selected.reason)}</p>}
      {!!selected.evidenceReference&&<p className="text-sm">Evidence reference: {String(selected.evidenceReference)}</p>}
      {evidence&&<div className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">Submitted assertions — not independently verified by submission</h3>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[1fr_2fr]">{(evidence.assertions as {assertionCode:string;value:string}[]).map((a,i)=><div key={`${a.assertionCode}-${i}`} className="contents"><dt className="text-slate-500">{display(a.assertionCode)}</dt><dd className="break-words">{a.value}</dd></div>)}</dl>
        <p className="text-xs text-slate-500">Captured {date(evidence.capturedAt)} · version {display(evidence.evidenceVersion)}</p></div>}
      {!details?<p className="text-sm">Loading history…</p>:Object.entries(details).map(([group,entries])=><div key={group} className="border-t pt-3"><h3 className="mb-2 text-sm font-semibold capitalize">{group}</h3>
        {Array.isArray(entries)&&entries.length?<ol className="space-y-2">{entries.map((entry:Row)=><li key={String(entry.id)} className="border-l-2 border-slate-200 pl-3 text-sm">
          <p className="font-medium">{display(entry.decision??entry.outcome??entry.conclusion??entry.disposition??entry.state??entry.status)}</p>
          {!!entry.policyVersion&&<p className="text-xs">Policy: {String(entry.policyVersion)} · Trust: {display(entry.trust)}</p>}
          {!!entry.reason&&<p>{String(entry.reason)}</p>}<p className="text-xs text-slate-500">{date(entry.createdAt??entry.effectiveAt)} · {display(entry.reviewerPrincipalId??entry.assessedBy??entry.reviewedBy??entry.decidedBy??entry.decisionId)}</p>
        </li>)}</ol>:<p className="text-sm text-slate-500">No {group} recorded.</p>}</div>)}
    </section>}
    {action&&<form className="space-y-3 rounded-lg border bg-white p-4" onSubmit={e=>{e.preventDefault();void submit();}}>
      <h2 className="font-semibold">{action.label}</h2><p className="text-sm text-slate-600">{action.warning}</p>
      {missingContext&&<p role="alert" className="text-sm text-amber-800">Select and inspect an appropriate record first. Reviews need evidence; dispositions need an assessment; decisions need an open case.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{action.fields.map(field=><label key={field.key} className={`space-y-1 text-sm ${field.type==="textarea"?"sm:col-span-2":""}`}><span>{field.label}</span>
        {field.options?<select className="h-10 w-full rounded border px-2" value={values[field.key]??field.options[0]} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value,...(field.key==="scope"?{subjectId:""}:{})}))}>{field.options.map(option=><option key={option} value={option}>{display(option)}</option>)}</select>:
        field.key==="subjectId"?<select required className="h-10 w-full rounded border px-2" value={values.subjectId??""} onChange={e=>setValues(v=>({...v,subjectId:e.target.value}))}><option value="">Select a canonical subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.label} · {s.id}</option>)}</select>:
        field.type==="restrictions"?<div className="grid gap-1 rounded border p-2">{restrictionOptions.map(option=><label key={option} className="flex items-center gap-2"><input type="checkbox" disabled={values.state!=="RESTRICTED"} checked={(values[field.key]??"").split(",").includes(option)} onChange={e=>setValues(v=>{const current=new Set((v[field.key]??"").split(",").filter(Boolean));e.target.checked?current.add(option):current.delete(option);return {...v,[field.key]:[...current].join(",")};})}/>{display(option)}</label>)}</div>:
        field.type==="textarea"?<textarea required maxLength={1000} className="min-h-20 w-full rounded border p-2" value={values[field.key]??""} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>:
        <Input required={!field.optional} type={field.type??"text"} maxLength={500} value={values[field.key]??""} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>}</label>)}</div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>I confirm this explicit action, its scope and supporting evidence. Historical facts will remain intact.</label>
      <div className="flex gap-2"><Button type="submit" disabled={busy||missingContext||!confirmed}>{busy?"Recording…":"Confirm and record"}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setActionId("")}>Cancel</Button></div>
    </form>}
    {allowed&&<details className="rounded-lg border bg-white p-3"><summary className="cursor-pointer text-sm font-medium">Privileged action verification</summary><div className="mt-3 space-y-3"><TotpCodeInput label="Current authenticator code" value={code} onChange={setCode}/><Button disabled={busy||!/^\d{6}$/.test(code)} onClick={stepUp}>Verify step-up</Button><p className="text-xs text-slate-500">Server verification is authoritative. Your pending action is never submitted automatically.</p></div></details>}
  </section>;
}
