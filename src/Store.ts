// @ts-ignore
import fs from 'fs';
import { RWLock } from 'async-rwlock';
// @ts-ignore
import { fork, ChildProcess } from 'child_process';
// @ts-ignore
import crypto from 'crypto';

interface Command<K, V> {
    type: 'set' | 'delete';
    key: K;
    value?: V;
}

interface Event<K, V> {
    type: 'set' | 'delete';
    key: K;
    value?: V;
    version: number;
}

export interface VersionedValue<V> {
    value: V;
    version: number;
}

export interface StorageEngine<K, V> {
    get(key: K): Promise<VersionedValue<V> | undefined>;
    set(key: K, value: VersionedValue<V>): Promise<void>;
    delete(key: K): Promise<void>;
    entries(): Promise<[K, VersionedValue<V>][]>;
}

export class Store<K, V> {
    private commands: Command<K, V>[] = [];
    private events: Event<K, V>[] = [];
    private timeouts: Map<K, any> = new Map();
    private maxEntries: number | null;
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
    private secretKey: string;
    private versions: Map<K, VersionedValue<V>[]> = new Map();
    private batch: Command<K, V>[] = [];

    constructor(storage: StorageEngine<K, V>, maxEntries?: number, walPath?: string, nodePaths?: string[], secretKey?: string) {
        this.storage = storage;
        this.maxEntries = maxEntries || null;
        this.lock = new RWLock();
        this.secretKey = secretKey || '';
        if (walPath) {
            this.wal = fs.createWriteStream(walPath, { flags: 'a' });
        }
        if (nodePaths) {
            for (const nodePath of nodePaths) {
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

    public async set(key: K, value: V, ttl?: number): Promise<void> {
        const versionedValue: VersionedValue<V> = { value, version: 0 };
        const existing = await this.storage.get(key);
        if (existing) {
            versionedValue.version = existing.version + 1;
            clearTimeout(this.timeouts.get(key)!);
            this.timeouts.delete(key);
        }
        await this.storage.set(key, versionedValue);
        this.commands.push({ type: 'set', key, value });
        this.events.push({ type: 'set', key, value, version: versionedValue.version });
        if (ttl) {
            const timeout = setTimeout(() => this.delete(key), ttl);
            this.timeouts.set(key, timeout);
        }
        this.lru.unshift(key);
        if (this.lru.length > this.maxEntries!) {
            const evictedKey = this.lru.pop()!;
            await this.storage.delete(evictedKey);
        }
        const index = this.secondaryIndex.get(value) || [];
        index.push(key);
        this.secondaryIndex.set(value, index);
        if (this.wal) {
            const encryptedValue = crypto.createCipher('aes-256-cbc', this.secretKey).update(JSON.stringify(versionedValue), 'utf8', 'hex');
            this.wal.write(`${key} ${encryptedValue}\n`);
        }
    }

    public async delete(key: K): Promise<void> {
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
        }
    }

    public async get(key: K): Promise<{ value: V, version: number } | undefined> {
        const events = this.events.filter(event => event.key === key);
        if (events.length > 0) {
            if (events.length > 1) {
                const resolvedValue = this.resolveConflict(events.map(event => ({ value: event.value!, version: event.version })));
                return { value: resolvedValue, version: events.length };
            }
            return { value: events[0].value!, version: events[0].version };
        }
        return undefined;
    }

    private resolveConflict(versionedValues: VersionedValue<V>[]): V {
        versionedValues.sort((a, b) => b.version - a.version);
        return versionedValues[0].value;
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
}
