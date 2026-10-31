// Draws the trainer card onto a canvas so it can be saved and shared as a PNG.

export const CARD_WIDTH = 540;
export const CARD_HEIGHT = 840;

// First colour of each region banner's gradient (see .region1 … .region9 in pokemon.css).
const REGION_COLORS = [
    "#b8322b",
    "#8a6d1c",
    "#1e6f8f",
    "#5a4c9c",
    "#3a3a3a",
    "#2f5fb3",
    "#c0502a",
    "#8c2c6e",
    "#2d7a4a",
];

const STYLES = {
    classic: {
        band: ["#ef4b4b", "#b11f1f"],
        body: ["#fdfbf3", "#efe7cf"],
        border: ["#ffd447", "#ffd447"],
        ink: "#1d2340",
        tile: "#ffffff",
        font: "Inter, Arial, sans-serif",
    },
    holo: {
        band: ["#7a3cff", "#ff7a3c"],
        body: ["#ffffff", "#f0ecff"],
        border: ["#ff6b9d", "#6bc5ff"],
        ink: "#1d2340",
        tile: "#ffffff",
        font: "Inter, Arial, sans-serif",
    },
    retro: {
        band: ["#306230", "#306230"],
        body: ["#9bbc0f", "#9bbc0f"],
        border: ["#0f380f", "#0f380f"],
        ink: "#0f380f",
        tile: "#8bac0f",
        font: '"Press Start 2P", monospace',
    },
};

function roundRect(context, x, y, width, height, radius, fill) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
}

function gradient(context, x0, y0, x1, y1, [from, to]) {
    const result = context.createLinearGradient(x0, y0, x1, y1);
    result.addColorStop(0, from);
    result.addColorStop(1, to);
    return result;
}

// card: { name, partnerName, seenText, facts: [[icon, label, value]], regions: [{ name, seen, total }], style }
// sprite: a loaded image of the partner, or null.
export function drawTrainerCard(canvas, card, sprite) {
    const style = STYLES[card.style] ?? STYLES.classic;
    const retro = card.style === "retro";
    const context = canvas.getContext("2d");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const font = (weight, size) => weight + " " + (retro ? Math.round(size * 0.6) : size) + "px " + style.font;

    roundRect(
        context,
        0,
        0,
        CARD_WIDTH,
        CARD_HEIGHT,
        28,
        gradient(context, 0, 0, CARD_WIDTH, CARD_HEIGHT, style.border),
    );
    roundRect(
        context,
        10,
        10,
        CARD_WIDTH - 20,
        CARD_HEIGHT - 20,
        20,
        gradient(context, 0, 0, 0, CARD_HEIGHT, style.body),
    );
    context.save();
    context.beginPath();
    context.roundRect(10, 10, CARD_WIDTH - 20, 76, [20, 20, 0, 0]);
    context.clip();
    context.fillStyle = gradient(context, 0, 0, CARD_WIDTH, 0, style.band);
    context.fillRect(10, 10, CARD_WIDTH - 20, 76);
    context.restore();

    context.fillStyle = "#ffffff";
    context.textBaseline = "middle";
    context.font = font("900", 30);
    context.fillText("TRAINER CARD", 34, 49);

    // Partner avatar
    context.beginPath();
    context.arc(100, 170, 64, 0, 2 * Math.PI);
    context.fillStyle = retro ? "#8bac0f" : gradient(context, 0, 106, 0, 234, ["#ffffff", "#7f9be0"]);
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = style.border[0];
    context.stroke();
    if (sprite) {
        context.imageSmoothingEnabled = false;
        context.drawImage(sprite, 36, 106, 128, 128);
    }

    context.fillStyle = style.ink;
    context.font = font("900", 34);
    context.fillText(card.name || "Trainer", 190, 150, CARD_WIDTH - 220);
    context.font = font("600", 18);
    if (card.partnerName) {
        context.fillText("Partner: " + card.partnerName, 190, 192, CARD_WIDTH - 220);
    }

    context.textAlign = "center";
    context.font = font("900", 22);
    context.fillText(card.seenText, CARD_WIDTH / 2, 272, CARD_WIDTH - 60);

    // Stat tiles, 3 × 2
    const tileWidth = (CARD_WIDTH - 40 - 2 * 12) / 3;
    card.facts.forEach(([icon, label, value], index) => {
        const x = 20 + (index % 3) * (tileWidth + 12);
        const y = 300 + Math.floor(index / 3) * 96;
        roundRect(context, x, y, tileWidth, 84, 14, style.tile);
        context.fillStyle = style.ink;
        context.font = font("400", 20);
        context.fillText(icon, x + tileWidth / 2, y + 18);
        context.font = font("900", 26);
        context.fillText(String(value), x + tileWidth / 2, y + 44);
        context.font = font("600", 13);
        context.fillText(label, x + tileWidth / 2, y + 68, tileWidth - 10);
    });

    // Region rows
    context.textAlign = "left";
    context.font = font("900", 20);
    context.fillText("Regions", 24, 512);
    card.regions.forEach(({ name, seen, total }, index) => {
        const y = 532 + index * 30;
        roundRect(context, 20, y, CARD_WIDTH - 40, 25, 7, REGION_COLORS[index] ?? "#555555");
        context.fillStyle = "#ffffff";
        context.font = font("700", 15);
        context.textAlign = "left";
        context.fillText(name, 32, y + 13);
        roundRect(context, 130, y + 9, 290, 7, 4, "rgba(0, 0, 0, 0.35)");
        if (seen) {
            roundRect(context, 130, y + 9, Math.max(7, (290 * seen) / total), 7, 4, "#ffd447");
        }
        context.fillStyle = "#ffffff";
        context.textAlign = "right";
        context.fillText(seen + "/" + total, CARD_WIDTH - 32, y + 13);
    });

    context.textAlign = "center";
    context.fillStyle = style.ink;
    context.font = font("600", 13);
    context.fillText("Gbot's Pokédex", CARD_WIDTH / 2, CARD_HEIGHT - 22);
}

