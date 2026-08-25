import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { CommunicationService } from '../../core/services/communication.service';
import { Notification } from '../../core/models/communication.model';

/**
 * Unified "My Notifications" page — one component, routed to from every
 * portal's sidebar (Student/Teacher/Coordinator/Parent at
 * /{portal}/notifications, and embedded directly inside the Admin's
 * existing Notifications screen alongside the broadcast composer — see
 * AdminNotificationsComponent). GET /api/notifications is already
 * filtered to the current user server-side (see CommunicationService),
 * so this same component works unmodified for any role — no role input
 * needed.
 *
 * Split out of CommunicationComponent (features/communication), which
 * still owns the Feedback/Complaints tab that isn't relevant to every
 * role the way notifications are — bundling both under one "Notifications"
 * label would have dragged complaints into portals that don't want it.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  notifications = signal<Notification[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.communicationService.getMyNotifications().subscribe({
      next: (data) => {
        this.notifications.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load notifications right now.');
        this.loading.set(false);
      },
    });
  }

  markRead(id: string): void {
    this.communicationService.markNotificationRead(id).subscribe({
      next: () => this.load(),
    });
  }

  get unreadCount(): number {
    return this.notifications().filter((n) => !n.read_at).length;
  }
}
