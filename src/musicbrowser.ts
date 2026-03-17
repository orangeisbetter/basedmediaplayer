import { Collection } from "./collection.ts";

// Artist and album are mutually exclusive
export type BrowserState = {
    collection: Collection | null;
    albumId: number | null;
    artistId: number | null;
};

export type BrowserStateSet = {
    collection?: Collection | null;
    albumId?: number | null;
    artistId?: number | null;
};

export type BrowserStateStore = {
    collectionId: number | null;
    albumId: number | null;
    artistId: number | null;
};

type BrowserObserver = (state: BrowserState) => void

export class MusicBrowser {
    private static state: BrowserState = {
        collection: null,
        albumId: null,
        artistId: null
    };

    public static get collection() {
        return this.state.collection
    }
    public static get albumId() {
        return this.state.albumId;
    }
    public static get artistId() {
        return this.state.artistId;
    }

    private static observers: (BrowserObserver)[] = [];

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    private static stateStore(state: BrowserState): BrowserStateStore {
        return {
            collectionId: state.collection?.id ?? null,
            albumId: state.albumId,
            artistId: state.artistId
        };
    }

    private static saveNewState() {
        const store = this.stateStore(this.state);
        const current = document.title;
        document.title = "Based Media Player";
        history.pushState(store, "");
        document.title = current;
    }

    private static restore(state: BrowserStateStore | null) {
        if (state === null) {
            state = {
                collectionId: null,
                albumId: null,
                artistId: null
            };
        }
        this.state = {
            collection: state.collectionId !== null ? Collection.byID(state.collectionId)! : null,
            albumId: state.albumId ?? null,
            artistId: state.artistId ?? null
        };

        this.observers.forEach(observer => observer(this.state));
    }

    static init() {
        history.replaceState(this.stateStore(this.state), "Local library");

        addEventListener("popstate", event => {
            this.restore(event.state);
        });
    }

    static attachObserver(observer: BrowserObserver) {
        this.observers.push(observer);
    }

    static detachObserver(observer: (state: BrowserState) => void) {
        this.observers = this.observers.filter(test => test !== observer);
    }

    static navigate(newStateSet: BrowserStateSet) {
        const newState: BrowserState = {
            collection: newStateSet.collection ?? null,
            albumId: null,
            artistId: null
        };

        if (newStateSet.albumId !== undefined) {
            newState.albumId = newStateSet.albumId;
        }

        if (newStateSet.artistId !== undefined) {
            newState.artistId = newStateSet.artistId;
        }

        if (newState.collection === this.state.collection &&
            newState.albumId === this.state.albumId &&
            newState.artistId === this.state.artistId
        ) return;

        this.state = newState;
        this.saveNewState();

        this.observers.forEach(observer => observer(this.state));
    }

    static modify(callback: (state: BrowserState) => void) {
        const newState = { ...this.state };
        callback(newState);

        if (newState.collection === this.state.collection &&
            newState.albumId === this.state.albumId &&
            newState.artistId === this.state.artistId
        ) return;

        this.state = newState;
        this.saveNewState();

        this.observers.forEach(observer => observer(this.state));
    }
}