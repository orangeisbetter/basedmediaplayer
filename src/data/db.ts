import { IDBPDatabase, IDBPTransaction, openDB } from "idb";
import { Album } from "../album.ts";
import { Track } from "../track.ts";
import { CollectionRepository } from "./collectionstore.ts";
import { Artist } from "../artist.ts";
import { RadioStation } from "../radiostation.ts";

export let db: IDBPDatabase;

let rescanRequired = false;

function upgradeDb(
	db: IDBPDatabase<unknown>,
	oldVersion: number,
	_newVersion: number | null,
	transaction: IDBPTransaction<unknown, string[], "versionchange">
) {
	if (oldVersion < 1) {
		db.createObjectStore(Album.STORE_NAME, { keyPath: "id" });
		db.createObjectStore(Track.STORE_NAME, { keyPath: "id" });

		const configStore = db.createObjectStore("config");
		configStore.put(0, "volume");

		// Library rescan necessary
		rescanRequired = true;
	} else if (oldVersion == 1) {
		db.deleteObjectStore("library");
	}

	if (oldVersion < 2) {
		db.createObjectStore(CollectionRepository.STORE_NAME, { keyPath: "id" });
	}

	if (oldVersion < 3) {
		const configStore = transaction.objectStore("config");
		configStore.put("albums", "browser_mode");
		configStore.put("album_artist", "browser_album_sort_mode");
		configStore.put("", "browser_track_sort_mode");
	}

	if (oldVersion < 4) {
		db.createObjectStore(Artist.STORE_NAME, { keyPath: "id" });

		// Library rescan necessary
		rescanRequired = true;
	}

	if (oldVersion < 5) {
		db.createObjectStore("files", { keyPath: "id", autoIncrement: true });

		// reset modified object stores
		db.deleteObjectStore(Track.STORE_NAME);
		db.deleteObjectStore(Album.STORE_NAME);
		db.deleteObjectStore(Artist.STORE_NAME);
		db.deleteObjectStore(CollectionRepository.STORE_NAME);

		db.createObjectStore(Track.STORE_NAME, { keyPath: "id" });
		db.createObjectStore(Album.STORE_NAME, { keyPath: "id" });
		db.createObjectStore(Artist.STORE_NAME, { keyPath: "id" });
		db.createObjectStore(CollectionRepository.STORE_NAME, { keyPath: "id" });
	}

	if (oldVersion < 6) {
		const stationsStore = db.createObjectStore(RadioStation.STORE_NAME, { keyPath: "id" });

		stationsStore.put(RadioStation.create("92.9 KAT FM", "https://us9.maindigitalstream.com/ssl/katf"));
		stationsStore.put(RadioStation.create("93.3 KIOA", "https://live.amperwave.net/manifest/saga-kioafmaac-hlsc1.m3u8"));
		stationsStore.put(RadioStation.create("IPR Classical", "https://classical-stream.iowapublicradio.org/Classical.mp3"));
		stationsStore.put(RadioStation.create("IPR News", "https://news-stream.iowapublicradio.org/News.mp3"));
		stationsStore.put(RadioStation.create("IPR Studio One", "https://studioone-stream.iowapublicradio.org/StudioOne.mp3"));
		stationsStore.put(RadioStation.create("Jazz24", "https://knkx-live-a.edge.audiocdn.com/6285_128k"));
		stationsStore.put(RadioStation.create("TruckersFM", "https://radio.truckers.fm"));
	}
}

// Open and initialize/upgrade the database
export function initDB(): Promise<{ db: IDBPDatabase, rescan: boolean }> {
	return openDB("music-library", 6, { upgrade: upgradeDb })
		.then(localDb => {
			db = localDb;
			return { db: db, rescan: rescanRequired };
		});
}