// Resolves to the loaded image, or null if it can't be used on a canvas (missing, or no CORS).
export function loadCanvasImage(src) {
    return new Promise((resolve) => {
        if (!src) {
            resolve(null);
            return;
        }
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

export const FINALE_WIDTH = 1200;
export const FINALE_HEIGHT = 630;

// The "Pokédex complete" share image: a night sky, the title in gold, the starters lined up in
// three rows and the region legendaries in front. starters/legends: loaded images or nulls.
// byline: who did it ("Red & Pikachu"), or "" to leave it off.
export function drawFinaleCard(canvas, { dateText, byline }, starters, legends) {
    canvas.width = FINALE_WIDTH;
    canvas.height = FINALE_HEIGHT;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false; // crisp pixel sprites
    context.fillStyle = gradient(context, 0, 0, 0, FINALE_HEIGHT, ["#0b1030", "#3b2a6b"]);
    context.fillRect(0, 0, FINALE_WIDTH, FINALE_HEIGHT);
    const glow = context.createRadialGradient(600, 760, 40, 600, 760, 520);
    glow.addColorStop(0, "rgba(255, 212, 71, 0.5)");
    glow.addColorStop(1, "rgba(255, 212, 71, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, FINALE_WIDTH, FINALE_HEIGHT);
    // a scatter of stars (fixed pattern, so every image looks the same)
    context.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let index = 0; index < 70; index++) {
        context.fillRect((index * 397) % FINALE_WIDTH, (index * 151) % 330, 2, 2);
    }

    context.textAlign = "center";
    context.font = "900 64px inter, arial, sans-serif";
    context.fillStyle = "#b11f1f";
    context.fillText("🏆 Pokédex complete!", FINALE_WIDTH / 2, 98);
    context.shadowColor = "rgba(255, 212, 71, 0.8)";
    context.shadowBlur = 20;
    context.fillStyle = "#ffd447";
    context.fillText("🏆 Pokédex complete!", FINALE_WIDTH / 2, 92);
    context.shadowBlur = 0;
    context.font = "700 26px inter, arial, sans-serif";
    context.fillStyle = "#ffffff";
    context.fillText(
        (byline ? byline + " · " : "") + "1,025 / 1,025 Pokémon seen" + (dateText ? " · " + dateText : ""),
        FINALE_WIDTH / 2,
        138,
    );

    // 27 starters: three rows of nine, one column per region
    starters.forEach((image, index) => {
        if (image) {
            const column = Math.floor(index / 3);
            const row = index % 3;
            context.drawImage(image, 60 + column * 122, 160 + row * 74, 84, 84);
        }
    });
    // the nine legendaries along the bottom, bigger
    legends.forEach((image, index) => {
        if (image) {
            context.drawImage(image, 18 + index * 130, 392, 150, 150);
        }
    });

    context.font = "600 20px inter, arial, sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillText("Gbot's Pokédex", FINALE_WIDTH / 2, FINALE_HEIGHT - 26);
}
