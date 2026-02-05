import { IDBPDatabase } from "idb";
import { IPicture } from "music-metadata"

declare const template_album: HTMLTemplateElement;

export interface AlbumStore {
    id: number;
    name?: string;
    artist?: string;
    coverData?: IPicture;
    trackIds: number[];
}

export class Album implements AlbumStore {
    id: number;
    name?: string;
    artist?: string;
    coverData?: IPicture;
    trackIds: number[];

    private cover?: string;

    static highestID: number = 0;
    static albums: Map<number, Album> = new Map();

    constructor(id?: number) {
        this.id = id === undefined ? Album.highestID++ : id;
        Album.albums.set(this.id, this);
        this.trackIds = [];
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
            coverData: this.coverData,
            trackIds: this.trackIds
        };
    }

    getCoverURL() {
        if (!this.coverData) {
            return "missing.png";
        } else if (!this.cover) {
            this.cover = URL.createObjectURL(new Blob([this.coverData.data as BlobPart], { type: this.coverData.format }));
        }
        return this.cover;
    }
}