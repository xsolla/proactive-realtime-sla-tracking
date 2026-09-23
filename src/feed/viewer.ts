export type ViewerRole = "business" | "technical" | "system";

export type Viewer = {
  role: ViewerRole;
};

/**
 * The only place a viewer is read. Today that is the VIEWER_ROLE env var.
 * A real session replaces the body of this function and nothing else.
 */
export function getViewer(): Viewer {
  const role = process.env.VIEWER_ROLE;
  if (role === "business" || role === "technical" || role === "system") {
    return { role };
  }
  throw new Error("VIEWER_ROLE must be business, technical, or system.");
}
