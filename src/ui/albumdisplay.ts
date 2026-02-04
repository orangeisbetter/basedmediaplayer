import { Album } from "../album";
import { Collection } from "../collection";
import { Player } from "../player";
import { Playlist } from "../playlist";
import { convertTime } from "../time";
import { Track } from "../track";
import { ContextMenu, Menu } from "./menu";
import { MusicBrowserView } from "./musicbrowserview";
import { CTXMenu, ctxmenu } from "ctxmenu";
import { SelectableList } from "./selectablelist";

declare const template_album_view_track: HTMLTemplateElement;

export class AlbumDisplay {
    private static rootElement: HTMLDivElement = null;

    private static playAllButton: HTMLButtonElement;
    private static addToPlaylistButton: HTMLButtonElement;
    private static trackTableBody: HTMLTableSectionElement;

    private static albumId?: number;
    private static collection?: Collection;

    private static trackIds: number[] = [];
    private static list: SelectableList = null;

    private static menu: Menu = {
        menuitems: [
            {
                kind: "item",
                html: "<b>Play all</b>",
                click: () => this.playAll()
            },
            {
                kind: "item",
                html: "Play",
                click: () => this.play()
            },
            {
                kind: "item",
                html: "Play next",
                click: () => this.playNext()
            },
            {
                kind: "item",
                html: "Add to playlist",
                click: () => this.addToPlaylist()
            },
            { kind: "separator" },
            { kind: "item", html: "Add to collection" },
        ]
    };

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(element: HTMLDivElement) {
        this.rootElement = element;

        this.playAllButton = this.rootElement.querySelector("#play_all_btn");
        this.addToPlaylistButton = this.rootElement.querySelector("#add_to_playlist_btn");
        this.trackTableBody = this.rootElement.querySelector("tbody");

        this.playAllButton.addEventListener("click", () => this.playAll(0));
        this.addToPlaylistButton.addEventListener("click", () => this.addAllToPlaylist());

        this.list = SelectableList.register(this.trackTableBody);
        ContextMenu.set(this.trackTableBody, () => this.menu);

        this.hide();
    }

    static show() {
        this.rootElement.style.display = "";
    }

    static hide() {
        this.rootElement.style.display = "none";
    }

    static displayAlbum(albumId: number, collection: Collection) {
        this.albumId = albumId;
        this.collection = collection;

        this.trackTableBody.innerHTML = "";

        const album = Album.byID(albumId);

        const collectionTracks = collection?.getTrackIds();
        this.trackIds = collection ? album.trackIds.filter(x => collectionTracks.has(x)) : album.trackIds;

        for (let index = 0; index < this.trackIds.length; index++) {
            const track = Track.byID(this.trackIds[index]);
            this.trackTableBody.appendChild(AlbumDisplay.getTrackElement(index, track));
        }

        const cover: HTMLImageElement = this.rootElement.querySelector(".album-cover");
        cover.src = album.getCoverURL();

        this.rootElement.querySelector(".album-name").textContent = album.name ?? "Unknown Album";
        this.rootElement.querySelector(".album-artist").textContent = album.artist ?? "Unknown Artist";

        this.rootElement.scroll({ top: 0 });

        MusicBrowserView.hide();
        this.show();
    }

    private static getTrackElement(index: number, track: Track): DocumentFragment {
        const clone = document.importNode(template_album_view_track.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[1].textContent = track.title;
        cells[2].textContent = convertTime(track.duration);
        cells[3].textContent = track.artist ?? "";
        cells[4].textContent = track.composer?.join(", ") ?? "";

        clone.firstElementChild.addEventListener("dblclick", () => this.playAll(index));

        return clone;
    }

    private static playAll(index?: number) {
        const album = Album.byID(this.albumId);

        const collectionTracks = this.collection?.getTrackIds();
        const trackIds = this.collection ? album.trackIds.filter(x => collectionTracks.has(x)) : album.trackIds;

        // Get index from beginning of selection if not specified
        index ??= this.list.getSelected()[0];

        Playlist.clear();
        Playlist.add(...trackIds);
        Playlist.changeTrack(index);
        Player.play();
    }

    private static play() {
        const indices = this.list.getSelected();
        if (indices.length == 0) return; // How did we get here???
        const tracks = indices.map(index => this.trackIds[index]);
        Playlist.add(...tracks);
        Playlist.changeTrack(Playlist.getNumTracks() - tracks.length);
        Player.play();
    }

    private static playNext() {
        const indices = this.list.getSelected();
        const tracks = indices.map(index => this.trackIds[index]);
        Playlist.insertNext(...tracks);
    }

    private static addToPlaylist() {
        const indices = this.list.getSelected();
        const tracks = indices.map(index => this.trackIds[index]);
        Playlist.add(...tracks);
    }

    private static addAllToPlaylist() {
        Playlist.add(...this.trackIds);
    }
}