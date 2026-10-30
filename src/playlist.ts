import { convertTime } from "./time.ts";
import { Track } from "./track.ts";
import { Emitter } from "./emitter.ts";
import { Stream } from "./stream.ts";

export type PlaylistAddEventData = PlaylistItem[];
export type PlaylistInsertEventData = {
    /** The tracks that were inserted. */
    items: PlaylistItem[];
    /** The index the tracks were inserted at. */
    to: number;
};
export type PlaylistRemoveEventData = number[];
export type PlaylistReorderEventData = {
    /** The track indices that were removed. */
    from: number[];
    /** The index where the tracks were reinserted. */
    to: number;
    /** The new index of the current track. */
    current: number;
    /** A mapping between old indices and new ones. */
    mapping: number[];
};
export type PlaylistShuffleEventData = {
    /** A mapping from new indices to old ones. */
    mapping: number[];
    /** The new index of the current track. */
    current: number;
}
export type PlaylistTrackChangeEventData = {
    /** The current track index. */
    index: number | null;
    /** The current item */
    item: PlaylistItem | null;
};
export type PlaylistNumTracksChangeEventData = {
    /** The number of tracks in the playlist. */
    number: number;
    /** The total duration of the tracks in the playlist. */
    duration: number;
};

export enum LoopMode {
    /** Stop at the end of the playlist. */
    None,
    /** Repeat the current track when it finishes. */
    Track,
    /** Restart at the top of the playlist when the last track finishes. */
    Playlist,
}

export enum PlaylistItemType {
	TRACK,
	STREAM,
};

export type PlaylistItem = {
	type: PlaylistItemType.TRACK
	trackId: number,
} | {
	type: PlaylistItemType.STREAM,
	stream: Stream
};

export const PlaylistItem = {
	createFromTrack(trackId: number): PlaylistItem {
		return { type: PlaylistItemType.TRACK, trackId };
	},

	createFromStream(stream: Stream): PlaylistItem {
		return { type: PlaylistItemType.STREAM, stream };
	}
}

/**
 * A static class for the playlist.
 * 
 * This class manages a list of tracks and an index into that list, with events that are emitted
 * when the list changes.
 * 
 * Looping is also managed in this class. Looping logic is implemented in {@link Playlist.autoNext}.
 */
export class Playlist {
    private static list: PlaylistItem[] = [];
    private static currentItemIdx: number = 0;

    /** The loop mode of the playlist. */
    static loopMode: LoopMode = LoopMode.None;

    static events = {
        /** Emitted when tracks are added to the end of the playlist. */
        add: new Emitter<PlaylistAddEventData>(),
        /** Emitted when tracks are inserted into the playlist. */
        insert: new Emitter<PlaylistInsertEventData>(),
        /** Emitted when tracks are removed from the playlist. */
        remove: new Emitter<PlaylistRemoveEventData>(),
        /** Emitted when tracks are reordered in the playlist. */
        reorder: new Emitter<PlaylistReorderEventData>(),
        /** Emitted when the playlist is cleared. */
        clear: new Emitter<void>(),
        /** Emitted when the playlist is shuffled. */
        shuffle: new Emitter<PlaylistShuffleEventData>(),
        /** Emitted when the current track changes. */
        trackChange: new Emitter<PlaylistTrackChangeEventData>(),
        /** Emitted when the number of tracks in the playlist changes. */
        numTracksChange: new Emitter<PlaylistNumTracksChangeEventData>()
    };

    constructor() {
        throw Error("This static class cannot be instantiated.");
    }

    /**
     * Adds a list of track IDs to the end of the playlist.
     * @param trackIds The IDs of the tracks to add.
     */
    static add(...items: PlaylistItem[]) {
		Playlist.list.push(...items);
        Playlist.events.add.emit(items);
        if (items.length > 0) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
    }

    /**
     * Inserts a list of track IDs into the playlist at a particular index. 
     * @param index The index to insert tracks at. The tracks will be inserted "in-between" the
     * track at this index, and the one before it.
     * @param items The IDs of the tracks to insert.
     */
    static insert(index: number, ...items: PlaylistItem[]) {
        if (index <= Playlist.currentItemIdx) {
            Playlist.currentItemIdx += items.length;
        }
        Playlist.list.splice(index, 0, ...items);
        Playlist.events.insert.emit({ items: items, to: index });
        if (items.length > 0) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
    }

