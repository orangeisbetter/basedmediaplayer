import { changeIcon } from "../util/icons.ts";
import { Menu, MenuSystem } from "./menu.ts";

declare const tree_list_item: HTMLTemplateElement;

export type TreeViewChildNodeClickHandler = (this: TreeListNode, event: PointerEvent) => void;

export class TreeListList {
	element!: HTMLElement;
	
	readonly items: TreeListNode[] = [];
	readonly parentItem: TreeListNode | null;

	constructor(element: HTMLElement, children?: TreeListNode[], parentItem?: TreeListNode) {
		this.element = element;
		this.parentItem = parentItem ?? null;
		for (const child of children ?? []) {
			this.add(child);
		}
	}

	add(item: TreeListNode) {
		this.element.appendChild(item.element);
		this.items.push(item);
		item.parentList = this;
	}

	remove(item: TreeListNode): boolean {
		const index = this.items.indexOf(item);
		if (index === -1) return false;

		this.items.splice(index, 1);
		item.element.remove();
		item.parentList = null;
		return true;
	}
}

type TreeViewItemOptions = {
	children?: TreeListNode[],
	iconName?: string,
	labelText: string,
	expanded?: boolean,
	onClick?: TreeViewChildNodeClickHandler,
	contextMenu?: Menu
};

export class TreeListNode {
	element!: HTMLElement;
	labelElement!: HTMLElement;
	private _label?: string;
	private _expanded?: boolean;

	readonly childList: TreeListList;
	parentList: TreeListList | null;

	constructor(options: TreeViewItemOptions) {
		const childrenElement = this.createElement(options);
		this.parentList = null;
		this.childList = new TreeListList(childrenElement, options.children, this);
		this.label = options.labelText;
		this.expanded = options.expanded ?? false;
	}

	remove() {
		this.parentList?.remove(this);
	}
	
	expandToggle() {
		this.expanded = !this.expanded;
	}
	
	get label() {
		return this._label!;
	}
	set label(text: string) {
		this._label = text;
		this.labelElement.textContent = text;
	}
	
	get expanded() {
		return this._expanded!;
	}
	set expanded(expanded: boolean) {
		this._expanded = expanded;
		if (expanded) {
			this.element.setAttribute("data-expanded", "");
		} else {
			this.element.removeAttribute("data-expanded");
		}
	}
	
	private createElement(options: { iconName?: string, onClick?: TreeViewChildNodeClickHandler, contextMenu?: Menu }): HTMLElement {
		this.element = document.importNode(tree_list_item.content, true).firstElementChild as HTMLElement;
		
		const icon = this.element.querySelector("svg")!;
		if (options.iconName === undefined) {
			icon.remove();
		} else {
			changeIcon(icon, options.iconName);
		}
		
		const caret = this.element.querySelector(".caret")!;
		caret.addEventListener("click", this.expandToggle.bind(this));
		
		this.labelElement = this.element.querySelector(".label")!;
		
		if (options.onClick) {
			this.labelElement.classList.add("active");
			this.labelElement.addEventListener("click", options.onClick.bind(this));
		}
		
		if (options.contextMenu) {
			const row = this.element.querySelector(".row")!;
			MenuSystem.setContextMenu(row, options.contextMenu);
		}

		return this.element.querySelector("ul")!;
	}
}