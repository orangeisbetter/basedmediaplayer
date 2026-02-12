export interface MenuItem {
    kind: "item";
    html: string;
    click?: () => void;
    submenu?: Menu;
}

export interface MenuSeparator {
    kind: "separator";
}

export type MenuEntry = MenuItem | MenuSeparator;

export interface Menu {
    menuitems: MenuEntry[];
}

type MenuPosition =
    | { type: "direct"; x: number; y: number }
    | { type: "menubar"; rect: DOMRect }
    | { type: "submenu"; rect: DOMRect }
    | { type: "topbottom"; rect: DOMRect, x: number };

class MenuItemView {
    element: HTMLLIElement;
    item: MenuItem;
    parentMenu: MenuView;
    submenuView?: MenuView;
    timeout: number = 0;

    constructor(item: MenuItem, parentMenu: MenuView) {
        this.element = document.createElement("li");
        this.element.className = "menuitem";
        this.element.innerHTML = item.html;

        this.item = item;
        this.parentMenu = parentMenu;

        if (this.item.submenu) {
            this.element.classList.add("hasmenu");
            this.element.addEventListener("mouseenter", () => this.mouseEnter());
            this.element.addEventListener("mouseleave", () => this.mouseLeave());
        }

        this.element.addEventListener("click", () => this.clickHandler());
    }

    clickHandler() {
        this.item.click?.call(undefined);
        if (!this.item.submenu) {
            MenuSystem.closeAllMenus();
        }
    }

    getElement() {
        return this.element;
    }

    private mouseEnter() {
        if (this.submenuView && this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = 0;
        } else if (!this.submenuView && !this.timeout) {
            this.timeout = window.setTimeout(() => {
                this.timeout = 0;
                const rect = this.element.getBoundingClientRect();
                this.submenuView = new MenuView(this.item.submenu, { type: "submenu", rect }, this.parentMenu.source, this);
            }, 300);
        }
    }

    private mouseLeave() {
        if (this.submenuView && !this.timeout) {
            this.timeout = window.setTimeout(() => {
                this.timeout = 0;
                this.submenuView.remove();
                this.submenuView = null;
            }, 300);
        } else if (!this.submenuView && this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = 0;
        }
    }
}

class MenuSeparatorView {
    element: HTMLLIElement;

    constructor(separator: MenuSeparator) {
        this.element = document.createElement("li");
        this.element.className = "separator";

        void separator;
    }

    getElement() {
        return this.element;
    }
}

type MenuSource = "bar" | "context";

class MenuView {
    element: HTMLUListElement;
    items: MenuItemView[] = [];
    parent?: MenuView;
    source: MenuSource;

