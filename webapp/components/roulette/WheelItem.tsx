"use client";

import { cn } from "@/lib/utils";

interface WheelItemProps {
  label: string;
  sublabel?: string;
  emoji?: string;
  image?: string;
  isSelected: boolean;
  isLocked: boolean;
}

export default function WheelItem({ label, sublabel, emoji, image, isSelected, isLocked }: WheelItemProps) {
  const highlighted = isSelected && isLocked;

  return (
    <div
      className={cn(
        "h-16 flex items-center gap-3 px-3 transition-colors duration-300",
        highlighted ? "bg-blush/25" : "bg-white",
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className={cn(
            "w-9 h-9 rounded-full object-cover shrink-0 ring-2 transition-all duration-300",
            highlighted ? "ring-rose" : "ring-blush/40",
          )}
          draggable={false}
        />
      ) : emoji ? (
        <span className="text-xl shrink-0 w-9 text-center">{emoji}</span>
      ) : (
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors duration-300",
            highlighted ? "bg-rose text-white" : "bg-blush/40 text-rose",
          )}
        >
          {label[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold truncate transition-colors duration-300",
            highlighted ? "text-rose" : "text-zinc-800",
          )}
        >
          {label}
        </p>
        {sublabel && (
          <p className="text-[10px] text-zinc-400 truncate">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
