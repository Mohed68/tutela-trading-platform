// Local visual QA only. No authentication, database, or production server imports.
import express from 'express';
import { createServer } from 'vite';
const app=express();
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
const sample=process.argv.includes('--sample');
const permissions=['verification.queue.view','verification.evidence.view','verification.review.submit','verification.reevaluate',
  'risk.view','risk.signal.create','risk.assess','risk.dispose','enforcement.view','enforcement.case.open','enforcement.decide'];
const row={id:'00000000-0000-4000-8000-000000000001',organizationId:'qa-organization',profileRevisionId:'qa-profile',
  legalName:'QA Trading Organization',subjectName:'QA Trading Organization',scope:'ORGANIZATION',subjectId:'qa-organization',
  evidenceId:'qa-evidence',evidenceVersion:'1',signalType:'document_discrepancy',severity:'medium',currentState:'NORMAL',
  reason:'Fictional local visual QA context only',createdAt:new Date().toISOString()};
app.get('/admin/vre/subjects',(_req,res)=>res.json(sample?[{id:'qa-organization',label:'QA Trading Organization'}]:[]));
app.get('/admin/vre/:module',(_req,res)=>res.json(sample?[row]:[]));
app.get('/admin/vre/verification/:org/profiles/:profile/evidence',(_req,res)=>res.json({evidenceId:'qa-evidence',evidenceVersion:'1',evidenceDigest:'a'.repeat(64),
  assertions:[{assertionCode:'legal_name',value:'QA Trading Organization'},{assertionCode:'document_type',value:'Fictional QA evidence'}]}));
app.get('/admin/vre/*',(_req,res)=>res.json({reviews:[],decisions:[],assessments:[],actions:[]}));
app.post('*',(_req,res)=>res.status(409).json({code:'visual_preview_read_only'}));
app.get('/__vre-preview',async(req,res)=>{
  const html=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>VRE local QA</title></head>
  <body><div class="mx-auto max-w-6xl p-5"><p class="mb-4 text-amber-800">LOCAL VISUAL QA · FICTIONAL DATA · NO MUTATIONS</p>
  <nav class="mb-5 flex gap-5"><a href="?module=verification">Verification</a><a href="?module=risk">Risk</a><a href="?module=enforcement">Enforcement</a></nav><div id="root"></div></div>
  <script type="module">import React from 'react';import{createRoot}from'react-dom/client';import{VreWorkbench}from'/src/components/admin/VreWorkbench.tsx';import'/src/index.css';
  const module=new URLSearchParams(location.search).get('module')||'verification';createRoot(document.getElementById('root')).render(React.createElement(VreWorkbench,{module,permissions:${JSON.stringify(permissions)}}));</script></body></html>`;
  res.type('html').send(await vite.transformIndexHtml(req.originalUrl,html));
});
app.use(vite.middlewares);
const server=app.listen(5179,'127.0.0.1',()=>console.log('VRE read-only visual preview: http://127.0.0.1:5179/__vre-preview'));
process.on('SIGINT',()=>{server.close();void vite.close();});
