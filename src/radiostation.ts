import { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from "idb";

export interface RadioStationStore {
	id: number;
	title: string;
	url: string;
}

export class RadioStation implements RadioStationStore {
	public static readonly STORE_NAME = "radio_stations" as const;

	id: number;
	title: string;
	url: string;

	static highestID: number = 0;
	static stations = new Map<number, RadioStation>();
	
	constructor(store: RadioStationStore) {
		this.id = store.id;
		this.title = store.title;
		this.url = store.url;

		RadioStation.stations.set(this.id, this);
	}

	static createFromStore({ id, ...store }: RadioStationStore): RadioStation {
		const station = new RadioStation({
			id: id ?? (RadioStation.highestID++),
			...store
		});
		if (id >= RadioStation.highestID) {
			RadioStation.highestID = id + 1;
		}
		return station;
	}

	static create(title: string, url: string) {
		const station = new RadioStation({
			id: RadioStation.highestID++,
			title: title,
			url: url
		});
		return station;
	}

	static async saveAll(db: IDBPDatabase) {
		const transaction = db.transaction(RadioStation.STORE_NAME, "readwrite");
		const objectStore = transaction.objectStore(RadioStation.STORE_NAME);
		for (const station of RadioStation.stations.values()) {
			objectStore.put(station.getStore());
		}
		transaction.commit();
		await transaction.done;
	}

	static async loadAll(db: IDBPDatabase) {
		const stations: RadioStation[] = await db.getAll(RadioStation.STORE_NAME);
		for (const station of stations) {
			RadioStation.createFromStore(station);
		}
	}

	static byID(id: number): RadioStation {
		const station = RadioStation.stations.get(id);
		if (station === undefined) {
			throw new Error(`Station by ID ${id} not found`);
		}
		return station;
	}

	getStore(): RadioStationStore {
		return {
			id: this.id,
			title: this.title,
			url: this.url
		};
	}

	save(objectStore: IDBPObjectStore<unknown, string[], typeof RadioStation.STORE_NAME, "readwrite">) {
		objectStore.put(this.getStore());
	}

	delete(tx: IDBPTransaction<unknown, string[], "readwrite">) {
		RadioStation.stations.delete(this.id);

		tx.objectStore(RadioStation.STORE_NAME).delete(this.id);
	}
}