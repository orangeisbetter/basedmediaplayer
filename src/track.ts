import { IDBPDatabase } from "idb";
import { ICommonTagsResult, IFormat, parseBlob } from "music-metadata";

export interface ProtoTrack {
    handle: FileSystemFileHandle;
    tag: ICommonTagsResult;
    format: IFormat;
};

export interface TrackStore {
    id: number;
    albumId: number;
    handle: FileSystemFileHandle;
    duration: number;
    disc: number | null;
    no: number | null;
    title: string;
    artist?: string;
    lyrics?: (string | undefined)[];
    date?: string;
    genre?: string[];
    composer?: string[];
}

export class Track implements TrackStore {
    id: number;
    albumId: number;
    handle: FileSystemFileHandle;
    duration: number;
    disc: number | null;
    no: number | null;
    title: string;
    artist?: string;
    lyrics?: (string | undefined)[];
    date?: string;
    genre?: string[];
    composer?: string[];

    static highestID: number = 0;
    static tracks: Map<number, Track> = new Map();

    constructor(store: TrackStore) {
        this.id = store.id;
        this.albumId = store.albumId;
        this.handle = store.handle;
        this.duration = store.duration;
        this.disc = store.disc;
        this.no = store.no;
        this.title = store.title;
        this.artist = store.artist;
        this.lyrics = store.lyrics;
        this.date = store.date;
        this.genre = store.genre;
        this.composer = store.composer;

        Track.tracks.set(this.id, this);
    }

    static createFromStore({ id, ...store }: TrackStore): Track {
        const track = new Track({
            id: id ?? (Track.highestID++),
            ...store,
        })
        return track;
    }

    static createFromProtoTrack(proto: ProtoTrack, albumId: number): Track {
        const track = new Track({
            id: Track.highestID++,
            albumId: albumId,
            handle: proto.handle,
            duration: proto.format.duration!,
            disc: proto.tag.disk.no,
            no: proto.tag.track.no,
            title: proto.tag.title ?? proto.handle.name,
            artist: proto.tag.artist,
            lyrics: proto.tag.lyrics?.map(lyrics => lyrics.text),
            date: proto.tag.date,
            genre: proto.tag.genre,
            composer: proto.tag.composer,
        });
        return track;
    }

    static async saveAll(db: IDBPDatabase) {
        const transaction = db.transaction("tracks", "readwrite");
        const objectStore = transaction.objectStore("tracks");
        for (const track of Track.tracks.values()) {
            await objectStore.put(track.getStore());
        }
        transaction.commit();
    }

    static async loadAll(db: IDBPDatabase) {
        const tracks: TrackStore[] = await db.getAll("tracks");
        for (const track of tracks) {
            Track.createFromStore(track);
            if (track.id >= Track.highestID) {
                Track.highestID = track.id + 1;
            }
        }
    }

    static byID(id: number): Track | undefined {
        return Track.tracks.get(id);
    }

    static getAllIds(): Iterable<number> {
        return Track.tracks.keys();
    }

    getStore(): TrackStore {
        return {
            id: this.id,
            albumId: this.albumId,
            handle: this.handle,
            duration: this.duration,
            disc: this.disc,
            no: this.no,
            title: this.title,
            artist: this.artist,
            lyrics: this.lyrics,
            date: this.date,
            genre: this.genre,
            composer: this.composer,
        };
    }

    static async loadFile(handle: FileSystemFileHandle, path: string): Promise<ProtoTrack | null> {
        try {
            const file = await handle.getFile();

            if (!file.type.startsWith("audio")) {
                return null;
            }

            const { common, format } = await parseBlob(file);
            if (!common.title) {
                common.title = handle.name;
            }

            const parts = path.split("/", 3);
            if (parts.length == 3) {
                const [artist, album] = parts;

                if (!common.albumartist) {
                    common.albumartist = artist;
                }
                if (!common.album) {
                    common.album = album;
                }
            }

            return { handle, tag: common, format };
        } catch {
            return null;
        }
    }
}