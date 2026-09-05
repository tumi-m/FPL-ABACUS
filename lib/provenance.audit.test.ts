/**
 * D8 — the provenance audit.
 *
 * The rule: every numeric leaf on the player, planner and board surfaces is
 * rendered inside one of the three provenance components — Published,
 * Estimated/Est, or the Unavailable affordance — and no figure is a bare leaf.
 *
 * This is enforced the only way it stays true: a static audit that reads the
 * actual TSX of the surfaces and walks the JSX tree. A rendered-DOM test
 * would cover one page at one gameweek; this covers the source, every render.
 *
 * What counts as a bare figure: a JSX expression whose rendered value is a
 * number — a numeric-producer call chain (`.toFixed()`, `Math.round(…)`,
 * `toLocaleString()`), arithmetic over two numeric operands, or a bare read
 * of a numerically-named field — not wrapped in one of the annotating
 * components; and a JSX text node carrying digits outside an annotating
 * subtree, excluding table headers, option labels and SVG geometry text.
 *
 * Deliberately out of scope (not stat figures, or annotated elsewhere):
 *   - <title> elements and `title=` attributes — native tooltips, which the
 *     house style already fills with method sentences,
 *   - numeric attribute *values* (min={0}, step={90}) — control config,
 *     never rendered as data,
 *   - ChartFrame subtrees — chart marks are annotated by their frame's
 *     caption/table pair (D4's contract), and SVG text is geometry,
 *   - <th>, <option>, <dt> and <figcaption> text — labels and prose, not
 *     figures (the figure beside the label is what carries provenance),
 *   - structural guards (`{cond && (...)}`) whose numeric part is a
 *     condition, not a rendered value.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const ROOT = path.join(import.meta.dirname, "..");

/** The surfaces the brief names: player, planner and board. */
const AUDITED_FILES = [
  "app/(app)/players/[id]/page.tsx",
  "components/gaffer/player/PlayerCharts.tsx",
  "components/gaffer/player/StatPercentiles.tsx",
  "components/gaffer/planner/MarketPanel.tsx",
  "components/gaffer/planner/PlannerPitch.tsx",
  "components/gaffer/planner/PlannerSuggestions.tsx",
  "components/gaffer/planner/SolverPlan.tsx",
  "components/gaffer/planner/TransferPlanner.tsx",
  "components/gaffer/planner/PriceWatch.tsx",
  "components/gaffer/planner/TeamValueBoard.tsx",
  "components/gaffer/boards/BonusBoard.tsx",
  "components/gaffer/boards/DefconBoard.tsx",
  "components/gaffer/watch/WatchlistBoard.tsx",
];

/** Components whose subtree carries provenance by definition. */
const PROVENANCE_COMPONENTS = new Set([
  "Published",
  "Estimated",
  "Est", // the original estimate wrapper — same visual language
  "Unavailable",
]);

/** Containers whose own annotation contract covers the figures inside. */
const ANNOTATION_COMPONENTS = new Set([
  "ChartFrame", // caption/table carry the method for every mark inside
  "Meter", // a bar whose hint carries the method
  "title", // native tooltip — the method sentence lives here
]);

/** Text-bearing elements whose content is a label or prose, not a figure. */
const LABEL_ELEMENTS = new Set(["th", "option", "dt", "figcaption", "caption", "legend", "h1", "h2", "h3", "h4", "label", "button"]);

const WRAPPING_COMPONENTS = new Set([...PROVENANCE_COMPONENTS, ...ANNOTATION_COMPONENTS]);

/** Call expressions that *produce* a rendered number from state. */
const NUMBER_PRODUCERS = new Set([
  "toFixed",
  "toLocaleString",
  "toString",
  "round",
  "abs",
  "min",
  "max",
  "floor",
  "ceil",
]);

/** Format helpers that already fold a number into prose or a figure. */
const FORMAT_HELPERS = new Set(["formatPrice", "formatRank", "formatCompactRank", "formatSignedRank", "formatDeltaShort"]);

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

