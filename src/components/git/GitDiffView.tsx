import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { yaml } from "@codemirror/lang-yaml";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import {
  applyChunkAction,
  buildThreeWayChunks,
  LineRange,
  MergeChunk,
  MergeChunkAction,
} from "./merge/threeWay";
import "./GitDiffView.css";

export type HighlightTheme = "vscode-dark" | "monokai" | "dracula";

export type GitDiffViewProps = {
  mode?: "two-way" | "three-way";
  baseText: string;
  compareText?: string;
  leftText?: string;
  rightText?: string;
  languageId?: string;
  filePath?: string;
  highlightTheme?: HighlightTheme;
  className?: string;
};

const EMPTY_STATE = "Select revisions to compare.";

const HIGHLIGHT_THEMES: Record<HighlightTheme, {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  function: string;
  variable: string | null;
  constant: string;
}> = {
  "vscode-dark": {
    comment: "#6A9955",
    keyword: "#C586C0",
    string: "#CE9178",
    number: "#B5CEA8",
    type: "#4EC9B0",
    function: "#DCDCAA",
    variable: "#9CDCFE",
    constant: "#569CD6",
  },
  monokai: {
    comment: "#75715e",
    keyword: "#66d9ef",
    string: "#e6db74",
    number: "#ae81ff",
    type: "#a6e22e",
    function: "#a6e22e",
    variable: "#f8f8f2",
    constant: "#66d9ef",
  },
  dracula: {
    comment: "#6272A4",
    keyword: "#FF79C6",
    string: "#F1FA8C",
    number: "#BD93F9",
    type: "#8BE9FD",
    function: "#50FA7B",
    variable: null,
    constant: "#BD93F9",
  },
};

function buildHighlightStyle(theme: HighlightTheme) {
  const tokens = HIGHLIGHT_THEMES[theme];
  const styles = [
    { tag: tags.comment, color: tokens.comment },
    { tag: tags.keyword, color: tokens.keyword },
    { tag: tags.controlKeyword, color: tokens.keyword },
    { tag: tags.controlOperator, color: tokens.keyword },
    { tag: tags.string, color: tokens.string },
    { tag: tags.special(tags.string), color: tokens.string },
    { tag: tags.number, color: tokens.number },
    { tag: tags.typeName, color: tokens.type },
    { tag: tags.className, color: tokens.type },
    { tag: tags.function(tags.variableName), color: tokens.function },
    { tag: tags.function(tags.propertyName), color: tokens.function },
    { tag: tags.constant(tags.name), color: tokens.constant },
    { tag: tags.constant(tags.variableName), color: tokens.constant },
    { tag: tags.bool, color: tokens.constant },
    { tag: tags.null, color: tokens.constant },
    { tag: tags.atom, color: tokens.constant },
  ];

  if (tokens.variable) {
    styles.push({ tag: tags.variableName, color: tokens.variable });
  }

  return HighlightStyle.define(styles);
}

const highlightStyles: Record<HighlightTheme, HighlightStyle> = {
  "vscode-dark": buildHighlightStyle("vscode-dark"),
  monokai: buildHighlightStyle("monokai"),
  dracula: buildHighlightStyle("dracula"),
};

function readOnlyExtensions(highlightTheme: HighlightTheme) {
  return [
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    syntaxHighlighting(highlightStyles[highlightTheme]),
  ];
}
const FILE_EXTENSIONS: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  json: "json",
  md: "md",
  markdown: "md",
  py: "py",
  python: "py",
  rs: "rs",
  rust: "rs",
  css: "css",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  c: "c",
  cc: "cpp",
  cxx: "cpp",
  cpp: "cpp",
  go: "go",
  java: "java",
};

function resolveLanguageId(languageId?: string, filePath?: string) {
  if (languageId) {
    return FILE_EXTENSIONS[languageId.toLowerCase()] ?? languageId.toLowerCase();
  }
  const extension = filePath?.split(".").pop()?.toLowerCase();
  return extension ? FILE_EXTENSIONS[extension] ?? extension : undefined;
}

function languageExtension(languageId?: string, filePath?: string) {
  const resolved = resolveLanguageId(languageId, filePath);
  switch (resolved) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return javascript({ typescript: resolved.startsWith("t") });
    case "json":
      return json();
    case "md":
      return markdown();
    case "py":
      return python();
    case "rs":
      return rust();
    case "css":
      return css();
    case "html":
      return html();
    case "yaml":
      return yaml();
    case "cpp":
    case "c":
      return cpp();
    case "go":
      return go();
    case "java":
      return java();
    default:
      return null;
  }
}

