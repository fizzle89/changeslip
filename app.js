/* Changeslip app - browser UI over the engine. PRO flag gates persistence. */
(function(){
const $ = id => document.getElementById(id);
const PRO = !!window.CO_PRO;
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let state = {
  company: '', project: '', job_no: '',
  tpl: { gc_name:'', packet_title:'Change Order Request', ref_label:'COR No.', labor_markup:'10', material_markup:'10', equipment_markup:'10', ohp_markup:'5', compound:false, cover_note:'', required_docs:['receipt'] },
  rates: [ {type:'labor', class_code:'JW', rate_st:'74', rate_ot:'111'} ],
  docs: [], lines: [], seq: 1,
  ticket: { ref:'', title:'', work_date:'', signed_by:'' },
  approved: null,
};
function loadState(){ if(!PRO) return; try{ const s = JSON.parse(localStorage.getItem('changeslip.state.v1')||'null'); if(s) state = s; }catch(e){} }
function saveState(){ if(!PRO) return; localStorage.setItem('changeslip.state.v1', JSON.stringify(state)); }
function bind(id, get, set){ const el=$(id); el.value = get(); el.addEventListener('input', ()=>{ set(el.type==='checkbox'?el.checked:el.value); state.approved=null; recalc(); saveState(); }); if(el.type==='checkbox') el.checked=get(); }
function ratesMap(){ return Changeslip.buildRates(state.rates); }
function priced(){ return Changeslip.priceTicket(state.lines, ratesMap(), state.tpl); }
function currentFlags(){ return Changeslip.flags(state.ticket, state.lines, state.docs, state.tpl, ratesMap()); }
function recalc(){
  const p = priced(); const f = currentFlags();
  $('sumBody').innerHTML = [
    ['Labor', p.subtotals.labor], ['Labor markup '+esc(state.tpl.labor_markup||'0')+'%', p.markups.labor],
    ['Material', p.subtotals.material], ['Material markup '+esc(state.tpl.material_markup||'0')+'%', p.markups.material],
    ['Equipment', p.subtotals.equipment], ['Equipment markup '+esc(state.tpl.equipment_markup||'0')+'%', p.markups.equipment],
    ['Overhead & profit '+esc(state.tpl.ohp_markup||'0')+'%'+(state.tpl.compound?' (compounded)':''), p.ohp],
  ].map(r=>'<tr><td>'+r[0]+'</td><td style="text-align:right">'+Changeslip.fm(r[1])+'</td></tr>').join('')
  + '<tr style="font-weight:700;border-top:2px solid #1c1a17"><td>TOTAL REQUESTED</td><td style="text-align:right">'+Changeslip.fm(p.total)+'</td></tr>';
  const blocks = f.filter(x=>x.severity==='block'), warns = f.filter(x=>x.severity==='warn');
  $('flagsBox').innerHTML = f.length
    ? '<ul style="margin:6px 0;padding-left:20px">'+f.map(x=>'<li class="'+(x.severity==='block'?'err':'warn')+'">'+(x.severity==='block'?'Must fix: ':'Note: ')+esc(x.text)+'</li>').join('')+'</ul>'
    : '<p class="ok">No open items. Ready for a person to review the amounts.</p>';
  $('approveBtn').disabled = blocks.length > 0 || !state.company || !state.tpl.gc_name;
  $('approveNote').textContent = blocks.length ? 'Approval is locked until every "must fix" item above is resolved.' : (warns.length ? 'Exporting acknowledges the open notes above in the packet.' : 'Ready to approve and export.');
  renderLines(); renderDocs(); renderRates(); saveState();
}
function renderRates(){
  $('rateRows').innerHTML = state.rates.map((r,i)=>
    '<tr><td><select data-i="'+i+'" data-f="type" class="rateIn"><option value="labor"'+(r.type==='labor'?' selected':'')+'>labor</option><option value="equipment"'+(r.type==='equipment'?' selected':'')+'>equipment</option></select></td>'+
    '<td><input class="rateIn" data-i="'+i+'" data-f="class_code" value="'+esc(r.class_code)+'" placeholder="code e.g. JW"></td>'+
    '<td><input class="rateIn" data-i="'+i+'" data-f="rate_st" value="'+esc(r.rate_st)+'" size="7" placeholder="ST $/h"></td>'+
    '<td><input class="rateIn" data-i="'+i+'" data-f="rate_ot" value="'+esc(r.rate_ot||'')+'" size="7" placeholder="OT $/h"></td>'+
    '<td><button class="mini" data-del-rate="'+i+'">remove</button></td></tr>').join('');
  document.querySelectorAll('.rateIn').forEach(el=>el.addEventListener('input',()=>{ state.rates[+el.dataset.i][el.dataset.f]=el.value; state.approved=null; recalc(); }));
  document.querySelectorAll('[data-del-rate]').forEach(b=>b.addEventListener('click',()=>{ state.rates.splice(+b.dataset.delRate,1); state.approved=null; recalc(); }));
}
function renderDocs(){
  $('docRows').innerHTML = state.docs.length ? state.docs.map((d,i)=>
    '<tr><td>'+esc(d.kind.replace('_',' '))+'</td><td>'+esc(d.filename)+'</td><td><button class="mini" data-del-doc="'+i+'">remove</button></td></tr>').join('')
    : '<tr><td colspan="3" class="mut">No documents recorded. Record the signed ticket at least - file names only; nothing is uploaded.</td></tr>';
  document.querySelectorAll('[data-del-doc]').forEach(b=>b.addEventListener('click',()=>{ state.docs.splice(+b.dataset.delDoc,1); state.approved=null; recalc(); }));
}
function renderLines(){
  const docOpts = sel => '<option value="">- none -</option>'+state.docs.map(d=>'<option value="'+d.id+'"'+(sel===d.id?' selected':'')+'>'+esc(d.filename)+'</option>').join('');
  $('lineRows').innerHTML = state.lines.length ? state.lines.map((l,i)=>{
    let f1='',f2='';
    if(l.type==='labor'){ f1='<input class="lnIn" data-i="'+i+'" data-f="class_code" value="'+esc(l.class_code||'')+'" size="5" placeholder="class"> <input class="lnIn" data-i="'+i+'" data-f="hours_st" value="'+esc(l.hours_st||'')+'" size="3" placeholder="ST h"> <input class="lnIn" data-i="'+i+'" data-f="hours_ot" value="'+esc(l.hours_ot||'')+'" size="3" placeholder="OT h">';
      f2='<select class="lnIn" data-i="'+i+'" data-f="source_doc_id">'+docOpts(l.source_doc_id)+'</select>'; }
    else if(l.type==='material'){ f1='<input class="lnIn" data-i="'+i+'" data-f="qty" value="'+esc(l.qty||'')+'" size="3" placeholder="qty"> <input class="lnIn" data-i="'+i+'" data-f="unit" value="'+esc(l.unit||'')+'" size="3" placeholder="unit"> <input class="lnIn" data-i="'+i+'" data-f="unit_cost" value="'+esc(l.unit_cost||'')+'" size="6" placeholder="$ each">';
      f2='<select class="lnIn" data-i="'+i+'" data-f="source_doc_id">'+docOpts(l.source_doc_id)+'</select>'; }
    else { f1='<input class="lnIn" data-i="'+i+'" data-f="class_code" value="'+esc(l.class_code||'')+'" size="5" placeholder="code or blank"> <input class="lnIn" data-i="'+i+'" data-f="qty" value="'+esc(l.qty||'')+'" size="3" placeholder="qty"> <input class="lnIn" data-i="'+i+'" data-f="unit_cost" value="'+esc(l.unit_cost||'')+'" size="6" placeholder="$ if no rate">';
      f2='<select class="lnIn" data-i="'+i+'" data-f="source_doc_id">'+docOpts(l.source_doc_id)+'</select>'; }
    const amt = Changeslip.lineAmount(l, ratesMap());
    return '<tr><td>'+esc(l.type)+'</td><td><input class="lnIn" data-i="'+i+'" data-f="description" value="'+esc(l.description||'')+'" size="18" placeholder="description"></td><td>'+f1+'</td><td>'+f2+'</td><td style="text-align:right">'+Changeslip.fm(amt.amount)+'</td><td><label style="font-weight:400;font-size:12px"><input type="checkbox" class="lnIn" data-i="'+i+'" data-f="confirmed"'+(l.confirmed?' checked':'')+'> confirmed</label></td><td><button class="mini" data-del-line="'+i+'">x</button></td></tr>';
  }).join('') : '<tr><td colspan="7" class="mut">No lines yet. Add labor, material and equipment lines from the ticket. A person types and confirms every line - nothing is read from photos.</td></tr>';
  document.querySelectorAll('.lnIn').forEach(el=>el.addEventListener('input',()=>{
    const l = state.lines[+el.dataset.i]; const f = el.dataset.f;
    l[f] = el.type==='checkbox' ? (el.checked?1:0) : el.value;
    state.approved=null; recalc();
  }));
  document.querySelectorAll('[data-del-line]').forEach(b=>b.addEventListener('click',()=>{ state.lines.splice(+b.dataset.delLine,1); state.approved=null; recalc(); }));
}
$('addRate').addEventListener('click',()=>{ state.rates.push({type:'labor',class_code:'',rate_st:'',rate_ot:''}); recalc(); });
$('addDoc').addEventListener('click',()=>{
  const kind=$('docKind').value, name=$('docName').value.trim();
  if(!name) return;
  state.docs.push({id:'d'+(state.seq++), kind, filename:name}); $('docName').value=''; state.approved=null; recalc();
});
$('addLine').addEventListener('click',()=>{ state.lines.push({id:'l'+(state.seq++), type:$('lineType').value, description:'', confirmed:0}); state.approved=null; recalc(); });
bind('coName', ()=>state.company, v=>state.company=v);
bind('gcName', ()=>state.tpl.gc_name, v=>state.tpl.gc_name=v);
bind('projName', ()=>state.project, v=>state.project=v);
bind('jobNo', ()=>state.job_no, v=>state.job_no=v);
bind('packetTitle', ()=>state.tpl.packet_title, v=>state.tpl.packet_title=v);
bind('refLabel', ()=>state.tpl.ref_label, v=>state.tpl.ref_label=v);
bind('mkLabor', ()=>state.tpl.labor_markup, v=>state.tpl.labor_markup=v);
bind('mkMat', ()=>state.tpl.material_markup, v=>state.tpl.material_markup=v);
bind('mkEquip', ()=>state.tpl.equipment_markup, v=>state.tpl.equipment_markup=v);
bind('mkOhp', ()=>state.tpl.ohp_markup, v=>state.tpl.ohp_markup=v);
bind('compound', ()=>state.tpl.compound, v=>state.tpl.compound=v);
bind('coverNote', ()=>state.tpl.cover_note, v=>state.tpl.cover_note=v);
bind('tRef', ()=>state.ticket.ref, v=>state.ticket.ref=v);
bind('tTitle', ()=>state.ticket.title, v=>state.ticket.title=v);
bind('tDate', ()=>state.ticket.work_date, v=>state.ticket.work_date=v);
bind('tSigned', ()=>state.ticket.signed_by, v=>state.ticket.signed_by=v);
$('approveBtn').addEventListener('click',()=>{
  const approver=$('approver').value.trim();
  if(!approver){ $('approveNote').textContent='Type the name of the person approving these amounts first.'; return; }
  const blocks = currentFlags().filter(x=>x.severity==='block');
  if(blocks.length) return;
  const warns = currentFlags().filter(x=>x.severity==='warn').map(x=>x.text);
  const at = new Date().toISOString().slice(0,10);
  buildPacket(approver, at, warns);
  if(PRO){
    const reg = JSON.parse(localStorage.getItem('changeslip.register.v1')||'[]');
    const p = priced();
    reg.push({when:new Date().toISOString(), ref:state.ticket.ref, title:state.ticket.title, approver, total:p.total, lines:p.lines.length});
    localStorage.setItem('changeslip.register.v1', JSON.stringify(reg));
    if(window.renderRegister) window.renderRegister();
  }
});
function td(doc,x,y,w,txt,opts){ doc.text(String(txt), x, y, opts||{}); }
function buildPacket(approver, at, warns){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'letter'});
  const p = priced(); const L=50; let y=56;
  doc.setFontSize(18); td(doc,L,y,0,state.tpl.packet_title||'Change Order Request'); y+=20;
  doc.setFontSize(10);
  td(doc,L,y,0,state.company+'  to  '+state.tpl.gc_name); y+=16;
  doc.setDrawColor(160); doc.line(L,y,562,y); y+=16;
  const meta=[['Project',state.project],['Job no.',state.job_no],[state.tpl.ref_label||'COR No.',state.ticket.ref],['Description',state.ticket.title],['Work date',state.ticket.work_date],['Ticket signed by',state.ticket.signed_by],['Amounts approved by',approver+' on '+at]];
  meta.forEach(m=>{ doc.setFont(undefined,'bold'); td(doc,L,y,0,m[0]); doc.setFont(undefined,'normal'); td(doc,L+120,y,0,m[1]||'-'); y+=14; });
  y+=10; doc.setFontSize(13); doc.setFont(undefined,'bold'); td(doc,L,y,0,'Summary'); y+=14; doc.setFontSize(10); doc.setFont(undefined,'normal');
  const rows=[['Labor',p.subtotals.labor],['Labor markup '+(state.tpl.labor_markup||'0')+'%',p.markups.labor],['Material',p.subtotals.material],['Material markup '+(state.tpl.material_markup||'0')+'%',p.markups.material],['Equipment',p.subtotals.equipment],['Equipment markup '+(state.tpl.equipment_markup||'0')+'%',p.markups.equipment],['Overhead and profit '+(state.tpl.ohp_markup||'0')+'%'+(state.tpl.compound?' (compounded)':''),p.ohp]];
  rows.forEach(r=>{ td(doc,L+8,y,0,r[0]); td(doc,540,y,0,Changeslip.fm(r[1]),{align:'right'}); y+=13; doc.setDrawColor(220); doc.line(L,y-10,562,y-10); });
  doc.setFont(undefined,'bold'); td(doc,L+8,y,0,'TOTAL REQUESTED'); td(doc,540,y,0,Changeslip.fm(p.total),{align:'right'}); y+=18; doc.setFont(undefined,'normal');
  if(state.tpl.cover_note){ const lines=doc.splitTextToSize(state.tpl.cover_note,500); doc.text(lines,L,y); y+=lines.length*12+8; }
  if(warns.length){ doc.setFont(undefined,'bold'); td(doc,L,y,0,'Open items acknowledged by approver:'); y+=13; doc.setFont(undefined,'normal'); warns.forEach(w=>{ const wl=doc.splitTextToSize('- '+w,500); doc.text(wl,L,y); y+=wl.length*12+2; }); }
  doc.addPage(); y=56; doc.setFontSize(13); doc.setFont(undefined,'bold'); td(doc,L,y,0,'Line detail'); y+=16; doc.setFontSize(8.5); doc.setFont(undefined,'normal');
  const srcname={}; state.docs.forEach(d=>srcname[d.id]=d.filename);
  doc.setFont(undefined,'bold'); td(doc,L,y,0,'#'); td(doc,L+20,y,0,'Type'); td(doc,L+70,y,0,'Description'); td(doc,L+250,y,0,'Basis'); td(doc,L+400,y,0,'Amount'); td(doc,L+460,y,0,'Source'); y+=4; doc.line(L,y,562,y); y+=12; doc.setFont(undefined,'normal');
  p.lines.forEach((l,i)=>{
    let basis;
    if(l.type==='labor') basis=(l.class_code||'')+' ST '+(l.hours_st||0)+' / OT '+(l.hours_ot||0)+' h';
    else if(l.type==='equipment') basis=(l.class_code||'')+' '+(l.qty||0)+' '+(l.unit||'');
    else basis=(l.qty||'')+' '+(l.unit||'')+' @ '+Changeslip.fm(Changeslip.money(l.unit_cost));
    if(y>740){ doc.addPage(); y=56; }
    td(doc,L,y,0,String(i+1)); td(doc,L+20,y,0,l.type);
    const dl=doc.splitTextToSize(l.description||'',170); doc.text(dl,L+70,y);
    td(doc,L+250,y,0,basis); td(doc,L+430,y,0,Changeslip.fm(l.amount),{align:'right'});
    const src=doc.splitTextToSize(srcname[l.source_doc_id]||'-',95); doc.text(src,L+460,y);
    y+=Math.max(dl.length,src.length)*10+6;
  });
  y+=8; if(y>720){doc.addPage();y=56;}
  doc.setFontSize(9); doc.setFont(undefined,'bold'); td(doc,L,y,0,'Backup to send with this packet, in order:'); y+=12; doc.setFont(undefined,'normal');
  state.docs.forEach((d,i)=>{ td(doc,L,y,0,(i+1)+'. '+d.filename+' ('+d.kind.replace('_',' ')+')'); y+=12; });
  td(doc,L,y+6,0,'Note: backup files are not embedded in this PDF. Attach them when you submit the packet.'); 
  const fname='change-order-'+(state.ticket.ref||'packet').replace(/[^A-Za-z0-9-]+/g,'-')+'.pdf';
  doc.save(fname);
}
$('sampleBtn').addEventListener('click',()=>{
  state.company='Test Electric'; state.project='Riverside Clinic TI'; state.job_no='J-1042';
  state.tpl.gc_name='Riverside GC'; state.tpl.labor_markup='10'; state.tpl.material_markup='10'; state.tpl.equipment_markup='10'; state.tpl.ohp_markup='5'; state.tpl.compound=false;
  state.rates=[{type:'labor',class_code:'JW',rate_st:'74',rate_ot:'111'},{type:'equipment',class_code:'LIFT',rate_st:'185',rate_ot:'185'}];
  state.docs=[{id:'d'+(state.seq++),kind:'signed_ticket',filename:'signed-ticket-2026-10-01.pdf'},{id:'d'+(state.seq++),kind:'receipt',filename:'receipt-receptacles.png'}];
  state.ticket={ref:'PCO-1',title:'Add 4 receptacles',work_date:'2026-10-01',signed_by:'J. Super'};
  const did=state.docs[1].id;
  state.lines=[
    {id:'l'+(state.seq++),type:'labor',class_code:'JW',hours_st:'6',hours_ot:'2',description:'Journeyman - pull wire and terminate 4 receptacles',source_doc_id:state.docs[0].id,confirmed:1},
    {id:'l'+(state.seq++),type:'material',qty:'3',unit:'ea',unit_cost:'12.345',description:'Receptacles, 20A spec grade',source_doc_id:did,confirmed:1},
    {id:'l'+(state.seq++),type:'equipment',class_code:'LIFT',qty:'1',unit:'day',description:'Scissor lift',confirmed:1}];
  state.approved=null;
  ['coName','gcName','projName','jobNo','packetTitle','refLabel','mkLabor','mkMat','mkEquip','mkOhp','coverNote','tRef','tTitle','tDate','tSigned'].forEach(id=>{});
  // re-bind values into inputs
  $('coName').value=state.company; $('gcName').value=state.tpl.gc_name; $('projName').value=state.project; $('jobNo').value=state.job_no;
  $('packetTitle').value=state.tpl.packet_title; $('refLabel').value=state.tpl.ref_label;
  $('mkLabor').value=state.tpl.labor_markup; $('mkMat').value=state.tpl.material_markup; $('mkEquip').value=state.tpl.equipment_markup; $('mkOhp').value=state.tpl.ohp_markup;
  $('tRef').value=state.ticket.ref; $('tTitle').value=state.ticket.title; $('tDate').value=state.ticket.work_date; $('tSigned').value=state.ticket.signed_by;
  recalc();
});
loadState();
if(PRO && localStorage.getItem('changeslip.state.v1')){
  ['coName','gcName','projName','jobNo','packetTitle','refLabel','mkLabor','mkMat','mkEquip','mkOhp','coverNote','tRef','tTitle','tDate','tSigned'].forEach(id=>{ if($(id)) $(id).value = id==='coName'?state.company : id==='gcName'?state.tpl.gc_name : id==='projName'?state.project : id==='jobNo'?state.job_no : id==='packetTitle'?state.tpl.packet_title : id==='refLabel'?state.tpl.ref_label : id==='mkLabor'?state.tpl.labor_markup : id==='mkMat'?state.tpl.material_markup : id==='mkEquip'?state.tpl.equipment_markup : id==='mkOhp'?state.tpl.ohp_markup : id==='coverNote'?state.tpl.cover_note : id==='tRef'?state.ticket.ref : id==='tTitle'?state.ticket.title : id==='tDate'?state.ticket.work_date : state.ticket.signed_by; });
}
recalc();
})();