    /**
     * Similar to {@link Playlist.insert}, except insertion happens after the current
     * track.
     * @param items The IDs of the tracks to insert.
     */
    static insertNext(...items: PlaylistItem[]) {
        Playlist.insert(Playlist.currentItemIdx + 1, ...items);
    }

    /**
     * Removes tracks from the playlist by their index in the playlist.
     * @param trackIndices The tracks to remove.
     */
    static remove(...trackIndices: number[]) {
        trackIndices.sort((a, b) => b - a);
        let trackChange = false;
        for (const i of trackIndices) {
            Playlist.list.splice(i, 1);
            if (i < Playlist.currentItemIdx) {
                Playlist.currentItemIdx--;
            } else if (i == Playlist.currentItemIdx) {
                trackChange = true;
                if (Playlist.currentItemIdx >= Playlist.list.length) Playlist.currentItemIdx = Playlist.list.length - 1;
                if (Playlist.currentItemIdx < 0) Playlist.currentItemIdx = 0;
            }
        }
        Playlist.events.remove.emit(trackIndices);
        if (trackIndices.length > 0) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
        if (trackChange) {
            if (Playlist.list.length == 0) {
                Playlist.events.trackChange.emit({ index: null, item: null });
            } else {
                Playlist.events.trackChange.emit({ index: Playlist.currentItemIdx, item: Playlist.list[Playlist.currentItemIdx] });
            }
        }
    }

    /**
     * Clears the playlist.
     */
    static clear() {
        const changed = Playlist.list.length > 0;
        Playlist.list.length = 0;
        Playlist.events.clear.emit();
        Playlist.events.trackChange.emit({ index: null, item: null });
        if (changed) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
    }

    /** 
     * Shuffles the playlist
     */
    static shuffle() {
        const indices = Array.from(Playlist.list, (_, i) => i);

        for (let currentIndex = Playlist.list.length - 1; currentIndex >= 0; currentIndex--) {
            const randomIndex = Math.floor(Math.random() * (currentIndex + 1));

            [Playlist.list[currentIndex], Playlist.list[randomIndex]] = [Playlist.list[randomIndex], Playlist.list[currentIndex]];
            [indices[currentIndex], indices[randomIndex]] = [indices[randomIndex], indices[currentIndex]];
        }

        // Find where the current track moved to, since it's too complicated to do this in the above loop
        for (let i = 0; i < indices.length; i++) {
            if (indices[i] == Playlist.currentItemIdx) {
                Playlist.currentItemIdx = i;
                break;
            }
        }

        Playlist.events.shuffle.emit({ mapping: indices, current: Playlist.currentItemIdx });
    }

    /**
     * Removes and then reinserts tracks from the playlist. This is similar to a
     * call to {@link Playlist.remove} and to {@link Playlist.insert}, except that
     * because this is a reorder, the current track does not change, the length of
     * the playlist does not change, fewer events are emitted.
     * @param index The index to insert at
     * @param trackIndices The indices in the playlist to remove
     */
    static reorder(index: number, ...trackIndices: number[]) {
        // Sort in descending order
        trackIndices.sort((a, b) => b - a);
        // Does the current track get moved?
        const movedIndex = trackIndices.length - 1 - trackIndices.findIndex(value => value === Playlist.currentItemIdx);

        const indexTransform = Playlist.list.map((_, index) => index);

        const removed = [];
        const removedIndices = [];
        let insertionIndex = index;
        for (const removalIndex of trackIndices) {
            if (removalIndex < insertionIndex) {
                insertionIndex--;
            }
            if (movedIndex === trackIndices.length && removalIndex < Playlist.currentItemIdx) {
                Playlist.currentItemIdx--;
            }
            removed.push(...Playlist.list.splice(removalIndex, 1));
            removedIndices.push(...indexTransform.splice(removalIndex, 1));
        }
        Playlist.list.splice(insertionIndex, 0, ...removed.reverse());
        indexTransform.splice(insertionIndex, 0, ...removedIndices.reverse());
        if (movedIndex === trackIndices.length && insertionIndex <= Playlist.currentItemIdx) {
            Playlist.currentItemIdx += trackIndices.length;
        } else if (movedIndex !== trackIndices.length) {
            Playlist.currentItemIdx = insertionIndex + movedIndex;
        }
        const mapping = new Array(indexTransform.length);
        for (let i = 0; i < indexTransform.length; i++) {
            mapping[indexTransform[i]] = i;
        }
        Playlist.events.reorder.emit({ from: trackIndices, to: index, current: Playlist.currentItemIdx, mapping });
    }

