import { Collection } from "../data/collection.ts";
import { TreeListList, TreeListNode, TreeViewChildNodeClickHandler } from "./treeview.ts";
import { MusicBrowser } from "../musicbrowser.ts";
import { CompareEntry, compareSmartAlpha, compareStack, compareUndefinedLast } from "../util/sort.ts";
import { Player } from "../player.ts";
import { Playlist, PlaylistItem, PlaylistItemType } from "../playlist.ts";
import { Stream } from "../stream.ts";
import { RadioStation } from "../radiostation.ts";
import { createCollectionDialog, renameCollectionDialog } from "./collectionoperations.ts";
import { getTracksMenuItems } from "./menus.ts";

class CollectionNode {
    collection: Collection;
    treeViewNode: TreeListNode;
    children: CollectionNode[];

    constructor(collection: Collection) {
        this.collection = collection;
        this.children = [];
        for (const child of collection.getChildren()) {
            this.children.push(new CollectionNode(child));
        }
        CollectionNode.sortChildren(this.children);
        this.treeViewNode = new TreeListNode({
            labelText: this.collection.getName(),
            iconName: "music-box-multiple",
            children: this.children.map(child => child.treeViewNode),
            onClick: () => this.click(),
			contextMenu: {
				menuitems: [
					getTracksMenuItems(Array.from(collection.getTrackIds()), false),
					{
						kind: "separator"
					},
					{
						kind: "item",
						text: "Rename collection",
						click: () => renameCollectionDialog(collection)
					},
					{
						kind: "item",
						text: "Create new collection here",
						click: () => createCollectionDialog(collection)
					},
					{
						kind: "separator"
					},
					() => ({
						kind: "item",
						text: `Delete collection "${collection.getName()}" (${collection.getTrackIds().size} tracks)`,
						click: () => collection.deleteSelf()
					})
				]
			}
        });

		collection.events.selfChange.addListener(collection => this.selfChangeHandler(collection));
		collection.events.childrenChange.addListener(collection => this.childrenChangeHandler(collection));
    }

    static sortChildren(children: CollectionNode[]) {
        children.sort(compareStack([
            new CompareEntry(child => child.collection.getName(), compareUndefinedLast(compareSmartAlpha))
        ]));
    }

    linkChildren() {
        for (const childNode of this.children) {
			// childNode.treeViewNode.attach(this.treeViewNode);
            this.treeViewNode.childList.add(childNode.treeViewNode);
        }
    }

	readonly selfChangeHandler = (collection: Collection) => {
		this.treeViewNode.label = collection.getName();
	}

    childrenChangeHandler(collection: Collection) {
        const existingMap = new Map(
            this.children.map(node => [node.collection, node])
        );

        // Temporarily remove from the DOM tree (we'll put them back, don't worry)
        for (const childNode of this.children) {
            childNode.treeViewNode.remove();
        }

        // Add ones that have not been here before (and keep track of which ones have)
        for (const child of collection.getChildren()) {
            if (existingMap.has(child)) {
                existingMap.delete(child);
                continue;
            }
            this.children.push(new CollectionNode(child));
        }

        // Remove ones that are no longer here (I guess not *all* of them)
        this.children = this.children.filter(childNode => !existingMap.has(childNode.collection));

        CollectionNode.sortChildren(this.children);

        // And this is where we put them back
        this.linkChildren();
    }

    click() {
        MusicBrowser.navigate({
            collection: this.collection,
        });
    }

    collectionsClickHandler: TreeViewChildNodeClickHandler = function () {
        this.expandToggle();
    }
}

export class LibraryTreeView {
	private static treeView: TreeListList;
	private static collectionNodes: CollectionNode[];
	private static collectionTreeNode: TreeListNode;
	private static radioStationsRootNode: TreeListNode;
	private static radioStationsNodes: TreeListNode[] = [];

