/* =========================================================
   app.js — Router, state, auth & rendering semua halaman
   ========================================================= */
const KATEGORI_TABUNGAN = ['Umum','Darurat','Pendidikan','Liburan','Gadget','Kendaraan','Rumah','Lainnya'];
const KATEGORI_PENGELUARAN = ['Makanan','Minuman','Transportasi','Belanja','Pulsa','Internet','Pendidikan','Kesehatan','Game','Hiburan','Lainnya'];
const KATEGORI_ICON = {
  Umum:'savings', Darurat:'emergency', Pendidikan:'school', Liburan:'flight', Gadget:'smartphone',
  Kendaraan:'directions_car', Rumah:'home', Lainnya:'more_horiz', Makanan:'restaurant', Minuman:'local_cafe',
  Transportasi:'directions_bus', Belanja:'shopping_bag', Pulsa:'sim_card', Internet:'wifi', Kesehatan:'health_and_safety',
  Game:'sports_esports', Hiburan:'movie'
};

const state = {
  route: 'dashboard',
  user: null, // {id, nama, email, foto_url, role}
};

/* ---------------- Utilities ---------------- */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function rp(n){ return 'Rp ' + Math.round(n||0).toLocaleString('id-ID'); }
function fmtDate(d){ return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
function uid(){ return genId(); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

function toast(msg, type='success'){
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-8px)'; el.style.transition='.3s'; setTimeout(()=>el.remove(),300); }, 2600);
}
window.toast = toast;

function animateCount(el, to, prefix='Rp '){
  const from = 0; const dur = 800; const start = performance.now();
  function step(t){
    const p = Math.min((t-start)/dur, 1);
    const eased = 1 - Math.pow(1-p, 3);
    el.textContent = prefix + Math.round(from + (to-from)*eased).toLocaleString('id-ID');
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function openSheet(html){
  const overlay = $('#sheet-overlay');
  $('#sheet-content').innerHTML = html;
  overlay.classList.add('open');
}
function closeSheet(){ $('#sheet-overlay').classList.remove('open'); scannerApi?.stopScanner(); }
window.closeSheet = closeSheet;

// Pengganti confirm() bawaan browser dengan modal sesuai desain Tabungin.
function appConfirm(message, { title='Konfirmasi', okText='Oke', icon='help', danger=false } = {}){
  return new Promise((resolve)=>{
    const overlay = $('#confirm-overlay');
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#confirm-icon').textContent = icon;
    const okBtn = $('#confirm-ok');
    okBtn.textContent = okText;
    okBtn.className = danger ? 'btn btn-ghost' : 'btn btn-gold';
    if(danger) okBtn.style.color = 'var(--red)';
    else okBtn.style.color = '';
    overlay.classList.add('show');
    const cleanup = (result)=>{
      overlay.classList.remove('show');
      okBtn.onclick = null; $('#confirm-cancel').onclick = null;
      resolve(result);
    };
    okBtn.onclick = ()=> cleanup(true);
    $('#confirm-cancel').onclick = ()=> cleanup(false);
  });
}
window.appConfirm = appConfirm;

/* ---------------- Mode lokal tanpa login ---------------- */
// Tidak ada auth/Supabase/SQL. Satu profil lokal otomatis dibuat & disimpan di IndexedDB.
async function initAuth(){
  let user = await idb.getMeta('current_user');
  if(!user){
    user = { id: uid(), nama:'Saya', email:null, foto_url:null, role:'user' };
    await idb.setMeta('current_user', user);
  }
  state.user = user;
  return user;
}
async function resetAllData(){
  const ok = await appConfirm('Hapus SEMUA data lokal (tabungan, pengeluaran, target, dll)? Tindakan ini tidak bisa dibatalkan.', { title:'Reset Semua Data', icon:'delete_forever', okText:'Hapus', danger:true });
  if(!ok) return;
  for(const store of ['tabungan','target','pengeluaran','wishlist','challenge','produk']){
    await idb.clear(store);
  }
  toast('Semua data berhasil dihapus');
  navigate('dashboard');
}
window.resetAllData = resetAllData;

/* ---------------- Router ---------------- */
const ROUTES = {
  dashboard: { title:'Dashboard', icon:'dashboard', render: renderDashboard },
  tabungan: { title:'Tabungan', icon:'savings', render: renderTabungan },
  pengeluaran: { title:'Pengeluaran', icon:'receipt_long', render: renderPengeluaran },
  scan: { title:'Scan Barcode', icon:'qr_code_scanner', render: renderScan },
  struk: { title:'Scan Struk', icon:'document_scanner', render: renderStruk },
  target: { title:'Target Tabungan', icon:'flag', render: renderTarget },
  wishlist: { title:'Wishlist Impian', icon:'favorite', render: renderWishlist },
  statistik: { title:'Statistik', icon:'bar_chart', render: renderStatistik },
  insight: { title:'AI Insight', icon:'auto_awesome', render: renderInsight },
  challenge: { title:'Challenge', icon:'emoji_events', render: renderChallenge },
  profil: { title:'Profil', icon:'person', render: renderProfil },
  pengaturan: { title:'Pengaturan', icon:'settings', render: renderPengaturan },
};
const NAV_MAIN = ['dashboard','tabungan','pengeluaran','scan','target','statistik'];
const NAV_SIDEBAR = ['dashboard','tabungan','pengeluaran','scan','struk','target','wishlist','statistik','insight','challenge','profil','pengaturan'];

function navigate(route){
  if(!ROUTES[route]) route = 'dashboard';
  stopScanner();
  state.route = route;
  renderShell();
  ROUTES[route].render();
  history.replaceState(null,'', '#'+route);
}
window.navigate = navigate;

function renderShell(){
  $('#page-title').textContent = ROUTES[state.route].title;
  $all('.nav-item').forEach(el=> el.classList.toggle('active', el.dataset.route===state.route));
  $all('.bn-item').forEach(el=> el.classList.toggle('active', el.dataset.route===state.route));
  const fab = $('#fab');
  const fabRoutes = { tabungan:'plus_tabungan', pengeluaran:'plus_pengeluaran', target:'plus_target', wishlist:'plus_wishlist', challenge:'plus_challenge' };
  if(fabRoutes[state.route]){ fab.style.display='flex'; fab.dataset.action = fabRoutes[state.route]; }
  else fab.style.display='none';
}

/* ---------------- DASHBOARD ---------------- */
async function renderDashboard(){
  const main = $('#page-content');
  main.innerHTML = `<div class="skeleton" style="height:140px;border-radius:22px;margin-bottom:16px;"></div>
    <div class="grid-stats">${Array(4).fill('<div class="skeleton" style="height:90px;"></div>').join('')}</div>`;

  const [tabungan, pengeluaran, targets] = await Promise.all([idb.getAll('tabungan'), idb.getAll('pengeluaran'), idb.getAll('target')]);
  const totalTabungan = tabungan.filter(t=>t.jenis==='masuk').reduce((s,t)=>s+Number(t.nominal),0);
  const totalTarik = tabungan.filter(t=>t.jenis==='tarik').reduce((s,t)=>s+Number(t.nominal),0);
  const totalPengeluaran = pengeluaran.reduce((s,p)=>s+Number(p.harga)*Number(p.jumlah||1),0);
  const saldo = totalTabungan - totalTarik;
  const now = new Date();
  const pengeluaranBulanIni = pengeluaran.filter(p=> sameMonthLocal(p.tanggal, now)).reduce((s,p)=>s+Number(p.harga)*Number(p.jumlah||1),0);
  const tabunganBulanIni = tabungan.filter(t=> t.jenis==='masuk' && sameMonthLocal(t.tanggal, now)).reduce((s,t)=>s+Number(t.nominal),0);
  const targetAktif = targets.find(t=>t.status==='aktif');
  const progress = targetAktif ? Math.min(Math.round((targetAktif.nominal_terkumpul/targetAktif.nominal_target)*100),100) : 0;

  main.innerHTML = `
    <div class="offline-banner" id="offline-banner"><span class="material-symbols-rounded">cloud_off</span> Mode offline — data tersimpan lokal & akan disinkron otomatis saat online.</div>
    <div class="hero-balance fade-up">
      <div class="label">Saldo Saat Ini</div>
      <div class="amount num" id="count-saldo">${rp(0)}</div>
      <div class="row">
        <div class="pill"><span class="material-symbols-rounded" style="font-size:16px">savings</span> Tabungan ${rp(totalTabungan)}</div>
        <div class="pill"><span class="material-symbols-rounded" style="font-size:16px">trending_down</span> Pengeluaran ${rp(totalPengeluaran)}</div>
      </div>
    </div>

    <div class="grid-stats">
      <div class="card stat-card tone-teal fade-up"><div class="ic"><span class="material-symbols-rounded">savings</span></div><div class="label">Tabungan Bulan Ini</div><div class="val num">${rp(tabunganBulanIni)}</div></div>
      <div class="card stat-card tone-red fade-up"><div class="ic"><span class="material-symbols-rounded">trending_down</span></div><div class="label">Pengeluaran Bulan Ini</div><div class="val num">${rp(pengeluaranBulanIni)}</div></div>
      <div class="card stat-card tone-gold fade-up"><div class="ic"><span class="material-symbols-rounded">flag</span></div><div class="label">Target Aktif</div><div class="val">${targetAktif ? targetAktif.nama : '—'}</div></div>
      <div class="card stat-card tone-blue fade-up"><div class="ic"><span class="material-symbols-rounded">percent</span></div><div class="label">Progress Target</div><div class="val">${progress}%</div></div>
    </div>

    <div class="section-title"><h2>Grafik Ringkasan (7 hari)</h2></div>
    <div class="card" style="height:230px;"><canvas id="chart-dashboard"></canvas></div>

    <div class="section-title"><h2>Aktivitas Terbaru</h2><a class="link" onclick="navigate('pengeluaran')">Lihat semua</a></div>
    <div class="card" id="recent-list"></div>
  `;

  animateCount($('#count-saldo'), saldo);
  if(!navigator.onLine) $('#offline-banner').classList.add('show');

  // chart 7 hari terakhir (gabungan pengeluaran)
  const labels = []; const data = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    labels.push(d.toLocaleDateString('id-ID',{weekday:'short'}));
    const dayStr = d.toISOString().slice(0,10);
    data.push(pengeluaran.filter(p=>p.tanggal===dayStr).reduce((s,p)=>s+Number(p.harga)*Number(p.jumlah||1),0));
  }
  chartsApi.renderLineChart('chart-dashboard', labels, data, 'Pengeluaran');

  // aktivitas terbaru gabungan
  const acts = [
    ...tabungan.map(t=>({...t, _type:'tabungan'})),
    ...pengeluaran.map(p=>({...p, _type:'pengeluaran'}))
  ].sort((a,b)=> new Date(b.tanggal) - new Date(a.tanggal)).slice(0,6);

  $('#recent-list').innerHTML = acts.length ? acts.map(a=>{
    if(a._type==='tabungan'){
      const isMasuk = a.jenis==='masuk';
      return `<div class="tx-item"><div class="ic" style="background:rgba(31,190,140,.15);color:var(--teal)"><span class="material-symbols-rounded">${KATEGORI_ICON[a.kategori]||'savings'}</span></div>
        <div class="meta"><div class="t">${isMasuk?'Tabung':'Tarik'} · ${a.kategori}</div><div class="d">${fmtDate(a.tanggal)}</div></div>
        <div class="amt ${isMasuk?'plus':'minus'}">${isMasuk?'+':'-'}${rp(a.nominal)}</div></div>`;
    }
    return `<div class="tx-item"><div class="ic" style="background:rgba(240,89,107,.15);color:var(--red)"><span class="material-symbols-rounded">${KATEGORI_ICON[a.kategori]||'receipt_long'}</span></div>
      <div class="meta"><div class="t">${a.nama_produk}</div><div class="d">${a.kategori} · ${fmtDate(a.tanggal)}</div></div>
      <div class="amt minus">-${rp(a.harga*a.jumlah)}</div></div>`;
  }).join('') : `<div class="empty-state"><span class="material-symbols-rounded">inbox</span><div>Belum ada aktivitas</div></div>`;
}
function sameMonthLocal(dateStr, now){
  const d = new Date(dateStr);
  return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
}

/* ---------------- TABUNGAN ---------------- */
async function renderTabungan(){
  const main = $('#page-content');
  const list = (await idb.getAll('tabungan')).sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
  const totalMasuk = list.filter(t=>t.jenis==='masuk').reduce((s,t)=>s+Number(t.nominal),0);
  const totalTarik = list.filter(t=>t.jenis==='tarik').reduce((s,t)=>s+Number(t.nominal),0);

  main.innerHTML = `
    <div class="grid-2" style="margin-bottom:16px;">
      <div class="card stat-card tone-teal"><div class="ic"><span class="material-symbols-rounded">add_circle</span></div><div class="label">Total Masuk</div><div class="val num">${rp(totalMasuk)}</div></div>
      <div class="card stat-card tone-red"><div class="ic"><span class="material-symbols-rounded">remove_circle</span></div><div class="label">Total Tarik</div><div class="val num">${rp(totalTarik)}</div></div>
    </div>
    <div class="section-title"><h2>Riwayat Tabungan</h2></div>
    <div class="card" id="tabungan-list">${renderTabunganList(list)}</div>
  `;
}
function renderTabunganList(list){
  if(!list.length) return `<div class="empty-state"><span class="material-symbols-rounded">savings</span><div>Belum ada riwayat tabungan</div></div>`;
  return list.map(t=>`
    <div class="tx-item">
      <div class="ic" style="background:${t.jenis==='masuk'?'rgba(31,190,140,.15)':'rgba(240,89,107,.15)'};color:${t.jenis==='masuk'?'var(--teal)':'var(--red)'}">
        <span class="material-symbols-rounded">${KATEGORI_ICON[t.kategori]||'savings'}</span>
      </div>
      <div class="meta"><div class="t">${t.kategori}${t.catatan?' · '+t.catatan:''}</div><div class="d">${fmtDate(t.tanggal)}</div></div>
      <div class="amt ${t.jenis==='masuk'?'plus':'minus'}">${t.jenis==='masuk'?'+':'-'}${rp(t.nominal)}</div>
      <button class="icon-btn" style="width:32px;height:32px;margin-left:6px" onclick="deleteItem('tabungan','${t.id}')"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
    </div>`).join('');
}
function formTabungan(){
  return `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>Tambah Tabungan</span><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="tabs" id="jenis-tabs">
      <button class="active" data-jenis="masuk">Tambah Tabungan</button>
      <button data-jenis="tarik">Tarik Tabungan</button>
    </div>
    <form id="form-tabungan">
      <div class="field"><label>Nominal</label><div class="input-wrap"><input type="number" name="nominal" placeholder="0" required></div></div>
      <div class="field"><label>Kategori</label><div class="chips" id="chip-kat-tabungan">${KATEGORI_TABUNGAN.map((k,i)=>`<div class="chip ${i===0?'active':''}" data-val="${k}">${k}</div>`).join('')}</div></div>
      <div class="field"><label>Tanggal</label><div class="input-wrap"><input type="date" name="tanggal" value="${todayStr()}" required></div></div>
      <div class="field"><label>Catatan (opsional)</label><div class="input-wrap"><textarea name="catatan" placeholder="Catatan tabungan..."></textarea></div></div>
      <button type="submit" class="btn btn-primary btn-block">Simpan</button>
    </form>
  `;
}
function bindFormTabungan(){
  let jenis = 'masuk'; let kategori = KATEGORI_TABUNGAN[0];
  $all('#jenis-tabs button').forEach(b=> b.onclick = ()=>{ $all('#jenis-tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); jenis=b.dataset.jenis; });
  $all('#chip-kat-tabungan .chip').forEach(c=> c.onclick = ()=>{ $all('#chip-kat-tabungan .chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); kategori=c.dataset.val; });
  $('#form-tabungan').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = { id:uid(), user_id: state.user?.id, jenis, nominal:Number(fd.get('nominal')), kategori, catatan: fd.get('catatan')||null, tanggal: fd.get('tanggal') };
    await sync.saveLocalThenQueue('tabungan', obj);
    closeSheet(); toast('Tabungan tersimpan'); navigate('tabungan'); renderDashboardIfActive();
  };
}

/* ---------------- TARGET TABUNGAN ---------------- */
async function renderTarget(){
  const main = $('#page-content');
  const list = (await idb.getAll('target')).sort((a,b)=> new Date(b.created_at||0)-new Date(a.created_at||0));
  main.innerHTML = `<div id="target-list">${renderTargetList(list)}</div>`;
}
function ringSVG(pct, size=64, color='var(--gold)'){
  const r = size/2 - 6; const c = 2*Math.PI*r;
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px;">
    <svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--surface-strong)" stroke-width="6" fill="none"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c - (c*pct/100)}"/></svg>
    <div class="pct">${pct}%</div></div>`;
}
function renderTargetList(list){
  if(!list.length) return `<div class="card empty-state"><span class="material-symbols-rounded">flag</span><div>Belum ada target tabungan. Tap + untuk membuat target baru.</div></div>`;
  return list.map(t=>{
    const pct = Math.min(Math.round((t.nominal_terkumpul/t.nominal_target)*100),100);
    const sisa = Math.max(t.nominal_target - t.nominal_terkumpul,0);
    let estimasi = '';
    if(t.deadline){
      const days = Math.max(Math.ceil((new Date(t.deadline)-new Date())/(1000*60*60*24)),0);
      estimasi = ` · ${days} hari lagi`;
    }
    return `<div class="card target-card fade-up">
      ${t.gambar_url ? `<img class="thumb" src="${t.gambar_url}">` : `<div class="thumb" style="display:flex;align-items:center;justify-content:center"><span class="material-symbols-rounded">flag</span></div>`}
      <div class="info">
        <div class="name">${t.nama}</div>
        <div class="meta">Terkumpul ${rp(t.nominal_terkumpul)} / ${rp(t.nominal_target)} · Sisa ${rp(sisa)}${estimasi}</div>
        <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>
      ${ringSVG(pct,56)}
      <button class="icon-btn" style="width:32px;height:32px" onclick="deleteItem('target','${t.id}')"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
    </div>`;
  }).join('');
}
function formTarget(){
  return `<div class="sheet-handle"></div>
    <div class="sheet-title"><span>Target Tabungan Baru</span><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <form id="form-target">
      <div class="field"><label>Nama Target</label><div class="input-wrap"><input name="nama" placeholder="Contoh: Beli HP Baru" required></div></div>
      <div class="field"><label>Nominal Target</label><div class="input-wrap"><input type="number" name="nominal_target" placeholder="5000000" required></div></div>
      <div class="field"><label>Sudah Terkumpul (opsional)</label><div class="input-wrap"><input type="number" name="nominal_terkumpul" placeholder="0"></div></div>
      <div class="field"><label>Deadline (opsional)</label><div class="input-wrap"><input type="date" name="deadline"></div></div>
      <div class="field"><label>URL Gambar (opsional)</label><div class="input-wrap"><input name="gambar_url" placeholder="https://..."></div></div>
      <button type="submit" class="btn btn-primary btn-block">Buat Target</button>
    </form>`;
}
function bindFormTarget(){
  $('#form-target').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = { id:uid(), user_id: state.user?.id, nama: fd.get('nama'), nominal_target:Number(fd.get('nominal_target')),
      nominal_terkumpul:Number(fd.get('nominal_terkumpul')||0), deadline: fd.get('deadline')||null, gambar_url: fd.get('gambar_url')||null,
      status:'aktif', created_at:new Date().toISOString() };
    await sync.saveLocalThenQueue('target', obj);
    closeSheet(); toast('Target dibuat'); navigate('target');
  };
}

/* ---------------- PENGELUARAN ---------------- */
async function renderPengeluaran(){
  const main = $('#page-content');
  const all = (await idb.getAll('pengeluaran')).sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
  main.innerHTML = `
    <div class="search-bar"><span class="material-symbols-rounded">search</span><input id="search-pengeluaran" placeholder="Cari nama produk..."></div>
    <div class="chips" style="margin-bottom:14px" id="filter-kategori">
      <div class="chip active" data-val="">Semua</div>
      ${KATEGORI_PENGELUARAN.map(k=>`<div class="chip" data-val="${k}">${k}</div>`).join('')}
    </div>
    <div class="card" id="pengeluaran-list">${renderPengeluaranList(all)}</div>
  `;
  let filterKat = '';
  function refresh(){
    const q = $('#search-pengeluaran').value.toLowerCase();
    const filtered = all.filter(p=> (!filterKat || p.kategori===filterKat) && p.nama_produk.toLowerCase().includes(q));
    $('#pengeluaran-list').innerHTML = renderPengeluaranList(filtered);
  }
  $('#search-pengeluaran').oninput = refresh;
  $all('#filter-kategori .chip').forEach(c=> c.onclick = ()=>{ $all('#filter-kategori .chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); filterKat = c.dataset.val; refresh(); });
}
function renderPengeluaranList(list){
  if(!list.length) return `<div class="empty-state"><span class="material-symbols-rounded">receipt_long</span><div>Tidak ada pengeluaran ditemukan</div></div>`;
  return list.map(p=>`
    <div class="tx-item">
      ${p.foto_produk ? `<img src="${p.foto_produk}" class="ic" style="object-fit:cover">` : `<div class="ic" style="background:rgba(240,89,107,.15);color:var(--red)"><span class="material-symbols-rounded">${KATEGORI_ICON[p.kategori]||'receipt_long'}</span></div>`}
      <div class="meta"><div class="t">${p.nama_produk}</div><div class="d">${p.kategori} · ${p.jumlah}x · ${fmtDate(p.tanggal)}</div></div>
      <div class="amt minus">-${rp(p.harga*p.jumlah)}</div>
      <button class="icon-btn" style="width:32px;height:32px;margin-left:4px" onclick="deleteItem('pengeluaran','${p.id}')"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
    </div>`).join('');
}
function formPengeluaran(prefill={}){
  return `<div class="sheet-handle"></div>
    <div class="sheet-title"><span>Tambah Pengeluaran</span><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <form id="form-pengeluaran">
      <div class="field"><label>Nama Produk</label><div class="input-wrap"><input name="nama_produk" value="${prefill.nama_produk||''}" placeholder="Contoh: Indomie Goreng" required></div></div>
      <div class="grid-2">
        <div class="field"><label>Harga</label><div class="input-wrap"><input type="number" name="harga" value="${prefill.harga||''}" placeholder="0" required></div></div>
        <div class="field"><label>Jumlah</label><div class="input-wrap"><input type="number" name="jumlah" value="1" min="1" required></div></div>
      </div>
      <div class="field"><label>Kategori</label><div class="chips" id="chip-kat-pengeluaran">${KATEGORI_PENGELUARAN.map((k,i)=>`<div class="chip ${k===(prefill.kategori||KATEGORI_PENGELUARAN[0])?'active':''}" data-val="${k}">${k}</div>`).join('')}</div></div>
      <div class="field"><label>Tanggal</label><div class="input-wrap"><input type="date" name="tanggal" value="${todayStr()}" required></div></div>
      <div class="field"><label>Catatan (opsional)</label><div class="input-wrap"><textarea name="catatan" placeholder="Catatan..."></textarea></div></div>
      <input type="hidden" name="foto_produk" value="${prefill.foto_produk||''}">
      <input type="hidden" name="barcode" value="${prefill.barcode||''}">
      <button type="submit" class="btn btn-primary btn-block">Simpan Pengeluaran</button>
    </form>`;
}
function bindFormPengeluaran(){
  let kategori = $('#chip-kat-pengeluaran .chip.active')?.dataset.val || KATEGORI_PENGELUARAN[0];
  $all('#chip-kat-pengeluaran .chip').forEach(c=> c.onclick = ()=>{ $all('#chip-kat-pengeluaran .chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); kategori=c.dataset.val; });
  $('#form-pengeluaran').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const barcode = fd.get('barcode') || null;
    const nama_produk = fd.get('nama_produk');
    const harga = Number(fd.get('harga'));
    const foto_produk = fd.get('foto_produk') || null;
    const obj = { id:uid(), user_id: state.user?.id, nama_produk, harga, jumlah:Number(fd.get('jumlah')),
      kategori, catatan: fd.get('catatan')||null, foto_produk, barcode,
      tanggal: fd.get('tanggal'), sumber: barcode ? 'scan_barcode' : 'manual' };
    await sync.saveLocalThenQueue('pengeluaran', obj);

    // "Belajar sendiri": kalau ada barcode dan belum ada di database produk lokal,
    // simpan sekarang — supaya scan barcode yang sama berikutnya langsung dikenali otomatis.
    if(barcode){
      const existing = await idb.getAll('produk');
      if(!existing.find(p=>p.barcode===barcode)){
        await idb.put('produk', {
          id: uid(), barcode, nama_produk, foto_produk, merek:'-', kategori,
          harga_default: harga, created_at: new Date().toISOString()
        });
        toast('Produk disimpan ke database lokal — scan berikutnya akan otomatis dikenali');
      }
    } else {
      toast('Pengeluaran tersimpan');
    }
    closeSheet(); navigate('pengeluaran');
  };
}

/* ---------------- WISHLIST ---------------- */
async function renderWishlist(){
  const main = $('#page-content');
  const list = await idb.getAll('wishlist');
  const targets = await idb.getAll('target');
  main.innerHTML = `<div class="grid-auto" id="wishlist-list">${list.length? list.map(w=>{
    const linked = targets.find(t=>t.id===w.target_id);
    const terkumpul = linked ? linked.nominal_terkumpul : 0;
    const pct = Math.min(Math.round((terkumpul/w.harga_estimasi)*100),100);
    return `<div class="card fade-up">
      ${w.foto_url?`<img src="${w.foto_url}" style="width:100%;height:100px;object-fit:cover;border-radius:14px;margin-bottom:10px">`:''}
      <div style="font-weight:700;font-size:14.5px;margin-bottom:4px">${w.nama}</div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">${rp(w.harga_estimasi)}</div>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div style="font-size:11.5px;color:var(--text-dim);margin-top:6px">${pct}% terkumpul</div>
      <button class="icon-btn" style="width:30px;height:30px;position:absolute;top:10px;right:10px" onclick="deleteItem('wishlist','${w.id}')"><span class="material-symbols-rounded" style="font-size:15px">delete</span></button>
    </div>`;
  }).join('') : `<div class="card empty-state" style="grid-column:1/-1"><span class="material-symbols-rounded">favorite</span><div>Belum ada wishlist impian</div></div>`}</div>`;
}
function formWishlist(targets){
  return `<div class="sheet-handle"></div>
    <div class="sheet-title"><span>Tambah Wishlist</span><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <form id="form-wishlist">
      <div class="field"><label>Nama Barang</label><div class="input-wrap"><input name="nama" placeholder="Contoh: PS5" required></div></div>
      <div class="field"><label>Harga Estimasi</label><div class="input-wrap"><input type="number" name="harga_estimasi" placeholder="8500000" required></div></div>
      <div class="field"><label>URL Foto (opsional)</label><div class="input-wrap"><input name="foto_url" placeholder="https://..."></div></div>
      <div class="field"><label>Hubungkan ke Target (opsional)</label><div class="input-wrap"><select name="target_id"><option value="">— Tidak ada —</option>${targets.map(t=>`<option value="${t.id}">${t.nama}</option>`).join('')}</select></div></div>
      <button type="submit" class="btn btn-primary btn-block">Simpan</button>
    </form>`;
}
function bindFormWishlist(){
  $('#form-wishlist').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = { id:uid(), user_id: state.user?.id, nama: fd.get('nama'), harga_estimasi:Number(fd.get('harga_estimasi')),
      foto_url: fd.get('foto_url')||null, target_id: fd.get('target_id')||null, created_at:new Date().toISOString() };
    await sync.saveLocalThenQueue('wishlist', obj);
    closeSheet(); toast('Wishlist ditambahkan'); navigate('wishlist');
  };
}

/* ---------------- CHALLENGE ---------------- */
async function renderChallenge(){
  const main = $('#page-content');
  const list = await idb.getAll('challenge');
  main.innerHTML = `<div id="challenge-list">${list.length? list.map(c=>{
    const pct = Math.min(Math.round((c.progress/c.nominal)*100),100);
    return `<div class="card fade-up" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;font-size:14.5px">${c.judul}</div>
        ${pct>=100?'<span class="badge gold"><span class="material-symbols-rounded" style="font-size:13px">military_tech</span> Selesai</span>':`<span class="badge teal">${c.tipe}</span>`}
      </div>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:6px">${rp(c.progress)} / ${rp(c.nominal)} (${pct}%)</div>
      <button class="icon-btn" style="width:30px;height:30px;position:absolute;top:14px;right:14px" onclick="deleteItem('challenge','${c.id}')"><span class="material-symbols-rounded" style="font-size:15px">delete</span></button>
    </div>`;
  }).join('') : `<div class="card empty-state"><span class="material-symbols-rounded">emoji_events</span><div>Belum ada challenge menabung</div></div>`}</div>`;
}
function formChallenge(){
  return `<div class="sheet-handle"></div>
    <div class="sheet-title"><span>Challenge Baru</span><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <form id="form-challenge">
      <div class="field"><label>Judul</label><div class="input-wrap"><input name="judul" placeholder="Nabung Rp10.000/Hari" required></div></div>
      <div class="field"><label>Tipe</label><div class="input-wrap"><select name="tipe"><option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option></select></div></div>
      <div class="field"><label>Target Nominal</label><div class="input-wrap"><input type="number" name="nominal" placeholder="300000" required></div></div>
      <button type="submit" class="btn btn-primary btn-block">Mulai Challenge</button>
    </form>`;
}
function bindFormChallenge(){
  $('#form-challenge').onsubmit = async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = { id:uid(), user_id: state.user?.id, judul: fd.get('judul'), tipe: fd.get('tipe'), nominal:Number(fd.get('nominal')), progress:0, status:'berjalan', mulai: todayStr() };
    await sync.saveLocalThenQueue('challenge', obj);
    closeSheet(); toast('Challenge dimulai!'); navigate('challenge');
  };
}

/* ---------------- STATISTIK ---------------- */
async function renderStatistik(){
  const main = $('#page-content');
  main.innerHTML = `
    <div class="tabs" id="stat-tabs">
      <button class="active" data-r="harian">Harian</button>
      <button data-r="mingguan">Mingguan</button>
      <button data-r="bulanan">Bulanan</button>
      <button data-r="tahunan">Tahunan</button>
    </div>
    <div class="card" style="height:240px;margin-bottom:16px"><canvas id="stat-line"></canvas></div>
    <div class="grid-2">
      <div class="card" style="height:230px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">Pengeluaran per Kategori</div><canvas id="stat-doughnut"></canvas></div>
      <div class="card" style="height:230px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">Tabungan vs Pengeluaran</div><canvas id="stat-bar"></canvas></div>
    </div>
  `;
  async function draw(range){
    const pengeluaran = await idb.getAll('pengeluaran');
    const tabungan = await idb.getAll('tabungan');
    const {labels, dataPengeluaran, dataTabungan} = buildSeries(pengeluaran, tabungan, range);
    chartsApi.renderLineChart('stat-line', labels, dataPengeluaran, 'Pengeluaran');
    const byKat = {};
    pengeluaran.forEach(p=>{ byKat[p.kategori]=(byKat[p.kategori]||0)+p.harga*p.jumlah; });
    chartsApi.renderDoughnutChart('stat-doughnut', Object.keys(byKat), Object.values(byKat));
    chartsApi.renderBarChart('stat-bar', labels, [
      { label:'Tabungan', data:dataTabungan, backgroundColor:'#1FBE8C' },
      { label:'Pengeluaran', data:dataPengeluaran, backgroundColor:'#F0596B' }
    ]);
  }
  $all('#stat-tabs button').forEach(b=> b.onclick=()=>{ $all('#stat-tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); draw(b.dataset.r); });
  draw('harian');
}
function buildSeries(pengeluaran, tabungan, range){
  const labels = []; const dataPengeluaran = []; const dataTabungan = [];
  const now = new Date();
  let n = range==='harian'?7:range==='mingguan'?6:range==='bulanan'?6:5;
  for(let i=n-1;i>=0;i--){
    let label, filterFn;
    if(range==='harian'){
      const d=new Date(); d.setDate(d.getDate()-i); label=d.toLocaleDateString('id-ID',{weekday:'short'});
      const ds=d.toISOString().slice(0,10); filterFn=(x)=>x.tanggal===ds;
    } else if(range==='mingguan'){
      label = `M-${n-1-i}`;
      const end=new Date(); end.setDate(end.getDate()-(i*7)); const start=new Date(end); start.setDate(start.getDate()-7);
      filterFn=(x)=>{ const d=new Date(x.tanggal); return d>=start && d<=end; };
    } else if(range==='bulanan'){
      const d=new Date(now.getFullYear(), now.getMonth()-i, 1); label=d.toLocaleDateString('id-ID',{month:'short'});
      filterFn=(x)=>{ const xd=new Date(x.tanggal); return xd.getFullYear()===d.getFullYear() && xd.getMonth()===d.getMonth(); };
    } else {
      const y = now.getFullYear()-i; label=String(y);
      filterFn=(x)=> new Date(x.tanggal).getFullYear()===y;
    }
    labels.push(label);
    dataPengeluaran.push(pengeluaran.filter(filterFn).reduce((s,p)=>s+p.harga*p.jumlah,0));
    dataTabungan.push(tabungan.filter(t=>t.jenis==='masuk').filter(filterFn).reduce((s,t)=>s+Number(t.nominal),0));
  }
  return { labels, dataPengeluaran, dataTabungan };
}

/* ---------------- AI INSIGHT ---------------- */
async function renderInsight(){
  const main = $('#page-content');
  main.innerHTML = `<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center"><span class="material-symbols-rounded" style="color:var(--gold)">auto_awesome</span><div style="font-size:13px;color:var(--text-dim)">Analisis otomatis berdasarkan riwayat transaksi Anda — diproses langsung di perangkat (offline-friendly).</div></div></div>
    <div id="insight-list"><div class="skeleton" style="height:70px;margin-bottom:10px"></div><div class="skeleton" style="height:70px"></div></div>`;
  const insights = await generateInsights();
  $('#insight-list').innerHTML = insights.map(i=>`<div class="card insight-card fade-up"><div class="tag">${i.tag.toUpperCase()}</div><p>${i.text}</p></div>`).join('');
}

/* ---------------- SCAN BARCODE (mirip kasir: modal scan -> keranjang) ---------------- */
const UNIT_OPTIONS = ['Satuan','Renceng','Box'];
let scanCart = []; // {localId, barcode, nama_produk, harga, jumlah, satuan, foto_produk, kategori, recognized}

async function getCurrentSaldo(){
  const tabungan = await idb.getAll('tabungan');
  const masuk = tabungan.filter(t=>t.jenis==='masuk').reduce((s,t)=>s+Number(t.nominal),0);
  const tarik = tabungan.filter(t=>t.jenis==='tarik').reduce((s,t)=>s+Number(t.nominal),0);
  return masuk - tarik;
}

async function renderScan(){
  const main = $('#page-content');
  const saldo = await getCurrentSaldo();
  main.innerHTML = `
    <div class="hero-balance fade-up" id="saldo-card" style="margin-bottom:16px">
      <div class="label">Saldo Tabungan Anda</div>
      <div class="amount num" id="saldo-amount">${rp(saldo)}</div>
      <div class="row"><div class="pill"><span class="material-symbols-rounded" style="font-size:16px">info</span> Bayar belanja langsung dari saldo ini, seperti e-wallet</div></div>
    </div>
    <button class="btn btn-primary btn-block" id="btn-open-scan"><span class="material-symbols-rounded">qr_code_scanner</span> Scan Barcode</button>
    <div class="section-title"><h2>Belanja Saat Ini</h2><span style="font-size:12px;color:var(--text-dim)" id="cart-count"></span></div>
    <div id="cart-list"></div>
    <div class="empty-state" id="cart-empty" style="display:none"><span class="material-symbols-rounded">qr_code_scanner</span><div>Belum ada item. Scan barcode produk, atur harganya, lalu Bayar — saldo tabungan otomatis berkurang.</div></div>
  `;
  $('#btn-open-scan').onclick = openScanModal;
  renderCartUI();
}

function renderCartUI(){
  const list = $('#cart-list');
  const empty = $('#cart-empty');
  $('#cart-count').textContent = scanCart.length ? `${scanCart.length} item` : '';
  $('#fab-cart-bar')?.remove();
  if(!scanCart.length){
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = scanCart.map(item=>{
    const subtotal = (Number(item.harga)||0) * item.jumlah;
    return `<div class="card cart-row fade-up" data-id="${item.localId}">
      ${item.foto_produk ? `<img src="${item.foto_produk}" class="thumb">` : `<div class="thumb"><span class="material-symbols-rounded">inventory_2</span></div>`}
      <div class="body">
        ${!item.recognized ? `<div class="badge-unrecognized"><span class="material-symbols-rounded" style="font-size:12px">edit</span> Produk tidak ditemukan — isi nama & harga sendiri</div><br>` : `<div class="badge teal" style="margin-bottom:6px">Produk ditemukan</div><br>`}
        ${item.recognized
          ? `<div class="name">${item.nama_produk}</div>`
          : `<input class="name-input" placeholder="Nama produk" value="${item.nama_produk||''}" data-field="nama_produk">`
        }
        <div class="controls">
          <select class="unit-select" data-field="satuan">${UNIT_OPTIONS.map(u=>`<option value="${u}" ${u===item.satuan?'selected':''}>${u}</option>`).join('')}</select>
          <input type="number" class="price-input" placeholder="Harga custom" value="${item.harga||''}" data-field="harga">
          <div class="qty-stepper">
            <button data-act="dec">−</button>
            <div class="qty-val">${item.jumlah}</div>
            <button data-act="inc">+</button>
          </div>
        </div>
        <div class="subtotal num">${rp(subtotal)}</div>
      </div>
      <button class="icon-btn row-delete" style="width:32px;height:32px" data-act="delete"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
    </div>`;
  }).join('') + renderStickyTotalBar();

  // bind events per row
  $all('.cart-row').forEach(row=>{
    const id = row.dataset.id;
    const item = scanCart.find(i=>i.localId===id);
    row.querySelector('[data-act="inc"]').onclick = ()=>{ item.jumlah++; renderCartUI(); };
    row.querySelector('[data-act="dec"]').onclick = ()=>{ if(item.jumlah>1) item.jumlah--; else removeFromCart(id); renderCartUI(); };
    row.querySelector('[data-act="delete"]').onclick = ()=> removeFromCart(id);
    row.querySelector('[data-field="satuan"]').onchange = (e)=>{ item.satuan = e.target.value; };
    // PENTING: jangan renderCartUI() di sini — itu akan membangun ulang <input> dan
    // membuat fokus + keyboard hilang setiap kali mengetik satu huruf. Cukup update
    // angka subtotal & total di tempat, tanpa membongkar ulang DOM input-nya.
    row.querySelector('[data-field="harga"]').oninput = (e)=>{
      item.harga = Number(e.target.value)||0;
      const subtotalEl = row.querySelector('.subtotal');
      if(subtotalEl) subtotalEl.textContent = rp((Number(item.harga)||0)*item.jumlah);
      updateStickyTotalOnly();
    };
    const namaInput = row.querySelector('[data-field="nama_produk"]');
    if(namaInput) namaInput.oninput = (e)=>{ item.nama_produk = e.target.value; };
  });
}
function updateStickyTotalOnly(){
  const bar = $('#fab-cart-bar');
  if(!bar) return;
  const total = scanCart.reduce((s,i)=> s + (Number(i.harga)||0)*i.jumlah, 0);
  const amountEl = bar.querySelector('.amount');
  if(amountEl) amountEl.textContent = rp(total);
}
function renderStickyTotalBar(){
  const total = scanCart.reduce((s,i)=> s + (Number(i.harga)||0)*i.jumlah, 0);
  return `<div class="sticky-total-bar" id="fab-cart-bar">
    <div><div class="label">Total Bayar</div><div class="amount num">${rp(total)}</div></div>
    <button class="btn btn-gold" id="btn-confirm-cart"><span class="material-symbols-rounded" style="font-size:17px">payments</span> Bayar</button>
  </div>`;
}
function removeFromCart(id){ scanCart = scanCart.filter(i=>i.localId!==id); renderCartUI(); }

// dipasang ulang tiap render karena tombol ada di dalam innerHTML yang diregenerasi
document.addEventListener('click', (e)=>{
  if(e.target.closest('#btn-confirm-cart')) confirmCart();
});

async function confirmCart(){
  if(!scanCart.length) return;
  const invalid = scanCart.find(i=> !i.nama_produk || !i.harga);
  if(invalid){ toast('Lengkapi nama & harga custom untuk semua item dulu', 'error'); return; }

  const total = scanCart.reduce((s,i)=> s + (Number(i.harga)||0)*i.jumlah, 0);
  const saldo = await getCurrentSaldo();
  if(total > saldo){
    toast(`Saldo tidak cukup. Kurang ${rp(total - saldo)}`, 'error');
    return;
  }
  const ok = await appConfirm(`Bayar ${rp(total)} dari saldo tabungan (${rp(saldo)})?`, { title:'Konfirmasi Pembayaran', icon:'payments', okText:'Bayar Sekarang' });
  if(!ok) return;

  const namaBarang = scanCart.map(i=>i.nama_produk).join(', ');
  for(const item of scanCart){
    const obj = { id:uid(), user_id: state.user?.id, nama_produk:item.nama_produk, harga:Number(item.harga), jumlah:item.jumlah,
      kategori: item.kategori || 'Lainnya', catatan: item.satuan && item.satuan!=='Satuan' ? `Satuan: ${item.satuan}` : null,
      foto_produk: item.foto_produk||null, barcode: item.barcode||null, tanggal: todayStr(), sumber: item.barcode?'scan_barcode':'manual' };
    await sync.saveLocalThenQueue('pengeluaran', obj);
    // belajar sendiri: simpan produk baru yang belum dikenal ke database lokal
    if(item.barcode && !item.recognized){
      const existing = await idb.getAll('produk');
      if(!existing.find(p=>p.barcode===item.barcode)){
        await idb.put('produk', { id:uid(), barcode:item.barcode, nama_produk:item.nama_produk, foto_produk:item.foto_produk||null, merek:'-', kategori:item.kategori||'Lainnya', harga_default:Number(item.harga), created_at:new Date().toISOString() });
      }
    }
  }
  // tarik saldo tabungan sebesar total belanja — inilah yang membuat saldo benar-benar berkurang, seperti bayar pakai e-wallet
  await sync.saveLocalThenQueue('tabungan', {
    id:uid(), user_id: state.user?.id, jenis:'tarik', nominal: total, kategori:'Belanja',
    catatan: `Bayar: ${namaBarang}`.slice(0,200), tanggal: todayStr()
  });

  toast(`Berhasil bayar ${rp(total)} — saldo terpotong otomatis`);
  scanCart = [];
  navigate('dashboard');
}

/* ---- Modal Scan (mirip viewfinder kasir) ---- */
function openScanModal(){
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>Scan Barcode</span><button class="icon-btn" id="btn-close-scan"><span class="material-symbols-rounded">close</span></button></div>
    <p style="font-size:12.5px;color:var(--text-dim);text-align:center;margin-bottom:14px">Arahkan barcode ke dalam kotak — otomatis terbaca.</p>
    <div class="scan-modal-frame">
      <div id="scan-modal-cam" style="width:100%;height:100%"></div>
      <div class="scan-corner-ui tl"></div><div class="scan-corner-ui tr"></div>
      <div class="scan-corner-ui bl"></div><div class="scan-corner-ui br"></div>
      <div class="scan-success-overlay" id="scan-success"><div class="check"><span class="material-symbols-rounded">check</span></div><div style="font-weight:700">Terbaca!</div></div>
    </div>
    <div class="scan-links">
      <button id="btn-restart-cam"><span class="material-symbols-rounded" style="font-size:16px">refresh</span> Ulangi Kamera</button>
      <span class="sep">|</span>
      <button id="btn-baca-ai"><span class="material-symbols-rounded" style="font-size:16px">auto_awesome</span> Baca via AI</button>
      <span class="sep">|</span>
      <button id="btn-pilih-gambar-scan"><span class="material-symbols-rounded" style="font-size:16px">image</span> Pilih Gambar</button>
      <span class="sep">|</span>
      <button id="btn-flash-scan"><span class="material-symbols-rounded" style="font-size:16px">flash_on</span> Flash</button>
    </div>
    <div id="ai-scan-status" style="text-align:center;font-size:12px;color:var(--text-dim);margin-top:10px"></div>
    <input type="file" id="file-barcode-modal" accept="image/*" style="display:none">
    <div id="qr-reader-file-result" style="display:none"></div>
  `);
  let flashOn = false;
  scannerApi.startScanner('scan-modal-cam', handleScanSuccess);
  $('#btn-close-scan').onclick = closeSheet;
  $('#btn-restart-cam').onclick = ()=>{ scannerApi.stopScanner(); setTimeout(()=> scannerApi.startScanner('scan-modal-cam', handleScanSuccess), 200); };
  $('#btn-flash-scan').onclick = ()=>{ flashOn=!flashOn; scannerApi.toggleFlashlight(flashOn); };
  $('#btn-pilih-gambar-scan').onclick = ()=> $('#file-barcode-modal').click();
  $('#btn-baca-ai').onclick = handleBacaViaAI;
  $('#file-barcode-modal').onchange = (e)=>{
    const file = e.target.files[0];
    if(file) scannerApi.scanFromFile(file, handleScanSuccess);
  };
}

async function handleBacaViaAI(){
  const key = await aiApi.getAnthropicKey();
  if(!key){
    closeSheet();
    toast('Isi Anthropic API key dulu di Pengaturan untuk pakai Baca via AI', 'error');
    navigate('pengaturan');
    return;
  }
  const statusEl = $('#ai-scan-status');
  if(statusEl) statusEl.textContent = 'Mengambil gambar & menganalisis dengan Claude Vision...';
  const base64 = aiApi.captureFrameAsBase64('scan-modal-cam');
  if(!base64){
    if(statusEl) statusEl.textContent = '';
    toast('Kamera belum siap, coba lagi sebentar', 'error');
    return;
  }
  const { result, error, message } = await aiApi.aiReadBarcodeFromImage(base64);
  if(statusEl) statusEl.textContent = '';
  if(error){
    let msg = 'Gagal membaca gambar dengan AI.';
    if(error==='api_error') msg = `Gagal memanggil Claude API: ${message||''}`;
    if(error==='parse_failed') msg = 'AI merespons tapi formatnya tidak sesuai, coba lagi.';
    toast(msg, 'error');
    return;
  }
  $('#scan-success')?.classList.add('show');
  await new Promise(r=> setTimeout(r, 500));
  closeSheet();

  const namaAI = result.nama_produk && result.nama_produk!=='null' ? result.nama_produk : '';
  const kategoriAI = KATEGORI_PENGELUARAN.includes(result.kategori) ? result.kategori : 'Lainnya';
  const hargaAI = (typeof result.harga_terdeteksi === 'number') ? result.harga_terdeteksi : 0;
  const barcodeAI = result.barcode && result.barcode!=='null' ? String(result.barcode) : null;

  scanCart.push({
    localId: genId(), barcode: barcodeAI, nama_produk: namaAI, harga: hargaAI,
    jumlah:1, satuan:'Satuan', foto_produk:null, kategori: kategoriAI, recognized: !!(namaAI)
  });
  toast(namaAI ? `AI mengenali: ${namaAI}` : 'AI tidak yakin — lengkapi manual di keranjang', namaAI?'success':'error');
  navigate('scan');
}

async function handleScanSuccess(code){
  $('#scan-success')?.classList.add('show');
  await new Promise(r=> setTimeout(r, 650));
  closeSheet();

  const { produk, error, guess } = await scannerApi.findProductByBarcode(code);
  if(produk){
    scanCart.push({
      localId: genId(), barcode: produk.barcode, nama_produk: produk.nama_produk, harga: produk.harga_default || 0,
      jumlah:1, satuan:'Satuan', foto_produk: produk.foto_produk||null, kategori: KATEGORI_PENGELUARAN.includes(produk.kategori)?produk.kategori:'Lainnya', recognized:true
    });
    toast(`${produk.nama_produk} ditambahkan`);
  } else {
    let pesan = `Barcode ${code} belum dikenal — lengkapi nama & harga di keranjang.`;
    if(error==='offline') pesan = `Sedang offline — barcode ${code} ditambahkan, lengkapi manual.`;
    if(guess?.negara) pesan += ` (kemungkinan produk dari ${guess.negara})`;
    scanCart.push({ localId: genId(), barcode: code, nama_produk:'', harga:0, jumlah:1, satuan:'Satuan', foto_produk:null, kategori:'Lainnya', recognized:false });
    toast(pesan, 'error');
  }
  navigate('scan');
}

/* ---------------- SCAN STRUK (OCR) ---------------- */
function renderStruk(){
  const main = $('#page-content');
  main.innerHTML = `
    <div class="card" style="text-align:center;padding:32px 20px">
      <span class="material-symbols-rounded" style="font-size:46px;color:var(--gold)">document_scanner</span>
      <h3 style="margin:14px 0 6px">Scan Struk Belanja</h3>
      <p style="font-size:13px;color:var(--text-dim);max-width:320px;margin:0 auto 18px">Upload foto struk belanja — Claude Vision AI akan membaca nama barang & harganya, lalu memasukkannya ke Keranjang Scan untuk Anda cek sebelum disimpan.</p>
      <input type="file" id="file-struk" accept="image/*" style="display:none">
      <button class="btn btn-gold" id="btn-pilih-struk"><span class="material-symbols-rounded">photo_camera</span> Pilih Foto Struk</button>
      <div style="font-size:11.5px;color:var(--text-dim);margin-top:14px;line-height:1.5" id="struk-note">
        Fitur ini butuh Anthropic API key (atur di Pengaturan). Hasil baca AI tidak selalu 100% akurat — selalu cek dulu di Keranjang Scan sebelum menyimpan.
      </div>
    </div>
    <div id="struk-preview"></div>
  `;
  $('#btn-pilih-struk').onclick = ()=> $('#file-struk').click();
  $('#file-struk').onchange = async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    $('#struk-preview').innerHTML = `<div class="card fade-up" style="margin-top:16px">
      <img src="${url}" style="width:100%;border-radius:14px;max-height:280px;object-fit:contain;background:var(--surface-strong)">
      <div id="struk-status" style="text-align:center;font-size:12.5px;color:var(--text-dim);margin-top:12px">Membaca struk dengan Claude Vision...</div>
    </div>`;

    const key = await aiApi.getAnthropicKey();
    if(!key){
      $('#struk-status').innerHTML = `Anthropic API key belum diatur. <button class="btn btn-ghost" style="padding:6px 12px;margin-top:8px" onclick="navigate('pengaturan')">Atur di Pengaturan</button>`;
      return;
    }
    const base64 = await aiApi.fileToBase64(file);
    const { result, error, message } = await aiApi.aiReadReceiptFromImage(base64);
    if(error){
      let msg = 'Gagal membaca struk.';
      if(error==='api_error') msg = `Gagal memanggil Claude API: ${message||''}`;
      if(error==='parse_failed') msg = 'AI merespons tapi formatnya tidak sesuai. Coba foto yang lebih jelas.';
      $('#struk-status').innerHTML = `<span style="color:var(--red)">${msg}</span>`;
      return;
    }
    const items = (result.items||[]).filter(it=> it.nama_produk && it.harga);
    if(!items.length){
      $('#struk-status').textContent = 'AI tidak menemukan item yang terbaca jelas di struk ini. Coba foto lebih jelas atau input manual lewat Pengeluaran.';
      return;
    }
    items.forEach(it=>{
      scanCart.push({ localId: genId(), barcode:null, nama_produk: it.nama_produk, harga: Number(it.harga)||0,
        jumlah: Number(it.jumlah)||1, satuan:'Satuan', foto_produk:null, kategori:'Lainnya', recognized:true });
    });
    $('#struk-status').innerHTML = `<span style="color:var(--teal)">✓ ${items.length} item ditemukan & masuk ke Keranjang Scan</span>`;
    toast(`${items.length} item dari struk masuk ke keranjang`);
    setTimeout(()=> navigate('scan'), 900);
  };
}

/* ---------------- PROFIL ---------------- */
async function renderProfil(){
  const main = $('#page-content');
  const [tabungan, pengeluaran, targets] = await Promise.all([idb.getAll('tabungan'), idb.getAll('pengeluaran'), idb.getAll('target')]);
  const totalTabungan = tabungan.filter(t=>t.jenis==='masuk').reduce((s,t)=>s+Number(t.nominal),0);
  const totalPengeluaran = pengeluaran.reduce((s,p)=>s+Number(p.harga)*Number(p.jumlah||1),0);
  const targetAktif = targets.filter(t=>t.status==='aktif').length;
  main.innerHTML = `
    <div class="card" style="text-align:center;padding:28px 20px">
      <div style="width:76px;height:76px;border-radius:50%;background:var(--grad-primary);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#06251c">
        ${(state.user?.nama||'S')[0].toUpperCase()}
      </div>
      <div style="font-weight:700;font-size:16px" id="profil-nama">${state.user?.nama||'Saya'}</div>
      <div style="font-size:12.5px;color:var(--text-dim)">Data tersimpan lokal di perangkat ini</div>
      <button class="btn btn-ghost" style="margin-top:12px;padding:8px 16px" id="btn-ubah-nama"><span class="material-symbols-rounded" style="font-size:15px">edit</span> Ubah Nama</button>
    </div>
    <div class="grid-stats" style="margin-top:16px">
      <div class="card stat-card tone-teal"><div class="ic"><span class="material-symbols-rounded">savings</span></div><div class="label">Total Tabungan</div><div class="val num">${rp(totalTabungan)}</div></div>
      <div class="card stat-card tone-red"><div class="ic"><span class="material-symbols-rounded">receipt_long</span></div><div class="label">Total Pengeluaran</div><div class="val num">${rp(totalPengeluaran)}</div></div>
      <div class="card stat-card tone-gold"><div class="ic"><span class="material-symbols-rounded">flag</span></div><div class="label">Target Aktif</div><div class="val">${targetAktif}</div></div>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:20px;color:var(--red)" onclick="resetAllData()"><span class="material-symbols-rounded">delete_forever</span> Reset Semua Data</button>
  `;
  $('#btn-ubah-nama').onclick = ()=>{
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-title"><span>Ubah Nama</span><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <form id="form-ubah-nama">
        <div class="field"><label>Nama</label><div class="input-wrap"><input name="nama" value="${state.user?.nama||'Saya'}" required autofocus></div></div>
        <button type="submit" class="btn btn-primary btn-block">Simpan</button>
      </form>
    `);
    $('#form-ubah-nama').onsubmit = async (e)=>{
      e.preventDefault();
      const nama = new FormData(e.target).get('nama').trim();
      if(nama){ state.user.nama = nama; await idb.setMeta('current_user', state.user); closeSheet(); renderProfil(); }
    };
  };
}

/* ---------------- PENGATURAN ---------------- */
async function renderPengaturan(){
  const main = $('#page-content');
  const theme = await idb.getMeta('theme') || 'dark';
  const savedKey = await aiApi.getAnthropicKey();
  main.innerHTML = `
    <div class="card">
      <div class="settings-row"><span>Dark Mode</span><div class="switch ${theme==='dark'?'on':''}" id="switch-dark"><div class="dot"></div></div></div>
      <div class="settings-row"><span>Ikuti Tema Sistem</span><div class="switch" id="switch-auto"><div class="dot"></div></div></div>
      <div class="settings-row"><span>Status Koneksi</span><span class="badge ${navigator.onLine?'teal':'gold'}">${navigator.onLine?'Online':'Offline'}</span></div>
      <div class="settings-row"><span>Sinkron Sekarang</span><button class="btn btn-ghost" style="padding:8px 14px" id="btn-sync"><span class="material-symbols-rounded" style="font-size:16px">sync</span></button></div>
    </div>

    <div class="section-title"><h2>Baca via AI (Claude Vision)</h2></div>
    <div class="card">
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-bottom:12px">
        Untuk fitur "Baca via AI" di Scan Barcode & Scan Struk, masukkan API key Anthropic Anda sendiri.
        Key ini <b>hanya disimpan di perangkat ini</b> (IndexedDB browser) dan dikirim langsung dari browser Anda ke api.anthropic.com — tidak lewat server mana pun milik kami.
        <br><br>
        <span style="color:var(--gold)">⚠️ Catatan keamanan:</span> karena disimpan di sisi klien, key ini bisa dilihat lewat DevTools browser perangkat ini. Cocok untuk pemakaian pribadi, kurang aman bila perangkat dipakai bersama orang lain.
        Dapatkan key di <span style="color:var(--teal)">console.anthropic.com</span>.
      </p>
      <div class="field">
        <label>Anthropic API Key</label>
        <div class="input-wrap"><input type="password" id="input-api-key" placeholder="sk-ant-..." value="${savedKey||''}"></div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" style="flex:1" id="btn-save-key">Simpan Key</button>
        ${savedKey ? `<button class="btn btn-ghost" id="btn-clear-key"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>` : ''}
      </div>
      <div style="margin-top:10px;font-size:11.5px;color:${savedKey?'var(--teal)':'var(--text-dim)'}">${savedKey ? '✓ Key tersimpan — fitur Baca via AI aktif' : 'Belum diisi — tombol "Baca via AI" akan meminta key ini saat dipakai'}</div>
    </div>

    <div class="section-title"><h2>Tentang</h2></div>
    <div class="card" style="font-size:12.5px;color:var(--text-dim);line-height:1.7">
      Tabungin v1.0 — PWA Tabungan & Pengeluaran.<br>
      Dibangun dengan HTML5, CSS3, Vanilla JS, IndexedDB, Chart.js, Html5-QRCode, dan Claude Vision API (opsional).
    </div>
  `;
  $('#switch-dark').onclick = async ()=>{
    const isOn = $('#switch-dark').classList.contains('on');
    setTheme(isOn ? 'light' : 'dark');
  };
  $('#btn-sync').onclick = ()=>{ sync.flush(); toast('Sinkronisasi dijalankan'); };
  $('#btn-save-key').onclick = async ()=>{
    const val = $('#input-api-key').value.trim();
    if(!val){ toast('Isi API key dulu', 'error'); return; }
    await aiApi.setAnthropicKey(val);
    toast('API key tersimpan'); renderPengaturan();
  };
  $('#btn-clear-key')?.addEventListener('click', async ()=>{
    await aiApi.setAnthropicKey(null);
    toast('API key dihapus'); renderPengaturan();
  });
}

/* ---------------- DELETE generic ---------------- */
async function deleteItem(store, id){
  const ok = await appConfirm('Hapus item ini?', { title:'Hapus Item', icon:'delete', okText:'Hapus', danger:true });
  if(!ok) return;
  await sync.saveLocalThenQueue(store, {id}, 'delete');
  toast('Item dihapus');
  ROUTES[state.route].render();
}
window.deleteItem = deleteItem;

/* ---------------- Theme ---------------- */
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme==='light' ? 'light' : '');
  idb.setMeta('theme', theme);
}
async function initTheme(){
  let theme = await idb.getMeta('theme');
  if(!theme) theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(theme);
}

/* ---------------- FAB handler ---------------- */
function bindFab(){
  $('#fab').onclick = async ()=>{
    const action = $('#fab').dataset.action;
    if(action==='plus_tabungan'){ openSheet(formTabungan()); bindFormTabungan(); }
    if(action==='plus_pengeluaran'){ openSheet(formPengeluaran()); bindFormPengeluaran(); }
    if(action==='plus_target'){ openSheet(formTarget()); bindFormTarget(); }
    if(action==='plus_wishlist'){ const targets = await idb.getAll('target'); openSheet(formWishlist(targets)); bindFormWishlist(); }
    if(action==='plus_challenge'){ openSheet(formChallenge()); bindFormChallenge(); }
  };
}

function renderDashboardIfActive(){ if(state.route==='dashboard') renderDashboard(); }

/* ---------------- (Auth screen dihapus — app berjalan tanpa login) ---------------- */

/* ---------------- Boot ---------------- */
async function bootApp(){
  $('#app').style.display='flex';
  buildNav();
  bindFab();
  navigate(location.hash?.replace('#','') || 'dashboard');
  if(navigator.onLine) sync.flush();
}
function buildNav(){
  const sidebar = $('#sidebar-nav');
  sidebar.innerHTML = NAV_SIDEBAR.map(r=>`<div class="nav-item" data-route="${r}" onclick="navigate('${r}')"><span class="material-symbols-rounded">${ROUTES[r].icon}</span>${ROUTES[r].title}</div>`).join('');
  const bottom = $('#bottom-nav');
  bottom.innerHTML = NAV_MAIN.map(r=>`<div class="bn-item" data-route="${r}" onclick="navigate('${r}')"><span class="material-symbols-rounded">${ROUTES[r].icon}</span>${ROUTES[r].title}</div>`).join('');
}

window.addEventListener('DOMContentLoaded', async ()=>{
  try{
    await initTheme();
    await initAuth();
    setTimeout(()=> $('#splash').classList.add('hide'), 700);
    await bootApp();
    window.addEventListener('online', ()=>{ toast('Kembali online'); document.querySelectorAll('#offline-banner').forEach(b=>b.classList.remove('show')); });
    window.addEventListener('offline', ()=>{ toast('Anda sedang offline. Data tetap tersimpan lokal.', 'error'); });
  }catch(err){
    console.error('Gagal memulai aplikasi:', err);
    $('#splash').classList.add('hide');
    document.body.insertAdjacentHTML('beforeend', `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;z-index:9999;background:#0B1410;color:#EAF3EE;text-align:center;font-family:sans-serif">
        <div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Gagal memuat aplikasi</div>
          <div style="font-size:13px;color:#9FB3A9;max-width:320px">${err.message || err}</div>
          <div style="font-size:12px;color:#9FB3A9;margin-top:10px">Coba muat ulang halaman, atau pastikan diakses lewat http://localhost (bukan IP biasa) jika ini terkait penyimpanan/keamanan browser.</div>
        </div>
      </div>`);
  }
});
