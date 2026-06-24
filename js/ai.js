/* =========================================================
   ai.js — "Baca via AI" menggunakan Claude API (vision) sungguhan.
   Karena Tabungin berjalan 100% di browser tanpa backend, fitur ini
   memakai API key Anthropic milik pengguna sendiri (disimpan di
   IndexedDB perangkat ini saja, dikirim langsung dari browser ke
   api.anthropic.com — TIDAK pernah lewat server pihak ketiga).

   Catatan keamanan: API key tersimpan di perangkat & bisa dilihat lewat
   DevTools browser. Cocok untuk pemakaian personal, BUKAN untuk versi
   multi-user/publik (untuk itu butuh backend agar key tidak terekspos).
   ========================================================= */

async function getAnthropicKey(){
  return await idb.getMeta('anthropic_api_key');
}
async function setAnthropicKey(key){
  await idb.setMeta('anthropic_api_key', key || null);
}

function captureFrameAsBase64(containerId, quality=0.85){
  const video = document.querySelector(`#${containerId} video`);
  if(!video || !video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

async function fileToBase64(file, quality=0.85, maxDim=1280){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width*scale); height = Math.round(height*scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callClaudeVision(base64Image, promptText, apiKey){
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type:'base64', media_type:'image/jpeg', data: base64Image } },
          { type: 'text', text: promptText }
        ]
      }]
    })
  });
  if(!res.ok){
    const errBody = await res.text().catch(()=> '');
    throw new Error(`API error ${res.status}: ${errBody.slice(0,200)}`);
  }
  const data = await res.json();
  const text = (data.content || []).map(c=> c.text || '').join('').trim();
  return text;
}

function parseJsonLoose(text){
  const cleaned = text.replace(/```json|```/g,'').trim();
  try{ return JSON.parse(cleaned); }
  catch(e){
    const match = cleaned.match(/\{[\s\S]*\}/);
    if(match){ try{ return JSON.parse(match[0]); }catch(_){} }
    return null;
  }
}

// Baca barcode/produk dari satu foto (untuk fitur "Baca via AI" di Scan Barcode)
async function aiReadBarcodeFromImage(base64Image){
  const apiKey = await getAnthropicKey();
  if(!apiKey) return { error:'no_key' };
  const prompt = `Lihat foto kemasan produk ini. Tugasmu:
1. Cari digit barcode (EAN/UPC) jika terlihat di foto, walau buram/miring.
2. Identifikasi nama produk dan kategori paling cocok dari daftar ini: Makanan, Minuman, Transportasi, Belanja, Pulsa, Internet, Pendidikan, Kesehatan, Game, Hiburan, Lainnya.
3. Jika ada label harga yang terlihat di kemasan, catat juga.
Balas HANYA dengan JSON murni tanpa markdown, format:
{"barcode": "digit barcode atau null jika tidak terbaca", "nama_produk": "nama produk atau null", "kategori": "salah satu kategori di atas", "harga_terdeteksi": angka_atau_null}`;
  try{
    const text = await callClaudeVision(base64Image, prompt, apiKey);
    const json = parseJsonLoose(text);
    if(!json) return { error:'parse_failed', raw:text };
    return { result: json };
  }catch(err){
    return { error:'api_error', message: err.message };
  }
}

// Baca daftar item dari foto struk belanja (untuk fitur Scan Struk)
async function aiReadReceiptFromImage(base64Image){
  const apiKey = await getAnthropicKey();
  if(!apiKey) return { error:'no_key' };
  const prompt = `Lihat foto struk belanja ini. Baca daftar barang yang dibeli beserta harganya.
Balas HANYA dengan JSON murni tanpa markdown, format:
{"items":[{"nama_produk":"...","harga":angka_per_item,"jumlah":angka_qty}], "total_struk": angka_atau_null}
Jika harga di struk adalah subtotal (harga x jumlah), hitung balik harga satuannya. Jika tidak yakin jumlah, gunakan 1.`;
  try{
    const text = await callClaudeVision(base64Image, prompt, apiKey);
    const json = parseJsonLoose(text);
    if(!json) return { error:'parse_failed', raw:text };
    return { result: json };
  }catch(err){
    return { error:'api_error', message: err.message };
  }
}

window.aiApi = { getAnthropicKey, setAnthropicKey, captureFrameAsBase64, fileToBase64, aiReadBarcodeFromImage, aiReadReceiptFromImage };
