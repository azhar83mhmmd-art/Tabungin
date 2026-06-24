/* =========================================================
   supabase.js — versi LOKAL MURNI (tanpa Supabase, tanpa SQL)
   File ini sengaja dibuat sebagai stub agar app.js & scanner.js
   yang memanggil getSupabase()/sync tetap berjalan tanpa error,
   tapi semua data 100% disimpan di IndexedDB perangkat saja.
   ========================================================= */
function getSupabase(){
  return null; // tidak ada backend — semua lokal
}

const sync = {
  isOnline(){ return navigator.onLine; },

  // Langsung simpan ke IndexedDB, tidak ada antrian/sinkronisasi server.
  async saveLocalThenQueue(store, obj, type='upsert'){
    if(type === 'upsert'){
      await idb.put(store, obj);
    } else if(type === 'delete'){
      await idb.delete(store, obj.id);
    }
    return obj;
  },

  async flush(){ /* tidak ada server untuk disinkron */ },
  async pullAll(){ /* tidak ada server untuk ditarik */ }
};

window.sync = sync;
window.getSupabase = getSupabase;
