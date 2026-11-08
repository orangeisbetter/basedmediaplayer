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
import { StylesEditor } from "./ui/styleseditor.ts";
import { Keyboard } from "./keyboard.ts";
import { RadioStationsEditor } from "./ui/radiostationsview.ts";
import { RadioStation } from "./radiostation.ts";
import { initDB } from "./data/db.ts";

declare const track_list: HTMLDivElement;

// Service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register("./serviceworker.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
    })
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
	LibraryTreeView.init(document.querySelector("#treeview-list")!);

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