    constructor(menu: Menu, options: MenuPosition, source: MenuSource, parentItem?: MenuItemView) {
        this.element = document.createElement("ul");
        this.element.className = "menu";

        this.source = source;
        this.parent = parentItem?.parentMenu;

        for (const entry of menu.menuitems) {
            switch (entry.kind) {
                case "item": {
                    const item = new MenuItemView(entry, this);
                    this.element.appendChild(item.getElement());
                    this.items.push(item);
                } break;
                case "separator": {
                    const separator = new MenuSeparatorView(entry);
                    this.element.appendChild(separator.getElement());
                } break;
            }
        }

        // Make invisible
        this.element.style.top = "0";
        this.element.style.left = "0";

        // Append to DOM
        if (parentItem) {
            parentItem.element.appendChild(this.element);
        } else {
            document.body.appendChild(this.element);
        }

        const rect = this.element.getBoundingClientRect();

        switch (options.type) {
            case "direct":
                this.element.classList.add("direct");

                if (options.x + rect.width < window.innerWidth) {
                    this.element.style.left = `${options.x}px`;
                } else if (options.x - rect.width >= 0) {
                    this.element.style.left = `${options.x - rect.width}px`;
                } else {
                    this.element.style.left = "0px";
                }

                if (options.y + rect.height < window.innerHeight) {
                    this.element.style.top = `${options.y}px`;
                } else if (options.y - rect.height >= 0) {
                    this.element.style.top = `${options.y - rect.height}px`;
                } else {
                    this.element.style.top = "0px";
                }
                break;
            case "menubar":
                this.element.classList.add("menubar");

                this.element.style.left = `${options.rect.left}px`;

                if (options.rect.bottom + rect.height < window.innerHeight) {
                    this.element.style.top = `${options.rect.bottom}px`;
                } else if (options.rect.top - rect.height >= 0) {
                    this.element.style.top = `${options.rect.top - rect.height}px`;
                } else {
                    this.element.style.top = "0px";
                }
                break;
            case "submenu":
                this.element.classList.add("submenu");

                if (options.rect.x + options.rect.width - 3 + rect.width < window.innerWidth) {
                    this.element.style.left = `${options.rect.right - 3}px`;
                } else if (options.rect.x + 3 - rect.width >= 0) {
                    this.element.style.left = `${options.rect.left + 3 - rect.width}px`;
                } else {
                    this.element.style.left = "0px";
                }

                if (options.rect.y - 3 + rect.height < window.innerHeight) {
                    this.element.style.top = `${options.rect.top - 3}px`;
                } else if (options.rect.y + 3 - rect.height >= 0) {
                    this.element.style.top = `${options.rect.bottom - rect.height + 3}px`;
                } else {
                    this.element.style.top = "0px";
                }
                break;
            case "topbottom":
                this.element.classList.add("topbottom");
                break;
        }

        this.element.classList.add("visible");

        // Register click away
        const clickAway = (event: MouseEvent) => {
            if (!this.element.contains(event.target as Node)) {
                MenuSystem.closeAllMenus();
                document.removeEventListener("click", clickAway);
            }
        };

        document.addEventListener("click", clickAway);
    }

    getElement() {
        return this.element;
    }

    remove() {
        this.element.remove();
        if (!this.parent && this.source === "context") {
            MenuSystem.openMenu = null;
        }
        if (!this.parent && this.source === "bar") {
            MenuSystem.openMenu = null;
        }
    }
}

type MenuCallback = () => Menu | null;

export class MenuSystem {
    static contextMenuRegistry: WeakMap<Element, MenuCallback> = new WeakMap();
    static openMenu: MenuView = null;
    static activeMenuBarButton: HTMLButtonElement = null;

    static init() {
        document.addEventListener("contextmenu", event => this.onContextMenu(event));
    }

    static setContextMenu(element: Element, menu: MenuCallback) {
        this.contextMenuRegistry.set(element, menu);
    }

    static removeContextMenu(element: Element) {
        this.contextMenuRegistry.delete(element);
    }

    static createMenuBar(element: HTMLDivElement, menu: Menu) {
        element.className = "menubar";

        for (const entry of menu.menuitems) {
            if (entry.kind === "item") {
                const button = document.createElement("button");
                button.className = "menubar-item";
                button.innerHTML = entry.html;

                button.addEventListener("click", e => {
                    e.stopPropagation();

                    this.closeAllMenus();

                    if (entry.submenu) {
                        const rect = button.getBoundingClientRect();
                        this.openMenu = new MenuView(entry.submenu, { type: "menubar", rect }, "bar");
                        button.classList.add("open");
                        this.activeMenuBarButton = button;
                    }

                    entry.click?.call(undefined);
                });

                element.appendChild(button);
            }
        }
    }

    static closeAllMenus() {
        this.openMenu?.remove();
        if (MenuSystem.activeMenuBarButton !== null) {
            MenuSystem.activeMenuBarButton.classList.remove("open");
            MenuSystem.activeMenuBarButton = null;
        }
    }

    private static onContextMenu(event: PointerEvent) {
        if (this.openMenu) {
            this.openMenu.remove();
            return;
        };

        for (let element = event.target as Element | null; element; element = element.parentElement) {
            const menuCallback = this.contextMenuRegistry.get(element);
            if (!menuCallback) {
                continue;
            }

            const menu = menuCallback();
            if (!menu) {
                continue;
            }

            event.preventDefault();
            this.openMenu = new MenuView(menu, { type: "direct", x: event.clientX, y: event.clientY }, "context");
            return;
        }
    }
}