/* Minimal IndexedDB-backed queue for offline self-clock-in/out. Scope is deliberately
 * narrow: only Time In/Out (with its photo) can be captured while offline and synced once
 * back online — nothing else in My Portal works offline. IndexedDB (not localStorage) is
 * required here since the queued item includes a photo Blob, which localStorage can't hold.
 */
const OfflineQueue = (function () {
  const DB_NAME = 'txtaire-offline';
  const STORE_NAME = 'pendingAttendance';
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function add(item) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listForEmployee(employeeId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const all = (req.result || []).filter((i) => i.employeeId === employeeId);
        all.sort((a, b) => a.createdAt - b.createdAt);
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(localId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { add, listForEmployee, remove };
})();
