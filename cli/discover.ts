/**
 * Syntactic discovery via ts-morph (no type-checking, no app execution).
 *
 * Extracts the two AST targets:
 *   (a) the component's `cva()` definition  → base / variants / defaults
 *   (b) every JSX usage of the component     → (variantProps, className, file, line)
 */

import path from "node:path"
import { Project, SyntaxKind, type Node, type JsxAttribute } from "ts-morph"

import type { CvaDefinition, RawUsage, ClassNameValue } from "./types.ts"

/** Build a ts-morph project over the target app's source (excludes deps/build). */
export function loadProject(absRoot: string): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, jsx: 1 /* Preserve */ },
  })
  project.addSourceFilesAtPaths([
    `${absRoot}/**/*.tsx`,
    `${absRoot}/**/*.ts`,
    `!${absRoot}/**/node_modules/**`,
    `!${absRoot}/**/.next/**`,
    `!${absRoot}/**/dist/**`,
  ])
  return project
}

/** Read a string-literal-ish node's text, or undefined if it isn't a static string. */
function literalText(node: Node | undefined): string | undefined {
  if (!node) return undefined
  const s = node.asKind(SyntaxKind.StringLiteral)
  if (s) return s.getLiteralText()
  const t = node.asKind(SyntaxKind.NoSubstitutionTemplateLiteral)
  if (t) return t.getLiteralText()
  return undefined
}

