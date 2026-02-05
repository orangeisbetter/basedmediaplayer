import { openDB } from "idb";

import { Track } from "./track.ts";
import { Album } from "./album.ts";
import { Library } from "./collection.ts";
import { init } from "./ui/librarytreeview.ts";
import { MusicBrowserView } from "./ui/musicbrowserview.ts";
import { AlbumDisplay } from "./ui/albumdisplay.ts";
import { PlaylistView } from "./ui/playlistview.ts"
import { Player } from "./player.ts";
import { PlayerView } from "./ui/playerview.ts";
import { PlaybackController } from "./playbackcontroller.ts";
import { MenuSystem } from "./ui/menu.ts";
import { SelectableList } from "./ui/selectablelist.ts";
import { MenuBar } from "./ui/menubar.ts";

/** @type {Album[]} */
const albums = [];

/** @type {import("idb").IDBPDatabase} */
let db;

// Service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register("./serviceworker.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
    })
}

async function* getHandlesRecursively(/** @type {FileSystemFileHandle} */ entry, path = "") {
    if (entry.kind === "file") {
        yield { path, handle: entry };
        return;
    }

    // entry.kind === "directory"
    for await (const handle of entry.values()) {
        const nextPath = path ? `${path}/${handle.name}` : handle.name;
        yield* getHandlesRecursively(handle, nextPath);
    }
}

async function asyncPool(poolSize, items, fn) {
    const results = [];
    const executing = [];

    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);

        if (poolSize <= items.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolSize) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(results);
}

async function ensureReadPermission(handle) {
    const opts = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    return await handle.requestPermission(opts) === "granted";
}

async function loadLibrary() {
    await Library.load(db);

    if (await db.count("tracks") > 0 && await db.count("albums") > 0) {
        await Track.loadAll(db);
        await Album.loadAll(db);

        Album.albums.forEach(album => {
            albums[album.name] = album;
        });
        return;
    }

    const dirHandle = await getLibraryHandle();

    load_dialog.showModal();

    // Remove library button
    document.getElementById("library_select_btn")?.remove();

    loading_lbl.textContent = "Scanning library files...";

    /** @type {{path: string, handle: FileSystemFileHandle}} */
    const items = [];
    for await (const file of getHandlesRecursively(dirHandle)) {
        items.push(file);
    }

    const progress_bar = document.getElementById("progress_bar");
    progress_bar.max = items.length;

    let countDone = 0;
    /** @type {(ProtoTrack)[]} */
    const protos = await asyncPool(256, items, ({ path, handle }) => Track.loadFile(handle, path).then(proto => {
        countDone++;
        progress_bar.value = countDone;
        loading_lbl.textContent = `${countDone} / ${items.length} files scanned`;
        return proto;
    }));

    loading_lbl.textContent = `Construcing albums from ${protos.length} discovered tracks`;

    // Build albums from tracks
    for (const proto of protos) {
        if (!proto) continue;

        const albumName = proto.tag.album;
        const albumLower = albumName?.toLowerCase();

        let album = albums.find(album => album.name?.toLowerCase() === albumLower && album.artist === (proto.tag.albumartist ?? proto.tag.artist));
        if (!album) {
            album = new Album();
            album.name = albumName;
            album.artist = proto.tag.albumartist ?? proto.tag.artist;
            albums.push(album);
        }

        const track = Track.createFromProtoTrack(proto, album.id);
        album.trackIds.push(track.id);

        if (proto.tag.picture && !album.cover) {
            const coverData = proto.tag.picture[0];
            album.coverData = coverData;
        }
    }

    for (const album of albums) {
        album.trackIds.sort((a, b) => {
            const trackA = Track.byID(a);
            const trackB = Track.byID(b);

            if (trackA.disc !== trackB.disc) {
                return (trackA.disc ?? 0) - (trackB.disc ?? 0);
            }

            if (trackA.no !== trackB.no) {
                return (trackA.no ?? 0) - (trackB.no ?? 0);
            }

            return (trackA.title ?? "").localeCompare(trackB.title ?? "");
        });
    }

    loading_lbl.textContent = "Writing library to indexedDB...";

    await Track.saveAll(db);
    await Album.saveAll(db);
    await Library.save(db);

    load_dialog.close();
}

/** @type {import("./collection.ts").CollectionStore[]} */
const defaultCollections = [
    {
        name: "Soundtrack",
        trackIds: [1, 2, 3],
        collections: [
            {
                name: "Movie",
                trackIds: [4, 5, 6],
                collections: []
            },
            {
                name: "Game",
                trackIds: [5, 6, 7],
                collections: []
            },
        ]
    },
    {
        name: "Instrumental",
        trackIds: [5, 6, 7, 8, 100, 101, 102],
        collections: []
    },
];

async function initDB() {
    db = await openDB("music-library", 1, {
        upgrade(db) {
            db.createObjectStore("albums", { keyPath: "id" });
            db.createObjectStore("tracks", { keyPath: "id" });

            const libraryStore = db.createObjectStore("library");
            libraryStore.put(defaultCollections, "collections");

            const configStore = db.createObjectStore("config");
            configStore.put(0, "volume");
        }
    });
}

function saveRootHandle(dirHandle) {
    return db.put("config", dirHandle, "root");
}

function loadRootHandle() {
    return db.get("config", "root");
}

/**
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
async function getLibraryHandle() {
    const root = await loadRootHandle();
    if (root && await ensureReadPermission(root)) {
        return root;
    }

    // Ensure supported browser
    if (!globalThis.showDirectoryPicker) {
        const unsupportedDialog = document.createElement("dialog");
        unsupportedDialog.style.width = "400px"
        unsupportedDialog.innerHTML = `
        <div class="content">
            <h2>Error: Unsupported Browser or context</h2>
            <p>It appears your browser does not support the <code>Window.showDirectoryPicker()</code> function, which is needed by this application, or you are accessing the page via an insecure context.</p>
            <p>For now, you'll need to use a chromium-based browser (such as Google Chrome, Microsoft Edge, Brave, Supermium, and others) and use a secure context to run this app.</p>
        </div>
        `;

        const buttonBar = document.createElement("div");
        buttonBar.className = "button-bar";

        const glue = document.createElement("div");
        glue.className = "glue";

        const okButton = document.createElement("button");
        okButton.style.float = "right";
        okButton.textContent = "Close";
        okButton.addEventListener("click", () => {
            unsupportedDialog.close();
            unsupportedDialog.remove();
        });

        buttonBar.appendChild(glue);
        buttonBar.appendChild(okButton);

        unsupportedDialog.appendChild(buttonBar);

        document.body.appendChild(unsupportedDialog);
        unsupportedDialog.showModal();

        throw new Error("Directory picker unsupported");
    }

    // Prompt the user with a button to select library (naive but ok)
    document.querySelector(".main-view").innerHTML += `<button id="library_select_btn">Select Library</button>`;
    return await new Promise(resolve => {
        library_select_btn.addEventListener("click", async () => {
            const dirHandle = await globalThis.showDirectoryPicker();
            await ensureReadPermission(dirHandle);
            saveRootHandle(dirHandle);
            resolve(dirHandle);
        });
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

    loadLibrary().then(() => {
        MusicBrowserView.init(document.querySelector(".browser-view"));
        init();
    });

    await Player.init(db);
});