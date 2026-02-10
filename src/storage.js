const memoryStore = new Map();

function canUseLocalStorage() {
  try {
    const probe = "__atdu_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = typeof window !== "undefined" && canUseLocalStorage();

export const storage = {
  async get(key) {
    if (useLocalStorage) {
      return { value: window.localStorage.getItem(key) };
    }
    return { value: memoryStore.has(key) ? memoryStore.get(key) : null };
  },
  async set(key, value) {
    const normalized = String(value);
    if (useLocalStorage) {
      window.localStorage.setItem(key, normalized);
      return true;
    }
    memoryStore.set(key, normalized);
    return true;
  },
  async delete(key) {
    if (useLocalStorage) {
      window.localStorage.removeItem(key);
      return true;
    }
    memoryStore.delete(key);
    return true;
  },
};
