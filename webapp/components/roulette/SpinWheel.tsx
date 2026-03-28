"use client";

import { useEffect, useRef, useMemo } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import WheelItem from "./WheelItem";
import { cn } from "@/lib/utils";

export interface WheelItemData {
  id: string;
  label: string;
  sublabel?: string;
  emoji?: string;
  image?: string;
}

interface SpinWheelProps {
  label: string;
  items: WheelItemData[];
  selectedIndex: number;
  spinning: boolean;
  locked: boolean;
  onLocked: () => void;
  spinDuration: number; // ms (1500, 2200, 3000)
}

const ITEM_H = 64;
const VISIBLE = 3;
const VIEWPORT_H = ITEM_H * VISIBLE; // 192px
const REPEATS = 3;

export default function SpinWheel({
  label,
  items,
  selectedIndex,
  spinning,
  locked,
  onLocked,
  spinDuration,
}: SpinWheelProps) {
  const lockedRef = useRef(false);
  const fallbackRef = useRef<NodeJS.Timeout | null>(null);

  const totalItems = items.length * REPEATS;
  const stripH = totalItems * ITEM_H;

  // Centre the selected item in the viewport
  const centerOffset = Math.floor(VISIBLE / 2) * ITEM_H;
  // Target: land on the selected item in the middle repeat, centred in viewport
  const fullRotations = Math.ceil(spinDuration / 600);
  const targetY = -(
    items.length * ITEM_H * fullRotations +
    selectedIndex * ITEM_H -
    centerOffset
  );

  const y = useMotionValue(0);

  const springConfig = useMemo(() => {
    const t = spinDuration / 1000;
    return {
      stiffness: 60 / t,
      damping: 15 / Math.sqrt(t),
      mass: t * 0.6,
    };
  }, [spinDuration]);

  const springY = useSpring(y, springConfig);

  // Reset when not spinning
  useEffect(() => {
    if (!spinning && !locked) {
      lockedRef.current = false;
      y.jump(0);
    }
  }, [spinning, locked, y]);

  // Start spin
  useEffect(() => {
    if (spinning && !locked) {
      lockedRef.current = false;
      y.set(targetY);

      // Fallback timeout to guarantee lock
      fallbackRef.current = setTimeout(() => {
        if (!lockedRef.current) {
          lockedRef.current = true;
          onLocked();
        }
      }, spinDuration + 800);
    }
    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
  }, [spinning, locked, targetY, spinDuration, onLocked, y]);

  // Detect settle via polling velocity
  useEffect(() => {
    if (!spinning || locked) return;

    const checkInterval = setInterval(() => {
      const vel = Math.abs(springY.getVelocity());
      if (vel < 2 && !lockedRef.current) {
        lockedRef.current = true;
        clearInterval(checkInterval);
        onLocked();
      }
    }, 100);

    // Don't check too early
    const startDelay = setTimeout(() => {}, spinDuration * 0.6);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(startDelay);
    };
  }, [spinning, locked, springY, onLocked, spinDuration]);

  // Build repeated item list
  const repeatedItems = useMemo(() => {
    const arr: WheelItemData[] = [];
    for (let r = 0; r < REPEATS; r++) {
      for (const item of items) {
        arr.push(item);
      }
    }
    return arr;
  }, [items]);

  return (
    <div className="flex-1 min-w-0">
      {/* Label */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold">
          {label}
        </span>
        {spinning && !locked && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
            className="w-3 h-3 border border-rose/40 border-t-rose rounded-full"
          />
        )}
        {locked && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="text-[9px] uppercase tracking-wider font-bold text-rose bg-rose/10 px-2 py-0.5 rounded-full"
          >
            Locked
          </motion.span>
        )}
      </div>

      {/* Wheel container */}
      <motion.div
        animate={
          spinning && !locked
            ? {
                borderColor: ["rgba(227,107,138,0.2)", "rgba(227,107,138,0.7)", "rgba(227,107,138,0.2)"],
              }
            : locked
              ? { borderColor: "rgba(227,107,138,0.6)" }
              : { borderColor: "rgba(214,188,150,0.4)" }
        }
        transition={spinning && !locked ? { duration: 0.8, repeat: Infinity } : { duration: 0.3 }}
        className={cn(
          "relative rounded-2xl border-2 bg-white overflow-hidden",
          locked && "shadow-[0_0_25px_rgba(227,107,138,0.12)]",
        )}
        style={{ height: VIEWPORT_H }}
      >
        {/* Highlight bar */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none border-y-2 border-rose/25 bg-blush/20"
          style={{
            top: centerOffset,
            height: ITEM_H,
          }}
        />

        {/* Fade mask */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 25%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 25%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)",
            background: "linear-gradient(to bottom, white 0%, transparent 25%, transparent 75%, white 100%)",
          }}
        />

        {/* Scrolling strip */}
        <motion.div style={{ y: springY }}>
          {repeatedItems.map((item, i) => {
            const isTheOne = locked && i % items.length === selectedIndex;
            return (
              <WheelItem
                key={`${item.id}-${i}`}
                label={item.label}
                sublabel={item.sublabel}
                emoji={item.emoji}
                image={item.image}
                isSelected={isTheOne}
                isLocked={locked}
              />
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
