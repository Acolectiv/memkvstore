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
    let val = await store.delete("key");
    expect(val).toStrictEqual({ status: true, keyDeleted: "key" });
});

test("bulkSet", async() => {
    let keys = ["key1", "key2", "key3"];
    let values = ["val1", "val2", "val3"];

    let res = await store.bulkSet(keys, values);

    expect(res).toStrictEqual({ status: true, keys: keys.length, values: values.length })
});

test("bulkDelete", async() => {
    let keys = ["key1", "key2", "key3"];

    let res = await store.bulkDelete(keys);

    expect(res).toStrictEqual({ status: true, keysDeleted: keys.length })
});