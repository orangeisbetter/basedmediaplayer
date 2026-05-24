type Listener<T> = (payload: T) => void;

export class Emitter<T> {
    private listeners: Listener<T>[] = [];

    addListener(listener: Listener<T>) {
        this.listeners.push(listener);
    }

    removeListener(listener: Listener<T>) {
        this.listeners = this.listeners.filter(test => test != listener);
    }

    emit(payload: T) {
        this.listeners.forEach(listener => listener(payload));
    }
}