function useMergeView(
  docA: string,
  docB: string,
  active: boolean,
  baseExtensions: readonly unknown[],
  extraExtensions: readonly unknown[],
  viewRef: MutableRefObject<MergeView | null>
) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || !container) {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      return;
    }

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    viewRef.current = new MergeView({
      a: { doc: docA, extensions: [...baseExtensions, ...extraExtensions] },
      b: { doc: docB, extensions: [...baseExtensions, ...extraExtensions] },
      parent: container,
      highlightChanges: true,
      gutter: true,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [active, container, docA, docB, baseExtensions, extraExtensions, viewRef]);

  return setContainer;
}

function useUnifiedView(
  doc: string,
  original: string,
  active: boolean,
  showChanges: boolean,
  baseExtensions: readonly unknown[],
  extraExtensions: readonly unknown[],
  viewRef: MutableRefObject<EditorView | null>,
  onReady?: () => void
) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || !container) {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      return;
    }

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const extensions = [
      ...extraExtensions,
      ...(showChanges
        ? [
            unifiedMergeView({
              original,
              gutter: true,
              highlightChanges: true,
              mergeControls: false,
            }),
          ]
        : []),
    ];

    const state = EditorState.create({
      doc,
      extensions: [...baseExtensions, ...extensions],
    });

    viewRef.current = new EditorView({
      state,
      parent: container,
    });
    onReady?.();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [
    active,
    container,
    doc,
    original,
    showChanges,
    baseExtensions,
    extraExtensions,
    viewRef,
    onReady,
  ]);

  return setContainer;
}

type ArrowSegment = {
  id: string;
  side: "left" | "right";
  path: string;
  conflict: boolean;
};

type ControlItem = {
  id: string;
  top: number;
  left: number;
  conflict: boolean;
  hasLeft: boolean;
  hasRight: boolean;
  chunk: MergeChunk;
};

function lineRangeCenter(view: EditorView, range: LineRange): number {
  const startLine = Math.min(range.startLine + 1, view.state.doc.lines);
  const endLine = Math.min(range.endLine + 1, view.state.doc.lines);
  const start = view.state.doc.line(startLine);
  const end = view.state.doc.line(endLine);
  const startBlock = view.lineBlockAt(start.from);
  const endBlock = view.lineBlockAt(end.to);
  return (startBlock.top + endBlock.top + endBlock.height) / 2;
}

function buildArrowPath(x1: number, y1: number, x2: number, y2: number): string {
  const bend = Math.max(24, Math.min(80, Math.abs(x2 - x1) * 0.4));
  const c1x = x1 + (x2 > x1 ? bend : -bend);
  const c2x = x2 - (x2 > x1 ? bend : -bend);
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
}

