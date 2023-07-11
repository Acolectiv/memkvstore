# MemKVStore

[![Release MemKVStore](https://github.com/Acolectiv/memkvstore/actions/workflows/release_package.yml/badge.svg)](https://github.com/Acolectiv/memkvstore/actions/workflows/release_package.yml)

`MemKVStore` is a key-value store class implemented in TypeScript. It supports a variety of advanced features, including time-to-live (TTL) for keys, secondary indexing, write-ahead logging (WAL), multi-node consensus, data partitioning, data compression and encryption, versioning and conflict resolution, batch operations and atomic transactions, event sourcing and CQRS (Command Query Responsibility Segregation), snapshots, and partitioning.

## Features

- **Basic key-value store operations:** Get, set, and delete operations.
- **Time-to-live (TTL) for keys:** Keys can be set to automatically expire after a certain amount of time.
- **Secondary indexing:** Allows efficient lookups based on values.
- **Write-ahead logging (WAL):** Changes are logged before they are applied, ensuring data integrity.
- **Multi-node consensus:** Multiple nodes can agree on the state of the data.
- **Data partitioning:** Data can be split across multiple nodes.
- **Versioning and conflict resolution:** Multiple versions of a value can be stored, and conflicts between versions can be resolved.
- **Batch operations and atomic transactions:** Multiple operations can be performed as a single atomic transaction.
- **Event sourcing and CQRS:** Changes to the data are stored as a sequence of events, which can be replayed to reconstruct the current state.
- **Snapshots:** The current state can be saved and restored later.
- **Partitioning:** Data can be divided into partitions, which can be processed in parallel.
- **LRU eviction policy:** When the store is full, the least recently used items are evicted.

## Usage

You can use your own storage strategy that needs to implement *StorageEngine*, but you can also use the already packaged *InMemoryStore* module:

```typescript
import { Store } from "memkvstore";

let store = new Store<any, any>();
```

That's it! You can now use the *store* instance as following:

```typescript
await store.set("key", "value", tll?); // it will return true

await store.get("key"); // it will return { value: "value", version: 0 } (example)

await store.delete("key"); // it will return { status: true, keyDeleted: key }

await store.bulkSet(
    ["key1", "key2", "key3"],
    ["val1", "val2", "val3"]
); // it will return { status: true, keys: keys.length, values: values.length }

await store.bulkDelete(
    ["key1", "key2", "key3"]
); // it will return { status: true, keysDeleted: keys.length }

await store.resetSession(); // it will return undefined
```