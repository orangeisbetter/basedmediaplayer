type Listener<T> = (payload: T) => void;

export class Emitter<T> {
    private listeners: Listener<T>[] = [];

    addListener(listener: Listener<T>) {
        this.listeners.push(listener);
    }

    emit(payload: T) {
        this.listeners.forEach(listener => listener(payload));
    }
}