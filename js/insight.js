/* =========================================================
   insight.js — AI Insight Keuangan
   Catatan: ini adalah mesin analisis berbasis aturan (rule-based)
   yang berjalan 100% di browser tanpa API berbayar — cocok untuk
   PWA offline-first. Bisa diganti ke LLM API nanti bila perlu.
   ========================================================= */
function rupiah(n){
  return 'Rp ' + Math.round(n||0).toLocaleString('id-ID');
}

async function generateInsights(){
  const pengeluaran = await idb.getAll('pengeluaran');
  const tabungan = await idb.getAll('tabungan');
  const targets = await idb.getAll('target');
  const insights = [];

  if(pengeluaran.length === 0){
    insights.push({ tag:'Mulai', text:'Belum ada data pengeluaran. Tambahkan transaksi atau scan struk belanja agar AI Insight bisa menganalisis kebiasaan Anda.' });
    return insights;
  }

  const now = new Date();
  const bulanIni = pengeluaran.filter(p=> sameMonth(new Date(p.tanggal), now));
  const totalBulanIni = sumBy(bulanIni,'harga','jumlah');

  // kategori paling boros
  const byKategori = groupSum(bulanIni, 'kategori');
  const sorted = Object.entries(byKategori).sort((a,b)=>b[1]-a[1]);
  if(sorted.length){
    const [topKat, topVal] = sorted[0];
    const persen = totalBulanIni ? Math.round((topVal/totalBulanIni)*100) : 0;
    insights.push({
      tag:'Kategori Boros',
      text:`Pengeluaran ${topKat} bulan ini mencapai ${persen}% dari total pengeluaran (${rupiah(topVal)}).`
    });
  }

  // simulasi hemat 10%
  if(sorted.length){
    const [topKat, topVal] = sorted[0];
    const hemat = topVal * 0.1;
    const targetAktif = targets.find(t=> t.status === 'aktif');
    if(targetAktif){
      const sisa = Math.max(targetAktif.nominal_target - targetAktif.nominal_terkumpul, 0);
      const tabunganBulananRerata = estimateMonthlySavingRate(tabungan) || 1;
      const hariSekarang = sisa / (tabunganBulananRerata/30 || 1);
      const hariBaru = (sisa) / (((tabunganBulananRerata + hemat)/30) || 1);
      const selisihHari = Math.max(Math.round(hariSekarang - hariBaru), 0);
      if(selisihHari > 0){
        insights.push({
          tag:'Simulasi Hemat',
          text:`Jika mengurangi pengeluaran ${topKat} sebesar 10% (${rupiah(hemat)}/bulan), target "${targetAktif.nama}" bisa tercapai sekitar ${selisihHari} hari lebih cepat.`
        });
      }
    }
  }

  // prediksi pengeluaran bulan depan (rerata 3 bulan terakhir)
  const rerata3bln = average3MonthSpending(pengeluaran, now);
  if(rerata3bln > 0){
    insights.push({
      tag:'Prediksi',
      text:`Berdasarkan rata-rata 3 bulan terakhir, pengeluaran bulan depan diprediksi sekitar ${rupiah(rerata3bln)}.`
    });
  }

  // prediksi tabungan
  const lajuTabungan = estimateMonthlySavingRate(tabungan);
  if(lajuTabungan > 0){
    insights.push({
      tag:'Prediksi Tabungan',
      text:`Dengan laju menabung saat ini (~${rupiah(lajuTabungan)}/bulan), saldo tabungan diprediksi bertambah ${rupiah(lajuTabungan*3)} dalam 3 bulan ke depan.`
    });
  }

  // saran umum bila pengeluaran > tabungan
  const totalTabunganBulanIni = sumBy(tabungan.filter(t=> sameMonth(new Date(t.tanggal), now) && t.jenis==='masuk'), 'nominal');
  if(totalBulanIni > totalTabunganBulanIni && totalBulanIni > 0){
    insights.push({
      tag:'Saran',
      text:`Pengeluaran bulan ini (${rupiah(totalBulanIni)}) lebih besar dari tabungan (${rupiah(totalTabunganBulanIni)}). Coba alokasikan minimal 20% pemasukan untuk menabung lebih dulu.`
    });
  }

  return insights;
}

function sameMonth(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth(); }
function sumBy(arr, ...fields){
  return arr.reduce((sum,item)=>{
    if(fields.length===2) return sum + (Number(item[fields[0]])||0) * (Number(item[fields[1]])||1);
    return sum + (Number(item[fields[0]])||0);
  },0);
}
function groupSum(arr, key){
  const out = {};
  arr.forEach(item=>{
    const k = item[key] || 'Lainnya';
    out[k] = (out[k]||0) + (Number(item.harga)||0)*(Number(item.jumlah)||1);
  });
  return out;
}
function average3MonthSpending(pengeluaran, now){
  let total = 0, months = 0;
  for(let i=1;i<=3;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const items = pengeluaran.filter(p=>{
      const pd = new Date(p.tanggal);
      return pd.getFullYear()===d.getFullYear() && pd.getMonth()===d.getMonth();
    });
    if(items.length){ total += sumBy(items,'harga','jumlah'); months++; }
  }
  return months ? total/months : 0;
}
function estimateMonthlySavingRate(tabungan){
  const masuk = tabungan.filter(t=>t.jenis==='masuk');
  if(!masuk.length) return 0;
  const total = sumBy(masuk,'nominal');
  const dates = masuk.map(t=> new Date(t.tanggal).getTime());
  const span = Math.max((Math.max(...dates) - Math.min(...dates)) / (1000*60*60*24*30), 1);
  return total / span;
}

window.insightApi = { generateInsights, rupiah };
