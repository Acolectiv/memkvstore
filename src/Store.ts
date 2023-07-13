// @ts-ignore
import fs from 'fs';
import { RWLock } from 'async-rwlock';
// @ts-ignore
import { fork, ChildProcess } from 'child_process';

import { InMemoryStore } from './storages/InMemoryStore';

import {
    Command,
    Event,
    StorageEngine,
    VersionedValue
} from "./types";

import { ConstructorOptions } from './types/ConstructorOptions';

export class Store<K, V> {
    private commands: Command<K, V>[] = [];
    private events: Event<K, V>[] = [];
    private timeouts: Map<K, NodeJS.Timeout> = new Map();
    private maxEntries: number | typeof Infinity;
    private lru: K[] = [];
    private lock: RWLock;
    private snapshots: Map<number, Map<K, VersionedValue<V>>> = new Map();
    private snapshotVersion: number = 0;
    private secondaryIndex: Map<V, K[]> = new Map();
    private wal: fs.WriteStream;
    private storage: StorageEngine<K, V>;
    private nodes: ChildProcess[] = [];
    private consensus: Map<string, { yes: number, no: number }> = new Map();
    private partitions: Map<K, number> = new Map();
    private versions: Map<K, VersionedValue<V>[]> = new Map();
    private batch: Command<K, V>[] = [];
    private initialStorage: StorageEngine<K, V>;

    constructor(opts?: ConstructorOptions<K, V>) {
        this.initialStorage = opts?.storage || new InMemoryStore<K, V>();
        this.storage = opts?.storage || new InMemoryStore<K, V>();
        this.maxEntries = opts?.maxEntries || Infinity;
        this.lock = new RWLock();
        if (opts?.walPath) {
            this.wal = fs.createWriteStream(opts.walPath, { flags: 'a' });
        }
        if (opts?.nodePaths) {
            for (const nodePath of opts.nodePaths) {
                const node = fork(nodePath);
                node.on('message', (message: any) => {
                    if (message.type === 'consensus') {
                        const consensus = this.consensus.get(message.id);
                        if (consensus) {
                            if (message.vote) {
                                consensus.yes += 1;
                            } else {
                                consensus.no += 1;
                            }
                        }
                    }
                });
                this.nodes.push(node);
            }
        }
    }

    // public async set(key: K, value: V, ttl?: number): Promise<boolean> {
    //     const versionedValue: VersionedValue<V> = { value, version: 0 };
    //     const existing = await this.storage.get(key);
    //     if (existing) {
    //         versionedValue.version = existing.version + 1;
    //         clearTimeout(this.timeouts.get(key)!);
    //         this.timeouts.delete(key);
    //     }

    //     await this.storage.set(key, versionedValue);
    //     this.commands.push({ type: 'set', key, value });
    //     this.events.push({ type: 'set', key, value, version: versionedValue.version });
    //     if (ttl) {
    //         const timeout = setTimeout(() => this.delete(key), ttl);
    //         this.timeouts.set(key, timeout);
    //     }
    //     this.lru.unshift(key);
    //     if (this.lru.length > this.maxEntries!) {
    //         const evictedKey = this.lru.pop()!;
    //         await this.storage.delete(evictedKey);
    //     }
    //     const index = this.secondaryIndex.get(value) || [];
    //     index.push(key);
    //     this.secondaryIndex.set(value, index);
    //     if (this.wal) {
    //         this.wal.write(`${key} ${versionedValue}\n`);
    //     }

    //     return true;
    // }

    public async set(key: K, value: V, ttl?: number): Promise<boolean> {
        const existing = await this.storage.get(key);
        let versionedValue: VersionedValue<V> = { value, version: 0 };
        
        if (existing) {
          const newVersion = existing.version + 1;
          versionedValue = { value, version: newVersion };
        }
      
        const success = await this.storage.compareAndSwap(key, existing, versionedValue);

        if (success) {
            this.commands.push({ type: 'set', key, value });
            this.events.push({ type: 'set', key, value, version: versionedValue.version });
            
            clearTimeout(this.timeouts.get(key)!);
            this.timeouts.delete(key);
        
            this.lru.unshift(key);
            if (this.lru.length > this.maxEntries!) {
                const evictedKey = this.lru.pop()!;
                await this.storage.delete(evictedKey);
            }
        
            const index = this.secondaryIndex.get(value) || [];
            index.push(key);
            this.secondaryIndex.set(value, index);
        
            if (this.wal) {
                this.wal.write(`${key} ${JSON.stringify(versionedValue)}\n`);
            }
        }

        return success;
    }

