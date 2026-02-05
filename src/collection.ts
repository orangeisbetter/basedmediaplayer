import { IDBPDatabase } from "idb";
import { Track } from "./track.ts";

export interface CollectionStore {
    name: string;
    trackIds: number[];
    collections: CollectionStore[];
}

export class Collection {
    name: string;
    trackIds: Set<number>;
    collections: Collection[];

    private tracksCache?: Set<number>;
    private _parent?: Collection;

    constructor(options: { name: string, trackIds: number[], collections: Collection[] }) {
        this.name = options.name;
        this.trackIds = new Set(options.trackIds);
        this.collections = options.collections;
        for (const collection of this.collections) {
            collection._parent = this;
        }
    }

    get parent(): Collection | undefined {
        return this._parent;
    }

    static createFromStore(store: CollectionStore): Collection {
        return new Collection({
            name: store.name,
            trackIds: store.trackIds,
            collections: store.collections.map(store => Collection.createFromStore(store))
        });
    }

    addCollection(collection: Collection) {
        collection._parent = this;
        this.collections.push(collection);
    }

    add(trackId: number) {
        if (!this.trackIds) {
            throw Error("Cannot add track to collection. This collection is not valid for this process.");
        }
        this.trackIds.add(trackId);
        this.invalidateTracksCache();
    }

    remove(trackId: number): boolean {
        if (!this.trackIds) {
            throw Error("Cannot remove track from collection. This collection is not valid for this process.");
        }
        const success = this.trackIds.delete(trackId);
        if (success) {
            this.invalidateTracksCache();
        }
        return success;
    }

    invalidateTracksCache() {
        this.tracksCache = undefined;
        this._parent?.invalidateTracksCache();
    }

    private gather(out: Set<number>) {
        if (this.trackIds) {
            for (const id of this.trackIds) out.add(id);
        }
        for (const child of this.collections) child.gather(out);
    }

    getTrackIds(): Set<number> {
        if (!this.tracksCache) {
            this.tracksCache = new Set<number>();
            this.gather(this.tracksCache);
        };
        return this.tracksCache;
    }

    getAlbumIds(): Set<number> {
        const albums = new Set<number>();
        for (const id of this.getTrackIds()) {
            const track = Track.byID(id);
            if (!track) continue;
            albums.add(track.albumId);
        }
        return albums;
    }

    getStore(): CollectionStore {
        return {
            name: this.name,
            trackIds: Array.from(this.trackIds),
            collections: this.collections.map(collection => collection.getStore())
        };
    }
}

export class Library {
    static collections: Collection[] = [];

    static initFromStore(store: CollectionStore[]): void {
        this.collections = store.map(store => Collection.createFromStore(store));
    }

    static async save(db: IDBPDatabase) {
        await db.put("library", this.getStore(), "collections");
    }

    static async load(db: IDBPDatabase) {
        const store: CollectionStore[] = await db.get("library", "collections");
        this.collections = store.map(store => Collection.createFromStore(store));
    }

    static getStore(): CollectionStore[] {
        return this.collections.map(collection => collection.getStore());
    }
}