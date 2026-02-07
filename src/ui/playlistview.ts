import { Player } from "../player.ts";
import { Playlist, PlaylistInsertEventData, PlaylistNumTracksChangeEventData, PlaylistRemoveEventData, PlaylistReorderEventData, PlaylistShuffleEventData, PlaylistTrackChangeEventData } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { MenuSystem, Menu } from "./menu.ts";
import { SelectableList } from "./selectablelist.ts";

declare const template_playlist_item: HTMLTemplateElement;

declare const playlist_panel: HTMLDivElement;

export class PlaylistView {
    private static currentTrack: HTMLDivElement | null = null;

    private static list: HTMLElement;
    private static selectableList: SelectableList;

    private static clearButton: HTMLButtonElement;
    private static shuffleButton: HTMLButtonElement;

    // private static selected: number[] = [];
    // private static lastSelectedIndex: number = null;

    private static items: HTMLElement[] = [];
    private static dragMarker: HTMLElement;
    private static dragRAF = false;

    private static draggingElement = false;
    private static dragElement: HTMLElement;
    private static dragSelectionBox: { startX: number, startY: number } = { startX: 0, startY: 0 };

    private static singleMenu: Menu = {
        menuitems: [
            {
                kind: "item",
                html: "<b>Play</b>",
                click: () => this.playHandler(),
            },
            {
                kind: "item",
                html: "Remove from list",
                click: () => this.removeFromListHandler(),
            },
            // { kind: "separator" },
            // {
            //     kind: "item",
            //     html: "Find in library",
            // }
        ]
    };

    private static multiMenu: Menu = {
        menuitems: [
            {
                kind: "item",
                html: "<b>Play</b>",
                click: () => this.playHandler(),
            },
            {
                kind: "item",
                html: "Remove from list",
                click: () => this.removeFromListHandler(),
            }
        ]
    };

    constructor() {
        throw Error("This static class cannot be instantiated.");
    }

    static init() {
        this.list = playlist_panel.querySelector(".playlist-list")!;
        // this.list.addEventListener("click", PlaylistView.playlistItemClickHandler.bind(this));
        this.list.addEventListener("dblclick", PlaylistView.playlistItemDoubleClickHandler.bind(this));
        this.list.addEventListener("dragstart", PlaylistView.dragStartHandler.bind(this));
        this.list.addEventListener("dragend", PlaylistView.dragEndHandler.bind(this));
        this.list.addEventListener("dragenter", PlaylistView.dragEnterHandler.bind(this));
        this.list.addEventListener("dragover", PlaylistView.dragOverHandler.bind(this));
        this.list.addEventListener("dragleave", PlaylistView.dragLeaveHandler.bind(this));
        this.list.addEventListener("drop", PlaylistView.dropHandler.bind(this));

        this.clearButton = playlist_panel.querySelector(".clear")!;
        this.clearButton.addEventListener("click", Playlist.clear);

        this.shuffleButton = playlist_panel.querySelector(".shuffle")!;
        this.shuffleButton.addEventListener("click", Playlist.shuffle);

        this.dragMarker = document.createElement("div");
        this.dragMarker.className = "drag-target-marker";

        this.dragElement = document.querySelector(".dragging-playlist")!;

        this.selectableList = SelectableList.register(this.list);

        MenuSystem.setContextMenu(this.list, () => {
            const length = this.selectableList.getSelected().length;
            if (length > 1) {
                return this.multiMenu;
            } else if (length == 1) {
                return this.singleMenu;
            } else {
                return null;
            }
        });

        // let selectionBox = document.createElement("div");
        // this.list.appendChild(selectionBox);
        // this.list.style.position = "relative";
        // selectionBox.style.position = "fixed";
        // selectionBox.style.backgroundColor = "blue";
        // selectionBox.style.display = "none";

        // let listBoundingBox = this.list.getBoundingClientRect();

        // this.list.addEventListener("mousedown", event => {
        //     PlaylistView.dragSelectionBox.startX = event.clientX;
        //     PlaylistView.dragSelectionBox.startY = event.clientY;
        //     selectionBox.style.display = "block";
        // });

        // this.list.addEventListener("mousemove", event => {
        //     selectionBox.style.top = Math.min(PlaylistView.dragSelectionBox.startY, event.clientY) - listBoundingBox.top + "px";
        //     selectionBox.style.left = Math.min(PlaylistView.dragSelectionBox.startX, event.clientX) - listBoundingBox.left + "px";
        //     selectionBox.style.height = "50px";//Math.abs(PlaylistView.dragSelectionBox.startY - event.clientY) + "px";
        //     selectionBox.style.width = "50px";//Math.abs(PlaylistView.dragSelectionBox.startX - event.clientX) + "px";
        // });

        // this.list.addEventListener("mouseup", event => {
        //     selectionBox.style.display = "none";
        // });

        Playlist.events.add.addListener(PlaylistView.addHandler);
        Playlist.events.insert.addListener(PlaylistView.insertHandler);
        Playlist.events.remove.addListener(PlaylistView.removeHandler);
        Playlist.events.reorder.addListener(PlaylistView.reorderHandler);
        Playlist.events.clear.addListener(PlaylistView.clearHandler);
        Playlist.events.shuffle.addListener(PlaylistView.shuffleHandler);
        Playlist.events.trackChange.addListener(PlaylistView.trackChangeHandler);
        Playlist.events.numTracksChange.addListener(PlaylistView.numTracksChangeHandler);
    }

