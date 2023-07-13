export interface Event<K, V> {
    type: 'set' | 'delete';
    key: K;
    value?: V;
    version: number;
}
