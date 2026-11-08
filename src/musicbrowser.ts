import { Collection } from "./data/collection.ts";
import { CollectionRepository } from "./data/collectionstore.ts";
import { Emitter } from "./emitter.ts";

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

	static events = {
		locationChange: new Emitter<BrowserState>()
	};

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

		let collection = null;
		if (state.collectionId !== null) try {
			collection = CollectionRepository.byID(state.collectionId);
		} catch (_) {
			// do nothing; use null
		}

        const newState: BrowserState = {
            collection: collection,
            albumId: state.albumId ?? null,
            artistId: state.artistId ?? null
        };
		
		this.setState(newState);
    }

    static init() {
        history.replaceState(this.stateStore(this.state), "Local library");

        addEventListener("popstate", event => {
            this.restore(event.state);
        });
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

		this.setState(newState);
    }

    static modify(callback: (state: BrowserState) => void) {
        const newState = { ...this.state };
        callback(newState);
		
		this.setState(newState);
    }

	private static readonly collectionHandler = () => {
		const newState = { ...this.state };
		newState.collection = this.state.collection?.getParent() ?? null;
		
		this.setState(newState);
	};

	private static setState(newState: BrowserState) {
		if (newState.collection === this.state.collection &&
			newState.albumId === this.state.albumId &&
			newState.artistId === this.state.artistId
		) return;

		if (this.state.collection !== null) {
			this.state.collection.events.deleted.removeListener(this.collectionHandler);
		}

		if (newState.collection !== null) {
			newState.collection.events.deleted.addListener(this.collectionHandler);
		}

		this.state = newState;
		this.saveNewState();

		this.events.locationChange.emit(this.state);
	}
}