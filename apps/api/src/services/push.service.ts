import webpush from "web-push";
import { logger } from "../lib/monitoring.js";

let configured = false;

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

function ensureConfigured() {
  if (configured) return;
  if (!isPushConfigured()) return;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: any
): Promise<{ ok: boolean; shouldRemove: boolean }> {
  try {
    ensureConfigured();
    if (!configured) {
      return { ok: false, shouldRemove: false };
    }
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, shouldRemove: false };
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.status;
    const shouldRemove = statusCode === 404 || statusCode === 410;
    logger.warn(`Push send failed (${statusCode || "unknown"})`, error as Error);
    return { ok: false, shouldRemove };
  }
}
