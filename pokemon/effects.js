// Shared celebration effects.

const CONFETTI_COLORS = ["#ffd447", "#ff6b6b", "#4dabf7", "#51cf66", "#cc5de8"];

// A container of falling confetti pieces; the caller places it and removes it afterwards.
export function makeConfetti(count = 40, className = "confetti") {
    const burst = document.createElement("div");
    burst.className = className;
    burst.setAttribute("aria-hidden", "true");
    for (let index = 0; index < count; index++) {
        const piece = document.createElement("span");
        piece.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
        piece.style.setProperty("--drift", ((Math.random() - 0.5) * 120).toFixed(0) + "px");
        piece.style.setProperty("--delay", (Math.random() * 0.3).toFixed(2) + "s");
        piece.style.setProperty("--spin", (Math.random() * 720 - 360).toFixed(0) + "deg");
        piece.style.backgroundColor = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
        burst.append(piece);
    }
    return burst;
}
