import { Emitter } from "../emitter.ts";
import { Track } from "../track.ts";

type CollectionInitializer = {
	id: number;
	name: string;
	trackIds?: Iterable<number>;
}

export class Collection {
	public readonly id: number;
	private name: string;
	private parent: Collection | null = null;
	private children = new Set<Collection>();
	private trackIds: Set<number>;
	
	private tracksCache: Set<number> | null = null;

	public readonly events = {
		// Fired when the collection's own non-relational attributes change
		selfChange: new Emitter<Collection>(),
		// Fired when the collection's parent changes. Does NOT fire on deletion.
		parentChange: new Emitter<Collection>(),
		// Fired when a direct child collection is added or removed.
		childrenChange: new Emitter<Collection>(),
		// Fired after this collection is deleted. Parameter is the collection's (now inactive) ID
		deleted: new Emitter<number>(),
		// Fired when this collection's direct tracks change (added or removed)
		tracksChangeDirect: new Emitter<Collection>(),
		// Fired when the logical content of this collection changes (tracks added or removed in any part of the tree)
		tracksChangeIndirect: new Emitter<Collection>()
	};

	public static rootCollections = new Set<Collection>();

	// Events for root-level collections
	public static readonly events = {
		rootChildrenChange: new Emitter<void>()
	};

	public static recentlyUsed: Collection | null = null;

	public constructor({ id, name, trackIds }: CollectionInitializer) {
		this.id = id;
		this.name = name;
		this.trackIds = new Set(trackIds);
	}

	// Public API: static

	/**
	 * Finds every collection that directly contains at least one of the given tracks.
	 * @param trackIds The track IDs to look for.
	 * @returns The matching collections.
	 */
	public static getResidingCollections(trackIds: Iterable<number>): Set<Collection> {
		const matches = new Set(trackIds);
		const result = new Set<Collection>();
		if (matches.size === 0) return result;

		const stack = Array.from(this.rootCollections);
		while (stack.length > 0) {
			const collection = stack.pop()!;

			for (const trackId of collection.trackIds) {
				if (matches.has(trackId)) {
					result.add(collection);
					break;
				}
			}

			for (const child of collection.children) {
				stack.push(child);
			}
		}

		return result;
	}

	// instance

	/** Returns the collection's display name. */
	public getName(): string {
		return this.name;
	}

	/** Returns the parent collection, or `null` if this is a root collection. */
	public getParent(): Collection | null {
		return this.parent;
	}

	/** Returns the collection's direct children. */
	public getChildren(): ReadonlyArray<Collection> {
		return Array.from(this.children);
	}

	/** Returns the IDs of all tracks in this collection and its descendants. */
	public getTrackIds(): ReadonlySet<number> {
		if (!this.tracksCache) {
			this.tracksCache = new Set<number>();
			this.gather(this.tracksCache);
		};
		return this.tracksCache;
	}

	/** Returns the IDs of all albums referenced by tracks in this collection and its descendants. */
	public getAlbumIds(): ReadonlySet<number> {
		const albums = new Set<number>();
		for (const id of this.getTrackIds()) {
			const track = Track.byID(id)!;
			albums.add(track.albumId);
		}
		return albums;
	}

	/** Returns only the track IDs directly assigned to this collection. */
	public getDirectTrackIds(): Iterable<number> {
		return this.trackIds;
	}

	/**
	 * Renames the collection.
	 * @param name The new name.
	 */
	public setName(name: string): void {
		this.name = name;
		
		this.events.selfChange.emit(this);
	}

	/**
	 * Moves this collection under a new parent, or makes it a root when `parent` is `null`.
	 * @param parent The new parent collection.
	 */
	public setParent(parent: Collection | null): void {
		// Unlink from old parent
		if (this.parent !== null) {
			this.parent.children.delete(this);
			this.parent.invalidateCache();

			this.parent.events.childrenChange.emit(this.parent);
			this.parent.fireTrackChange();
		} else if (Collection.rootCollections.has(this)) {
			Collection.rootCollections.delete(this);

			Collection.events.rootChildrenChange.emit();
		}

		this.parent = parent;

		// Link to new parent
		if (this.parent !== null) {
			this.parent.children.add(this);
			this.parent.invalidateCache();

			this.parent.events.childrenChange.emit(this.parent);
			this.parent.fireTrackChange();
		} else {
			Collection.rootCollections.add(this);

			Collection.events.rootChildrenChange.emit();
		}

		this.events.parentChange.emit(this);
	}

	/**
	 * Adds tracks directly to this collection and notifies listeners.
	 * @param trackIds The track IDs to add.
	 */
	public addTracks(trackIds: Iterable<number>): void {
		Collection.recentlyUsed = this;
		for (const trackId of trackIds) {
			this.trackIds.add(trackId);
		}
		this.invalidateCache();

		this.events.tracksChangeDirect.emit(this);
		this.fireTrackChange();
	}

	/**
	 * Removes tracks directly from this collection and notifies listeners.
	 * @param trackIds The track IDs to remove.
	 */
	public removeTracks(trackIds: Iterable<number>): void {
		for (const trackId of trackIds) {
			this.trackIds.delete(trackId);
		}
		this.invalidateCache();

		this.events.tracksChangeDirect.emit(this);
		this.fireTrackChange();
	}

	/** Deletes this collection and all of its descendants, unlinking them from the tree. */
	public deleteSelf(): void {
		// Recursively delete children
		for (const child of this.children) {
			child.deleteSelf();
		}

		// Unlink from parent
		if (this.parent) {
			this.parent.children.delete(this);
			this.parent.invalidateCache();

			this.parent.events.childrenChange.emit(this.parent);
			this.parent.fireTrackChange();
		} else {
			Collection.rootCollections.delete(this);

			Collection.events.rootChildrenChange.emit();
		}

		if (Collection.recentlyUsed == this) {
			Collection.recentlyUsed = null;
		}

		this.events.deleted.emit(this.id);
	}

	// Private helpers

	private invalidateCache(): void {
		this.tracksCache = null;
		this.parent?.invalidateCache();
	}

	private fireTrackChange(): void {
		this.events.tracksChangeIndirect.emit(this);
		for (let collection = this.parent; collection !== null; collection = collection.parent) {
			collection.events.tracksChangeIndirect.emit(collection);
		}
	}

	private gather(out: Set<number>): void {
		for (const id of this.trackIds) out.add(id);
		for (const child of this.children) {
			child.gather(out);
		}
	}
}