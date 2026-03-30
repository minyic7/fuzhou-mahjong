import { useState } from "react";
import { TileView } from "./Tile";
import type { TileInstance } from "@fuzhou-mahjong/shared";
import { Suit } from "@fuzhou-mahjong/shared";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { useWindowSize } from "../hooks/useWindowSize";

/* Helper to create demo TileInstance objects for display */
function demoTile(id: number, tile: TileInstance["tile"]): TileInstance {
  return { id, tile };
}

const DEMO_WAN: TileInstance[] = [
  demoTile(200, { kind: "suited", suit: Suit.Wan, value: 1 }),
  demoTile(201, { kind: "suited", suit: Suit.Wan, value: 5 }),
  demoTile(202, { kind: "suited", suit: Suit.Wan, value: 9 }),
];
const DEMO_BING: TileInstance[] = [
  demoTile(203, { kind: "suited", suit: Suit.Bing, value: 2 }),
  demoTile(204, { kind: "suited", suit: Suit.Bing, value: 6 }),
  demoTile(205, { kind: "suited", suit: Suit.Bing, value: 8 }),
];
const DEMO_TIAO: TileInstance[] = [
  demoTile(206, { kind: "suited", suit: Suit.Tiao, value: 3 }),
  demoTile(207, { kind: "suited", suit: Suit.Tiao, value: 7 }),
  demoTile(208, { kind: "suited", suit: Suit.Tiao, value: 9 }),
];

const DEMO_FLOWERS: TileInstance[] = [
  demoTile(209, { kind: "season", seasonType: "spring" as any }),
  demoTile(210, { kind: "season", seasonType: "summer" as any }),
  demoTile(211, { kind: "plant", plantType: "plum" as any }),
  demoTile(212, { kind: "plant", plantType: "orchid" as any }),
];

const DEMO_SEQUENCE: TileInstance[] = [
  demoTile(213, { kind: "suited", suit: Suit.Tiao, value: 3 }),
  demoTile(214, { kind: "suited", suit: Suit.Tiao, value: 4 }),
  demoTile(215, { kind: "suited", suit: Suit.Tiao, value: 5 }),
];

const DEMO_TRIPLET: TileInstance[] = [
  demoTile(216, { kind: "suited", suit: Suit.Bing, value: 7 }),
  demoTile(217, { kind: "suited", suit: Suit.Bing, value: 7 }),
  demoTile(218, { kind: "suited", suit: Suit.Bing, value: 7 }),
];

const DEMO_PAIR: TileInstance[] = [
  demoTile(219, { kind: "suited", suit: Suit.Wan, value: 2 }),
  demoTile(220, { kind: "suited", suit: Suit.Wan, value: 2 }),
];

const DEMO_GOLD_INDICATOR: TileInstance = demoTile(221, { kind: "suited", suit: Suit.Wan, value: 3 });
const DEMO_GOLD_TILE: TileInstance = demoTile(222, { kind: "suited", suit: Suit.Wan, value: 4 });

interface SlideContent {
  title: string;
  titleEn: string;
  content: React.ReactNode;
}

function TileRow({ tiles, label }: { tiles: TileInstance[]; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {label && <span style={{ color: "var(--color-text-secondary)", fontSize: 13, minWidth: 28 }}>{label}</span>}
      {tiles.map((t) => (
        <TileView key={t.id} tile={t} small />
      ))}
    </div>
  );
}

const ALL_SLIDES: SlideContent[] = [
  {
    title: "牌型介绍",
    titleEn: "Tile Types",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          三种花色 (suits)，每种 1-9，各 4 张:
        </p>
        <TileRow tiles={DEMO_WAN} label="万" />
        <TileRow tiles={DEMO_BING} label="饼" />
        <TileRow tiles={DEMO_TIAO} label="条" />
      </div>
    ),
  },
  {
    title: "金牌 (Wild Tiles)",
    titleEn: "Gold Tiles",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          翻金牌确定百搭牌。金牌指示牌的下一张为百搭 (wild)。
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--color-text-secondary)", fontSize: 12, marginBottom: 4 }}>指示牌</div>
            <TileView tile={DEMO_GOLD_INDICATOR} small />
          </div>
          <span style={{ color: "var(--color-gold-bright)", fontSize: 20 }}>&rarr;</span>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--color-gold-bright)", fontSize: 12, marginBottom: 4 }}>金牌 (wild)</div>
            <div style={{ border: "2px solid var(--color-gold-bright)", borderRadius: 6, display: "inline-block", padding: 2 }}>
              <TileView tile={DEMO_GOLD_TILE} small />
            </div>
          </div>
        </div>
        <p style={{ color: "var(--color-error)", fontSize: 13 }}>
          打出金牌会受罚! 慎重出牌。
        </p>
      </div>
    ),
  },
  {
    title: "花牌",
    titleEn: "Flowers",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          花牌自动收集，计入花分。集齐 4 张同类花牌 = 花杠，额外加分。
        </p>
        <TileRow tiles={DEMO_FLOWERS} />
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
          共 36 张花牌: 春夏秋冬、梅兰竹菊、东南西北、中发白 (各 2 张)
        </p>
      </div>
    ),
  },
  {
    title: "动作",
    titleEn: "Actions",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <span style={{ color: "var(--color-action-chi)", fontWeight: 700 }}>吃 (Chi)</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}> — 取上家弃牌组成顺子</span>
          <div style={{ marginTop: 4 }}><TileRow tiles={DEMO_SEQUENCE} /></div>
        </div>
        <div>
          <span style={{ color: "var(--color-action-peng)", fontWeight: 700 }}>碰 (Peng)</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}> — 取弃牌组成刻子</span>
          <div style={{ marginTop: 4 }}><TileRow tiles={DEMO_TRIPLET} /></div>
        </div>
        <div>
          <span style={{ color: "var(--color-action-gang)", fontWeight: 700 }}>杠 (Gang)</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}> — 四张相同牌组成杠</span>
        </div>
        <div>
          <span style={{ color: "var(--color-action-hu)", fontWeight: 700 }}>胡 (Hu)</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}> — 赢!</span>
        </div>
      </div>
    ),
  },
  {
    title: "胡牌条件",
    titleEn: "Winning",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          组成 4 组 (顺子/刻子/杠) + 1 对将牌即可胡牌。
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <TileRow tiles={DEMO_SEQUENCE} />
          <span style={{ color: "var(--color-text-secondary)" }}>+</span>
          <TileRow tiles={DEMO_TRIPLET} />
          <span style={{ color: "var(--color-text-secondary)" }}>+ ... +</span>
          <TileRow tiles={DEMO_PAIR} />
        </div>
        <p style={{ color: "var(--color-gold-bright)", fontSize: 13 }}>
          特殊牌型有额外倍数: 对对胡、清一色、金雀、金龙等。
        </p>
      </div>
    ),
  },
  {
    title: "计分",
    titleEn: "Scoring Basics",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          基本公式:
        </p>
        <div style={{
          background: "rgba(255,215,0,0.08)",
          border: "1px solid rgba(255,215,0,0.25)",
          borderRadius: 8,
          padding: "10px 14px",
          textAlign: "center",
        }}>
          <span style={{ color: "var(--color-gold-bright)", fontSize: 16, fontWeight: 700 }}>
            (花分 + 连庄 + 5) x 2
          </span>
        </div>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          自摸 (self-draw) = 三家各付全额，总计 3x。
        </p>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
          金牌加倍。特殊牌型有独立倍率。
        </p>
      </div>
    ),
  },
];

