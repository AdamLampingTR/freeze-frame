import type { HttpRequest } from "@azure/functions";

// SWA (and the SWA-CLI emulator) inject the signed-in user as a base64 JSON blob
// in x-ms-client-principal. Absent when running `func start` bare.
export function getPrincipal(
  req: HttpRequest,
): { userId: string; userDetails: string } | null {
  const header = req.headers.get("x-ms-client-principal");
  if (!header) return null;
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    return {
      userId: decoded.userId ?? "",
      userDetails: decoded.userDetails ?? "",
    };
  } catch {
    return null;
  }
}
