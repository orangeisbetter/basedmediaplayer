import { convertTime } from "./time";
import { Track } from "./track";
import { Emitter } from "./emitter";

export type PlaylistAddEventData = number[];
export type PlaylistInsertEventData = {
    /** The tracks that were inserted. */
    tracks: number[];
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
export type PlaylistTrackChangeEventData = {
    /** The current track index. */
    index: number | null;
    /** The ID of the current track. */
    id: number | null;
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

/**
 * A static class for the playlist.
 * 
 * This class manages a list of tracks and an index into that list, with events that are emitted
 * when the list changes.
 * 
 * Looping is also managed in this class. Looping logic is implemented in {@link Playlist.autoNext}.
 */
export class Playlist {
    private static list: number[] = [];
    private static currentTrackIdx: number = 0;

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
    static add(...trackIds: number[]) {
        let madeValid = false;
        if (Playlist.isEmpty() && trackIds.length > 0) {
            madeValid = true;
            Playlist.currentTrackIdx = 0;
        }
        Playlist.list.push(...trackIds);
        Playlist.events.add.emit(trackIds);
        if (trackIds.length > 0) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
        if (madeValid) {
            Playlist.events.trackChange.emit({ index: Playlist.currentTrackIdx, id: Playlist.list[Playlist.currentTrackIdx] });
        }
    }

    /**
     * Inserts a list of track IDs into the playlist at a particular index. 
     * @param index The index to insert tracks at. The tracks will be inserted "in-between" the
     * track at this index, and the one before it.
     * @param trackIds The IDs of the tracks to insert.
     */
    static insert(index: number, ...trackIds: number[]) {
        let madeValid = false;
        if (Playlist.isEmpty() && trackIds.length > 0) {
            madeValid = true;
            Playlist.currentTrackIdx = 0;
        }
        if (index <= Playlist.currentTrackIdx) {
            Playlist.currentTrackIdx += trackIds.length;
        }
        Playlist.list.splice(index, 0, ...trackIds);
        Playlist.events.insert.emit({ tracks: trackIds, to: index });
        if (trackIds.length > 0) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
        if (madeValid) {
            Playlist.events.trackChange.emit({ index: Playlist.currentTrackIdx, id: Playlist.list[Playlist.currentTrackIdx] });
        }
    }

    /**
     * Similar to {@link Playlist.insert}, except insertion happens after the current
     * track.
     * @param trackIds The IDs of the tracks to insert.
     */
    static insertNext(...trackIds: number[]) {
        Playlist.insert(Playlist.currentTrackIdx + 1, ...trackIds);
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
            if (i < Playlist.currentTrackIdx) {
                Playlist.currentTrackIdx--;
            } else if (i == Playlist.currentTrackIdx) {
                trackChange = true;
                if (Playlist.currentTrackIdx >= Playlist.list.length) Playlist.currentTrackIdx = Playlist.list.length - 1;
                if (Playlist.currentTrackIdx < 0) Playlist.currentTrackIdx = 0;
            }
        }
        Playlist.events.remove.emit(trackIndices);
        if (trackIndices.length > 0) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
        if (trackChange) {
            if (Playlist.list.length == 0) {
                Playlist.events.trackChange.emit({ index: null, id: null });
            } else {
                Playlist.events.trackChange.emit({ index: Playlist.currentTrackIdx, id: Playlist.list[Playlist.currentTrackIdx] });
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
        Playlist.events.trackChange.emit({ index: null, id: null });
        if (changed) {
            Playlist.events.numTracksChange.emit({ number: Playlist.getNumTracks(), duration: Playlist.getDuration() });
        }
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
        const movedIndex = trackIndices.length - 1 - trackIndices.findIndex(value => value === Playlist.currentTrackIdx);

        const indexTransform = Playlist.list.map((_, index) => index);

        const removed = [];
        const removedIndices = [];
        let insertionIndex = index;
        for (const removalIndex of trackIndices) {
            if (removalIndex < insertionIndex) {
                insertionIndex--;
            }
            if (movedIndex === trackIndices.length && removalIndex < Playlist.currentTrackIdx) {
                Playlist.currentTrackIdx--;
            }
            removed.push(...Playlist.list.splice(removalIndex, 1));
            removedIndices.push(...indexTransform.splice(removalIndex, 1));
        }
        Playlist.list.splice(insertionIndex, 0, ...removed.reverse());
        indexTransform.splice(insertionIndex, 0, ...removedIndices.reverse());
        if (movedIndex === trackIndices.length && insertionIndex <= Playlist.currentTrackIdx) {
            Playlist.currentTrackIdx += trackIndices.length;
        } else if (movedIndex !== trackIndices.length) {
            Playlist.currentTrackIdx = insertionIndex + movedIndex;
        }
        const mapping = new Array(indexTransform.length);
        for (let i = 0; i < indexTransform.length; i++) {
            mapping[indexTransform[i]] = i;
        }
        Playlist.events.reorder.emit({ from: trackIndices, to: index, current: Playlist.currentTrackIdx, mapping });
    }

    /**
     * Change to a different track in the playlist
     * @param trackIndex The index in the playlist of the track to change to.
     */
    static changeTrack(trackIndex: number) {
        if (trackIndex >= 0 && trackIndex < Playlist.list.length && Playlist.currentTrackIdx !== trackIndex) {
            Playlist.currentTrackIdx = trackIndex;
            Playlist.events.trackChange.emit({ index: Playlist.currentTrackIdx, id: Playlist.currentTrackId });
        }
    }

    /**
     * Set the current track to the end of the playlist.
     */
    static skipToEnd() {
        this.changeTrack(Playlist.list.length - 1);
    }

    static get currentTrackId(): number | null {
        if (Playlist.isEmpty()) {
            return null;
        }
        return Playlist.list[Playlist.currentTrackIdx];
    }

    /**
     * @returns If the current track has one after it in the playlist.
     */
    static hasNext(): boolean {
        return !Playlist.isEmpty() && Playlist.currentTrackIdx < Playlist.list.length - 1;
    }

    /**
     * @returns If the current track has one before it in the playlist.
     */
    static hasPrevious(): boolean {
        return !Playlist.isEmpty() && Playlist.currentTrackIdx > 0;
    }

    /**
     * Advances the playlist to the next track in the list, if available.
     * @returns The new track ID, or `null` if none exists.
     */
    static next(): number | null {
        if (!Playlist.hasNext()) {
            return null;
        }
        Playlist.changeTrack(Playlist.currentTrackIdx + 1);
        return Playlist.currentTrackId;
    }

    /**
     * Retreats the playlist to the previous track in the list, if available.
     * @returns The new track ID, or `null` if none exists.
     */
    static previous(): number | null {
        if (!Playlist.hasPrevious()) {
            return null;
        }
        Playlist.changeTrack(Playlist.currentTrackIdx - 1);
        return Playlist.currentTrackId;
    }

    /**
     * Similar to {@link Playlist.next}, except looping is performed depending on current loop mode.
     * @returns The new track ID, or `null` if none exists.
     */
    static autoNext(): number | null {
        if (this.isEmpty()) {
            return null;
        }

        if (this.loopMode === LoopMode.Track) {
            // Change to same track, emit trackChange event
            this.changeTrack(this.currentTrackIdx);
            return this.currentTrackId;
        }

        const nextIdx = this.currentTrackIdx + 1;

        if (nextIdx < this.list.length) {
            this.changeTrack(nextIdx);
            return this.currentTrackId;
        }

        if (this.loopMode === LoopMode.Playlist) {
            this.changeTrack(0);
            return this.currentTrackId;
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
     * @returns the total duration of the playlist
     */
    static getDuration() {
        return Playlist.list.reduce((prev, current) => prev + Track.byID(current).duration, 0);
    }

    /**
     * @returns The total duration of the playlist, as a formatted time string by {@link convertTime}
     */
    static getDurationAsString() {
        return convertTime(Playlist.getDuration());
    }
}