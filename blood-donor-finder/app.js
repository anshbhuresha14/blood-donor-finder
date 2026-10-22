const KEY = 'lifelink_donors';
const GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
// recipient group -> donor groups that can give to them
const CAN_RECEIVE = {'A+':['A+','A-','O+','O-'],'A-':['A-','O-'],'B+':['B+','B-','O+','O-'],'B-':['B-','O-'],
  'AB+':GROUPS,'AB-':['A-','B-','AB-','O-'],'O+':['O+','O-'],'O-':['O-']};
const DEFAULT_LOC = {lat:28.6139, lng:77.2090}; // Delhi
let myLoc = null;       // search origin
let regLoc = null;      // location attached to registration

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fill(sel){ sel.innerHTML = GROUPS.map(g => `<option>${g}</option>`).join(''); }
fill($('sGroup')); fill($('rGroup')); $('sGroup').value = 'O+';

function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }

function km(a,b){
  const R=6371, r=x=>x*Math.PI/180;
  const dLat=r(b.lat-a.lat), dLng=r(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function eligible(d){
  if(!d.available) return false;
  if(!d.last) return true;
  return (Date.now()-new Date(d.last))/864e5 >= 90;
}

function seed(center){
  const names=['Aarav Sharma','Priya Singh','Rohan Verma','Sneha Gupta','Imran Khan','Anjali Mehta','Vikram Rao','Neha Joshi','Karan Patel','Pooja Nair','Aditya Kumar','Simran Kaur','Rahul Das','Meera Iyer','Arjun Reddy','Fatima Sheikh'];
  const d = names.map((n,i)=>{
    const ang=Math.random()*2*Math.PI, dist=Math.random()*30; // within 30 km
    return {id:'demo'+i, name:n, phone:'9'+String(Math.floor(100000000+Math.random()*899999999)),
      group:GROUPS[i%8], city:'Nearby', available:Math.random()>0.2,
      last:Math.random()>0.5?new Date(Date.now()-Math.random()*200*864e5).toISOString().slice(0,10):'',
      lat:center.lat+Math.cos(ang)*dist/111, lng:center.lng+Math.sin(ang)*dist/(111*Math.cos(center.lat*Math.PI/180))};
  });
  save(d.concat(load().filter(x=>!String(x.id).startsWith('demo'))));
}

function getLoc(ok, fail){
  if(!navigator.geolocation){ fail('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    p => ok({lat:p.coords.latitude, lng:p.coords.longitude}),
    e => fail(e.message || 'Permission denied'),
    {enableHighAccuracy:true, timeout:10000});
}

function stats(){
  const d=load();
  $('stDonors').textContent=d.length;
  $('stAvail').textContent=d.filter(eligible).length;
}

function search(){
  const origin = myLoc || DEFAULT_LOC;
  const g=$('sGroup').value, radius=+$('sRadius').value;
  const groups = $('sCompat').checked ? CAN_RECEIVE[g] : [g];
  let list = load().filter(d => groups.includes(d.group))
    .map(d => ({...d, dist:km(origin,d)}))
    .filter(d => d.dist<=radius && (!$('sAvail').checked || eligible(d)))
    .sort((a,b)=> (a.group===g?0:1)-(b.group===g?0:1) || a.dist-b.dist);
  const box=$('results');
  if(!list.length){ box.innerHTML='<div class="empty">No donors found. Try a bigger radius or include compatible groups.</div>'; return; }
  box.innerHTML = list.map((d,i)=>{
    const ph = '91'+d.phone;
    const msg = encodeURIComponent(`URGENT: Need ${g} blood. Can you help? – via LifeLink`);
    return `<div class="donor" style="animation-delay:${i*40}ms">
      <div class="top"><span class="bg">${esc(d.group)}</span>
      <span class="tag ${eligible(d)?'ok':'no'}">${eligible(d)?'Available':'Not eligible'}</span></div>
      <b>${esc(d.name)}</b>
      <span class="muted">📍 ${esc(d.city)} • <span class="dist">${d.dist.toFixed(1)} km away</span></span>
      <span class="muted">Last donated: ${d.last?esc(d.last):'Never / not set'}</span>
      <div class="acts"><a class="call" href="tel:+${ph}">📞 Call</a>
      <a class="wa" target="_blank" rel="noopener" href="https://wa.me/${ph}?text=${msg}">💬 WhatsApp</a></div></div>`;
  }).join('');
}

$('btnSearch').onclick = search;
$('btnLoc').onclick = () => {
  $('locStatus').textContent='Getting your location…';
  getLoc(l=>{ myLoc=l; $('locStatus').textContent='✅ Using your live location.'; search(); },
         e=>{ $('locStatus').textContent='⚠️ '+e+' – using demo location.'; });
};
$('btnRegLoc').onclick = () => {
  $('regMsg').textContent='Getting location…';
  getLoc(l=>{ regLoc=l; $('regMsg').textContent='✅ Location attached.'; },
         e=>{ $('regMsg').textContent='⚠️ '+e; });
};
$('regForm').onsubmit = e => {
  e.preventDefault();
  if(!regLoc){ $('regMsg').textContent='⚠️ Please click “Attach my location” first.'; return; }
  const d=load();
  d.push({id:'u'+Date.now(), name:$('rName').value.trim(), phone:$('rPhone').value, group:$('rGroup').value,
    city:$('rCity').value.trim(), available:$('rAvail').checked, last:$('rLast').value, lat:regLoc.lat, lng:regLoc.lng});
  save(d); stats(); e.target.reset(); regLoc=null;
  $('regMsg').textContent='🎉 Registered! Thank you for saving lives.';
};
$('btnReset').onclick = () => {
  const c = myLoc || DEFAULT_LOC;
  save(load().filter(x=>!String(x.id).startsWith('demo'))); seed(c); stats(); search();
  alert('Demo donors regenerated around '+(myLoc?'your location':'Delhi'));
};

if(!load().length) seed(DEFAULT_LOC);
stats(); search();
