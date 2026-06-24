/* =========================================================
   db.js — IndexedDB wrapper (offline-first storage)
   Semua data ditulis dulu ke IndexedDB → render instan → lalu
   disinkronkan ke Supabase di background bila online.
   ========================================================= */
const DB_NAME = 'tabungin-db';
const DB_VERSION = 1;
const STORES = ['tabungan','target','pengeluaran','wishlist','challenge','produk','outbox','meta'];

// Polyfill UUID — crypto.randomUUID() butuh "secure context" (https atau localhost),
// jadi tidak tersedia jika dibuka lewat alamat IP biasa (http://192.168.x.x). Fungsi
// ini selalu jalan di kondisi apa pun.
function genId(){
  if(window.crypto && typeof window.crypto.randomUUID === 'function'){
    try{ return window.crypto.randomUUID(); }catch(e){ /* fallback di bawah */ }
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
}
window.genId = genId;

let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      STORES.forEach(name=>{
        if(!db.objectStoreNames.contains(name)){
          const store = db.createObjectStore(name, { keyPath:'id' });
          if(name !== 'meta') store.createIndex('updated_at','updated_at');
        }
      });
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return _dbPromise;
}

function tx(storeName, mode='readonly'){
  return openDB().then(db=> db.transaction(storeName, mode).objectStore(storeName));
}

const idb = {
  async put(store, obj){
    if(!obj.id) obj.id = genId();
    obj.updated_at = Date.now();
    const s = await tx(store,'readwrite');
    return new Promise((res,rej)=>{
      const r = s.put(obj);
      r.onsuccess = ()=>res(obj);
      r.onerror = ()=>rej(r.error);
    });
  },
  async get(store, id){
    const s = await tx(store);
    return new Promise((res,rej)=>{
      const r = s.get(id);
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
  },
  async getAll(store){
    const s = await tx(store);
    return new Promise((res,rej)=>{
      const r = s.getAll();
      r.onsuccess = ()=>res(r.result || []);
      r.onerror = ()=>rej(r.error);
    });
  },
  async delete(store, id){
    const s = await tx(store,'readwrite');
    return new Promise((res,rej)=>{
      const r = s.delete(id);
      r.onsuccess = ()=>res(true);
      r.onerror = ()=>rej(r.error);
    });
  },
  async clear(store){
    const s = await tx(store,'readwrite');
    return new Promise((res,rej)=>{
      const r = s.clear();
      r.onsuccess = ()=>res(true);
      r.onerror = ()=>rej(r.error);
    });
  },
  // outbox: antrian perubahan yang belum tersinkron ke Supabase
  async queueOutbox(action){
    // action = { id, store, type:'upsert'|'delete', payload }
    action.id = genId();
    action.created_at = Date.now();
    const s = await tx('outbox','readwrite');
    return new Promise((res,rej)=>{
      const r = s.put(action);
      r.onsuccess = ()=>res(action);
      r.onerror = ()=>rej(r.error);
    });
  },
  async setMeta(key, value){
    const s = await tx('meta','readwrite');
    return new Promise((res)=>{ s.put({id:key, value}); res(true); });
  },
  async getMeta(key){
    const v = await idb.get('meta', key);
    return v ? v.value : null;
  }
};

window.idb = idb;
