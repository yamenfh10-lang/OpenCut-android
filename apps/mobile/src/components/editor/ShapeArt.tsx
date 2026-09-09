import type { ShapeId } from "../../lib/presets";

// Sticker shapes as inline SVG (no copied assets, drawn from scratch).
export default function ShapeArt({
  shape,
  color,
  size = 120,
}: {
  shape: ShapeId;
  color: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    role: "img" as const,
    "aria-label": `${shape} sticker`,
  };
  switch (shape) {
    case "circle":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="44" fill={color} />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <polygon
            points="50,5 61,38 95,38 67,57 77,90 50,70 23,90 33,57 5,38 39,38"
            fill={color}
          />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <polygon points="10,40 60,40 60,25 90,50 60,75 60,60 10,60" fill={color} />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path
            d="M50 88 C20 62 8 44 8 30 C8 16 19 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C81 8 92 16 92 30 C92 44 80 62 50 88 Z"
            fill={color}
          />
        </svg>
      );
    case "rect":
    default:
      return (
        <svg {...common}>
          <rect x="8" y="8" width="84" height="84" rx="14" fill={color} />
        </svg>
      );
  }
}
