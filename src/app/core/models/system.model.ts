/** Mirrors app/models/identity.py — SystemSettings table. Admin-only concern;
 *  not currently routed under the Student portal. Kept here so the service
 *  layer is ready when the Admin portal gets built. */
export interface SystemSettings {
  license_expiry_date: string;
  school_name: string;
  activated_at: string;
}
