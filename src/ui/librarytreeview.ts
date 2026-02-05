import { MusicBrowserView } from "./musicbrowserview.ts";
import { Collection, Library } from "../collection.ts";
import { TreeView, TreeViewChildNode, TreeViewChildNodeClickHandler } from "./treeview.ts";
import { AlbumDisplay } from "./albumdisplay.ts";

export class CollectionNode {
    collection: Collection;
    treeViewNode: TreeViewChildNode;
    children: CollectionNode[];

    constructor(collection: Collection) {
        this.collection = collection;
        this.children = collection.collections.map(collection => new CollectionNode(collection));
        this.treeViewNode = new TreeViewChildNode({
            labelText: this.collection.name,
            iconName: "mdi:music-box-multiple",
            children: this.children.map(child => child.treeViewNode),
            onClick: () => this.click(),
        });
    }

    click() {
        MusicBrowserView.setCollection(this.collection);
        AlbumDisplay.hide();
        MusicBrowserView.show();
    }

    collectionsClickHandler: TreeViewChildNodeClickHandler = function () {
        this.expandToggle();
    }
}

export class LibraryTreeView {
    treeView: TreeView;
    collections: Collection[];
    collectionNodes: CollectionNode[];

    constructor(element: HTMLElement, collections: Collection[]) {
        this.collections = collections;
        this.collectionNodes = this.collections.map(collection => new CollectionNode(collection));
        this.treeView = new TreeView(element, [
            new TreeViewChildNode({
                labelText: "Local Library",
                iconName: "mdi:library-music",
                onClick: () => this.localLibraryClick(),
                // children: [
                //     new TreeViewChildNode({
                //         labelText: "All music",
                //         iconName: "mdi:album",
                //         onClick: () => this.albumsClick()
                //     }),
                // ]
            }),
            new TreeViewChildNode({
                labelText: "Collections",
                iconName: "mdi:music-box-multiple",
                children: this.collectionNodes.map(node => node.treeViewNode)
            }),
            new TreeViewChildNode({
                labelText: "Playlists",
                iconName: "mdi:playlist-music",
                children: [
                    new TreeViewChildNode({
                        labelText: "Study beats",
                        iconName: "mdi:playlist-music",
                    })
                ]
            }),
        ]);
    }

    localLibraryClick() {
        MusicBrowserView.setCollection(null);
        AlbumDisplay.hide();
        MusicBrowserView.show();
    }
}

export function init() {
    const sidebar: HTMLElement = document.querySelector(".sidebar")!;
    new LibraryTreeView(sidebar, Library.collections);
}