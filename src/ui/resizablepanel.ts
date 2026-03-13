export class ResizablePanels {
    static init() {
        const panels: NodeListOf<HTMLDivElement> = document.querySelectorAll(".resizable-panel");

        for (const panel of panels) {
            const handle: HTMLDivElement | null = panel.querySelector(".resize-handle");

            // Ignore if no handle
            if (handle === null) continue;

            handle.addEventListener("mousedown", event => {
                event.preventDefault();

                handle.classList.add("dragging");
                document.body.style.cursor = "ew-resize";

                const startX = event.clientX;
                // const startY = event.clientY;

                const startWidth = panel.clientWidth;
                // const startHeight = panel.clientHeight;

                const mousemove = (event: MouseEvent) => {
                    const diffX = event.clientX - startX;
                    // const diffY = event.clientY - startY;

                    if (panel.classList.contains("resize-left")) {
                        const minSize = Number(panel.dataset.minSize ?? 0);
                        const width = Math.max(minSize, startWidth - diffX);
                        panel.style.setProperty("--size", `${width}px`);
                    } else if (panel.classList.contains("resize-right")) {
                        const minSize = Number(panel.dataset.minSize ?? 0);
                        const width = Math.max(minSize, startWidth + diffX);
                        panel.style.setProperty("--size", `${width}px`);
                    }
                };

                const mouseup = () => {
                    handle.classList.remove("dragging");
                    document.removeEventListener("mousemove", mousemove);
                    document.removeEventListener("mouseup", mouseup);
                    document.body.style.cursor = "";
                }

                document.addEventListener("mousemove", mousemove);
                document.addEventListener("mouseup", mouseup);
            });

            handle.addEventListener("dblclick", event => {
                event.preventDefault();

                if (panel.classList.contains("resize-left") || panel.classList.contains("resize-right")) {
                    const defaultSize = Number(panel.dataset.defaultSize ?? 0);
                    panel.style.setProperty("--size", `${defaultSize}px`);
                }
            })
        }
    }
}