    static scrollIntoView() {
        PlaylistView.currentTrack?.scrollIntoView({ behavior: "instant", block: "nearest", container: "nearest" } as ScrollIntoViewOptions);
    }

    private static playlistItemDoubleClickHandler(event: MouseEvent) {
        // Play
        const item = (event.target as HTMLElement).closest(".playlist-item");
        const index = PlaylistView.items.indexOf(item as HTMLElement);

        if (index != -1) {
            Playlist.changeTrack(index);
            Player.play();
        }
    }

    private static dragStartHandler(event: DragEvent) {
        const selectedIndices = this.selectableList.getSelected();

        event.dataTransfer!.items.add(JSON.stringify(selectedIndices), "application/mp-playlist-indices");
        const label = this.dragElement.querySelector(".label")!;
        label.textContent = `${selectedIndices.length} track${selectedIndices.length != 1 ? "s" : ""}`;
        const height = this.dragElement.getBoundingClientRect().height;
        const width = this.dragElement.getBoundingClientRect().width;
        event.dataTransfer!.setDragImage(this.dragElement, width / 2, height - 10);
    }

    private static dragEndHandler() {
    }

    private static dragEnterHandler() {
    }

    private static findDropIndex(y: number) {
        let low = 0;
        let high = this.items.length;

        while (low < high) {
            const mid = (low + high) >>> 1;
            const rect = this.items[mid].getBoundingClientRect();

            if (y > rect.top + rect.height / 2) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return low;
    }

    private static updateDragMarker(clientY: number) {
        this.dragRAF = false;

        const index = PlaylistView.findDropIndex(clientY);
        const ref = this.items[index] ?? null;

        if (this.dragMarker.parentElement === null || this.dragMarker.nextElementSibling !== ref) {
            this.list.insertBefore(this.dragMarker, ref);
        }
    }

    private static dragOverHandler(event: DragEvent) {
        const dt = event.dataTransfer!;
        if (!dt.types.includes("application/mp-playlist-indices") && !dt.types.includes("application/mp-track-ids")) {
            // Ignore
            return;
        }

        // Allow dropping
        event.preventDefault();

        if (!this.dragRAF) {
            this.dragRAF = true;
            requestAnimationFrame(this.updateDragMarker.bind(this, event.clientY));
        }
    }

    private static dragLeaveHandler(event: DragEvent) {
        const related = event.relatedTarget as Node | null;
        if (!related || !this.list.contains(related)) {
            this.dragMarker.remove();
        }
    }

    private static dropHandler(event: DragEvent) {
        const dt = event.dataTransfer!;
        if (!dt.types.includes("application/mp-playlist-indices") && !dt.types.includes("application/mp-track-ids")) {
            // Ignore
            return;
        }

        event.preventDefault();
        this.dragMarker.remove();

        const index = this.findDropIndex(event.clientY);

        if (dt.types.includes("application/mp-playlist-indices")) {
            // Playlist reorder
            const indices = JSON.parse(dt.getData("application/mp-playlist-indices"));
            Playlist.reorder(index, ...indices);
        } else if (dt.types.includes("application/mp-track-ids")) {
            // Insert tracks from library
            const trackIds = JSON.parse(dt.getData("application/mp-tracks-ids"));
            Playlist.insert(index, ...trackIds);
        }
    }

    private static removeFromListHandler() {
        const selectedIndices = this.selectableList.getSelected();
        Playlist.remove(...selectedIndices);
    }

    private static playHandler() {
        const index = this.selectableList.getSelected()[0];
        Playlist.changeTrack(index);
        Player.play();
    }

    private static createPlaylistItem(trackId: number): DocumentFragment {
        const track = Track.byID(trackId)!;

        const clone = document.importNode(template_playlist_item.content, true);

        const trackName = clone.querySelector(".track-name") as HTMLSpanElement;
        trackName.textContent = track.title;
        trackName.title = track.title;

        const time = clone.querySelector(".time")!;
        time.textContent = convertTime(track.duration);

        return clone;
    }

    private static updateItemsCache() {
        PlaylistView.items = Array.from(PlaylistView.list.querySelectorAll(":scope > .playlist-item"));
    }

    private static getItemByIndex(index: number): HTMLDivElement | null {
        if (index < 0 || index >= this.items.length) {
            return null;
        }
        return this.items[index] as HTMLDivElement;
    }

    private static addHandler(trackIds: number[]) {
        for (const trackId of trackIds) {
            const item = PlaylistView.createPlaylistItem(trackId);
            PlaylistView.items.push(item.firstElementChild as HTMLElement);
            PlaylistView.list.appendChild(item);
        }
    }

    private static insertHandler({ tracks, to }: PlaylistInsertEventData) {
        const afterNode = PlaylistView.getItemByIndex(to);
        for (const trackId of tracks) {
            const item = PlaylistView.createPlaylistItem(trackId);
            PlaylistView.list.insertBefore(item, afterNode);
        }
        PlaylistView.updateItemsCache();
    }

    private static removeHandler(trackIndices: PlaylistRemoveEventData) {
        for (const index of trackIndices) {
            PlaylistView.getItemByIndex(index)!.remove();
        }
        // Deselect removed items
        // PlaylistView.selected.filter(index => !trackIndices.includes(index));
        PlaylistView.updateItemsCache();
    }

    private static reorderHandler({ from, to }: PlaylistReorderEventData) {
        const moving = [];
        for (const index of from) {
            const item = PlaylistView.getItemByIndex(index)!;
            moving.push(item);
            item.remove();
        }
        while (from.includes(to)) {
            to++;
        }
        moving.reverse();
        const afterNode = PlaylistView.getItemByIndex(to);
        for (const node of moving) {
            if (afterNode === null) {
                PlaylistView.list.appendChild(node);
            } else {
                PlaylistView.list.insertBefore(node, afterNode);
            }
        }
        // for (const i in PlaylistView.selected) {
        //     PlaylistView.selected[i] = mapping[PlaylistView.selected[i]];
        // }
        PlaylistView.updateItemsCache();
    }

    private static clearHandler() {
        PlaylistView.list.innerHTML = "";
        PlaylistView.items.length = 0;
        // PlaylistView.selected.length = 0;
    }

    private static shuffleHandler({ mapping }: PlaylistShuffleEventData) {
        const items = Array.from(PlaylistView.list.querySelectorAll(":scope > .playlist-item"));

        for (const item of items) {
            item.remove();
        }

        for (const index of mapping) {
            PlaylistView.list.appendChild(items[index]);
        }

        PlaylistView.updateItemsCache();
    }

    private static trackChangeHandler({ index }: PlaylistTrackChangeEventData) {
        PlaylistView.currentTrack?.classList.remove("active");
        if (index != null) {
            PlaylistView.currentTrack = PlaylistView.getItemByIndex(index)!;
            PlaylistView.currentTrack.classList.add("active");
        } else {
            PlaylistView.currentTrack = null;
        }
        PlaylistView.scrollIntoView();
    }

    private static numTracksChangeHandler({ number, duration }: PlaylistNumTracksChangeEventData) {
        // Handle this somehow
        const playlistInfo = playlist_panel.querySelector(".playlist-info")!;
        playlistInfo.textContent = `${number} track${number != 1 ? "s" : ""}, duration: ${convertTime(duration)}`;
    }

    public static toggleVisibility() {
        playlist_panel.classList.toggle("hidden");
    }
}