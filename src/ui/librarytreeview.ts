import { Collection } from "../collection.ts";
import { TreeView, TreeViewChildNode, TreeViewChildNodeClickHandler } from "./treeview.ts";
import { MusicBrowser } from "../musicbrowser.ts";
import { CompareEntry, compareSmartAlpha, compareStack, compareUndefinedLast } from "../util/sort.ts";
import { Player } from "../player.ts";
import { Playlist, PlaylistItemType } from "../playlist.ts";
import { Stream } from "../stream.ts";
import { RadioStation } from "../radiostation.ts";
import { createCollection } from "./createcollection.ts";

class CollectionNode {
    collection: Collection;
    treeViewNode: TreeViewChildNode;
    children: CollectionNode[];

    constructor(collection: Collection) {
        this.collection = collection;
        this.children = [];
        for (const child of collection.getChildren()) {
            this.children.push(new CollectionNode(child));
        }
        CollectionNode.sortChildren(this.children);
        this.treeViewNode = new TreeViewChildNode({
            labelText: this.collection.name,
            iconName: "music-box-multiple",
            children: this.children.map(child => child.treeViewNode),
            onClick: () => this.click(),
			contextMenu: {
				menuitems: [
					{
						kind: "item",
						text: "Create new collection here",
						click: () => createCollection(collection)
					},
					{
						kind: "separator"
					},
					() => ({
						kind: "item",
						text: `Delete collection "${collection.name}" (${collection.getTrackIds().size} tracks)`,
						click: () => collection.deleteSelf()
					})
				]
			}
        });

        collection.attachBaseObserver(collection => this.observer(collection));
    }

    static sortChildren(children: CollectionNode[]) {
        children.sort(compareStack([
            new CompareEntry(child => child.collection.name, compareUndefinedLast(compareSmartAlpha))
        ]));
    }

    linkChildren() {
        for (const childNode of this.children) {
            this.treeViewNode.addChild(childNode.treeViewNode);
        }
    }

    observer(collection: Collection) {
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
    static treeView: TreeView;
    static collectionNodes: CollectionNode[];
    static collectionTreeNode: TreeViewChildNode;
	static radioStationsRootNode: TreeViewChildNode;
	static radioStationsNodes: TreeViewChildNode[] = [];

    static initCollectionRootNode() {
        CollectionNode.sortChildren(this.collectionNodes);
        this.collectionTreeNode = new TreeViewChildNode({
            labelText: "Collections",
            iconName: "music-box-multiple",
            children: this.collectionNodes.map(node => node.treeViewNode),
            expanded: true,
			contextMenu: {
				menuitems: [
					{
						kind: "item",
						text: "Create new collection here",
						click: () => createCollection(null)
					}
				]
			}
        });

        Collection.attachRootObserver(collections => this.collectionRootObserver(collections));
    }

    static collectionRootObserver(collections: Collection[]) {
        const existingMap = new Map(
            this.collectionNodes.map(node => [node.collection, node])
        );

        // Temporarily remove from the DOM tree (we'll put them back, don't worry)
        for (const childNode of this.collectionNodes) {
            childNode.treeViewNode.remove();
        }

        // Add ones that have not been here before (and keep track of which ones have)
        for (const child of collections) {
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
            this.collectionTreeNode.addChild(node.treeViewNode);
        }
    }

	static getRadioStationItem(station: RadioStation): TreeViewChildNode {
		const stream = new Stream(station.url, station.title);
		return new TreeViewChildNode({
			labelText: station.title ?? station.url,
			onClick: () => {
				Playlist.clear();
				Playlist.add({ type: PlaylistItemType.STREAM, stream: stream });
				Playlist.changeTrack(0);
				Player.play();
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
			this.radioStationsRootNode.addChild(newNode);
			this.radioStationsNodes.push(newNode);
		}
	}

    static init(element: HTMLElement) {
        this.collectionNodes = Collection.rootCollections.map(child => new CollectionNode(Collection.byID(child)!));
        this.initCollectionRootNode();
		this.radioStationsRootNode = new TreeViewChildNode({
			labelText: "Radio Stations",
			iconName: "radio",
			expanded: true,
		});
        this.treeView = new TreeView(element, [
            new TreeViewChildNode({
                labelText: "Local library",
                iconName: "library-music",
                onClick: () => this.localLibraryClick(),
                // children: [
                //     new TreeViewChildNode({
                //         labelText: "All music",
                //         iconName: "album",
                //         onClick: () => this.albumsClick()
                //     }),
                // ]
            }),
            this.collectionTreeNode,
            // new TreeViewChildNode({
            //     labelText: "Playlists",
            //     iconName: "playlist-music",
            //     children: [
            //         new TreeViewChildNode({
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