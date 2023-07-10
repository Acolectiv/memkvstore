import { Store } from "./Store.js";

import InMemoryStore from "./storages/InMemoryStore";

let store = new Store<string, string>(new InMemoryStore<string, string>());

store.set("test", "test1");