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
      try {
        return { value: window.localStorage.getItem(key) };
      } catch (error) {
        console.warn("storage.get fallback to memory store", error);
      }
    }
    return { value: memoryStore.has(key) ? memoryStore.get(key) : null };
  },
  async set(key, value) {
    const normalized = String(value);
    if (useLocalStorage) {
      try {
        window.localStorage.setItem(key, normalized);
        return true;
      } catch (error) {
        console.warn("storage.set fallback to memory store", error);
      }
    }
    memoryStore.set(key, normalized);
    return true;
  },
  async delete(key) {
    if (useLocalStorage) {
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn("storage.delete fallback to memory store", error);
      }
    }
    memoryStore.delete(key);
    return true;
  },
};
