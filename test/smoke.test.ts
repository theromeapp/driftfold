/**
 * Smoke + ground-truth tests for the deterministic core.
 *
 * Per CLAUDE.md the hackathon bar is "runs without throwing", with a manual
 * spot-check guarding against silent clustering miscounts. We go one cheap step
 * further: assert the fixture's KNOWN cluster counts (DRIFT-MAP.md) so a miscount
 * fails CI instead of silently corrupting the demo. Run: `bun test`.
 */

import { describe, expect, test } from "bun:test"

import { discoverCluster } from "../cli/index.ts"
import { classify, partition, utilityCore } from "../cli/classify.ts"

const ROOT = "fixture"

describe("classify (appearance vs layout)", () => {
  test("appearance utilities fold", () => {
    for (const t of [
      "bg-blue-600",
      "hover:bg-blue-700",
      "text-white",
      "text-green-800",
      "rounded-full",
      "shadow-lg",
      "border-blue-500",
      "px-12",
      "bg-[#2563eb]",
      "text-xs",
    ]) {
      expect(classify(t)).toBe("appearance")
    }
  })

  test("layout utilities are kept", () => {
    for (const t of [
      "w-full",
      "mt-3",
      "ml-auto",
      "col-span-2",
      "-mt-2",
      "absolute",
      "z-10",
      "text-center", // alignment is layout, not appearance
      "gap-2",
    ]) {
      expect(classify(t)).toBe("layout")
    }
  })

  test("text-flow / overflow utilities are layout, not appearance", () => {
    // these share the text- prefix but control geometry — folding them into a
    // shared variant would force wrapping/truncation on every consumer.
    for (const t of [
      "text-nowrap",
      "text-wrap",
      "text-balance",
      "text-pretty",
      "text-ellipsis",
      "text-clip",
    ]) {
      expect(classify(t)).toBe("layout")
    }
    // but text color/size/weight remain appearance
    for (const t of ["text-white", "text-sm", "text-green-800"]) {
      expect(classify(t)).toBe("appearance")
    }
  })

  test("out-of-scope visual namespaces are kept (scope lock: fold only color/radius/shadow/padding)", () => {
    // intentional: DriftFold does not fold utilities it isn't scoped to reason
    // about. These stay at the call site rather than being mis-folded.
    for (const t of [
      "transition-colors",
      "duration-200",
      "ease-in-out",
      "animate-spin",
      "cursor-pointer",
      "backdrop-blur-sm",
    ]) {
      expect(classify(t)).toBe("layout")
    }
  })

  test("utilityCore strips modifiers, bracket-aware", () => {
    expect(utilityCore("hover:bg-blue-700")).toBe("bg-blue-700")
    expect(utilityCore("bg-[#2563eb]")).toBe("bg-[#2563eb]")
    expect(utilityCore("dark:hover:text-white")).toBe("text-white")
  })

  test("partition splits a mixed override", () => {
    const { appearance, layout } = partition([
      "bg-blue-600",
      "w-full",
      "rounded-full",
      "mt-3",
    ])
    expect(appearance.sort()).toEqual(["bg-blue-600", "rounded-full"])
    expect(layout.sort()).toEqual(["mt-3", "w-full"])
  })
})

describe("discover-cluster ground truth (fixture/DRIFT-MAP.md)", () => {
  test("Button: 6 clusters, 12 drift sites, 4 clean, 2 dynamic", () => {
    const r = discoverCluster("Button", ROOT)
    expect(r.summary.cluster_count).toBe(6)
    expect(r.summary.drift_sites).toBe(12)
    expect(r.summary.clean).toBe(4)
    expect(r.summary.dynamic).toBe(2)
    // top cluster (blue-primary) has 4 sites despite token reordering
    expect(r.clusters[0]?.site_count).toBe(4)
    // arbitrary-value twin clusters SEPARATELY (the merge moment)
    const arb = r.clusters.find((c) =>
      c.appearance_utils.some((u) => u.includes("[#2563eb]")),
    )
    expect(arb?.site_count).toBe(1)
    expect(arb?.appearance_utils).not.toContain("bg-blue-600")
  })

  test("Card: 2 clusters, 5 drift sites, 1 clean", () => {
    const r = discoverCluster("Card", ROOT)
    expect(r.summary.cluster_count).toBe(2)
    expect(r.summary.drift_sites).toBe(5)
    expect(r.summary.clean).toBe(1)
  })

  test("Badge: 2 clusters, 4 drift sites", () => {
    const r = discoverCluster("Badge", ROOT)
    expect(r.summary.cluster_count).toBe(2)
    expect(r.summary.drift_sites).toBe(4)
  })

  test("Input: clean wall — 0 clusters, 3 layout-only", () => {
    const r = discoverCluster("Input", ROOT)
    expect(r.summary.cluster_count).toBe(0)
    expect(r.summary.drift_sites).toBe(0)
    expect(r.summary.clean).toBe(3)
  })
})

describe("cn() override resolution (real-shadcn override forms)", () => {
  const CN_ROOT = "test/fixtures/cn-app"

  test("static-only cn(...) clusters; conditional cn(...) stays dynamic", () => {
    const r = discoverCluster("Button", CN_ROOT)
    // cn("a b c") and cn("a","b","c") are the same static set → one cluster, 2 sites
    expect(r.summary.cluster_count).toBe(1)
    expect(r.clusters[0]?.site_count).toBe(2)
    expect(r.clusters[0]?.appearance_utils).toEqual([
      "bg-blue-600",
      "hover:bg-blue-700",
      "text-white",
    ])
    // cn(busy && "opacity-50", "bg-red-600") has a conditional arg → untouchable
    expect(r.summary.dynamic).toBe(1)
  })
})
