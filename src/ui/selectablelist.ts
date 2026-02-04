type Index = number;

interface SelectableListOptions {
    items?: string;
}

export class SelectableList {
    private static lists = new Set<SelectableList>();
    private static active: SelectableList | null = null;

    static register(container: HTMLElement, opts: SelectableListOptions = {}) {
        const list = new SelectableList(container, opts);
        this.lists.add(list);
        return list;
    }

    static clearAllExcept(list: SelectableList | null) {
        for (const l of this.lists) {
            if (l !== list) l.clear();
        }
    }

    static clearActive() {
        this.active?.clear();
    }

    static selectAll() {
        this.active?.selectAll();
    }

    private container: HTMLElement;
    private selector: string;
    private items: HTMLElement[] = [];

    private selected = new Set<HTMLElement>();
    private anchor: HTMLElement | null = null;

    private observer: MutationObserver;

    private constructor(container: HTMLElement, opts: SelectableListOptions) {
        this.container = container;
        this.selector = opts.items ?? ':scope > *';

        this.refreshItems();

        this.container.addEventListener('mousedown', this.onMouseDown);
        this.container.addEventListener('click', this.onClick);

        this.observer = new MutationObserver(this.onMutate);
        this.observer.observe(container, { childList: true });
    }

    /* ---------------- public API ---------------- */

    /**
     * Gets the selected indices of the list.
     * This function returns the indices in ascending order.
     * @returns The selected indices of the list, in ascending order.
     */
    getSelected(): Index[] {
        return this.items
            .map((el, i) => (this.selected.has(el) ? i : -1))
            .filter(i => i !== -1);
    }

    /**
     * Clear the selection of the list.
     */
    clear() {
        for (const el of this.selected) {
            el.classList.remove('selected');
        }
        this.selected.clear();
        this.clearAnchor();
    }

    /**
     * Select all the elements of the list. This does not affect the anchor element.
     */
    selectAll() {
        for (const el of this.items) {
            if (this.selected.has(el)) continue;
            this.selected.add(el);
            el.classList.add('selected');
        }
    }

    /* ---------------- internals ---------------- */

    private refreshItems() {
        const next = Array.from(this.container.querySelectorAll<HTMLElement>(this.selector));

        for (const el of this.selected) {
            if (!next.includes(el)) {
                el.classList.remove('selected');
                this.selected.delete(el);
            }
        }

        if (this.anchor && !next.includes(this.anchor)) {
            this.clearAnchor();
        }

        this.items = next;
    }

    private activate() {
        if (SelectableList.active !== this) {
            SelectableList.clearAllExcept(this);
            SelectableList.active = this;
        }
    }

    private findItem(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null;
        return this.items.find(el => el.contains(target)) ?? null;
    }

    /* ---------------- events ---------------- */

    private onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;

        const item = this.findItem(e.target);
        if (!item) return;

        this.activate();
        // no selection mutation here — reserved for drag logic later
    };

    private onClick = (e: MouseEvent) => {
        if (e.button !== 0) return;

        const item = this.findItem(e.target);
        if (!item) return;

        const shift = e.shiftKey;
        const ctrl = e.ctrlKey || e.metaKey;

        if (shift) {
            this.rangeSelect(item, ctrl);
        } else if (ctrl) {
            this.toggle(item);
        } else {
            this.replaceSelection(item);
        }

        // anchor is ALWAYS updated on completed click
        this.setAnchor(item);

        e.preventDefault();
    };

    /* ---------------- selection ops ---------------- */

    private replaceSelection(item: HTMLElement) {
        this.clear();
        this.select(item);
    }

    private toggle(item: HTMLElement) {
        if (this.selected.has(item)) {
            this.deselect(item);
        } else {
            this.select(item);
        }
    }

    private rangeSelect(item: HTMLElement, invert: boolean) {
        if (!this.anchor) {
            this.replaceSelection(item);
            return;
        }

        const a = this.items.indexOf(this.anchor);
        const b = this.items.indexOf(item);
        if (a === -1 || b === -1) return;

        const [start, end] = a < b ? [a, b] : [b, a];

        for (let i = start; i <= end; i++) {
            const el = this.items[i];
            if (invert) {
                this.toggle(el);
            } else {
                this.select(el);
            }
        }
    }

    private select(el: HTMLElement) {
        if (this.selected.has(el)) return;
        this.selected.add(el);
        el.classList.add('selected');
    }

    private deselect(el: HTMLElement) {
        if (!this.selected.has(el)) return;
        this.selected.delete(el);
        el.classList.remove('selected');
    }

    private setAnchor(el: HTMLElement | null) {
        if (this.anchor === el) return;

        if (this.anchor) {
            this.anchor.classList.remove('anchor');
        }

        this.anchor = el;

        if (this.anchor) {
            this.anchor.classList.add('anchor');
        }
    }

    private clearAnchor() {
        this.setAnchor(null);
    }

    private onMutate = () => {
        this.refreshItems();
    };
}