    /**
     * Change to a different track in the playlist
     * @param trackIndex The index in the playlist of the track to change to.
     */
    static changeTrack(trackIndex: number) {
        if (trackIndex >= 0 && trackIndex < Playlist.list.length) {
            Playlist.currentItemIdx = trackIndex;
            Playlist.events.trackChange.emit({ index: Playlist.currentItemIdx, item: Playlist.currentItem });
        }
    }

    /**
     * Set the current track to the end of the playlist.
     */
    static skipToEnd() {
        this.changeTrack(Playlist.list.length - 1);
    }

    static get currentItem(): PlaylistItem | null {
        if (Playlist.isEmpty()) {
            return null;
        }
        return Playlist.list[Playlist.currentItemIdx];
    }

    /**
     * @returns If the current track has one after it in the playlist.
     */
    static hasNext(): boolean {
        return !Playlist.isEmpty() && Playlist.currentItemIdx < Playlist.list.length - 1;
    }

    /**
     * @returns If the current track has one before it in the playlist.
     */
    static hasPrevious(): boolean {
        return !Playlist.isEmpty() && Playlist.currentItemIdx > 0;
    }

    /**
     * Advances the playlist to the next track in the list, if available.
     * @returns The new item, or `null` if none exists.
     */
    static next(): PlaylistItem | null {
        if (!Playlist.hasNext()) {
            return null;
        }
        Playlist.changeTrack(Playlist.currentItemIdx + 1);
        return Playlist.currentItem;
    }

    /**
     * Retreats the playlist to the previous track in the list, if available.
     * @returns The new item, or `null` if none exists.
     */
    static previous(): PlaylistItem | null {
        if (!Playlist.hasPrevious()) {
            return null;
        }
        Playlist.changeTrack(Playlist.currentItemIdx - 1);
        return Playlist.currentItem;
    }

    /**
     * Similar to {@link Playlist.next}, except looping is performed depending on current loop mode.
     * @returns The new item, or `null` if none exists.
     */
    static autoNext(): PlaylistItem | null {
        if (this.isEmpty()) {
            return null;
        }

        if (this.loopMode === LoopMode.Track) {
            // Change to same track, emit trackChange event
            this.changeTrack(this.currentItemIdx);
            return this.currentItem;
        }

        const nextIdx = this.currentItemIdx + 1;

        if (nextIdx < this.list.length) {
            this.changeTrack(nextIdx);
            return this.currentItem;
        }

        if (this.loopMode === LoopMode.Playlist) {
            this.changeTrack(0);
            return this.currentItem;
        }

        return null;
    }

    /**
     * @returns `true` if the playlist is empty, `false` otherwise
     */
    static isEmpty(): boolean {
        return Playlist.list.length == 0;
    }

    /**
     * @returns the number of tracks in the playlist.
     */
    static getNumTracks() {
        return Playlist.list.length;
    }

    /**
     * @param index The index of the playlist
     * @returns the item in the specified index in the playlist, or `null` if the index is out of bounds.
     */
    static getItemByIndex(index: number): PlaylistItem | null {
        if (index < 0 || index >= Playlist.list.length) return null;
        return Playlist.list[index];
    }

    /**
     * @returns the total duration of the playlist
     */
    static getDuration() {
        return Playlist.list.reduce((prev, current) => {
			const currentDuration = (current.type == PlaylistItemType.STREAM ? Infinity : Track.byID(current.trackId)!.duration);
			return prev + currentDuration;
		}, 0);
    }

    /**
     * @returns The total duration of the playlist, as a formatted time string by {@link convertTime}
     */
    static getDurationAsString() {
        return convertTime(Playlist.getDuration());
    }
}