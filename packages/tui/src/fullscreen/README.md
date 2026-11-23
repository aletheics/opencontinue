# fullscreen

**Why:** the alternate-screen renderer needs viewport math that is independent of Ink, so scrolling and height allocation are deterministic and testable.

**Files:**

- `layout.ts` — tail-following transcript windows, clamped scroll offsets, and fixed-region height allocation.

**Rule:** no rendering here. `components/FullscreenTranscript.tsx` draws a window; `index.tsx` owns the alternate screen, scroll state, and layout regions.

**Tests:** `layout.test.ts` covers tail following, scrolled windows, clamping, and minimum viewport height.
