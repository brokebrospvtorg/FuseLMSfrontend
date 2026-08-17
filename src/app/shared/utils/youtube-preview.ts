/**
 * Client-side mirror of app/utils/youtube.py::parse_youtube_video_id, for
 * INSTANT PREVIEW ONLY (Lectures Sub-Sprint 5, Task 5.1: "instant video
 * preview using Sub-Sprint 4's player" as the Teacher types).
 *
 * This is never the source of truth — every write (setYoutubeVideo,
 * requestYoutubeEdit) still gets parsed and validated server-side before
 * anything is stored. If this and the backend ever disagree on some edge
 * case, the backend wins and the preview was just wrong for a moment;
 * nothing bad is stored either way.
 *
 * Recognizes the same formats as the backend: watch?v=, youtu.be/,
 * /embed/, /shorts/, or a bare 11-character ID.
 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeVideoIdPreview(input: string | null | undefined): string | null {
  if (!input) return null;
  const candidate = input.trim();

  if (VIDEO_ID_RE.test(candidate)) return candidate;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const allowedHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'];
  if (!allowedHosts.includes(host)) return null;

  const path = url.pathname.replace(/\/$/, '');

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const segment = path.replace(/^\//, '');
    return VIDEO_ID_RE.test(segment) ? segment : null;
  }

  if (path === '/watch') {
    const videoId = url.searchParams.get('v');
    return videoId && VIDEO_ID_RE.test(videoId) ? videoId : null;
  }

  for (const prefix of ['/embed/', '/shorts/']) {
    if (path.startsWith(prefix.slice(0, -1)) && path.split('/').length === 3) {
      const segment = path.split('/').pop()!;
      return VIDEO_ID_RE.test(segment) ? segment : null;
    }
  }

  return null;
}
