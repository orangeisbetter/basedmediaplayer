import { IDBPDatabase } from "idb";
import { Collection } from "./collection.ts";

export type CollectionStore = {
	id: number;
	name: string;
	trackIds: number[];
	parent: number;
};

export class CollectionRepository {
	public static readonly STORE_NAME = "collections" as const;

	private static nextID: number = 0;
	private static collections = new Map<number, Collection>();

	private static db: IDBPDatabase;

	/**
	 * Sets the database used for collection persistence.
	 * @param db The open IndexedDB database.
	 */
	public static init(db: IDBPDatabase) {
		this.db = db;
	}

	/**
	 * Returns the collection with the given ID.
	 * @param id The collection ID.
	 * @throws If no collection with that ID exists.
	 */
	public static byID(id: number): Collection {
		const collection = this.collections.get(id);
		if (collection === undefined) {
			throw new Error(`Collection by ID ${id} invalid`);
		}
		return collection;
	}
	
	/**
	 * Creates a new collection, attaches it to the given parent, and saves it.
	 * @param name The collection name.
	 * @param parent The parent collection, or `null` for a root collection.
	 * @returns The new collection.
	 */
	public static createNew(name: string, parent: Collection | null): Collection {
		const id = this.nextID++;
		const collection = new Collection({
			id,
			name: name
		});
		collection.setParent(parent);
		this.attachListeners(collection);
		this.collections.set(id, collection);
		this.save(collection);
		return collection;
	}

	/** Loads all collections from the database and rebuilds their tree relationships. */
	public static async loadAll() {
		const stores: CollectionStore[] = await this.db.getAll(this.STORE_NAME);

		// collection id -> parent id
		const parentMap = new Map<number, number>();

		for (const store of stores) {
			// create from store
			const collection = new Collection({
				id: store.id,
				name: store.name,
				trackIds: store.trackIds
			});
			if (this.nextID <= collection.id) {
				this.nextID = collection.id + 1;
			}
			this.collections.set(collection.id, collection);
			parentMap.set(store.id, store.parent);
		}

		for (const store of stores) {
			// link to parent collection
			const collection = this.collections.get(store.id)!;
			const parentId = parentMap.get(store.id)!;
			if (parentId == -1) {
				collection.setParent(null);
			} else {
				const parent = this.collections.get(parentId)!;
				collection.setParent(parent);
			}
		}

		// attach event listeners after everything is in place so we don't end up saving everything
		for (const collection of this.collections.values()) {
			this.attachListeners(collection);
		}
	}

	/**
	 * Persists the current state of a collection.
	 * @param collection The collection to save.
	 */
	public static save(collection: Collection) {
		this.db.put(this.STORE_NAME, this.toStore(collection));
	}

	private static delete(collectionId: number) {
		this.collections.delete(collectionId);
		this.db.delete(this.STORE_NAME, collectionId);
	}

	private static toStore(collection: Collection): CollectionStore {
		return {
			id: collection.id,
			name: collection.getName(),
			parent: collection.getParent()?.id ?? -1,
			trackIds: Array.from(collection.getDirectTrackIds())
		};
	}

	private static readonly onDelete = (collectionId: number) => {
		this.delete(collectionId);
	}

	private static readonly onChange = (collection: Collection) => {
		this.save(collection);
	}

	private static attachListeners(collection: Collection) {
		collection.events.selfChange.addListener(this.onChange);
		collection.events.parentChange.addListener(this.onChange);
		collection.events.tracksChangeDirect.addListener(this.onChange);
		collection.events.deleted.addListener(this.onDelete);
	}
};