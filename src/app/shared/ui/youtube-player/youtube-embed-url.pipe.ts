import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Lectures Sub-Sprint 4, Task 4.1.
 *
 * Turns an 11-character YouTube video ID into a SafeResourceUrl for
 * `youtube-nocookie.com/embed/<id>` — the privacy-enhanced embed domain
 * (YouTube doesn't set tracking cookies until the viewer actually presses
 * play), with `rel=0` (related videos at the end are limited to the same
 * channel, not an arbitrary "up next") and `modestbranding=1` (smaller
 * YouTube logo in the control bar). Angular blocks iframe `src` bindings
 * by default (XSS protection) — bypassSecurityTrustResourceUrl() is the
 * explicit, narrow opt-out, scoped to just this one interpolated string
 * rather than disabling sanitization more broadly.
 *
 * Deliberately takes a bare video ID, not a full URL — every write path
 * (Sub-Sprints 2/3) already normalizes to the 11-char id via
 * parse_youtube_video_id() before it's ever stored, so nothing downstream
 * should be re-parsing a raw URL again here.
 *
 * Usage: <iframe [src]="lecture.youtube_video_id | youtubeEmbedUrl"></iframe>
 * (App__youtube-player below wraps this for the common case — reach for
 * the pipe directly only if you need a bare iframe outside that wrapper.)
 */
@Pipe({
  name: 'youtubeEmbedUrl',
  standalone: true,
})
export class YoutubeEmbedUrlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(videoId: string | null | undefined): SafeResourceUrl | null {
    if (!videoId) return null;
    const url = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
