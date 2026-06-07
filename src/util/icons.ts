export function changeIcon(svg: SVGElement, iconName: string) {
    const use = svg.querySelector("use")!;
    use.setAttribute("href", `#icon-${iconName}`);
}