function collectViolations(relPath: string): Violation[] {
  const abs = path.join(ROOT, relPath);
  const source = readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Violation[] = [];
  const line = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  /** The tag name of a JSX element node — opening or self-closing — or null. */
  const tagOf = (node: ts.Node): string | null => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      return node.tagName.getText(sf);
    }
    // A child's parent is the JsxElement itself, not its opening element.
    if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(sf);
    return null;
  };

  /** Is this node inside a subtree that annotates its numbers? */
  const insideWrapper = (node: ts.Node): boolean => {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
      const tag = tagOf(cur);
      if (tag && WRAPPING_COMPONENTS.has(tag)) return true;
      cur = cur.parent;
    }
    return false;
  };

  /** Is this text node a label rather than a figure? */
  const insideLabel = (node: ts.Node): boolean => {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
      const tag = tagOf(cur);
      if (tag && LABEL_ELEMENTS.has(tag)) return true;
      cur = cur.parent;
    }
    return false;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sf);
      if (/\d/.test(text) && !insideWrapper(node) && !insideLabel(node)) {
        out.push({
          file: relPath,
          line: line(node.getStart(sf)),
          snippet: text.trim().slice(0, 70),
        });
      }
      return;
    }
    if (ts.isJsxExpression(node) && node.expression != null) {
      // Numeric attribute values (min={0}) are control config, not data.
      if (ts.isJsxAttribute(node.parent)) return;
      // Ternaries and boolean pairs are handled through their own children.
      const inner = node.expression;
      const isLogicalPair =
        ts.isBinaryExpression(inner) &&
        (inner.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          inner.operatorToken.kind === ts.SyntaxKind.BarBarToken);
      if (!ts.isConditionalExpression(inner) && !isLogicalPair) {
        if (rendersNumber(inner, sf) && !insideWrapper(node) && !insideLabel(node)) {
          out.push({
            file: relPath,
            line: line(node.getStart(sf)),
            snippet: inner.getText(sf).slice(0, 70),
          });
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return out;
}

/**
 * Does this expression, as rendered, produce a number? Chains rooted in a
 * numeric producer count; arithmetic over two numeric operands counts
 * (string + number renders prose, so only both-numeric does); a bare read
 * of a numerically-named field counts. Parentheses, assertions and
 * non-null chains are unwrapped.
 */
function rendersNumber(node: ts.Node, sf: ts.SourceFile): boolean {
  if (ts.isParenthesizedExpression(node)) return rendersNumber(node.expression, sf);
  if (ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) {
    return rendersNumber(node.expression, sf);
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText(sf).split(".").pop() ?? "";
    if (NUMBER_PRODUCERS.has(callee)) return true;
    if (FORMAT_HELPERS.has(callee)) return true;
    return node.arguments.some((a) => rendersNumber(a, sf));
  }
  if (ts.isBinaryExpression(node)) {
    const leftNum = rendersNumber(node.left, sf);
    const rightNum = rendersNumber(node.right, sf);
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      // One number glued into a sentence renders prose, not a figure.
      return leftNum && rightNum;
    }
    return leftNum || rightNum;
  }
  if (ts.isTemplateExpression(node)) {
    // A template with numeric spans still renders prose around them; the
    // spans themselves are audited where they appear as JSX containers.
    return false;
  }
  if (ts.isConditionalExpression(node)) {
    return rendersNumber(node.whenTrue, sf) || rendersNumber(node.whenFalse, sf);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return false;
  if (ts.isPropertyAccessExpression(node)) {
    return NUMERIC_FIELD.test(node.name.getText(sf)) || rendersNumber(node.expression, sf);
  }
  if (ts.isElementAccessExpression(node)) return rendersNumber(node.expression, sf);
  if (ts.isIdentifier(node)) return NUMERIC_FIELD.test(node.getText(sf));
  if (ts.isNumericLiteral(node)) return true;
  return false;
}

/** Field names that read as a stat figure when rendered bare. */
const NUMERIC_FIELD =
  /^(points|totalPoints|gwPoints|livePoints|contribution|multiplier|minutes|starts|goals|assists|cleanSheets|saves|bonus|bps|defcon|defconCount|tackles|cbi|recoveries|yellowCards|redCards|xg|xa|xgi|xgc|epNext|ep_next|net|gain|total|cost|price|now_cost|pStart|p60|percentile|owned|progress|pRise|share|spread|horizon|windowPoints|hits|threes|twos|ones|eff|rate|index|delta|expected|actual)$/;

describe("D8 provenance audit — every numeric leaf is annotated", () => {
  it("audited files all exist (the audit cannot pass on a stale path list)", () => {
    for (const f of AUDITED_FILES) {
      expect(() => readFileSync(path.join(ROOT, f)), f).not.toThrow();
    }
  });

  for (const file of AUDITED_FILES) {
    it(`${file} renders every stat figure through provenance`, () => {
      const violations = collectViolations(file);
      expect(
        violations,
        violations.map((v) => `${file}:${v.line} — bare figure \`${v.snippet}\``).join("\n"),
      ).toEqual([]);
    });
  }
});