export function GitDiffView({
  mode = "two-way",
  baseText,
  compareText,
  leftText,
  rightText,
  languageId,
  filePath,
  highlightTheme = "vscode-dark",
  className,
}: GitDiffViewProps) {
  const showTwoWay = mode === "two-way";
  const showThreeWay = mode === "three-way";

  const [baseDocState, setBaseDocState] = useState(baseText ?? "");
  const baseDoc = showThreeWay ? baseDocState : baseText ?? "";
  const compareDoc = compareText ?? "";
  const leftDoc = leftText ?? "";
  const rightDoc = rightText ?? "";

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const twoWayViewRef = useRef<MergeView | null>(null);
  const leftViewRef = useRef<EditorView | null>(null);
  const baseViewRef = useRef<EditorView | null>(null);
  const rightViewRef = useRef<EditorView | null>(null);
  const [arrowSegments, setArrowSegments] = useState<ArrowSegment[]>([]);
  const [controlItems, setControlItems] = useState<ControlItem[]>([]);
  const [chunkActions, setChunkActions] = useState<Record<string, MergeChunkAction>>({});
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const bumpLayout = useCallback(() => {
    setLayoutTick((tick) => tick + 1);
  }, []);

  const hasTwoWay = baseDoc.trim().length > 0 || compareDoc.trim().length > 0;
  const hasThreeWay =
    baseDoc.trim().length > 0 || leftDoc.trim().length > 0 || rightDoc.trim().length > 0;

  const langExtension = languageExtension(languageId, filePath);
  const extraExtensions = langExtension ? [langExtension] : [];
  const baseExtensions = readOnlyExtensions(highlightTheme);

  const twoWayRef = useMergeView(
    baseDoc,
    compareDoc,
    showTwoWay,
    baseExtensions,
    extraExtensions,
    twoWayViewRef
  );
  const leftRef = useUnifiedView(
    leftDoc,
    baseDoc,
    showThreeWay,
    true,
    baseExtensions,
    extraExtensions,
    leftViewRef,
    bumpLayout
  );
  const baseRef = useUnifiedView(
    baseDoc,
    baseDoc,
    showThreeWay,
    false,
    baseExtensions,
    extraExtensions,
    baseViewRef,
    bumpLayout
  );
  const rightRef = useUnifiedView(
    rightDoc,
    baseDoc,
    showThreeWay,
    true,
    baseExtensions,
    extraExtensions,
    rightViewRef,
    bumpLayout
  );

  const threeWayChunks = useMemo<MergeChunk[]>(
    () => (showThreeWay ? buildThreeWayChunks(baseDoc, leftDoc, rightDoc) : []),
    [showThreeWay, baseDoc, leftDoc, rightDoc]
  );

  useEffect(() => {
    setBaseDocState(baseText ?? "");
  }, [baseText]);

  useEffect(() => {
    setChunkActions((prev) => {
      const next: Record<string, MergeChunkAction> = {};
      for (const chunk of threeWayChunks) {
        if (prev[chunk.id]) {
          next[chunk.id] = prev[chunk.id];
        }
      }
      return next;
    });
    if (threeWayChunks.length > 0) {
      setSelectedChunkId((current) => current ?? threeWayChunks[0].id);
    } else {
      setSelectedChunkId(null);
    }
  }, [threeWayChunks]);

  useEffect(() => {
    if (!showThreeWay) {
      setArrowSegments([]);
      setControlItems([]);
      return;
    }

    const leftView = leftViewRef.current;
    const baseView = baseViewRef.current;
    const rightView = rightViewRef.current;
    const overlay = overlayRef.current;

    if (!leftView || !baseView || !rightView || !overlay) {
      return;
    }

    let frame = 0;

    const measure = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        const overlayRect = overlay.getBoundingClientRect();
        const leftRect = leftView.dom.getBoundingClientRect();
        const baseRect = baseView.dom.getBoundingClientRect();
        const rightRect = rightView.dom.getBoundingClientRect();

        const leftStartX = leftRect.right - overlayRect.left - 6;
        const rightStartX = rightRect.left - overlayRect.left + 6;
        const baseLeftX = baseRect.left - overlayRect.left + 6;
        const baseRightX = baseRect.right - overlayRect.left - 6;

        const segments: ArrowSegment[] = [];
        const controls: ControlItem[] = [];
        for (const chunk of threeWayChunks) {
          if (chunk.leftRange) {
            const y1 =
              lineRangeCenter(leftView, chunk.leftRange) + (leftRect.top - overlayRect.top);
            const y2 =
              lineRangeCenter(baseView, chunk.baseRange) + (baseRect.top - overlayRect.top);
            segments.push({
              id: `${chunk.id}-left`,
              side: "left",
              conflict: chunk.kind === "conflict",
              path: buildArrowPath(leftStartX, y1, baseLeftX, y2),
            });
          }
          if (chunk.rightRange) {
            const y1 =
              lineRangeCenter(rightView, chunk.rightRange) + (rightRect.top - overlayRect.top);
            const y2 =
              lineRangeCenter(baseView, chunk.baseRange) + (baseRect.top - overlayRect.top);
            segments.push({
              id: `${chunk.id}-right`,
              side: "right",
              conflict: chunk.kind === "conflict",
              path: buildArrowPath(rightStartX, y1, baseRightX, y2),
            });
          }

          const baseCenter =
            lineRangeCenter(baseView, chunk.baseRange) + (baseRect.top - overlayRect.top);
          controls.push({
            id: chunk.id,
            top: baseCenter,
            left: (baseRect.left + baseRect.right) / 2 - overlayRect.left,
            conflict: chunk.kind === "conflict",
            hasLeft: !!chunk.leftRange,
            hasRight: !!chunk.rightRange,
            chunk,
          });
        }

        setArrowSegments(segments);
        setControlItems(controls);
      });
    };

    const scrollTargets = [leftView.scrollDOM, baseView.scrollDOM, rightView.scrollDOM];
    scrollTargets.forEach((target) => target.addEventListener("scroll", measure));
    window.addEventListener("resize", measure);
    measure();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      scrollTargets.forEach((target) => target.removeEventListener("scroll", measure));
      window.removeEventListener("resize", measure);
    };
  }, [showThreeWay, threeWayChunks, layoutTick]);

  useEffect(() => {
    if (!showThreeWay || threeWayChunks.length === 0) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const currentIndex = Math.max(
        0,
        threeWayChunks.findIndex((chunk) => chunk.id === selectedChunkId)
      );
      const goToIndex = (nextIndex: number) => {
        const bounded = Math.min(Math.max(nextIndex, 0), threeWayChunks.length - 1);
        const chunk = threeWayChunks[bounded];
        setSelectedChunkId(chunk.id);
        if (baseViewRef.current) {
          const startLine = Math.min(chunk.baseRange.startLine + 1, baseViewRef.current.state.doc.lines);
          const pos = baseViewRef.current.state.doc.line(startLine).from;
          baseViewRef.current.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: "center" }),
          });
        }
      };

      switch (event.key) {
        case "n":
        case "ArrowDown":
          event.preventDefault();
          goToIndex(currentIndex + 1);
          break;
        case "p":
        case "ArrowUp":
          event.preventDefault();
          goToIndex(currentIndex - 1);
          break;
        case "l":
          event.preventDefault();
          if (threeWayChunks[currentIndex]?.leftRange) {
            handleChunkAction(threeWayChunks[currentIndex], "apply_left");
          }
          break;
        case "r":
          event.preventDefault();
          if (threeWayChunks[currentIndex]?.rightRange) {
            handleChunkAction(threeWayChunks[currentIndex], "apply_right");
          }
          break;
        case "i":
          event.preventDefault();
          if (threeWayChunks[currentIndex]?.kind !== "conflict") {
            handleChunkAction(threeWayChunks[currentIndex], "keep_base");
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showThreeWay, threeWayChunks, selectedChunkId]);

  const handleChunkAction = (chunk: MergeChunk, action: MergeChunkAction) => {
    if (action === "keep_base" || action === "manual") {
      setChunkActions((prev) => ({ ...prev, [chunk.id]: action }));
      return;
    }

    setChunkActions((prev) => ({ ...prev, [chunk.id]: action }));
    setBaseDocState((current) => applyChunkAction(current, leftDoc, rightDoc, chunk, action));
  };

  const containerClassName = className
    ? `git-diff-view ${className}`
    : "git-diff-view";

  if (showTwoWay && !hasTwoWay) {
    return (
      <section className={containerClassName}>
        <div className="git-diff-view__empty">{EMPTY_STATE}</div>
      </section>
    );
  }

  if (showThreeWay && !hasThreeWay) {
    return (
      <section className={containerClassName}>
        <div className="git-diff-view__empty">{EMPTY_STATE}</div>
      </section>
    );
  }

  return (
    <section className={containerClassName}>
      {showTwoWay ? <div ref={twoWayRef} className="git-diff-view__merge" /> : null}
      {showThreeWay ? (
        <div className="git-diff-view__three-way">
          <div className="git-diff-view__grid git-diff-view__grid--three">
            <div ref={leftRef} className="git-diff-view__merge" />
            <div ref={baseRef} className="git-diff-view__merge" />
            <div ref={rightRef} className="git-diff-view__merge" />
          </div>
          <div ref={overlayRef} className="git-diff-view__overlay">
            <svg className="git-diff-view__arrows" aria-hidden="true">
              <defs>
                <marker
                  id="git-diff-arrow-left"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" />
                </marker>
                <marker
                  id="git-diff-arrow-right"
                  markerWidth="6"
                  markerHeight="6"
                  refX="1"
                  refY="3"
                  orient="auto"
                >
                  <path d="M6,0 L0,3 L6,6 Z" />
                </marker>
              </defs>
              {arrowSegments.map((segment) => (
                <path
                  key={segment.id}
                  className={`git-diff-view__arrow git-diff-view__arrow--${segment.side} ${
                    segment.conflict ? "git-diff-view__arrow--conflict" : ""
                  }`}
                  d={segment.path}
                  markerEnd={
                    segment.side === "left"
                      ? "url(#git-diff-arrow-left)"
                      : "url(#git-diff-arrow-right)"
                  }
                />
              ))}
            </svg>
            <div className="git-diff-view__controls">
              {controlItems.map((item) => {
                const action = chunkActions[item.id] ?? item.chunk.action;
                const ignoreDisabled = item.conflict;
                const isSelected = item.id === selectedChunkId;
                return (
                  <div
                    key={item.id}
                    className={`git-diff-view__control ${
                      item.conflict ? "git-diff-view__control--conflict" : ""
                    } ${isSelected ? "git-diff-view__control--active" : ""}`}
                    style={{ top: item.top, left: item.left }}
                    onMouseEnter={() => setSelectedChunkId(item.id)}
                  >
                    <button
                      type="button"
                      className={`git-diff-view__action ${
                        action === "apply_left" ? "is-active" : ""
                      }`}
                      onClick={() => handleChunkAction(item.chunk, "apply_left")}
                      disabled={!item.hasLeft}
                    >
                      Apply Left
                    </button>
                    <button
                      type="button"
                      className={`git-diff-view__action ${
                        action === "keep_base" ? "is-active" : ""
                      }`}
                      onClick={() => handleChunkAction(item.chunk, "keep_base")}
                      disabled={ignoreDisabled}
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      className={`git-diff-view__action ${
                        action === "apply_right" ? "is-active" : ""
                      }`}
                      onClick={() => handleChunkAction(item.chunk, "apply_right")}
                      disabled={!item.hasRight}
                    >
                      Apply Right
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
