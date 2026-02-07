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

/** @type {import("idb").IDBPDatabase} */
let db;

// Service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register("./serviceworker.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
    })
}

async function initDB() {
    db = await openDB("music-library", 2, {
        upgrade(db, oldVersion) {
            if (oldVersion < 1) {
                db.createObjectStore("albums", { keyPath: "id" });
                db.createObjectStore("tracks", { keyPath: "id" });

                const configStore = db.createObjectStore("config");
                configStore.put(0, "volume");
            } else if (oldVersion == 1) {
                db.deleteObjectStore("library");
            }

            if (oldVersion < 2) {
                const collectionStore = db.createObjectStore("collections", { keyPath: "id" });

                collectionStore.put({
                    id: 0,
                    name: "Soundtrack",
                    trackIds: [0, 1, 2, 3, 4, 5, 6],
                    parent: -1
                });

                collectionStore.put({
                    id: 1,
                    name: "Game",
                    trackIds: [7, 8, 9, 10],
                    parent: 0
                });
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await initDB();

    MenuSystem.init();
    MenuBar.init(document.querySelector("#menubar"));

    PlaybackController.init();

    AlbumDisplay.init(track_list);

    PlaylistView.init();
    PlayerView.init(document.querySelector(".player"));

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            e.preventDefault();
            SelectableList.clearActive();
        } else if (e.key === "a" && e.ctrlKey) {
            e.preventDefault();
            SelectableList.selectAll();
        } else if (e.key.length === 1 && e.key !== " ") {
            search_bar.focus();
        }
    });

    Library.loadLibrary(db).then(async () => {
        MusicBrowserView.init(document.querySelector(".browser-view"));
        await Collection.loadAll(db);
        LibraryTreeView.init(document.querySelector(".sidebar"));
    });

    await Player.init(db);
});