    public async delete(key: K): Promise<{ status: boolean, keyDeleted: K }> {
        const existing = await this.storage.get(key);
        if (existing) {
            await this.storage.delete(key);
            this.commands.push({ type: 'delete', key });
            this.events.push({ type: 'delete', key, version: existing.version });
            clearTimeout(this.timeouts.get(key)!);
            this.timeouts.delete(key);
            const index = this.secondaryIndex.get(existing.value) || [];
            const keyIndex = index.indexOf(key);
            if (keyIndex !== -1) {
                index.splice(keyIndex, 1);
            }
            if (index.length === 0) {
                this.secondaryIndex.delete(existing.value);
            } else {
                this.secondaryIndex.set(existing.value, index);
            }
            const lruIndex = this.lru.indexOf(key);
            if (lruIndex !== -1) {
                this.lru.splice(lruIndex, 1);
            }
            if (this.wal) {
                this.wal.write(`${key} null\n`);
            }

            return { status: true, keyDeleted: key };
        }

        return { status: false, keyDeleted: null };
    }

    public async get(key: K): Promise<{ value: V, version: number } | undefined> {
        const existing = await this.storage.get(key);
        if(existing) return { value: existing.value, version: existing.version };
        else return undefined;
    }

    public async has(key: K): Promise<boolean> {
        const existing = await this.storage.get(key);
        return !!existing;
    }

    public async batchSet(key: K, value: V, ttl?: number): Promise<void> {
        this.batch.push({ type: 'set', key, value });
        if (ttl) {
            const timeout = setTimeout(() => this.batchDelete(key), ttl);
            this.timeouts.set(key, timeout);
        }
    }

    public async batchDelete(key: K): Promise<void> {
        this.batch.push({ type: 'delete', key });
    }

    public async executeBatch(): Promise<void> {
        await this.lock.writeLock();
        try {
            for (const command of this.batch) {
                if (command.type === 'set') {
                    await this.set(command.key, command.value!);
                } else if (command.type === 'delete') {
                    await this.delete(command.key);
                }
            }
            this.batch = [];
        } finally {
            this.lock.unlock();
        }
    }

    public async snapshot(): Promise<number> {
        const snapshot = new Map<K, VersionedValue<V>>();
        for (const [key, versionedValues] of this.versions as any) {
            snapshot.set(key, versionedValues[versionedValues.length - 1]);
        }
        this.snapshotVersion += 1;
        this.snapshots.set(this.snapshotVersion, snapshot);
        return this.snapshotVersion;
    }

    public async restore(snapshotVersion: number): Promise<void> {
        const snapshot = this.snapshots.get(snapshotVersion);
        if (!snapshot) {
            throw new Error(`Snapshot ${snapshotVersion} does not exist`);
        }
        this.versions.clear();
        for (const [key, versionedValue] of snapshot as any) {
            this.versions.set(key, [versionedValue]);
        }
    }

    public async getPartition(key: K): Promise<number> {
        return this.partitions.get(key) || 0;
    }

    public async setPartition(key: K, partition: number): Promise<void> {
        this.partitions.set(key, partition);
    }

    public async bulkSet(keys: K[], values: V[], ttl?: number[]): Promise<{ status: boolean, keys: number, values: number }> {
        if(keys.length !== values.length) throw new Error(`The values of \'keys\' and \'values\' should match.`);
        
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = values[i];
            const t = ttl ? ttl[i] : undefined;
            await this.set(key, value, t);
        }
        
        return { status: true, keys: keys.length, values: values.length };
    }

    public async bulkDelete(keys: K[]): Promise<{ status: boolean, keysDeleted: number }> {
        for (const key of keys) {
            await this.delete(key);
        }

        return { status: true, keysDeleted: keys.length };
    }

    public getEvents(): Event<K, V>[] {
        return [...this.events];
    }

    public async resetSession(): Promise<void> {
        this.storage = this.initialStorage;
        this.events = [];
        this.commands = [];
        this.secondaryIndex = new Map<V, K[]>();
    }
}
