import { Menu, MenuSystem } from "./menu.ts";
import { showReleaseNotesDialog } from "./releasenotes.ts";

declare const playver: HTMLDialogElement;

export class MenuBar {
    private static rootElement: HTMLDivElement;

    private static optionsButton: HTMLButtonElement;
    private static toolsButton: HTMLButtonElement;
    private static helpButton: HTMLButtonElement;

    private static menu: Menu = {
        menuitems: [
            {
                kind: "item",
                html: "Options",
                submenu: {
                    menuitems: [
                        {
                            kind: "item",
                            html: "Rescan library"
                        },
                        // { kind: "separator" },
                        // {
                        //     kind: "item",
                        //     html: "Preferences"
                        // },
                    ]
                }
            },
            // {
            //     kind: "item",
            //     html: "Tools",
            //     submenu: {
            //         menuitems: [
            //             {
            //                 kind: "item",
            //                 html: "Cassette Recorder"
            //             }
            //         ]
            //     }
            // },
            {
                kind: "item",
                html: "Help",
                submenu: {
                    menuitems: [
                        // {
                        //     kind: "item",
                        //     html: "View tutorial"
                        // },
                        {
                            kind: "item",
                            html: "Release notes",
                            click: () => showReleaseNotesDialog()
                        },
                        { kind: "separator" },
                        {
                            kind: "item",
                            html: "About",
                            click: () => playver.showModal()
                        },
                    ]
                }
            }
        ]
    };

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(element: HTMLDivElement) {
        this.rootElement = element;

        MenuSystem.createMenuBar(this.rootElement, this.menu);
    }
}