export const storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    return { value: v };
  },
  async set(key, value) {
    localStorage.setItem(key, String(value));
    return true;
  },
  async delete(key) {
    localStorage.removeItem(key);
    return true;
  },
};
