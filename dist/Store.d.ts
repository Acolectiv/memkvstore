import { StorageEngine } from "./types";
export declare class Store<K, V> {
    private commands;
    private events;
    private timeouts;
    private maxEntries;
    private lru;
    private lock;
    private snapshots;
    private snapshotVersion;
    private secondaryIndex;
    private wal;
    private storage;
    private nodes;
    private consensus;
    private partitions;
    private versions;
    private batch;
    constructor(storage?: StorageEngine<K, V>, maxEntries?: number, walPath?: string, nodePaths?: string[]);
    set(key: K, value: V, ttl?: number): Promise<void>;
    delete(key: K): Promise<void>;
    get(key: K): Promise<{
        value: V;
        version: number;
    } | undefined>;
    private resolveConflict;
    batchSet(key: K, value: V, ttl?: number): Promise<void>;
    batchDelete(key: K): Promise<void>;
    executeBatch(): Promise<void>;
    snapshot(): Promise<number>;
    restore(snapshotVersion: number): Promise<void>;
    getPartition(key: K): Promise<number>;
    setPartition(key: K, partition: number): Promise<void>;
}
