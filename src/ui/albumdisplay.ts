import { Album } from "../album.ts";
import { Artist } from "../artist.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { MenuSystem, Menu } from "./menu.ts";
import { SelectableList } from "./selectablelist.ts";

declare const template_album_view_track: HTMLTemplateElement;

export class AlbumDisplay {
    private static rootElement: HTMLDivElement;

    private static playAllButton: HTMLButtonElement;
    private static shufflePlayButton: HTMLButtonElement;
    private static addToPlaylistButton: HTMLButtonElement;
    private static trackTableBody: HTMLTableSectionElement;

    private static coverElement: HTMLImageElement;
    private static albumNameElement: HTMLElement;
    private static albumArtistElement: HTMLAnchorElement;
    private static albumInfoElement: HTMLElement;

    private static trackIds: number[] = [];
    private static list: SelectableList;

    private static menu: Menu = {
        menuitems: [
            {
                kind: "item",
                text: "Play all",
                default: true,
                click: () => this.playAll()
            },
            { kind: "separator" },
            {
                kind: "item",
                text: "Play",
                click: () => this.play()
            },
            {
                kind: "item",
                text: "Play next",
                click: () => this.playNext()
            },
            {
                kind: "item",
                text: "Add to playlist",
                click: () => this.addToPlaylist()
            },
            { kind: "separator" },
            {
                kind: "item",
                text: "Add to collection",
            },
            { kind: "separator" },
            {
                kind: "item",
                text: "Copy metadata as TSV",
                click: () => this.copyAsTSV()
            }
        ]
    };

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(element: HTMLDivElement) {
        this.rootElement = element;

        this.playAllButton = this.rootElement.querySelector("#play_all_btn")!;
        this.shufflePlayButton = this.rootElement.querySelector("#shuffle_play_btn")!;
        this.addToPlaylistButton = this.rootElement.querySelector("#add_to_playlist_btn")!;
        this.trackTableBody = this.rootElement.querySelector("tbody")!;

        this.coverElement = this.rootElement.querySelector("#album-cover")!;
        this.albumNameElement = this.rootElement.querySelector("#album-name")!;
        this.albumArtistElement = this.rootElement.querySelector("#album-artist")!;
        this.albumInfoElement = this.rootElement.querySelector("#album-info")!;

        this.playAllButton.addEventListener("click", () => this.playAllHandler());
        this.shufflePlayButton.addEventListener("click", () => this.shufflePlayHandler());
        this.addToPlaylistButton.addEventListener("click", () => this.addToPlaylistHandler());

        this.albumArtistElement.addEventListener("click", () => this.albumArtistClickHandler());

        this.list = SelectableList.register(this.trackTableBody);

        MenuSystem.setContextMenu(this.trackTableBody, () => {
            if (this.list.getSelected().length > 0) {
                return this.menu
            } else {
                return null;
            }
        });

        MusicBrowser.attachObserver(state => this.browserObserver(state));
    }

    private static browserObserver(state: BrowserState) {
        if (state.albumId === null) {
            this.hide();
            return;
        }

        this.show();
        this.displayAlbum();
    }

    static show() {
        this.rootElement.style.display = "";
    }

    static hide() {
        this.rootElement.style.display = "none";
    }

    private static displayAlbum() {
        const album = Album.byID(MusicBrowser.albumId!)!;

        this.trackTableBody.innerHTML = "";

        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        this.trackIds = collectionTracks ? album.trackIds.filter(x => collectionTracks.has(x)) : album.trackIds;

        for (const trackId of this.trackIds) {
            const track = Track.byID(trackId)!;
            this.trackTableBody.appendChild(AlbumDisplay.getTrackElement(track));
        }

        this.coverElement.src = album.getCoverURL();

        this.albumNameElement.textContent = album.name ?? "Unknown album";
        this.albumArtistElement.textContent = album.getArtistName() ?? "Unknown artist";

        const duration = this.trackIds.reduce((prev, current) => prev + Track.byID(current)!.duration, 0);
        const numTracks = this.trackIds.length;
        this.albumInfoElement.textContent = `${numTracks} track${numTracks != 1 ? "s" : ""} • ${convertTime(duration)}`;

        this.rootElement.scroll({ top: 0 });
    }

    private static getTrackElement(track: Track): DocumentFragment {
        const clone = document.importNode(template_album_view_track.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[1].textContent = track.title;
        cells[2].textContent = convertTime(track.duration);
        cells[3].textContent = Artist.getArtistString(track.artists) ?? "";
        cells[4].textContent = track.composer?.join(", ") ?? "";

        return clone;
    }

    private static playAll(index?: number) {
        if (MusicBrowser.albumId === null) {
            throw new Error("Cannot play album, no album set!");
        }

        const album = Album.byID(MusicBrowser.albumId)!;

        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        const trackIds = MusicBrowser.collection ? album.trackIds.filter(x => collectionTracks!.has(x)) : album.trackIds;

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

    private static copyAsTSV() {
        const indices = this.list.getSelected();
        const tsvData = indices
            .map(index => {
                const track = Track.byID(this.trackIds[index])!;
                const columns = [
                    track.disc ?? "",
                    track.no ?? "",
                    track.title,
                    convertTime(track.duration),
                    track.artists?.join("\\\\") ?? "",
                    track.composer?.join("\\\\") ?? ""
                ];
                return columns.join("\t");
            })
            .join("\n");

        navigator.clipboard.writeText(tsvData);
    }

    private static playAllHandler() {
        this.playAll(0);
    }

    private static addToPlaylistHandler() {
        Playlist.add(...this.trackIds);
    }

    private static shufflePlayHandler() {
        Playlist.clear();
        Playlist.add(...this.trackIds);
        Playlist.shuffle();
        Playlist.changeTrack(0);
        Player.play();
    }

    private static albumArtistClickHandler() {
        const albumId = MusicBrowser.albumId;
        if (albumId === null) return;
        const album = Album.byID(albumId)!;
        if (album.artist === undefined) return;
        MusicBrowser.navigate({
            artistId: album.artist
        });
    }
}