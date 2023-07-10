import {
    StorageEngine,
    VersionedValue
} from "../types";

export class InMemoryStore<K, V> implements StorageEngine<K, V> {
    private store: Map<K, VersionedValue<V>> = new Map();

    async get(key: K): Promise<VersionedValue<V> | undefined> {
        return this.store.get(key);
    }

    async set(key: K, value: VersionedValue<V>): Promise<void> {
        this.store.set(key, value);
    }

    async delete(key: K): Promise<void> {
        this.store.delete(key);
    }

    async entries(): Promise<[K, VersionedValue<V>][]> {
        return Array.from(this.store.entries());
    }
}