/** Convert a value's whitespace-collapsed string for class strings. */
function normalizeClassString(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

// Class-merge helpers whose all-static-string form is a static override.
const CLASS_HELPERS = new Set(["cn", "clsx", "cx", "classNames", "twMerge", "twJoin"])

/**
 * Resolve a `cn("a", "b")` / `clsx(...)` / `twMerge(...)` call to a static class
 * string IFF every argument is a string literal. Real shadcn code overwhelmingly
 * writes overrides as `className={cn("bg-blue-600 shadow-lg")}` — that is a static,
 * foldable override, not dynamic. If ANY argument is conditional/identifier/spread
 * (e.g. `cn(isLoading && "opacity-50", "w-full")`), return undefined → dynamic.
 */
function staticFromClassHelper(node: Node | undefined): string | undefined {
  const call = node?.asKind(SyntaxKind.CallExpression)
  if (!call) return undefined
  const callee = call.getExpression().getText()
  if (!CLASS_HELPERS.has(callee)) return undefined
  const args = call.getArguments()
  if (args.length === 0) return undefined
  const parts: string[] = []
  for (const arg of args) {
    const lit = literalText(arg)
    if (lit === undefined) return undefined // a non-literal arg ⇒ genuinely dynamic
    parts.push(lit)
  }
  return parts.join(" ")
}

/**
 * Find the cva definition for `component` by convention: a `const
 * <camel>Variants = cva(...)`. Match is case-insensitive on the component part
 * (Button → buttonVariants, Card → cardVariants, ...).
 */
export function findCvaDefinition(
  project: Project,
  component: string,
  absRoot: string,
): CvaDefinition | null {
  const wantName = `${component.toLowerCase()}variants`

  for (const sf of project.getSourceFiles()) {
    for (const decl of sf.getVariableDeclarations()) {
      if (decl.getName().toLowerCase() !== wantName) continue
      const init = decl.getInitializerIfKind(SyntaxKind.CallExpression)
      if (!init) continue
      if (init.getExpression().getText() !== "cva") continue

      const args = init.getArguments()
      const base = normalizeClassString(literalText(args[0]) ?? "")

      const variants: Record<string, Record<string, string>> = {}
      const groups: string[] = []
      const defaultVariants: Record<string, string> = {}

      const optsObj = args[1]?.asKind(SyntaxKind.ObjectLiteralExpression)
      if (optsObj) {
        const variantsObj = optsObj
          .getProperty("variants")
          ?.asKind(SyntaxKind.PropertyAssignment)
          ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
        if (variantsObj) {
          for (const groupProp of variantsObj.getProperties()) {
            const pa = groupProp.asKind(SyntaxKind.PropertyAssignment)
            if (!pa) continue
            const group = pa.getName().replace(/^["']|["']$/g, "")
            const groupObj = pa.getInitializerIfKind(
              SyntaxKind.ObjectLiteralExpression,
            )
            if (!groupObj) continue
            groups.push(group)
            variants[group] = {}
            for (const keyProp of groupObj.getProperties()) {
              const kpa = keyProp.asKind(SyntaxKind.PropertyAssignment)
              if (!kpa) continue
              const key = kpa.getName().replace(/^["']|["']$/g, "")
              const val = literalText(kpa.getInitializer())
              if (val !== undefined) variants[group][key] = normalizeClassString(val)
            }
          }
        }

        const defObj = optsObj
          .getProperty("defaultVariants")
          ?.asKind(SyntaxKind.PropertyAssignment)
          ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
        if (defObj) {
          for (const dp of defObj.getProperties()) {
            const dpa = dp.asKind(SyntaxKind.PropertyAssignment)
            if (!dpa) continue
            const g = dpa.getName().replace(/^["']|["']$/g, "")
            const v = literalText(dpa.getInitializer())
            if (v !== undefined) defaultVariants[g] = v
          }
        }
      }

      return {
        exportName: decl.getName(),
        base,
        variants,
        defaultVariants,
        groups,
        file: path.relative(absRoot, sf.getFilePath()),
      }
    }
  }
  return null
}

/** Extract a static string value from a JSX attribute, or undefined if dynamic/absent. */
function attrStaticString(attrInit: Node | undefined): string | undefined {
  if (!attrInit) return undefined
  const direct = literalText(attrInit)
  if (direct !== undefined) return direct
  const expr = attrInit.asKind(SyntaxKind.JsxExpression)?.getExpression()
  return literalText(expr)
}

/** Find every JSX usage of `<Component>` and read its variant props + className. */
export function findUsages(
  project: Project,
  component: string,
  def: CvaDefinition,
  absRoot: string,
): RawUsage[] {
  const usages: RawUsage[] = []

  for (const sf of project.getSourceFiles()) {
    const rel = path.relative(absRoot, sf.getFilePath())
    const opens = [
      ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ]
    for (const el of opens) {
      if (el.getTagNameNode().getText() !== component) continue

      const variantProps: Record<string, string | null> = {}
      let className: ClassNameValue = { kind: "none" }

      const attrByName = new Map<string, JsxAttribute>()
      for (const attr of el.getAttributes()) {
        const ja = attr.asKind(SyntaxKind.JsxAttribute)
        if (!ja) continue
        attrByName.set(ja.getNameNode().getText(), ja)
      }

      // variant-group props: explicit string > cva default > null(unknown/absent)
      for (const group of def.groups) {
        const ja = attrByName.get(group)
        if (!ja) {
          variantProps[group] = def.defaultVariants[group] ?? null
          continue
        }
        const v = attrStaticString(ja.getInitializer())
        variantProps[group] = v ?? null
      }

      // className
      const classAttr = attrByName.get("className")
      if (classAttr) {
        const init = classAttr.getInitializer()
        const direct = literalText(init)
        if (direct !== undefined) {
          className = { kind: "static", value: normalizeClassString(direct) }
        } else {
          const expr = init?.asKind(SyntaxKind.JsxExpression)?.getExpression()
          const staticInExpr = literalText(expr) ?? staticFromClassHelper(expr)
          if (staticInExpr !== undefined) {
            className = { kind: "static", value: normalizeClassString(staticInExpr) }
          } else if (expr) {
            className = { kind: "dynamic", raw: normalizeClassString(expr.getText()) }
          }
        }
      }

      usages.push({
        file: rel,
        line: el.getStartLineNumber(),
        variantProps,
        className,
      })
    }
  }

  // Stable ordering: by file, then line.
  usages.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1))
  return usages
}
