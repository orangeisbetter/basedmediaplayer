import { IDBPDatabase, IDBPTransaction, IDBPObjectStore } from "idb";
import { ICommonTagsResult, IFormat, parseBlob } from "music-metadata";
import { Artist } from "./artist.ts";
import { Album } from "./album.ts";
import { Collection } from "./collection.ts";

export interface ProtoTrack {
    path: string;
    fileId: number;
    tag: ICommonTagsResult;
    format: IFormat;
};

export interface TrackStore {
    id: number;
    albumId: number;
    path: string;
    fileId: number;

    // metadata
    duration: number;
    disc: number | null;
    no: number | null;
    title: string;
    artists: number[];
    featArtists?: string;
    lyrics?: (string | undefined)[];
    date?: string;
	year?: number;
    genre?: string[];
    composer?: string[];
    coverIndices: number[];

    userChanged: boolean;
}

export class Track implements TrackStore {
    public static readonly STORE_NAME = "tracks" as const;
    
    id: number;
    albumId: number;
    path: string;
    fileId: number;

    // metadata
    duration: number;
    disc: number | null;
    no: number | null;
    title: string;
    artists: number[];
    featArtists?: string;
    lyrics?: (string | undefined)[];
    date?: string;
	year?: number;
    genre?: string[];
    composer?: string[];
    coverIndices: number[];

    userChanged: boolean;

    static highestID: number = 0;
    static tracks = new Map<number, Track>();
    static fileIdToTrackId = new Map<number, number>();

    constructor(store: TrackStore) {
        this.id = store.id;
        this.path = store.path;
        this.albumId = store.albumId;
        this.fileId = store.fileId;

        this.duration = store.duration;
        this.disc = store.disc;
        this.no = store.no;
        this.title = store.title;
        this.artists = store.artists;
        this.featArtists = store.featArtists;
        this.lyrics = store.lyrics;
        this.date = store.date;
		this.year = store.year;
        this.genre = store.genre;
        this.composer = store.composer;
        this.coverIndices = store.coverIndices;

        this.userChanged = store.userChanged;

        Track.tracks.set(this.id, this);
        Track.fileIdToTrackId.set(this.fileId, this.id);
    }

    static createFromStore({ id, ...store }: TrackStore): Track {
        const track = new Track({
            id: id ?? (Track.highestID++),
            ...store,
        })
        return track;
    }

    static createFromProtoTrack(proto: ProtoTrack, albumId: number, changedArtists: Set<number>): Track {
        // Handle featuring artists
        const artists: number[] = [];
        let featArtists: string | undefined = undefined;
        if (proto.tag.artists) {
            for (const artistString of proto.tag.artists) {
                const [base, feat] = artistString.split(" ft. ", 2);
                if (feat) {
                    featArtists = feat;
                }
                artists.push(Artist.getOrCreate(base, changedArtists));
            }
        }

        const track = new Track({
            id: Track.highestID++,
            path: proto.path,
            albumId: albumId,
            fileId: proto.fileId,

            duration: proto.format.duration!,
            disc: proto.tag.disk.no,
            no: proto.tag.track.no,
            title: proto.tag.title!,
            artists: artists,
            featArtists: featArtists,
            lyrics: proto.tag.lyrics?.map(lyrics => lyrics.text),
            date: proto.tag.date,
			year: proto.tag.year,
            genre: proto.tag.genre,
            composer: proto.tag.composer,
            coverIndices: [],

            userChanged: false,
        });
        return track;
    }

    static async saveAll(db: IDBPDatabase) {
        const transaction = db.transaction(Track.STORE_NAME, "readwrite");
        const objectStore = transaction.objectStore(Track.STORE_NAME);
        for (const track of Track.tracks.values()) {
            objectStore.put(track.getStore());
        }
        transaction.commit();
        await transaction.done;
    }

    static async loadAll(db: IDBPDatabase) {
        const tracks: TrackStore[] = await db.getAll(Track.STORE_NAME);
        for (const track of tracks) {
            Track.createFromStore(track);
            if (track.id >= Track.highestID) {
                Track.highestID = track.id + 1;
            }
        }
    }

    static linkToArtists() {
        for (const [id, track] of Track.tracks) {
            const artistIds = track.artists;
            for (const artistId of artistIds) {
                const artist = Artist.byID(artistId)!;
                artist.trackIds.add(id);
            }
        }
    }

    static byID(id: number): Track | undefined {
        return Track.tracks.get(id);
    }

