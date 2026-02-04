import { ctxmenu, CTXMenu } from "ctxmenu";
import { Album } from "../album";
import { Collection, Library } from "../collection";
import { Player } from "../player";
import { Playlist } from "../playlist";
import { convertTime } from "../time";
import { Track } from "../track";
import { AlbumDisplay } from "./albumdisplay";

declare const template_album: HTMLTemplateElement;
declare const template_track_list_item: HTMLTemplateElement;

type AlbumClickHandler = (albumId: number, collection: Collection) => void;
type BrowserMode = "artists" | "albums" | "tracks";

export class MusicBrowserView {
    private static rootElement: HTMLDivElement;

    private static albumsList: HTMLDivElement;
    private static artistsList: HTMLDivElement;
    private static tracksList: HTMLDivElement;

    // private static breadcrumbs: HTMLDivElement;

    private static browserModeSelector: HTMLSelectElement;
    private static browserMode: BrowserMode;
    private static collection: Collection = null;

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(element: HTMLDivElement) {
        this.rootElement = element;

        this.albumsList = this.rootElement.querySelector(".albums-list");
        this.artistsList = this.rootElement.querySelector(".artists-list");
        this.tracksList = this.rootElement.querySelector(".tracks-list");

        // this.breadcrumbs = document.querySelector("header > .breadcrumbs");
        this.browserModeSelector = document.querySelector("header > select");

        this.browserModeSelector.addEventListener("change", () => {
            this.setBrowserMode(this.browserModeSelector.value as BrowserMode);
        });

        this.setBrowserMode("albums");
    }

    static setCollection(collection: Collection) {
        if (this.collection != collection) {
            this.collection = collection;
            // this.breadcrumbs.textContent = `> ${this.collection ? "Collections" : "Local library"} > ${this.getCollectionPath(this.collection)}`;
            this.rerender();
        }
    }

    static setBrowserMode(mode: BrowserMode) {
        if (this.browserMode != mode) {
            this.browserMode = mode;
            this.rootElement.dataset.mode = mode;
            this.rerender();
        }
    }

    static show() {
        this.rootElement.style.display = "";
        this.browserModeSelector.style.display = "";
    }

    static hide() {
        this.rootElement.style.display = "none";
        this.browserModeSelector.style.display = "none";
    }

    static rerender() {
        switch (this.browserMode) {
            case "albums":
                this.showAlbums();
                break;
            case "artists":
                this.showArtists();
                break;
            case "tracks":
                this.showTracks();
                break;
        }
    }

    static showAlbums() {
        const albumIds = this.collection ? this.collection.getAlbumIds() : Album.getAllIds();

        this.albumsList.innerHTML = "";

        for (const albumId of albumIds) {
            const album = Album.byID(albumId);
            this.albumsList.appendChild(this.getAlbumElement(album));
        }
    }

    static showArtists() {

    }

    static showTracks() {
        const allTracks = Array.from(Track.getAllIds());
        const collectionTracks = this.collection?.trackIds;
        const tracks = this.collection ? allTracks.filter(x => collectionTracks.has(x)) : allTracks;

        const tbody = this.tracksList.querySelector("tbody");

        tbody.innerHTML = "";

        for (const trackId of tracks) {
            const track = Track.byID(trackId);
            const album = Album.byID(track.albumId);
            tbody.appendChild(this.getTrackElement(album, track));
        }
    }

    private static getAlbumElement(album: Album): DocumentFragment {
        const clone = document.importNode(template_album.content, true);

        const cover: HTMLImageElement = clone.querySelector(".cover");
        cover.src = album.getCoverURL();
        cover.addEventListener("click", () => AlbumDisplay.displayAlbum(album.id, this.collection));

        const albumName: HTMLElement = clone.querySelector(".album-name");
        albumName.textContent = album.name ?? "Unknown Album";
        albumName.title = album.name ?? "Unknown Album";
        albumName.addEventListener("click", () => AlbumDisplay.displayAlbum(album.id, this.collection));

        const albumArtist: HTMLElement = clone.querySelector(".album-artist");
        albumArtist.textContent = album.artist ?? "Unknown Artist";
        albumArtist.title = album.artist ?? "Unknown Artist";

        return clone;
    }

    private static getTrackElement(album: Album, track: Track): DocumentFragment {
        const clone = document.importNode(template_track_list_item.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].title = cells[0].textContent = album.name ?? "Unknown Album";
        cells[1].title = cells[1].textContent = album.artist ?? "Unknown Artist";
        cells[2].title = cells[2].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[3].title = cells[3].textContent = track.title;
        cells[4].title = cells[4].textContent = convertTime(track.duration);
        cells[5].title = cells[5].textContent = track.artist ?? "";

        clone.firstElementChild.addEventListener("dblclick", () => {
            Playlist.add(track.id);
            Playlist.skipToEnd();
            Player.play();
        });

        const contextMenu: CTXMenu = [
            {
                text: "Play",
                action: () => {
                    Playlist.add(track.id);
                    Playlist.skipToEnd();
                    Player.play();
                }
            },
            {
                text: "Play next",
                action: () => Playlist.insertNext(track.id)
            },
            {
                text: "Add to playlist",
                action: () => Playlist.add(track.id)
            },
            // { isDivider: true },
            // {
            //     text: "Add to collection...",
            //     action: () => { },
            // },
            // {
            //     text: "Remove from collection",
            //     action: () => { },
            //     disabled: true
            // }
        ];

        clone.firstElementChild.addEventListener("contextmenu", (event: PointerEvent) => ctxmenu.show(contextMenu, event));

        return clone;
    }
}