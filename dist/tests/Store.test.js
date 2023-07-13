"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Store_1 = require("../Store");
let store = new Store_1.Store();
test("set", async () => {
    expect(await store.set("key", "value")).toBeTruthy();
});
test("get", async () => {
    let val = (await store.get("key")).value;
    expect(val).toBe("value");
});
test("delete", async () => {
    let val = await store.delete("key");
    expect(val).toStrictEqual({ status: true, keyDeleted: "key" });
});
test("bulkSet", async () => {
    let res = await store.bulkSet(["key1", "key2", "key3"], ["val1", "val2", "val3"]);
    expect(res).toStrictEqual({ status: true, keys: ["key1", "key2", "key3"].length, values: ["val1", "val2", "val3"].length });
});
test("bulkDelete", async () => {
    let res = await store.bulkDelete(["key1", "key2", "key3"]);
    expect(res).toStrictEqual({ status: true, keysDeleted: ["key1", "key2", "key3"].length });
});
//# sourceMappingURL=Store.test.js.map