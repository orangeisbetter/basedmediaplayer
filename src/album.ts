import { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from "idb";
import { Artist } from "./artist.ts";
import { Track} from "./track.ts";
import { arraysEqual } from "./util/arrays.ts";

export interface AlbumCover {
    data: Uint8Array;
    sourceFileIds: number[];
}

export interface AlbumStore {
    id: number;
    name?: string;
    artist?: number;
    covers: AlbumCover[];
    trackIds: number[];
}

export class Album implements AlbumStore {
    public static readonly STORE_NAME = "albums" as const;
    
    id: number;
    name?: string;
    artist?: number;
    covers: AlbumCover[];
    trackIds: number[];

    private coverUrls: string[];

    static highestID: number = 0;
    static albums = new Map<number, Album>();

    constructor(id?: number) {
        this.id = id === undefined ? Album.highestID++ : id;
        Album.albums.set(this.id, this);
        this.covers = [];
        this.trackIds = [];
        this.coverUrls = [];
    }

    static createFromStore({ id, ...store }: AlbumStore): Album {
        const album = new Album(id);
        Object.assign(album, store);
        return album;
    }

    static async saveAll(db: IDBPDatabase) {
        const transaction = db.transaction(Album.STORE_NAME, "readwrite");
        const objectStore = transaction.objectStore(Album.STORE_NAME);
        for (const album of Album.albums.values()) {
            objectStore.put(album.getStore());
        }
        transaction.commit();
        await transaction.done;
    }

    static async loadAll(db: IDBPDatabase) {
        const albums: AlbumStore[] = await db.getAll(Album.STORE_NAME);
        for (const album of albums) {
            Album.createFromStore(album);
            if (album.id >= Album.highestID) {
                Album.highestID = album.id + 1;
            }
        }
    }

    static linkToArtists() {
        for (const [id, album] of Album.albums) {
            const artistId = album.artist;
            if (!artistId) continue;
            const artist = Artist.byID(artistId)!;
            artist.albumIds.add(id);
        }
    }

    static getAllIds(): number[] {
        return Array.from(Album.albums.keys());
    }

    static byID(id: number): Album | undefined {
        return Album.albums.get(id);
    }

    getStore(): AlbumStore {
        return {
            id: this.id,
            name: this.name,
            artist: this.artist,
            covers: this.covers,
            trackIds: this.trackIds
        };
    }

    save(objectStore: IDBPObjectStore<unknown, string[], typeof Album.STORE_NAME, "readwrite">) {
        objectStore.put(this.getStore());
    }

    delete(tx: IDBPTransaction<unknown, string[], "readwrite">) {
        if (this.artist !== undefined) {
            const artist = Artist.byID(this.artist)!;
            artist.removeAlbum(this.id, tx);
        }

        Album.albums.delete(this.id);
        tx.objectStore(Album.STORE_NAME).delete(this.id);
    }

	hasCoverIndex(index?: number): boolean {
		if (index && index >= 0 && index < this.covers.length) {
			return true;
		} else {
			return false;
		}
	}

    getCoverURL(index?: number) {
        if (index === undefined) {
            index = 0;
        }
        if (this.covers.length == 0) {
            return "missing.png";
        } else if (!this.coverUrls[index]) {
            this.coverUrls[index] = URL.createObjectURL(new Blob([this.covers[index].data as BlobPart]));
        }
        return this.coverUrls[index];
    }

    getArtistName(): string | undefined {
        if (this.artist === undefined) return undefined;
        const artist = Artist.byID(this.artist);
        return artist?.name;
    }

    sortTracks() {
        this.trackIds.sort((a, b) => {
            const trackA = Track.byID(a)!;
            const trackB = Track.byID(b)!;

            if (trackA.disc !== trackB.disc) {
                return (trackA.disc ?? 0) - (trackB.disc ?? 0);
            }

            if (trackA.no !== trackB.no) {
                return (trackA.no ?? 0) - (trackB.no ?? 0);
            }

            return (trackA.title ?? "").localeCompare(trackB.title ?? "");
        });
    }

    hasCover(fileId: number) {
        for (const cover of this.covers) {
            if (cover.sourceFileIds.includes(fileId)) {
                return true;
            }
        }
        return false;
    }

    addCover(fileId: number, data: Uint8Array): number | null {
        for (let i = 0; i < this.covers.length; i++) {
            if (!arraysEqual(data, this.covers[i].data)) {
                continue;
            }
            if (!this.covers[i].sourceFileIds.includes(fileId)) {
                this.covers[i].sourceFileIds.push(fileId);
            }
            return i;
        }
        this.covers.push({ data, sourceFileIds: [fileId] });
        // this.covers.sort((a, b) => b.data.length - a.data.length);
        return this.covers.length - 1;
    }

    removeCover(fileId: number) {
        for (let i = 0; i < this.covers.length; i++) {
            const cover = this.covers[i];
            if (!cover.sourceFileIds.includes(fileId)) {
                continue;
            }
            cover.sourceFileIds = cover.sourceFileIds.filter(sourceFileId => sourceFileId !== fileId);
            if (cover.sourceFileIds.length === 0) {
                // remove cover and update all album track ids to match correctly
                this.covers.splice(i, 1);
				// update urls too so that they all update
				this.coverUrls.splice(i, 1);

                for (const trackId of this.trackIds) {
                    const track = Track.byID(trackId)!;
					for (let i = 0; i < track.coverIndices.length; i++) {
						if (track.coverIndices[i] && track.coverIndices[i] > i) {
							track.coverIndices[i]--;
						}
					}
                }
            }
            return;
        }
    }

    removeTrack(trackId: number, tx: IDBPTransaction<unknown, ArrayLike<string>, "readwrite">) {
        this.trackIds = this.trackIds.filter(existing => existing != trackId);
        if (this.trackIds.length == 0) {
            this.delete(tx);
        }
    }
}