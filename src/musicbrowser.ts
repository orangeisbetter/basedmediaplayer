import { Collection } from "./collection.ts";

export type BrowserState = {
    collection: Collection | null;
    albumId: number | null;
};

export type BrowserStateSet = {
    collection?: Collection | null;
    albumId?: number | null;
}

export type BrowserStateStore = {
    collectionId: number | null;
    albumId: number | null;
};

type BrowserObserver = (state: BrowserState) => void

export class MusicBrowser {
    private static state: BrowserState = {
        collection: null,
        albumId: null
    };

    private static observers: (BrowserObserver)[] = [];

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    private static stateStore(state: BrowserState): BrowserStateStore {
        return {
            collectionId: state.collection?.id ?? null,
            albumId: state.albumId
        };
    }

    private static saveNewState() {
        const store = this.stateStore(this.state);
        const current = document.title;
        document.title = "Based Media Player";
        history.pushState(store, "");
        document.title = current;
    }

    private static restore(state: BrowserStateStore) {
        if (state === null) {
            state = {
                collectionId: null,
                albumId: null
            };
        }
        this.state = {
            collection: state.collectionId !== null ? Collection.byID(state.collectionId)! : null,
            albumId: state.albumId ?? null
        };

        this.observers.forEach(observer => observer(this.state));
    }

    static init() {
        history.replaceState(this.stateStore(this.state), "Local library");

        addEventListener("popstate", event => {
            this.restore(event.state as BrowserStateStore);
        });
    }

    static attachObserver(observer: BrowserObserver) {
        this.observers.push(observer);
    }

    static detachObserver(observer: (state: BrowserState) => void) {
        this.observers = this.observers.filter(test => test !== observer);
    }

    static navigate(newState: BrowserStateSet) {
        if (this.state.collection === (newState.collection ?? null)
            && this.state.albumId === (newState.albumId ?? null)) {
            // there are no changes
            return;
        }

        this.state = {
            collection: newState.collection ?? null,
            albumId: newState.albumId ?? null
        };

        this.saveNewState();

        this.observers.forEach(observer => observer(this.state));
    }

    static modify(callback: (state: BrowserState) => void) {
        const newState = { ...this.state };
        callback(newState);
        this.state = newState;

        this.saveNewState();

        this.observers.forEach(observer => observer(this.state));
    }
}