/* =========================================================
   scanner.js — Scan Barcode (Html5-QRCode)
   Alur (mirip POS minimarket):
   1. Cek database produk LOKAL (hasil scan/input sebelumnya — "belajar sendiri")
   2. Cek beberapa API publik gratis (Open Food/Beauty/Pet/Products Facts)
   3. Jika tetap tidak ketemu -> form input manual otomatis terbuka, prefilled
      barcode-nya. Setelah disimpan, produk itu otomatis masuk ke database
      lokal sehingga scan barcode yang sama berikutnya langsung dikenali.
   ========================================================= */
let html5QrCode = null;
let scannerRunning = false;

// Beberapa "sister project" Open Food Facts — API & format sama, tapi domain
// kategori berbeda, jadi cakupan produk jauh lebih luas dari sekadar makanan.
const OFF_SOURCES = [
  { name:'openfoodfacts',  url:'https://world.openfoodfacts.org/api/v2/product/' },
  { name:'openbeautyfacts', url:'https://world.openbeautyfacts.org/api/v2/product/' },
  { name:'openproductsfacts', url:'https://world.openproductsfacts.org/api/v2/product/' },
  { name:'openpetfoodfacts', url:'https://world.openpetfoodfacts.org/api/v2/product/' },
];

function getSupportedFormats(){
  if(typeof Html5QrcodeSupportedFormats === 'undefined') return undefined;
  const F = Html5QrcodeSupportedFormats;
  return [
    F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.UPC_EAN_EXTENSION,
    F.CODE_128, F.CODE_39, F.CODE_93, F.CODABAR, F.ITF, F.QR_CODE
  ];
}

// Tebak info dasar dari struktur barcode GS1 (negara asal) — supaya form
// manual tidak benar-benar kosong walau produk tidak ketemu di API mana pun.
function guessFromBarcodePrefix(barcode){
  const digits = barcode.replace(/\D/g,'');
  if(digits.length < 3) return {};
  const prefix3 = Number(digits.slice(0,3));
  let negara = null;
  if(prefix3 >= 899 && prefix3 <= 899) negara = 'Indonesia';
  else if(prefix3 >= 690 && prefix3 <= 699) negara = 'China';
  else if(prefix3 >= 880 && prefix3 <= 880) negara = 'Korea Selatan';
  else if(prefix3 >= 450 && prefix3 <= 459) negara = 'Jepang';
  else if(prefix3 >= 0 && prefix3 <= 19) negara = 'Amerika Serikat / Kanada';
  return { negara };
}

async function tryFetchJson(url, timeoutMs=6000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    clearTimeout(t);
    return null;
  }
}

async function findProductByBarcode(barcode){
  // 1) database LOKAL (hasil scan/input sebelumnya) — ini yang membuat sistem
  //    makin "pintar" semakin sering dipakai, persis seperti master produk kasir.
  const local = await idb.getAll('produk');
  let produk = local.find(p => p.barcode === barcode);
  if(produk) return { produk, source:'database lokal', error:null };

  // 2) Supabase (jika suatu saat dikonfigurasi kembali — saat ini selalu null)
  const client = getSupabase();
  if(client && sync.isOnline()){
    try{
      const { data, error } = await client.from('produk').select('*').eq('barcode', barcode).maybeSingle();
      if(!error && data){
        await idb.put('produk', data);
        return { produk:data, source:'supabase', error:null };
      }
    }catch(e){ console.warn(e); }
  }

  if(!navigator.onLine){
    return { produk:null, source:null, error:'offline' };
  }

  // 3) Coba semua sumber Open*Facts secara berurutan
  let networkIssue = false;
  for(const src of OFF_SOURCES){
    const json = await tryFetchJson(`${src.url}${barcode}.json`);
    if(json === null){ networkIssue = true; continue; }
    if(json.status === 1 && json.product){
      const p = json.product;
      const newProduk = {
        id: genId(),
        barcode,
        nama_produk: p.product_name || p.product_name_id || p.generic_name || 'Produk Tanpa Nama',
        foto_produk: p.image_front_url || p.image_url || null,
        merek: p.brands || '-',
        kategori: (p.categories_tags && p.categories_tags[0]) ? humanizeOFFCategory(p.categories_tags[0]) : 'Lainnya',
        harga_default: null,
        created_at: new Date().toISOString()
      };
      await idb.put('produk', newProduk);
      if(client) sync.saveLocalThenQueue('produk', newProduk).catch(()=>{});
      return { produk:newProduk, source:src.name, error:null };
    }
  }

  return { produk:null, source:null, error: networkIssue ? 'network' : null, guess: guessFromBarcodePrefix(barcode) };
}

function humanizeOFFCategory(tag){
  return (tag.split(':')[1] || tag).replace(/-/g,' ');
}

function startScanner(elementId, onResult){
  if(scannerRunning) return;
  const formats = getSupportedFormats();
  html5QrCode = new Html5Qrcode(elementId, formats ? { formatsToSupport: formats, verbose:false } : undefined);
  const config = { fps: 12, qrbox: { width: 270, height: 160 }, aspectRatio: 1.4, disableFlip: false };
  html5QrCode.start(
    { facingMode: "environment" },
    config,
    (decodedText)=>{
      stopScanner();
      onResult(decodedText);
    },
    ()=>{ /* scan error per-frame (tidak ada barcode di frame), diamkan */ }
  ).then(()=> scannerRunning = true)
   .catch(err=>{
     let msg = 'Tidak bisa mengakses kamera.';
     const s = String(err).toLowerCase();
     if(s.includes('permission')) msg = 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser.';
     else if(s.includes('secure')) msg = 'Kamera hanya bisa diakses lewat HTTPS atau localhost.';
     else if(s.includes('notfound')) msg = 'Kamera tidak ditemukan di perangkat ini.';
     toast(msg, 'error');
     console.error('Scanner start error:', err);
   });
}

function stopScanner(){
  if(html5QrCode && scannerRunning){
    html5QrCode.stop().then(()=> html5QrCode.clear()).catch(()=>{});
    scannerRunning = false;
  }
}

async function toggleFlashlight(on){
  if(!html5QrCode){ toast('Mulai scan dulu sebelum mengaktifkan flash', 'error'); return; }
  try{
    await html5QrCode.applyVideoConstraints({ advanced: [{ torch: on }] });
  }catch(e){ toast('Flashlight tidak didukung perangkat ini', 'error'); }
}

function scanFromFile(file, onResult){
  const formats = getSupportedFormats();
  const tempScanner = new Html5Qrcode("qr-reader-file-result", formats ? { formatsToSupport: formats, verbose:false } : undefined);
  tempScanner.scanFile(file, true)
    .then(decodedText => { onResult(decodedText); tempScanner.clear(); })
    .catch(err => {
      console.error('scanFile error:', err);
      toast('Barcode tidak terbaca dari foto. Coba foto lebih jelas & fokus pada garis barcode.', 'error');
    });
}

window.scannerApi = { startScanner, stopScanner, toggleFlashlight, scanFromFile, findProductByBarcode };
