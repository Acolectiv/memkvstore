import { VersionedValue } from "./VersionedValue";
export interface StorageEngine<K, V> {
    get(key: K): Promise<VersionedValue<V> | undefined>;
    set(key: K, value: VersionedValue<V>): Promise<void>;
    delete(key: K): Promise<void>;
    entries(): Promise<[K, VersionedValue<V>][]>;
}
