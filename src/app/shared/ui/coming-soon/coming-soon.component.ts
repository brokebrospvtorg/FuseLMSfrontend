import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Placeholder for sidebar modules that aren't built yet.
 * Keeps the shell fully clickable/demoable without wiring
 * every module before it exists. Swap this route out for the
 * real component as each module lands.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="coming-soon">
      <i class="pi pi-hourglass coming-soon__icon"></i>
      <h2 class="coming-soon__title">{{ moduleName }}</h2>
      <p class="coming-soon__text">This module is on the build roadmap and isn't wired up yet.</p>
    </div>
  `,
  styles: [`
    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 4rem 2rem;
      color: #6b7280;
    }
    .coming-soon__icon {
      font-size: 2.5rem;
      color: #a7b0c5;
      margin-bottom: 1rem;
    }
    .coming-soon__title {
      font-family: 'Playfair Display', Georgia, serif;
      color: #101d3c;
      margin: 0 0 0.5rem;
    }
    .coming-soon__text {
      margin: 0;
      font-size: 0.95rem;
    }
  `],
})
export class ComingSoonComponent {
  @Input() moduleName = 'This module';
}
