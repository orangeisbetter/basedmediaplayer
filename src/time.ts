export function convertTime(time: number) {
    const negative = time < 0;
    if (negative) {
        time = -time;
    }
    const seconds = Math.floor(time) % 60;
    const minutes = Math.floor(time / 60) % 60;
    const hours = Math.floor(time / 60 / 60) % 24;
    const days = Math.floor(time / 60 / 60 / 24);

    if (hours > 0) {
        return `${negative ? "-" : ""}${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    } else {
        return `${negative ? "-" : ""}${minutes}:${String(seconds).padStart(2, '0')}`;
    }
}