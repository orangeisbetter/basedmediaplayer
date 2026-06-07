import { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from "idb";

export interface ArtistStore {
    id: number;
    name: string;
}

export class Artist implements ArtistStore {
    public static readonly STORE_NAME = "artists" as const;

    id: number;
    name: string;
    trackIds: Set<number>;
    albumIds: Set<number>;

    static highestID: number = 0;
    static artists: Map<number, Artist> = new Map();
    static nameMap: Map<string, number> = new Map();

    constructor(name: string, id?: number) {
        this.id = id === undefined ? Artist.highestID++ : id;
        this.name = name;
        this.trackIds = new Set();
        this.albumIds = new Set();
        Artist.artists.set(this.id, this);
        Artist.nameMap.set(this.name.toLowerCase(), this.id);
    }

    static createFromStore({ id, name }: ArtistStore): Artist {
        return new Artist(name, id);
    }

    static getOrCreate(name: string, changedArtists: Set<number> | undefined): number {
        name = name.trim();
        const id = this.idByName(name.toLowerCase());
        if (id !== undefined) return id;
        const newId = new Artist(name).id;
        changedArtists?.add(newId);
        return newId;
    }

    static async saveAll(db: IDBPDatabase) {
        const transaction = db.transaction(Artist.STORE_NAME, "readwrite");
        const objectStore = transaction.objectStore(Artist.STORE_NAME);
        for (const artist of Artist.artists.values()) {
            await objectStore.put(artist.getStore());
        }
        transaction.commit();
        await transaction.done;
    }

    static async loadAll(db: IDBPDatabase) {
        const artists: ArtistStore[] = await db.getAll(Artist.STORE_NAME);
        for (const artist of artists) {
            Artist.createFromStore(artist);
            if (artist.id >= Artist.highestID) {
                Artist.highestID = artist.id + 1;
            }
        }
    }

    static getAllIds(): number[] {
        return Array.from(Artist.artists.keys());
    }

    static byID(id: number): Artist | undefined {
        return Artist.artists.get(id);
    }

    static idByName(name: string): number | undefined {
        return Artist.nameMap.get(name);
    }

    static joinEnglish(items: string[]): string {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0];
        if (items.length === 2) return `${items[0]} & ${items[1]}`;

        const allButLast = items.slice(0, -1).join(', ');
        const last = items[items.length - 1];
        return `${allButLast} & ${last}`;
    }

    static getArtistString(artists: number[]): string {
        return this.joinEnglish(artists.map(id => Artist.byID(id)!.name));
    }

    getStore(): ArtistStore {
        return {
            id: this.id,
            name: this.name,
        };
    }

    save(objectStore: IDBPObjectStore<unknown, string[], typeof Artist.STORE_NAME, "readwrite">) {
        objectStore.put(this.getStore());
    }

    delete(tx: IDBPTransaction<unknown, string[], "readwrite">) {
		Artist.artists.delete(this.id);
		Artist.nameMap.delete(this.name.toLowerCase());
        tx.objectStore(Artist.STORE_NAME).delete(this.id);
    }

    removeTrack(trackId: number, tx: IDBPTransaction<unknown, string[], "readwrite">) {
        this.trackIds.delete(trackId);
        if (this.trackIds.size === 0 && this.albumIds.size === 0) {
            this.delete(tx);
        }
    }
    
    removeAlbum(albumId: number, tx: IDBPTransaction<unknown, string[], "readwrite">) {
        this.albumIds.delete(albumId);
        if (this.trackIds.size === 0 && this.albumIds.size === 0) {
            this.delete(tx);
        }
    }
}