declare const tree_list_item: HTMLTemplateElement;
declare const tree_list: HTMLTemplateElement;

export class TreeViewNode {
    children: TreeViewNode[];

    protected parent?: TreeViewNode;
    protected element: HTMLElement;
    protected childrenElement: HTMLUListElement;

    constructor(options: { children?: TreeViewNode[], elementOptions?: any }) {
        this.createElement(options.elementOptions);
        this.children = options.children ?? [];
        for (const child of this.children) {
            child.parent = this;
            this.childrenElement.appendChild(child.element);
        }
    }

    protected createElement(options?: any) {
        // Do nothing for super class
    }

    addChild(node: TreeViewNode) {
        this.childrenElement.appendChild(node.element);
        this.children.push(node);
        node.parent = this;
    }

    removeChild(node: TreeViewNode): boolean {
        const index = this.children.findIndex(child => child === node);
        if (index === -1) {
            return false;
        }
        this.children.splice(index, 1);
        node.element.remove();
        return false;
    }

    remove() {
        this.parent.removeChild(this);
    }
}

export type TreeViewChildNodeClickHandler = (this: TreeViewChildNode, event: PointerEvent) => any;

export class TreeViewChildNode extends TreeViewNode {
    children: TreeViewNode[];

    private labelElement: HTMLElement;
    private _label: string;
    private _expanded?: boolean;

    get label() {
        return this._label;
    }
    set label(text: string) {
        this._label = text;
        this.labelElement.textContent = text;
    }

    get expanded() {
        return this._expanded;
    }
    set expanded(expanded: boolean) {
        this._expanded = expanded;
        if (expanded) {
            this.element.setAttribute("data-expanded", "");
        } else {
            this.element.removeAttribute("data-expanded");
        }
    }

    constructor(options: { children?: TreeViewNode[], iconName?: string, labelText: string, expanded?: boolean, onClick?: TreeViewChildNodeClickHandler }) {
        super({ children: options.children, elementOptions: { iconName: options.iconName, onClick: options.onClick } });
        this.label = options.labelText;
        this.expanded = options.expanded ?? false;
    }

    protected createElement(options: { iconName?: string, onClick: TreeViewChildNodeClickHandler }) {
        this.element = document.importNode(tree_list_item.content, true).firstElementChild as HTMLElement;

        const icon = this.element.querySelector("iconify-icon");
        if (options.iconName === undefined) {
            icon.parentElement.remove();
        } else {
            icon.setAttribute("icon", options.iconName);
        }

        const caret = this.element.querySelector(".caret");
        caret.addEventListener("click", this.expandToggle.bind(this));

        this.labelElement = this.element.querySelector(".label");
        this.childrenElement = this.element.querySelector("ul");

        this.labelElement.addEventListener("click", options.onClick?.bind(this));
    }

    expandToggle() {
        this.expanded = !this.expanded;
    }
}

export class TreeView extends TreeViewNode {
    constructor(element: HTMLElement, children?: TreeViewNode[]) {
        super({ children: children });
        element.appendChild(this.element);
    }

    protected createElement() {
        this.element = document.importNode(tree_list.content, true).firstElementChild as HTMLElement;
        this.childrenElement = this.element.querySelector("ul");
    }
}