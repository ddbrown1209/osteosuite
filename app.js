
(function(){
  const isClient = location.pathname.endsWith('client.html');
  const toast=(m)=>{const t=document.getElementById('toast'); if(!t) return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);};
  // API helpers (server-first, fallback to localStorage)
  async function loadDB(){try{const r=await fetch('api/data'); if(!r.ok) throw 0; const j=await r.json(); localStorage.setItem('osteo.data', JSON.stringify(j)); return j;}catch(e){return JSON.parse(localStorage.getItem('osteo.data')||'{}')||{clients:[],profile:{}};}}
  async function saveDB(db){try{await fetch('api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(db)});}catch(e){} localStorage.setItem('osteo.data', JSON.stringify(db)); }
  async function createClient(c){try{const r=await fetch('api/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)}); if(r.ok){return await r.json();}}catch(e){} c.id='c_'+Math.random().toString(36).slice(2,9); return c;}
  async function updateClient(c){try{await fetch('api/clients/'+c.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});}catch(e){}}
  async function deleteClient(id){try{await fetch('api/clients/'+id,{method:'DELETE'});}catch(e){}}

  let DB={clients:[],profile:{clinic:{name:'Clinic',address:''},reviews:[]}}; let currentId=null;
  const bmi=(w,hcm)=>{const h=hcm/100; return Math.round((w/(h*h))*10)/10;};
  const fmt=(d)=> new Date(d).toLocaleDateString();

  // Practitioner
  async function renderPractitioner(){
    const list=document.getElementById('clients'); list.innerHTML='';
    DB.clients.forEach(c=>{const el=document.createElement('div'); el.className='item'+(c.id===currentId?' active':''); el.innerHTML=`<div class="row" style="justify-content:space-between"><div><strong>${c.name}</strong><div class="small">${c.details||''}</div></div><div class="small">${c.days?.at(-1)?.pain??''}</div></div>`; el.onclick=()=>{currentId=c.id; localStorage.setItem('osteo.current',currentId); renderPractitioner();}; list.appendChild(el);});
    const c = DB.clients.find(x=>x.id===currentId)||DB.clients[0]; if(!c) return; currentId=c.id;

    // KPIs
    document.getElementById('kpiVisits').textContent=c.snapshot?.visits??'–';
    document.getElementById('kpiPain').textContent=(c.snapshot?.pain||[]).slice(-7).join(' / ')||'–';
    document.getElementById('kpiAdh').textContent=(c.snapshot?.adherence??'–')+'%';
    document.getElementById('kpiOutcome').textContent=c.snapshot?.outcome?`NDI ${c.snapshot.outcome.ndiFrom} → ${c.snapshot.outcome.ndiTo}`:'–';
    document.getElementById('hpWeight').textContent=(c.health?.weight??'-')+' kg';
    document.getElementById('hpBmi').textContent=c.health?.bmi??'-';
    document.getElementById('hpBp').textContent=c.health?.bpS?`${c.health.bpS}/${c.health.bpD} • ${c.health.hr} bpm`:'–';
    document.getElementById('hpSleep').textContent=(c.health?.sleep??'-')+' h • '+(c.health?.steps??'-')+' steps';

    // Upcoming
    const up=document.getElementById('upcoming'); up.innerHTML=''; (c.appointments||[]).forEach(a=>{const row=document.createElement('div'); row.className='item'; row.innerHTML=`<strong>${a.title}</strong> <span class="small">• ${fmt(a.date)} • ${a.duration} min</span>`; up.appendChild(row);});

    // Exercises
    const ex=document.getElementById('exerciseList'); ex.innerHTML=''; (c.exercises||[]).forEach(e=>{const row=document.createElement('div'); row.className='item'; row.innerHTML=`<div><strong>${e.name}</strong><div class="small">${e.prescription}</div></div>`; ex.appendChild(row);});

    // Billing
    const b=document.getElementById('billing'); b.innerHTML=''; (c.billing||[]).forEach(v=>{const r=document.createElement('div'); r.className='item'; r.innerHTML=`<div class="row" style="justify-content:space-between"><div><strong>${v.status}</strong><div class="small">${v.id} • ${fmt(v.date)}</div></div><div>£${v.amount.toFixed(2)}</div></div>`; b.appendChild(r);});

    // Body map + pins (click to delete)
    const map=document.getElementById('bodyMap'); map.innerHTML='';
    (c.bodyPins||[]).forEach((p,idx)=>{const pin=document.createElement('div'); pin.className='pin'; pin.style.left=p.x+'%'; pin.style.top=p.y+'%'; pin.title=p.label||'Pain'; pin.onclick=()=>{ if(confirm('Delete pin?')){ c.bodyPins.splice(idx,1); save();} }; map.appendChild(pin);});
    document.getElementById('addMarkerBtn').onclick=()=>{ map.onclick=(ev)=>{const r=map.getBoundingClientRect(); const x=Math.round((ev.clientX-r.left)/r.width*100), y=Math.round((ev.clientY-r.top)/r.height*100); c.bodyPins=c.bodyPins||[]; c.bodyPins.push({x,y,label:'Pain'}); map.onclick=null; save(); toast('Pin added');}; toast('Click on the body map to place a pin.'); };
    document.getElementById('recordPainBtn').onclick=()=>{ const v=parseInt(prompt('Pain today (0–10)')||''); if(isNaN(v)) return; c.snapshot=c.snapshot||{}; c.snapshot.pain=(c.snapshot.pain||[]).slice(-6); c.snapshot.pain.push(v); save(); };

    // Health modal
    document.getElementById('editHealthBtn').onclick=()=>{ const m=document.getElementById('healthModal'); weightInput.value=c.health?.weight||''; heightInput.value=c.health?.height||''; waistInput.value=c.health?.waist||''; bps.value=c.health?.bpS||''; bpd.value=c.health?.bpD||''; hr.value=c.health?.hr||''; m.classList.add('show'); };
    const closeH=()=>document.getElementById('healthModal').classList.remove('show'); document.getElementById('closeHealth').onclick=closeH; document.getElementById('cancelHealth').onclick=closeH;
    document.getElementById('saveHealth').onclick=()=>{ c.health=c.health||{}; c.health.weight=parseFloat(weightInput.value)||c.health.weight; c.health.height=parseFloat(heightInput.value)||c.health.height; c.health.waist=parseFloat(waistInput.value)||c.health.waist; c.health.bpS=parseInt(bps.value)||c.health.bpS; c.health.bpD=parseInt(bpd.value)||c.health.bpD; c.health.hr=parseInt(hr.value)||c.health.hr; if(c.health.weight&&c.health.height) c.health.bmi=bmi(c.health.weight,c.health.height); closeH(); save(); };

    // Goals modal
    document.getElementById('setGoalsBtn').onclick=()=>{ startWeight.value=c.weightGoal?.startWeight||c.health?.weight||''; targetWeight.value=c.weightGoal?.targetWeight||''; exerciseTarget.value=c.exerciseGoal?.target||0; bpSysTarget.value=c.bpGoal?.targetSys||''; bpDiaTarget.value=c.bpGoal?.targetDia||''; document.getElementById('goalsModal').classList.add('show'); };
    const closeG=()=>document.getElementById('goalsModal').classList.remove('show'); document.getElementById('closeGoals').onclick=closeG; document.getElementById('cancelGoals').onclick=closeG;
    document.getElementById('saveGoals').onclick=()=>{ c.weightGoal=c.weightGoal||{history:[]}; c.weightGoal.startWeight=parseFloat(startWeight.value)||c.weightGoal.startWeight; c.weightGoal.targetWeight=parseFloat(targetWeight.value)||c.weightGoal.targetWeight; c.exerciseGoal=c.exerciseGoal||{target:0,completions:0}; c.exerciseGoal.target=parseInt(exerciseTarget.value)||0; c.bpGoal={targetSys:parseInt(bpSysTarget.value)||null,targetDia:parseInt(bpDiaTarget.value)||null}; closeG(); save(); };

    // Exercise plan editor
    document.getElementById('editPlanBtn').onclick=()=>{ alert('Open client view → daily plan auto-populates from exercisePlan; editor coming next iteration.'); };

    // Invoices
    document.getElementById('addInvoiceBtn').onclick=()=>{ invId.value='INV-'+Math.floor(Math.random()*9000+1000); invAmount.value='60.00'; invNotes.value='Consultation and treatment'; document.getElementById('invoiceModal').classList.add('show'); };
    const closeI=()=>document.getElementById('invoiceModal').classList.remove('show'); document.getElementById('closeInv').onclick=closeI; document.getElementById('cancelInv').onclick=closeI;
    document.getElementById('saveInv').onclick=()=>{ const inv={id:invId.value,date:new Date().toISOString().slice(0,10),amount:parseFloat(invAmount.value),notes:invNotes.value,status:'Outstanding'}; c.billing=c.billing||[]; c.billing.push(inv); closeI(); save(); };
    document.getElementById('pdfInv').onclick=()=>{ const inv={id:invId.value,date:new Date().toISOString().slice(0,10),amount:parseFloat(invAmount.value),notes:invNotes.value,status:'Outstanding'}; fetch('api/invoice/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoice:inv,client:c,clinic:DB.profile.clinic})}).then(r=>r.blob()).then(b=>{const url=URL.createObjectURL(b); const a=document.createElement('a'); a.href=url; a.download=(inv.id||'invoice')+'.pdf'; a.click(); URL.revokeObjectURL(url);}); };

    // Onboarding / client login
    const openNC=()=>{ const m=document.getElementById('newClientModal'); m.classList.add('show'); document.getElementById('clientLink').textContent=location.origin+location.pathname.replace('index.html','client.html')+'#client='+(c.id||'');};
    document.getElementById('newClientBtn').onclick=openNC; document.getElementById('clientLoginBtn').onclick=openNC;
    document.getElementById('closeNewClient').onclick=()=>document.getElementById('newClientModal').classList.remove('show');
    document.getElementById('cancelNewClient').onclick=()=>document.getElementById('newClientModal').classList.remove('show');
    document.getElementById('createClient').onclick=async ()=>{ const nc={name:ncName.value,email:ncEmail.value,dob:ncDob.value,details:ncComplaint.value,health:{height:parseFloat(ncHeight.value)||null,weight:parseFloat(ncWeight.value)||null}}; if(nc.health.height&&nc.health.weight) nc.health.bmi=bmi(nc.health.weight,nc.health.height); const created=await createClient(nc); DB.clients.push(created); currentId=created.id; save(); document.getElementById('newClientModal').classList.remove('show'); toast('Client created'); };
    document.getElementById('deleteClient').onclick=async ()=>{ if(!confirm('Delete this client?')) return; const idx=DB.clients.findIndex(x=>x.id===currentId); if(idx>-1){ const id=DB.clients[idx].id; DB.clients.splice(idx,1); await deleteClient(id); save(); } };

    // Tabs
    document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); document.querySelectorAll('[data-panel]').forEach(p=>p.style.display=p.getAttribute('data-panel')===t.dataset.tab?'block':'none'); });

    async function save(){ await saveDB(DB); renderPractitioner(); }
  }

  // Client
  function startOfWeek(d){const dt=new Date(d); const day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); dt.setHours(0,0,0,0); return dt;}
  async function renderClient(){
    const id=(location.hash.split('client=').pop()||'').trim(); const c=DB.clients.find(x=>x.id===id)||DB.clients[0]; if(!c){ document.body.innerHTML='<div class="app"><main class="main"><div class="card">No client found.</div></main></div>'; return; }
    document.getElementById('clientName').textContent=c.name;
    const wk=document.getElementById('week'); wk.innerHTML=''; const start=startOfWeek(new Date()); const end=new Date(start); end.setDate(start.getDate()+6); document.getElementById('weekRange').textContent=start.toLocaleDateString()+' – '+end.toLocaleDateString();
    c.days=c.days||[];
    for(let i=0;i<7;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const iso=d.toISOString().slice(0,10); const rec=c.days.find(x=>x.date===iso)||{date:iso,exercisesDone:false}; const el=document.createElement('div'); el.className='day'+(rec.exercisesDone && rec.pain!=null ? ' done':''); el.innerHTML=`<div class="small">${d.toLocaleDateString(undefined,{weekday:'short'})}</div><div>${d.getDate()}</div>`; el.onclick=()=>openCheck(rec,c); wk.appendChild(el); }
    const plan=document.getElementById('todaysPlan'); plan.innerHTML=''; const key=['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]; const ids=(c.exercisePlan&&c.exercisePlan[key])||[]; (ids.map(i=>c.exercises[i]).filter(Boolean)).forEach(ex=>{const chip=document.createElement('div'); chip.className='badge'; chip.textContent=ex.name; plan.appendChild(chip);});
    const goals=document.getElementById('clientGoals'); goals.innerHTML=''; const xp=c.xp||0; const lvl=Math.floor(xp/100)+1; goals.innerHTML += `<div class="kpi"><div class="small">Level</div><div class="v">${lvl}</div><div class="progress" style="margin-top:8px"><span style="width:${(xp%100)}%"></span></div></div>`;
    if(c.weightGoal && c.weightGoal.targetWeight){ const s=c.weightGoal.startWeight, t=c.weightGoal.targetWeight, cur=c.health?.weight||s; const total=Math.max(0,s-t), ach=Math.max(0,s-cur), pct=total>0?Math.min(100,Math.round(ach/total*100)):0; goals.innerHTML += `<div class="kpi"><div class="small">Weight goal</div><div class="v">${ach.toFixed(1)}kg / ${total.toFixed(1)}kg</div><div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div></div>`; }
    if(c.exerciseGoal && c.exerciseGoal.target>0){ const pct=Math.min(100,Math.round((c.exerciseGoal.completions||0)/c.exerciseGoal.target*100)); goals.innerHTML += `<div class="kpi"><div class="small">Exercise goal</div><div class="v">${c.exerciseGoal.completions||0}/${c.exerciseGoal.target}</div><div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div></div>`; }
    if(c.bpGoal && c.health?.bpS){ const ok=(c.health.bpS<=c.bpGoal.targetSys)&&(c.health.bpD<=c.bpGoal.targetDia); goals.innerHTML += `<div class="kpi"><div class="small">BP goal</div><div class="v">${c.health.bpS}/${c.health.bpD} mmHg</div><div class="small">${ok?'On target ✅':'Above target'}</div></div>`; }
    const inv=document.getElementById('cInvoices'); inv.innerHTML=''; (c.billing||[]).forEach(v=>{const row=document.createElement('div'); row.className='item'; row.innerHTML=`<div><strong>${v.status}</strong><div class="small">${v.id} • ${fmt(v.date)}</div></div><div>£${v.amount.toFixed(2)}</div>`; inv.appendChild(row);});
    document.getElementById('submitDay').onclick=()=>{ const iso=new Date().toISOString().slice(0,10); const rec=c.days.find(x=>x.date===iso)||{date:iso}; rec.pain=parseInt(document.getElementById('cPain').value)||rec.pain||0; const w=parseFloat(document.getElementById('cWeight').value); if(!isNaN(w)){ c.health.weight=w; if(c.health.height) c.health.bmi=bmi(w,c.health.height); c.weightGoal?.history?.push({date:iso,weight:w}); } rec.exercisesDone=true; if(c.exerciseGoal) c.exerciseGoal.completions=(c.exerciseGoal.completions||0)+1; if(!c.days.find(x=>x.date===iso)) c.days.push(rec); c.xp=(c.xp||0)+10; save(); toast('Daily check‑in saved ⭐'); };
    function openCheck(rec,c){ const m=document.getElementById('checkinModal'); m.classList.add('show'); ciExercises.value=rec.exercisesDone?'yes':'no'; ciSleep.value=rec.sleep||''; ciSteps.value=rec.steps||''; ciMood.value=rec.mood||'😊 Good'; document.getElementById('saveCheck').onclick=()=>{ rec.exercisesDone=(ciExercises.value==='yes'); rec.sleep=parseFloat(ciSleep.value)||rec.sleep; rec.steps=parseInt(ciSteps.value)||rec.steps; rec.mood=ciMood.value; const i=c.days.findIndex(x=>x.date===rec.date); if(i>-1) c.days[i]=rec; else c.days.push(rec); if(rec.exercisesDone && c.exerciseGoal) c.exerciseGoal.completions=(c.exerciseGoal.completions||0)+1; c.xp=(c.xp||0)+10; save(); m.classList.remove('show'); toast('Check‑in saved ⭐'); }; document.getElementById('closeCheck').onclick=()=>m.classList.remove('show'); document.getElementById('cancelCheck').onclick=()=>m.classList.remove('show'); }
    async function save(){ await saveDB(DB); renderClient(); }
  }

  // Boot
  loadDB().then(db=>{
    DB=db||{clients:[],profile:{clinic:{name:'Clinic',address:''},reviews:[]}};
    if(DB.clients.length===0){
      // Seed with 3 weeks of realistic data for Mark & James
      const today=new Date('2025-08-12'); const start=new Date(today); start.setDate(start.getDate()-21);
      function days(){const arr=[]; for(let i=0;i<=21;i++){const d=new Date(start); d.setDate(start.getDate()+i); arr.push({date:d.toISOString().slice(0,10), pain: Math.max(2, 7-Math.floor(i/3)), sleep: 6.5+((i%3)*0.5), steps: 3500+i*120, mood: (i%3!==0?'good':'ok'), exercisesDone: i%2===0});} return arr;}
      DB={profile:{clinic:{name:'DMK Performance & Injury — Osteopathy',address:'Swansea, UK'},reviews:['Rated 5.0/5 — Yably/Cylex','100% recommend — Facebook','“Darran is really professional and makes you feel at ease.”']},
        clients:[{id:'mark',name:'Mark Evans',email:'mark.evans@example.com',details:'Chronic upper thoracic pain (T4–T8), myofascial/postural – 9 months',snapshot:{visits:6,pain:[5,6,6,5,4,5,4],adherence:46,outcome:{ndiFrom:28,ndiTo:22}},health:{weight:101.8,height:178,waist:112,bmi:32.1,bpS:138,bpD:86,hr:84,sleep:5.8,steps:4200},appointments:[{date:'2025-08-14T11:30:00',title:'Follow-up',duration:45},{date:'2025-08-21T11:30:00',title:'Follow-up',duration:45}],exercises:[{name:'Thoracic extension over foam roller',prescription:'2×8 • daily • Slow breaths through range'},{name:'Wall angels',prescription:'2×10 • daily • Keep ribs down'},{name:'Scapular retraction (band rows)',prescription:'3×12 • 3×week'},{name:'Diaphragmatic breathing (90/90)',prescription:'1×5 • daily • 5 slow breaths'}],exercisePlan:{mon:[0,1,3],tue:[0,2,3],wed:[1,3],thu:[0,2],fri:[0,1,3],sat:[2],sun:[3]},goals:[{id:'desk',description:'Work at desk 60 min with pain < 3/10',target:10,progress:6},{id:'ndi',description:'Reduce NDI by ≥ 6 points',target:6,progress:6}],weightGoal:{startWeight:102.4,targetWeight:98.0,history:[{date:'2025-07-23',weight:102.4},{date:'2025-07-29',weight:101.5},{date:'2025-08-05',weight:101.0},{date:'2025-08-12',weight:101.8}]},exerciseGoal:{target:5,completions:3,lastReset:'2025-08-09'},bpGoal:{targetSys:130,targetDia:85},bodyPins:[{x:48,y:35,label:'Upper thoracic'}],notes:[],assessments:[],timeline:[],billing:[{id:'INV-2004',date:'2025-08-08',amount:60.00,status:'Outstanding',notes:'Follow-up'}],xp:240,days:days()},
                 {id:'james',name:\"James O'Connor\",email:'joconnor@example.com',details:'Right shoulder impingement — 4 months',snapshot:{visits:2,pain:[6,5,5,4,4,4,4],adherence:52,outcome:{ndiFrom:18,ndiTo:14}},health:{weight:78.2,height:181,waist:84,bmi:23.9,bpS:122,bpD:78,hr:66,sleep:7.2,steps:9200},appointments:[{date:'2025-08-16T10:00:00',title:'Follow-up',duration:30}],exercises:[{name:'Sleeper stretch',prescription:'2×30s • daily'},{name:'Scapular retraction',prescription:'3×12 • 3×week'}],exercisePlan:{mon:[0,1],wed:[1],fri:[0,1],sun:[0]},goals:[{id:'run',description:'Return to 5k pain‑free',target:1,progress:0}],weightGoal:null,exerciseGoal:{target:4,completions:1},bpGoal:null,bodyPins:[],billing:[],xp:40,days:days()[-10:]}]};
      saveDB(DB);
    }
    currentId = localStorage.getItem('osteo.current') || (DB.clients[0]?.id||null);
    if(isClient) renderClient(); else renderPractitioner();
  });
})();