export interface Command<K, V> {
    type: 'set' | 'delete';
    key: K;
    value?: V;
}
