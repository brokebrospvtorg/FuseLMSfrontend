import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';

import { CommunicationService } from '../../../core/services/communication.service';

const ROLE_OPTIONS = [
  { label: 'Everyone', value: null },
  { label: 'Admins', value: 'admin' },
  { label: 'Coordinators', value: 'coordinator' },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Students', value: 'student' },
  { label: 'Parents', value: 'parent' },
];

/**
 * Admin Sub-Sprint 4: "Broadcast system notifications and fee alerts."
 * Every Notification row before this was created as a side effect of a
 * specific action (grade override, fee approval, etc). This is the first
 * one-to-many "announcement" path — in-app only, since real email
 * delivery is still explicitly deferred (send_email stays a console-log
 * stub), and blasting an announcement through that stub to potentially
 * the whole school isn't useful yet.
 */
@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, SelectModule, TextareaModule, ButtonModule],
  templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss',
})
export class AdminNotificationsComponent {
  roleOptions = ROLE_OPTIONS;

  targetRole = signal<string | null>(null);
  message = signal('');
  sending = signal(false);

  constructor(private communicationService: CommunicationService) {}

  send(): void {
    const text = this.message().trim();
    if (!text) {
      Swal.fire({ icon: 'warning', title: 'Empty message', text: 'Write something before sending.' });
      return;
    }

    const targetLabel = this.roleOptions.find((r) => r.value === this.targetRole())?.label ?? 'Everyone';
    Swal.fire({
      icon: 'warning',
      title: `Send to ${targetLabel}?`,
      text: 'This delivers an in-app notification to every matching active account right now.',
      showCancelButton: true,
      confirmButtonText: 'Send',
      confirmButtonColor: '#101d3c',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.sending.set(true);
      this.communicationService.broadcastNotification(text, this.targetRole() ?? undefined).subscribe({
        next: (res) => {
          this.sending.set(false);
          this.message.set('');
          Swal.fire({
            icon: 'success',
            title: 'Broadcast sent',
            text: `Delivered to ${res.recipient_count} recipient${res.recipient_count === 1 ? '' : 's'}.`,
            confirmButtonColor: '#101d3c',
          });
        },
        error: (err) => {
          this.sending.set(false);
          Swal.fire({ icon: 'error', title: 'Could not send', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
    });
  }
}
