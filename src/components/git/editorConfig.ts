import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
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

export type HighlightTheme = "vscode-dark" | "monokai" | "dracula";

type HighlightTokens = {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  function: string;
  variable: string | null;
  constant: string;
};

const HIGHLIGHT_THEMES: Record<HighlightTheme, HighlightTokens> = {
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

export function readOnlyExtensions(highlightTheme: HighlightTheme) {
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

export function resolveLanguageId(languageId?: string, filePath?: string) {
  if (languageId) {
    return FILE_EXTENSIONS[languageId.toLowerCase()] ?? languageId.toLowerCase();
  }
  const extension = filePath?.split(".").pop()?.toLowerCase();
  return extension ? FILE_EXTENSIONS[extension] ?? extension : undefined;
}

export function languageExtension(languageId?: string, filePath?: string) {
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
