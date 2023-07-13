import { StorageEngine, VersionedValue } from "../types";
export declare class InMemoryStore<K, V> implements StorageEngine<K, V> {
    private store;
    get(key: K): Promise<VersionedValue<V> | undefined>;
    set(key: K, value: VersionedValue<V>): Promise<void>;
    delete(key: K): Promise<void>;
    entries(): Promise<[K, VersionedValue<V>][]>;
}
