import { IDBPDatabase } from "idb";
import { Artist } from "./artist.ts";

export interface AlbumStore {
    id: number;
    name?: string;
    artist?: number;
    covers: Uint8Array[];
    // coverData?: IPicture;
    trackIds: number[];
}

export class Album implements AlbumStore {
    id: number;
    name?: string;
    artist?: number;
    covers: Uint8Array[];
    trackIds: number[];

    private coverUrls: string[];

    static highestID: number = 0;
    static albums: Map<number, Album> = new Map();

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
        const transaction = db.transaction("albums", "readwrite");
        const objectStore = transaction.objectStore("albums");
        for (const album of Album.albums.values()) {
            await objectStore.put(album.getStore());
        }
        transaction.commit();
    }

    static async loadAll(db: IDBPDatabase) {
        const albums: AlbumStore[] = await db.getAll("albums");
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
            artist.albumIds.push(id);
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

    getCoverURL(index?: number) {
        if (index === undefined) {
            index = 0;
        }
        if (this.covers.length == 0) {
            return "missing.png";
        } else if (!this.coverUrls[index]) {
            this.coverUrls[index] = URL.createObjectURL(new Blob([this.covers[index] as BlobPart]));
        }
        return this.coverUrls[index];
    }

    getArtistName(): string | undefined {
        if (this.artist === undefined) return undefined;
        const artist = Artist.byID(this.artist);
        return artist?.name;
    }
}