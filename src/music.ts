import { openDB } from "idb";

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

declare const track_list: HTMLDivElement;
declare const search_bar: HTMLInputElement;

let db: import("idb").IDBPDatabase;

// Service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register("./serviceworker.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
    })
}

async function initDB(): Promise<boolean> {
    let rescan = false;
    db = await openDB("music-library", 4, {
        upgrade(db, oldVersion, _newVersion, transaction) {
            if (oldVersion < 1) {
                db.createObjectStore("albums", { keyPath: "id" });
                db.createObjectStore("tracks", { keyPath: "id" });

                const configStore = db.createObjectStore("config");
                configStore.put(0, "volume");
            } else if (oldVersion == 1) {
                db.deleteObjectStore("library");
            }

            if (oldVersion < 2) {
                const _collectionStore = db.createObjectStore("collections", { keyPath: "id" });

                // collectionStore.put({
                //     id: 0,
                //     name: "Soundtrack",
                //     trackIds: [],
                //     parent: -1
                // });

                // collectionStore.put({
                //     id: 1,
                //     name: "Game",
                //     trackIds: [],
                //     parent: 0
                // });

                // collectionStore.put({
                //     id: 2,
                //     name: "Movie",
                //     trackIds: [],
                //     parent: 0
                // });
            }

            if (oldVersion < 3) {
                const configStore = transaction.objectStore("config");
                configStore.put("albums", "browser_mode");
                configStore.put("album_artist", "browser_album_sort_mode");
                configStore.put("", "browser_track_sort_mode");
            }

            if (oldVersion < 4) {
                db.createObjectStore("artists", { keyPath: "id" });

                // Library rescan necessary
                rescan = true;
            }
        }
    });

    return rescan;
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

    const rescan = await initDB();

    ResizablePanels.init();

    // getAnonymousUsageConsent();

    MenuSystem.init();
    MenuBar.init(document.querySelector("#menubar")!);
    MusicBrowser.init();

    PlaybackController.init();

    AlbumDisplay.init(track_list);
    ArtistDisplay.init();

    PlaylistView.init();
    PlayerView.init(document.querySelector(".player")!);

    getVersion().then(version => document.querySelector(".version")!.textContent = version);

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            e.preventDefault();
            SelectableList.clearActive();
        } else if (e.ctrlKey) {
            if (e.key === "a") {
                e.preventDefault();
                SelectableList.selectAll();
            }
        } else if (e.key.length === 1 && e.key !== " ") {
            search_bar.focus();
        }
    });

    Library.loadLibrary(db, rescan).then(() => {
        BreadcrumbsView.init();
        MusicBrowserView.init(db, document.querySelector(".browser-view")!);
        return Collection.loadAll(db);
    }).then(() => {
        LibraryTreeView.init(document.querySelector("#sidebar")!);
    });

    await Player.init(db);
});