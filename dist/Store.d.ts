import { Event } from "./types";
import { ConstructorOptions } from './types/ConstructorOptions';
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
    private initialStorage;
    constructor(opts?: ConstructorOptions<K, V>);
    set(key: K, value: V, ttl?: number): Promise<boolean>;
    delete(key: K): Promise<{
        status: boolean;
        keyDeleted: K;
    }>;
    get(key: K): Promise<{
        value: V;
        version: number;
    } | undefined>;
    has(key: K): Promise<boolean>;
    batchSet(key: K, value: V, ttl?: number): Promise<void>;
    batchDelete(key: K): Promise<void>;
    executeBatch(): Promise<void>;
    snapshot(): Promise<number>;
    restore(snapshotVersion: number): Promise<void>;
    getPartition(key: K): Promise<number>;
    setPartition(key: K, partition: number): Promise<void>;
    bulkSet(keys: K[], values: V[], ttl?: number[]): Promise<{
        status: boolean;
        keys: number;
        values: number;
    }>;
    bulkDelete(keys: K[]): Promise<{
        status: boolean;
        keysDeleted: number;
    }>;
    getEvents(): Event<K, V>[];
    resetSession(): Promise<void>;
}
