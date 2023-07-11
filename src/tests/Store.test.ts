import { Store } from "../Store";

let store = new Store<any, any>();

test("set", async() => {
    expect(await store.set("key", "value")).toBeTruthy();
});

test("get", async() => {
    let val = (await store.get("key")).value;
    expect(val).toBe("value");
});

test("delete", async() => {
    await store.delete("key");
    let val = (await store.get("key"));
    expect(val).toBe(undefined);
});

test("bulkSet", async() => {
    let res = await store.bulkSet(["key1", "key2", "key3"], ["val1", "val2", "val3"]);
    expect(res).toStrictEqual({ status: true, keys: ["key1", "key2", "key3"].length, values: ["val1", "val2", "val3"].length })
});

test("bulkDelete", async() => {
    let res = await store.bulkDelete(["key1", "key2", "key3"]);
    expect(res).toStrictEqual({ status: true, keysDeleted: ["key1", "key2", "key3"].length })
});