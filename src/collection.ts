import { IDBPDatabase } from "idb";
import { Track } from "./track.ts";

export type CollectionStore = {
    id: number;
    name: string;
    trackIds: number[];
    parent: number;
}

export class Collection {
    id: number;
    name: string;
    trackIds: Set<number>;
    children: number[];
    parentId: number;

    /**
     * @deprecated Do not use this unless you need to
     */
    get collections(): Collection[] {
        const arr = new Array(this.children.length)
        for (const id of this.children) {
            arr.push(Collection.collections.get(id));
        }
        return arr;
    }

    private tracksCache?: Set<number>;

    static highestID: number = 0;
    static collections: Map<number, Collection> = new Map();

    static rootCollections: number[] = [];

    constructor(options: { id?: number, name: string, trackIds: number[], parentId: number }) {
        this.id = options.id === undefined ? Collection.highestID++ : options.id;
        this.name = options.name;
        this.trackIds = new Set(options.trackIds);
        this.parentId = options.parentId;
        this.children = [];
    }

    static createFromStore(store: CollectionStore): Collection {
        return new Collection({
            id: store.id,
            name: store.name,
            trackIds: store.trackIds,
            parentId: store.parent
        });
    }

    getStore(): CollectionStore {
        return {
            id: this.id as number,
            name: this.name,
            trackIds: Array.from(this.trackIds),
            parent: this.parentId
        };
    }

    static async saveAll(db: IDBPDatabase) {
        const transaction = db.transaction("collections", "readwrite");
        const objectStore = transaction.objectStore("collections");
        for (const collection of Collection.collections.values()) {
            await objectStore.put(collection.getStore());
        }
        transaction.commit();
    }

    static async loadAll(db: IDBPDatabase) {
        const collections: CollectionStore[] = await db.getAll("collections");

        // First pass: create objects (except for root, which is created statically)
        for (const collectionStore of collections) {
            const collection = Collection.createFromStore(collectionStore);
            Collection.collections.set(collection.id, collection);
            if (collection.id >= Collection.highestID) {
                Collection.highestID = collection.id + 1;
            }
        }

        // Second pass: link children
        for (const [id, collection] of Collection.collections) {
            const parentId = collection.parentId;
            if (parentId === -1) {
                this.rootCollections.push(id);
                continue;
            }
            Collection.collections.get(parentId)!.children.push(id);
        }
    }

    static byID(id: number): Collection | undefined {
        return Collection.collections.get(id);
    }

    invalidateTracksCache() {
        this.tracksCache = undefined;
        this.getParentCollection()?.invalidateTracksCache();
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

    *getChildren(): Generator<Collection> {
        for (const id of this.children) {
            yield Collection.collections.get(id)!;
        }
    }

    getParentCollection(): Collection | null {
        if (this.parentId === -1) return null;
        return Collection.collections.get(this.parentId)!;
    }

    addChild(id: number) {
        this.children.push(id);
        this.invalidateTracksCache();
    }

    private gather(out: Set<number>) {
        if (this.trackIds) {
            for (const id of this.trackIds) out.add(id);
        }
        for (const id of this.children) {
            Collection.collections.get(id)!.gather(out);
        }
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
}