export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  depth: number;
  children: TreeNode[];
}

const BRANCH_RE = /^([│ ]*)(├──|└──) (.+)$/;
const ROOT_RE = /^([./].*?)$/;

export function parseTree(text: string): TreeNode[] {
  if (!text || !text.trim()) return [];
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));

  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  let currentRoot: TreeNode | null = null;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^\d+ director(y|ies),? \d+ files?/.test(raw.trim())) continue;

    const m = raw.match(BRANCH_RE);
    if (!m) {
      const [maybeRoot] = raw.match(ROOT_RE) || [];
      if (maybeRoot && !raw.includes("├") && !raw.includes("└")) {
        const name = maybeRoot.trim().replace(/\/$/, "");
        if (name && !name.startsWith("─")) {
          currentRoot = {
            name,
            path: name,
            isDir: true,
            depth: 0,
            children: [],
          };
          roots.push(currentRoot);
          stack.length = 0;
          stack.push(currentRoot);
        }
      }
      continue;
    }

    const prefix = m[1];
    const nameRaw = m[3];
    const depth = Math.floor(prefix.length / 4) + 1;

    const isDir = nameRaw.endsWith("/");
    const name = nameRaw.replace(/\/$/, "").trim();

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    let parent: TreeNode | null = stack[stack.length - 1] || null;
    if (!parent) {
      if (!currentRoot) {
        currentRoot = { name: ".", path: ".", isDir: true, depth: 0, children: [] };
        roots.push(currentRoot);
      }
      parent = currentRoot;
      stack.push(parent);
    }

    const path = parent.path && parent.path !== "." ? `${parent.path}/${name}` : name;
    const node: TreeNode = { name, path, isDir, depth, children: [] };
    parent.children.push(node);
    stack.push(node);
  }

  return roots;
}

export function flattenPaths(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    out.push(n.path);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}
