/**
 * Stable color per correspondence id (Phase 10.2) so the same element reads as
 * the same hue across every frame's tree. Pure: a cheap string hash → HSL hue.
 */
export function correspondenceColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 60%)`;
}
