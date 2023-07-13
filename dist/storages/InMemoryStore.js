"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStore = void 0;
class InMemoryStore {
    store = new Map();
    async get(key) {
        return this.store.get(key);
    }
    async set(key, value) {
        this.store.set(key, value);
    }
    async delete(key) {
        this.store.delete(key);
    }
    async entries() {
        return Array.from(this.store.entries());
    }
}
exports.InMemoryStore = InMemoryStore;
//# sourceMappingURL=InMemoryStore.js.map