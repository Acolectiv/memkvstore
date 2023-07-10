# MemKVStore

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

First, you need to create a storage engine. The storage engine is responsible for actually storing the data. You can use the already packaged Storage Engine:

```typescript
import { InMemoryStore } from "memkvstore";

let memoryStore = new InMemoryStore<any, any>();
```

Use the created *memoryStore* instance in the Store class:

```typescript
import { Store } from "memkvstore";

let store = new Store<any, any>(memoryStore);
```

That's it! You can now use the *store* instance as following:

```typescript
await store.set("key", "value");
await store.get("key");
await store.delete("key");
```