// Condensed version for first-game overlay: slides 0, 3, 4
const CONDENSED_INDICES = [0, 3, 4];

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  condensed?: boolean;
}

export function TutorialModal({ open, onClose, condensed }: TutorialModalProps) {
  const slides = condensed
    ? CONDENSED_INDICES.map((i) => ALL_SLIDES[i])
    : ALL_SLIDES;
  const [currentSlide, setCurrentSlide] = useState(0);
  const { height } = useWindowSize();

  if (!open) return null;

  const isCompact = height <= BREAKPOINTS.COMPACT_HEIGHT;
  const slide = slides[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === slides.length - 1;

  const goNext = () => { if (!isLast) setCurrentSlide((s) => s + 1); };
  const goPrev = () => { if (!isFirst) setCurrentSlide((s) => s - 1); };

  return (
    <div
      className="tutorial-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--z-tutorial)",
        animation: "overlayFadeIn 0.2s ease-out",
        padding: 16,
      }}
    >
      <div
        className="tutorial-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--overlay-bg)",
          border: "2px solid var(--color-gold-border-hover)",
          borderRadius: 12,
          padding: isCompact ? "12px 16px" : "20px 24px",
          maxWidth: 480,
          width: "100%",
          maxHeight: isCompact ? "95dvh" : "85dvh",
          overflowY: "auto",
          position: "relative",
          animation: "overlayScaleIn 0.25s ease-out",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close tutorial"
          style={{
            position: "absolute",
            top: "clamp(8px, 2dvh, 16px)",
            right: "clamp(8px, 2dvh, 16px)",
            background: "transparent",
            border: "none",
            color: "var(--color-text-secondary)",
            fontSize: 22,
            cursor: "pointer",
            padding: "4px 8px",
            minHeight: 44,
            minWidth: 44,
            lineHeight: 1,
          }}
        >
          X
        </button>

        {/* Slide title */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ color: "var(--color-text-gold)", fontSize: 20, marginBottom: 2 }}>
            {slide.title}
          </h3>
          <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{slide.titleEn}</span>
        </div>

        {/* Slide content */}
        <div key={currentSlide} style={{ animation: "tutorialSlideIn 0.25s ease-out", minHeight: "clamp(80px, 30dvh, 120px)" }}>
          {slide.content}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: isCompact ? 12 : 20 }}>
          <button
            onClick={goPrev}
            disabled={isFirst}
            style={{
              padding: isCompact ? "6px 12px" : "8px 18px",
              fontSize: isCompact ? 13 : 14,
              background: isFirst ? "transparent" : "var(--color-bg-button)",
              border: isFirst ? "1px solid transparent" : "1px solid var(--color-bg-button-hover)",
              minHeight: 44,
              minWidth: 44,
            }}
          >
            上一页
          </button>

          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 0 }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  minHeight: "auto",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: i === currentSlide ? "var(--color-text-gold)" : "var(--color-gold-border)",
                  display: "block",
                  transition: "background 0.2s",
                }} />
              </button>
            ))}
          </div>

          {isLast ? (
            <button
              onClick={onClose}
              style={{
                padding: isCompact ? "6px 12px" : "8px 18px",
                fontSize: isCompact ? 13 : 14,
                background: "var(--color-bg-button)",
                border: "1px solid var(--color-text-gold)",
                color: "var(--color-gold-bright)",
                minHeight: 44,
                minWidth: 44,
              }}
            >
              知道了
            </button>
          ) : (
            <button
              onClick={goNext}
              style={{
                padding: isCompact ? "6px 12px" : "8px 18px",
                fontSize: isCompact ? 13 : 14,
                minHeight: 44,
                minWidth: 44,
              }}
            >
              下一页
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