	private static initCollectionRootNode() {
        CollectionNode.sortChildren(this.collectionNodes);
        this.collectionTreeNode = new TreeListNode({
            labelText: "Collections",
            iconName: "music-box-multiple",
            children: this.collectionNodes.map(node => node.treeViewNode),
            expanded: true,
			contextMenu: {
				menuitems: [
					{
						kind: "item",
						text: "Create new collection here",
						click: () => createCollectionDialog(null)
					}
				]
			}
        });

		Collection.events.rootChildrenChange.addListener(() => this.collectionRootObserver());
    }

	private static collectionRootObserver() {
        const existingMap = new Map(
            this.collectionNodes.map(node => [node.collection, node])
        );

        // Temporarily remove from the DOM tree (we'll put them back, don't worry)
        for (const childNode of this.collectionNodes) {
            childNode.treeViewNode.remove();
        }

        // Add ones that have not been here before (and keep track of which ones have)
        for (const child of Collection.rootCollections) {
            if (existingMap.has(child)) {
                existingMap.delete(child);
                continue;
            }
            this.collectionNodes.push(new CollectionNode(child));
        }

        // Remove ones that are no longer here (I guess not *all* of them)
        this.collectionNodes = this.collectionNodes.filter(childNode => !existingMap.has(childNode.collection));

        CollectionNode.sortChildren(this.collectionNodes);

        // And this is where we put them back
        for (const node of this.collectionNodes) {
			// node.treeViewNode.attach(this.collectionTreeNode);
            this.collectionTreeNode.childList.add(node.treeViewNode);
        }
    }

    private static play(item: PlaylistItem) {
		Playlist.clear();
		Playlist.add(item);
		Playlist.changeTrack(0);
		Player.play();
	}

	private static getRadioStationItem(station: RadioStation): TreeListNode {
		const stream = new Stream(station.url, station.title);
		const item: PlaylistItem = { type: PlaylistItemType.STREAM, stream: stream };
		return new TreeListNode({
			labelText: station.title ?? station.url,
			onClick: () => this.play(item),
			contextMenu: {
				menuitems: [
					{
						kind: "item",
						text: "Play",
						default: true,
						click: () => this.play(item),
					},
					{
						kind: "item",
						text: "Play next",
						click: () => Playlist.insertNext(item)
					},
					{
						kind: "item",
						text: "Add to playlist",
						click: () => {
							Playlist.add(item);
							if (Playlist.getNumTracks() == 1) {
								Playlist.changeTrack(0);
							}
						}
					}
				]
			}
		})
	}

	static updateRadioStations(stations: RadioStation[]) {
		for (const node of this.radioStationsNodes) {
			node.remove();
		}

		this.radioStationsNodes = [];

		stations.sort(compareStack([
			new CompareEntry(station => station.title, compareSmartAlpha)
		]));

		for (const station of stations) {
			const newNode = this.getRadioStationItem(station);
			// newNode.attach(this.radioStationsRootNode);
			this.radioStationsRootNode.childList.add(newNode);
			this.radioStationsNodes.push(newNode);
		}
	}

    static init(element: HTMLElement) {
        this.collectionNodes = Array.from(Collection.rootCollections).map(child => new CollectionNode(child));
        this.initCollectionRootNode();
		this.radioStationsRootNode = new TreeListNode({
			labelText: "Radio Stations",
			iconName: "radio",
			expanded: true,
		});
        this.treeView = new TreeListList(element, [
            new TreeListNode({
                labelText: "Local library",
                iconName: "library-music",
                onClick: () => this.localLibraryClick(),
            }),
            this.collectionTreeNode,
            // new TreeNodeItem({
            //     labelText: "Playlists",
            //     iconName: "playlist-music",
            //     children: [
            //         new TreeNodeItem({
            //             labelText: "Study beats",
            //             iconName: "playlist-music",
            //         })
            //     ]
            // }),
			this.radioStationsRootNode,
        ]);
    }

    static localLibraryClick() {
        MusicBrowser.navigate({});
    }
}
