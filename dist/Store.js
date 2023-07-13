"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
const fs_1 = __importDefault(require("fs"));
const async_rwlock_1 = require("async-rwlock");
const child_process_1 = require("child_process");
const InMemoryStore_1 = require("./storages/InMemoryStore");
class Store {
    commands = [];
    events = [];
    timeouts = new Map();
    maxEntries;
    lru = [];
    lock;
    snapshots = new Map();
    snapshotVersion = 0;
    secondaryIndex = new Map();
    wal;
    storage;
    nodes = [];
    consensus = new Map();
    partitions = new Map();
    versions = new Map();
    batch = [];
    initialStorage;
    constructor(opts) {
        this.initialStorage = opts?.storage || new InMemoryStore_1.InMemoryStore();
        this.storage = opts?.storage || new InMemoryStore_1.InMemoryStore();
        this.maxEntries = opts?.maxEntries || Infinity;
        this.lock = new async_rwlock_1.RWLock();
        if (opts?.walPath) {
            this.wal = fs_1.default.createWriteStream(opts.walPath, { flags: 'a' });
        }
        if (opts?.nodePaths) {
            for (const nodePath of opts.nodePaths) {
                const node = (0, child_process_1.fork)(nodePath);
                node.on('message', (message) => {
                    if (message.type === 'consensus') {
                        const consensus = this.consensus.get(message.id);
                        if (consensus) {
                            if (message.vote) {
                                consensus.yes += 1;
                            }
                            else {
                                consensus.no += 1;
                            }
                        }
                    }
                });
                this.nodes.push(node);
            }
        }
    }
    async set(key, value, ttl) {
        const versionedValue = { value, version: 0 };
        const existing = await this.storage.get(key);
        if (existing) {
            versionedValue.version = existing.version + 1;
            clearTimeout(this.timeouts.get(key));
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
        if (this.lru.length > this.maxEntries) {
            const evictedKey = this.lru.pop();
            await this.storage.delete(evictedKey);
        }
        const index = this.secondaryIndex.get(value) || [];
        index.push(key);
        this.secondaryIndex.set(value, index);
        if (this.wal) {
            this.wal.write(`${key} ${versionedValue}\n`);
        }
        return true;
    }
    async delete(key) {
        const existing = await this.storage.get(key);
        if (existing) {
            await this.storage.delete(key);
            this.commands.push({ type: 'delete', key });
            this.events.push({ type: 'delete', key, version: existing.version });
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
            const index = this.secondaryIndex.get(existing.value) || [];
            const keyIndex = index.indexOf(key);
            if (keyIndex !== -1) {
                index.splice(keyIndex, 1);
            }
            if (index.length === 0) {
                this.secondaryIndex.delete(existing.value);
            }
            else {
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
    async get(key) {
        const existing = await this.storage.get(key);
        if (existing)
            return { value: existing.value, version: existing.version };
        else
            return undefined;
    }
    async has(key) {
        const existing = await this.storage.get(key);
        if (existing)
            return true;
        else
            return false;
    }
    async batchSet(key, value, ttl) {
        this.batch.push({ type: 'set', key, value });
        if (ttl) {
            const timeout = setTimeout(() => this.batchDelete(key), ttl);
            this.timeouts.set(key, timeout);
        }
    }
    async batchDelete(key) {
        this.batch.push({ type: 'delete', key });
    }
    async executeBatch() {
        await this.lock.writeLock();
        try {
            for (const command of this.batch) {
                if (command.type === 'set') {
                    await this.set(command.key, command.value);
                }
                else if (command.type === 'delete') {
                    await this.delete(command.key);
                }
            }
            this.batch = [];
        }
        finally {
            this.lock.unlock();
        }
    }
    async snapshot() {
        const snapshot = new Map();
        for (const [key, versionedValues] of this.versions) {
            snapshot.set(key, versionedValues[versionedValues.length - 1]);
        }
        this.snapshotVersion += 1;
        this.snapshots.set(this.snapshotVersion, snapshot);
        return this.snapshotVersion;
    }
    async restore(snapshotVersion) {
        const snapshot = this.snapshots.get(snapshotVersion);
        if (!snapshot) {
            throw new Error(`Snapshot ${snapshotVersion} does not exist`);
        }
        this.versions.clear();
        for (const [key, versionedValue] of snapshot) {
            this.versions.set(key, [versionedValue]);
        }
    }
    async getPartition(key) {
        return this.partitions.get(key) || 0;
    }
    async setPartition(key, partition) {
        this.partitions.set(key, partition);
    }
    async bulkSet(keys, values, ttl) {
        if (keys.length !== values.length)
            throw new Error(`The values of \'keys\' and \'values\' should match.`);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = values[i];
            const t = ttl ? ttl[i] : undefined;
            await this.set(key, value, t);
        }
        return { status: true, keys: keys.length, values: values.length };
    }
    async bulkDelete(keys) {
        for (const key of keys) {
            await this.delete(key);
        }
        return { status: true, keysDeleted: keys.length };
    }
    getEvents() {
        return [...this.events];
    }
    async resetSession() {
        this.storage = this.initialStorage;
        this.events = [];
        this.commands = [];
        this.secondaryIndex = new Map();
    }
}
exports.Store = Store;
//# sourceMappingURL=Store.js.map