    static getAllIds(): Iterable<number> {
        return Track.tracks.keys();
    }

    private static removeFilenameExtension(filename: string) {
        const lastDotIndex = filename.lastIndexOf(".");
        if (lastDotIndex === -1 || lastDotIndex === 0) return filename;
        return filename.substring(0, lastDotIndex);
    }

    static async getTrackMetadata(file: File, fileId: number, path: string): Promise<ProtoTrack | null> {
        try {
            const { common, format } = await parseBlob(file);

            const parts = path.split("/", 3);

            if (!common.title) {
                common.title = this.removeFilenameExtension(parts[parts.length - 1]);
            }

            if (parts.length == 3) {
                const [artist, album] = parts;

                if (!common.albumartist) {
                    common.albumartist = artist;
                }
                if (!common.album) {
                    common.album = album;
                }
            }

            return { fileId, tag: common, format, path };
        } catch {
            return null;
        }
    }

    getStore(): TrackStore {
        return {
            id: this.id,
            path: this.path,
            albumId: this.albumId,
            fileId: this.fileId,

            duration: this.duration,
            disc: this.disc,
            no: this.no,
            title: this.title,
            artists: this.artists,
            featArtists: this.featArtists,
            lyrics: this.lyrics,
            date: this.date,
			year: this.year,
            genre: this.genre,
            composer: this.composer,
            coverIndices: this.coverIndices,

            userChanged: this.userChanged
        };
    }

    save(objectStore: IDBPObjectStore<unknown, string[], typeof Track.STORE_NAME, "readwrite">) {
        objectStore.put(this.getStore());
    }

    delete(tx: IDBPTransaction<unknown, string[], "readwrite">) {
		// Remove track from album
        const album = Album.byID(this.albumId)!;
        album.removeTrack(this.id, tx);

		// Remove track from artists
        for (const artistId of this.artists) {
            const artist = Artist.byID(artistId)!;
            artist.removeTrack(this.id, tx);
        }

        // Remove track from collections
		const residingCollections = Collection.getResidingCollections([this.id]);
		for (const collection of residingCollections) {
			collection.remove([this.id]);
		}

		// Remove track from registry and caches
        Track.tracks.delete(this.id);
        Track.fileIdToTrackId.delete(this.fileId);

		// Delete the track from db
        tx.objectStore(Track.STORE_NAME).delete(this.id);
    }

    // async updateMetadata(objectStore: IDBPObjectStore<unknown, [Track.STORE_NAME], Track.STORE_NAME, "readwrite">): Promise<boolean> {
    //     // If the user made changes to the metadata explicitly, ignore new file changes. The user is always right.
    //     if (this.userChanged) return false;

    //     const metadata = await Track.getTrackMetadata(this.handle, this.path);
    //     if (metadata === null) {
    //         throw new Error("Metadata used to exist but does not anymore! This is a bug.");
    //     }

    //     const album = Album.byID(this.albumId)!;
    //     if (album.name !== metadata.tag.album || album.artist !== metadata.tag.albumartist) {
    //         throw new Error("Album info for track changed but this action is not supported yet. Please delete your site data and reload the page to reset your library.");
    //     }

    //     let modified = false;

    //     if (this.duration !== metadata.format.duration) this.duration = metadata.format.duration!, modified = true;
    //     if (this.disc !== metadata.tag.disk.no) this.disc = metadata.tag.disk.no, modified = true;
    //     if (this.no !== metadata.tag.track.no) this.no = metadata.tag.track.no, modified = true;
    //     if (this.title !== metadata.tag.title!) this.title = metadata.tag.title!, modified = true;
    //     if (!Track.arraysEqual(this.artists, metadata.tag.artists?.map(artist => Artist.getOrCreate(artist)) ?? [])) this.artists = metadata.tag.artists?.map(artist => Artist.getOrCreate(artist)) ?? [], modified = true;

    //     const newLyrics = metadata.tag.lyrics?.map(lyrics => lyrics.text);
    //     if (!Track.arraysEqual(this.lyrics, newLyrics)) this.lyrics = newLyrics, modified = true;

    //     if (this.date !== metadata.tag.date) this.date = metadata.tag.date, modified = true;
    //     if (this.genre !== metadata.tag.genre) this.genre = metadata.tag.genre, modified = true;
    //     if (this.composer !== metadata.tag.composer) this.composer = metadata.tag.composer, modified = true;

    //     if (modified) {
    //         objectStore.put(this);
    //         return true;
    //     }

    //     return false;
    // }
}