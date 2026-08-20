import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { YoutubeEmbedUrlPipe } from './youtube-embed-url.pipe';

/**
 * Lectures Sub-Sprint 4, Tasks 4.2 + 4.3.
 *
 * Standalone, self-contained player: a 16:9 responsive iframe wrapper
 * around the privacy-enhanced youtube-nocookie.com embed (via
 * YoutubeEmbedUrlPipe). No service calls, no RBAC, no lecture-fetching
 * logic — that's each screen's job (Teacher preview in Sub-Sprint 5,
 * Coordinator current-vs-proposed compare card in Sub-Sprint 6, Student
 * viewer). This component only ever needs a video ID and renders it.
 *
 * The 16:9 wrapper (padding-top: 56.25% trick) is lifted from the original
 * Student lecture viewer rather than invented fresh — same technique, now
 * packaged for reuse instead of living inline in one screen.
 *
 * Usage: <app-youtube-player [videoId]="lecture.youtube_video_id" />
 * If videoId is null/empty, renders a plain "No video set yet" placeholder
 * instead of an iframe pointed at an empty embed URL — every call site
 * (Teacher's own unset lecture, a lecture with no locked video) needs this
 * either way, so it lives here once instead of being duplicated at each
 * call site.
 */
@Component({
  selector: 'app-youtube-player',
  standalone: true,
  imports: [CommonModule, YoutubeEmbedUrlPipe],
  templateUrl: './youtube-player.component.html',
  styleUrl: './youtube-player.component.scss',
})
export class YoutubePlayerComponent {
  /** Bare 11-character YouTube video ID — not a full URL. Pass
   *  lecture.youtube_video_id straight through; parsing already happened
   *  server-side (Sub-Sprints 2/3) before it was ever stored. */
  @Input() videoId: string | null | undefined = null;

  /** Optional accessible label for the iframe (e.g. the lecture title) —
   *  falls back to a generic label so this never ships without one. */
  @Input() title = 'YouTube video player';
}
