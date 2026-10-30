import { IDBPDatabase, openDB } from "idb";

import { Collection } from "./collection.ts";
import { LibraryTreeView } from "./ui/librarytreeview.ts";
import { MusicBrowserView } from "./ui/musicbrowserview.ts";
import { AlbumDisplay } from "./ui/albumdisplay.ts";
import { PlaylistView } from "./ui/playlistview.ts"
import { Player } from "./player.ts";
import { PlayerView } from "./ui/playerview.ts";
import { PlaybackController } from "./playbackcontroller.ts";
import { MenuSystem } from "./ui/menu.ts";
import { SelectableList } from "./ui/selectablelist.ts";
import { MenuBar } from "./ui/menubar.ts";
import { Library } from "./library.ts";
import { getVersion } from "./ui/releasenotes.ts";
import { BreadcrumbsView } from "./ui/breadcrumbsview.ts";
import { MusicBrowser } from "./musicbrowser.ts";
import { ResizablePanels } from "./ui/resizablepanel.ts";
import { ArtistDisplay } from "./ui/artistdisplay.ts";
import { CassetteRecorderView } from "./ui/cassetterecorderview.ts";
import { Album } from "./album.ts";
import { Track } from "./track.ts";
import { Artist } from "./artist.ts";
import { StylesEditor } from "./ui/styleseditor.ts";
import { Keyboard } from "./keyboard.ts";
import { RadioStationsEditor } from "./ui/radiostationsview.ts";
import { RadioStation } from "./radiostation.ts";

declare const track_list: HTMLDivElement;

// Service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register("./serviceworker.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
    })
}

async function initDB(): Promise<{ db: IDBPDatabase, rescan: boolean }> {
    let rescan = false;
    const db = await openDB("music-library", 6, {
        upgrade(db, oldVersion, _newVersion, transaction) {
            if (oldVersion < 1) {
                db.createObjectStore(Album.STORE_NAME, { keyPath: "id" });
                db.createObjectStore(Track.STORE_NAME, { keyPath: "id" });

                const configStore = db.createObjectStore("config");
                configStore.put(0, "volume");

				// Library rescan necessary
				rescan = true;
            } else if (oldVersion == 1) {
                db.deleteObjectStore("library");
            }

            if (oldVersion < 2) {
                db.createObjectStore(Collection.STORE_NAME, { keyPath: "id" });
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
                rescan = true;
            }

            if (oldVersion < 5) {
                db.createObjectStore("files", { keyPath: "id", autoIncrement: true });

				// reset modified object stores
				db.deleteObjectStore(Track.STORE_NAME);
				db.deleteObjectStore(Album.STORE_NAME);
				db.deleteObjectStore(Artist.STORE_NAME);
				db.deleteObjectStore(Collection.STORE_NAME);

                db.createObjectStore(Track.STORE_NAME, { keyPath: "id" });
                db.createObjectStore(Album.STORE_NAME, { keyPath: "id" });
                db.createObjectStore(Artist.STORE_NAME, { keyPath: "id" });
                db.createObjectStore(Collection.STORE_NAME, { keyPath: "id" });
            }

			if (oldVersion < 6) {
				const stationsStore = db.createObjectStore(RadioStation.STORE_NAME, { keyPath: "id" });

				stationsStore.put(RadioStation.create("92.9 KAT FM", "https://us9.maindigitalstream.com/ssl/katf"));
				stationsStore.put(RadioStation.create("93.3 KIOA", "https://live.amperwave.net/manifest/saga-kioafmaac-hlsc1.m3u8"));
				stationsStore.put(RadioStation.create("IPR Classical", "http://classical-stream.iowapublicradio.org/Classical.mp3"));
				stationsStore.put(RadioStation.create("IPR News", "http://news-stream.iowapublicradio.org/News.mp3"));
				stationsStore.put(RadioStation.create("IPR Studio One", "http://studioone-stream.iowapublicradio.org/StudioOne.mp3"));
				stationsStore.put(RadioStation.create("Jazz24", "http://knkx-live-a.edge.audiocdn.com/6285_128k"));
				stationsStore.put(RadioStation.create("TruckersFM", "http://radio.truckers.fm"));
			}
        }
    });

    return { db, rescan };
}

// async function getAnonymousUsageConsent() {
//     const previous = await db.get("config", "anonymous_usage_reporting_consent")
//     if (previous !== undefined) {
//         return;
//     }

//     const dialog = document.getElementById("anonymous-usage-consent") as HTMLDialogElement;
//     dialog.show();
//     dialog.addEventListener("close", () => {
//         const consent = dialog.returnValue;
//         const consented = consent === "yes";
//         db.put("config", consented, "anonymous_usage_reporting_consent");
//     });
// }

document.addEventListener("DOMContentLoaded", async () => {
    document.title = "Nothing is playing";

    document.addEventListener('load', (e) => {
        if (!(e.target instanceof HTMLImageElement)) return;
        const img = e.target;
        const aspect = img.naturalWidth / img.naturalHeight;
        img.style.setProperty('--aspect', String(aspect));
    }, true);

    getVersion().then(version => document.querySelector(".version")!.textContent = version);

    // getAnonymousUsageConsent();

	// Start this right away since it might take a while (usually does)
    const dbPromise = initDB();

	// ====================
	// Initialize interface
	// ====================

	Keyboard.init();
    ResizablePanels.init();
	SelectableList.init();

	// Menus & dialogs
    MenuSystem.init();
    MenuBar.init(document.querySelector("#menubar")!);
    CassetteRecorderView.init();
	StylesEditor.init();
	dbPromise.then(({ db }) => RadioStationsEditor.init(db));

    PlaylistView.init();
    PlayerView.init(document.querySelector(".player")!);
	
	// Browser
    MusicBrowser.init();
	dbPromise.then(({ db }) => MusicBrowserView.init(db, document.querySelector(".browser-view")!));
    AlbumDisplay.init(track_list);
    ArtistDisplay.init();
	BreadcrumbsView.init();
	LibraryTreeView.init(document.querySelector("#sidebar")!);

	// =======================
	// Initialize audio system
	// =======================

	const playerPromise = dbPromise.then(({ db }) => Player.init(db));
    PlaybackController.init();

	// ========================
	// Initialize music library
	// ========================

	const stationsPromise = dbPromise.then(({ db }) => {
		return RadioStation.loadAll(db).then(() => {
			LibraryTreeView.updateRadioStations(Array.from(RadioStation.stations.values()));
		});
	});

	const libraryPromise = dbPromise.then(({ db, rescan }) => {
		return Library.loadLibrary(db, rescan).then(() => {
			MusicBrowserView.update();
		});
	});

	// Round 'em all up here
	await Promise.all([
		playerPromise,
		stationsPromise,
		libraryPromise
	]);
});