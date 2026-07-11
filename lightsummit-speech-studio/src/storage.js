// Drop-in replacement for the Claude artifact storage API, backed by
// localStorage. Keeps the same async { value } shape the component expects.
const PREFIX = "lightsummit-storage:";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(PREFIX + key);
      if (value === null) throw new Error(`No value for key: ${key}`);
      return { key, value };
    },
    async set(key, value) {
      localStorage.setItem(PREFIX + key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(PREFIX + key);
    },
  };
}
