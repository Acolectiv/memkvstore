import { StorageEngine } from "./StorageEngine";
export interface ConstructorOptions<K, V> {
    storage?: StorageEngine<K, V>;
    maxEntries?: number;
    walPath?: string;
    nodePaths?: string[];
}
