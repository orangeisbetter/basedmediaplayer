import { IDBPDatabase } from "idb";
import { Track } from "./track.ts";

export type CollectionStore = {
    id: number;
    name: string;
    trackIds: number[];
    parent: number;
}

type CollectionRootObserver = (collections: Collection[]) => void;
type CollectionObserver = (collection: Collection) => void;

export class Collection {
    readonly id: number;
    name: string;
    private trackIds: Set<number>;
    private children: number[];
    private parentId: number;

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

    // These fire when a collection's children list or its name changes
    private baseObservers: CollectionObserver[] = [];
    // These fire when a collection's track member list changes (tracks added or removed)
    private trackObservers: CollectionObserver[] = [];

    private static db: IDBPDatabase;

    private static highestID: number = 0;
    static collections: Map<number, Collection> = new Map();

    static rootCollections: number[] = [];
    static recentlyAdded: Collection | null = null;

    private static rootObservers: CollectionRootObserver[] = [];

    constructor(options: { id?: number, name: string, trackIds: number[], parentId: number }) {
        this.id = options.id ?? Collection.highestID++;
        this.name = options.name;
        this.trackIds = new Set(options.trackIds);
        this.parentId = options.parentId;
        this.children = [];
        Collection.collections.set(this.id, this);
    }

    static init(db: IDBPDatabase) {
        this.db = db;
    }

    static createFromStore(store: CollectionStore): Collection {
        return new Collection({
            id: store.id,
            name: store.name,
            trackIds: store.trackIds,
            parentId: store.parent
        });
    }

    static async saveAll() {
        const transaction = this.db.transaction("collections", "readwrite");
        const objectStore = transaction.objectStore("collections");
        for (const collection of Collection.collections.values()) {
            await objectStore.put(collection.getStore());
        }
        transaction.commit();
    }

    static async loadAll() {
        const collections: CollectionStore[] = await this.db.getAll("collections");

        // First pass: create objects (except for root, which is created statically)
        for (const collectionStore of collections) {
            const collection = Collection.createFromStore(collectionStore);
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

    static createRootCollection(name: string): Collection {
        // Check to make sure a collection doesn't already exist by the same name
        // This isn't necessarily an illegal state but it is confusing for the user
        for (const id of this.rootCollections) {
            const collection = Collection.byID(id)!;
            if (collection.name.toLowerCase() === name.toLowerCase()) return collection;
        }

        const newCollection = new Collection({ name, trackIds: [], parentId: -1 });
        this.rootCollections.push(newCollection.id);
        const array = this.rootCollections.map(id => this.byID(id)!);
        this.rootObservers.forEach(observer => observer(array.slice()));
        return newCollection;
    }

    private static getResidingCollectionsRecursive(collection: Collection, out: Set<Collection>, trackIds: number[]) {
        const collectionTracks = collection.getTrackIds();
        trackIds = trackIds.filter(trackId => collectionTracks.has(trackId));
        for (const trackId of trackIds) {
            if (collection.trackIds.has(trackId)) {
                out.add(collection);
            }
        }
        for (const child of collection.getChildren()) {
            this.getResidingCollectionsRecursive(child, out, trackIds);
        }
    }

    static getResidingCollections(trackIds: number[]): Set<Collection> {
        const collections = new Set<Collection>();
        for (const collectionId of this.rootCollections) {
            const collection = Collection.byID(collectionId)!;
            this.getResidingCollectionsRecursive(collection, collections, trackIds);
        }
        return collections;
    }

    static attachRootObserver(observer: CollectionRootObserver) {
        this.rootObservers.push(observer);
    }

    static detachRootObserver(observer: CollectionRootObserver) {
        this.rootObservers = this.rootObservers.filter(test => test !== observer);
    }

    private tracksChanged() {
        this.tracksCache = undefined;
        this.trackObservers.forEach(observer => observer(this));
        this.getParent()?.tracksChanged();
    }

    add(trackIds: number[]) {
        Collection.recentlyAdded = this;
        if (trackIds.length === 0) return;
        for (const trackId of trackIds) {
            this.trackIds.add(trackId);
        }
        Collection.db.put("collections", this.getStore());
        this.tracksChanged();
    }

    remove(trackIds: number[]): number {
        if (trackIds.length === 0) return 0;
        let count = 0;
        for (const trackId of trackIds) {
            if (this.trackIds.delete(trackId)) count++;
        }
        if (count > 0) {
            Collection.db.put("collections", this.getStore());
            this.tracksChanged();
        }
        return count;
    }

    *getChildren(): Generator<Collection> {
        for (const id of this.children) {
            yield Collection.collections.get(id)!;
        }
    }

    getParent(): Collection | null {
        if (this.parentId === -1) return null;
        return Collection.collections.get(this.parentId)!;
    }

    getCollectionPath(): Collection[] {
        const path = this.parentId !== -1 ? Collection.collections.get(this.parentId)!.getCollectionPath() : [];
        path.push(this);
        return path;
    }

    createChild(name: string): Collection {
        // Check to make sure a collection doesn't already exist by the same name
        // This isn't necessarily an illegal state but it is confusing for the user
        for (const id of this.children) {
            const collection = Collection.byID(id)!;
            if (collection.name.toLowerCase() === name.toLowerCase()) return collection;
        }

        const newCollection = new Collection({ name, trackIds: [], parentId: this.id });
        this.children.push(newCollection.id);
        this.baseObservers.forEach(observer => observer(this));
        return newCollection;
    }

    deleteSelf() {
        for (const child of this.getChildren()) {
            child.deleteSelf();
        }
        Collection.collections.delete(this.id);
        if (this.parentId === -1) {
            Collection.rootCollections.filter(id => id !== this.id);
            const array = Collection.rootCollections.map(id => Collection.byID(id)!);
            Collection.rootObservers.forEach(observer => observer(array.slice()));
        } else {
            const parent = Collection.byID(this.parentId)!;
            parent.children.filter(id => id !== this.id);
            parent.baseObservers.forEach(observer => observer(parent));
        }
    }

    private gather(out: Set<number>) {
        for (const id of this.trackIds) out.add(id);
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

    getStore(): CollectionStore {
        return {
            id: this.id as number,
            name: this.name,
            trackIds: Array.from(this.trackIds),
            parent: this.parentId
        };
    }

    attachBaseObserver(observer: CollectionObserver) {
        this.baseObservers.push(observer);
    }

    detachBaseObserver(observer: CollectionObserver) {
        this.baseObservers = this.baseObservers.filter(test => test !== observer);
    }

    attachTrackObserver(observer: CollectionObserver) {
        this.trackObservers.push(observer);
    }

    detachTrackObserver(observer: CollectionObserver) {
        this.trackObservers = this.trackObservers.filter(test => test !== observer);
    }
}