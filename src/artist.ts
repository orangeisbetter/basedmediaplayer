import { IDBPDatabase } from "idb";

export interface ArtistStore {
    id: number;
    name: string;
}

export class Artist implements ArtistStore {
    id: number;
    name: string;
    trackIds: number[];
    albumIds: number[];

    static highestID: number = 0;
    static artists: Map<number, Artist> = new Map();
    static nameMap: Map<string, number> = new Map();

    constructor(name: string, id?: number) {
        this.id = id === undefined ? Artist.highestID++ : id;
        this.name = name;
        this.trackIds = [];
        this.albumIds = [];
        Artist.artists.set(this.id, this);
        Artist.nameMap.set(this.name.toLowerCase(), this.id);
    }

    static createFromStore({ id, name }: ArtistStore): Artist {
        return new Artist(name, id);
    }

    static getOrCreate(name: string): number {
        name = name.trim();
        const id = this.idByName(name.toLowerCase());
        if (id !== undefined) return id;
        return new Artist(name).id;
    }

    static async saveAll(db: IDBPDatabase) {
        const transaction = db.transaction("artists", "readwrite");
        const objectStore = transaction.objectStore("artists");
        for (const artist of Artist.artists.values()) {
            await objectStore.put(artist.getStore());
        }
        transaction.commit();
    }

    static async loadAll(db: IDBPDatabase) {
        const artists: ArtistStore[] = await db.getAll("artists");
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
}