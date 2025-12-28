export const BASE_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
}

export function buildHeaders() {
  return { "x-client": "parallel" };
}
`;

export const COMPARE_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "x-client": "parallel",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(
      "Request failed: " + payload
    );
  }
  return res.json();
}

export function buildHeaders() {
  return {
    "x-client": "parallel",
    "x-env": "storybook",
  };
}
`;

export const LEFT_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
}

export function buildHeaders() {
  return { "x-client": "parallel", "x-env": "left" };
}
`;

export const RIGHT_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "x-client": "parallel",
      "x-env": "right",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
}

export function buildHeaders() {
  return { "x-client": "parallel", "x-env": "right" };
}
`;

export const BASE_CONFLICT = `function pickColor(theme: string) {
  if (theme === "dark") {
    return "navy";
  }
  return "white";
}
`;

export const LEFT_CONFLICT = `function pickColor(theme: string) {
  if (theme === "dark") {
    return "midnightblue";
  }
  return "white";
}
`;

export const RIGHT_CONFLICT = `function pickColor(theme: string) {
  if (theme === "dark") {
    return "black";
  }
  return "ivory";
}
`;

export const BASE_LONG = [
  "export function buildTheme(tokens: Record<string, string>) {",
  "  const palette = {",
  "    background: tokens.background,",
  "    foreground: tokens.foreground,",
  "    accent: tokens.accent,",
  "    muted: tokens.muted,",
  "    border: tokens.border,",
  "  };",
  "",
  "  function pickTone(step: number) {",
  "    if (step < 3) {",
  "      return tokens.low;",
  "    }",
  "    if (step < 6) {",
  "      return tokens.mid;",
  "    }",
  "    return tokens.high;",
  "  }",
  "",
  "  const scales = Array.from({ length: 12 }, (_, index) => pickTone(index));",
  "",
  "  return {",
  "    palette,",
  "    scales,",
  "    text: {",
  "      headline: tokens.headline,",
  "      body: tokens.body,",
  "      caption: tokens.caption,",
  "    },",
  "  };",
  "}",
  "",
  "export function buildLayout(cols: number) {",
  "  const grid = [];",
  "  for (let row = 0; row < 8; row += 1) {",
  "    for (let col = 0; col < cols; col += 1) {",
  "      grid.push({ row, col, id: `${row}-${col}` });",
  "    }",
  "  }",
  "  return grid;",
  "}",
  "",
].join("\n");

export const LEFT_LONG = [
  "export function buildTheme(tokens: Record<string, string>) {",
  "  const palette = {",
  "    background: tokens.surface,",
  "    foreground: tokens.foreground,",
  "    accent: tokens.primary,",
  "    muted: tokens.muted,",
  "    border: tokens.border,",
  "  };",
  "",
  "  function pickTone(step: number) {",
  "    if (step < 2) {",
  "      return tokens.low;",
  "    }",
  "    if (step < 5) {",
  "      return tokens.mid;",
  "    }",
  "    if (step < 8) {",
  "      return tokens.high;",
  "    }",
  "    return tokens.ultra;",
  "  }",
  "",
  "  const scales = Array.from({ length: 16 }, (_, index) => pickTone(index));",
  "",
  "  return {",
  "    palette,",
  "    scales,",
  "    text: {",
  "      headline: tokens.headline,",
  "      body: tokens.body,",
  "      caption: tokens.caption,",
  "      code: tokens.code,",
  "    },",
  "  };",
  "}",
  "",
  "export function buildLayout(cols: number) {",
  "  const grid = [];",
  "  for (let row = 0; row < 12; row += 1) {",
  "    for (let col = 0; col < cols; col += 1) {",
  "      grid.push({ row, col, id: `${row}-${col}` });",
  "    }",
  "  }",
  "  return grid;",
  "}",
  "",
].join("\n");

export const RIGHT_LONG = [
  "export function buildTheme(tokens: Record<string, string>) {",
  "  const palette = {",
  "    background: tokens.background,",
  "    foreground: tokens.text,",
  "    accent: tokens.accent,",
  "    muted: tokens.muted,",
  "    border: tokens.border,",
  "  };",
  "",
  "  function pickTone(step: number) {",
  "    if (step < 4) {",
  "      return tokens.low;",
  "    }",
  "    if (step < 7) {",
  "      return tokens.mid;",
  "    }",
  "    return tokens.high;",
  "  }",
  "",
  "  const scales = Array.from({ length: 14 }, (_, index) => pickTone(index));",
  "",
  "  return {",
  "    palette,",
  "    scales,",
  "    text: {",
  "      headline: tokens.headline,",
  "      body: tokens.body,",
  "      caption: tokens.caption,",
  "    },",
  "  };",
  "}",
  "",
  "export function buildLayout(cols: number) {",
  "  const grid = [];",
  "  for (let row = 0; row < 8; row += 1) {",
  "    for (let col = 0; col < cols; col += 1) {",
  "      grid.push({ row, col, id: `${row}-${col}` });",
  "    }",
  "  }",
  "  return grid;",
  "}",
  "",
].join("\n");
