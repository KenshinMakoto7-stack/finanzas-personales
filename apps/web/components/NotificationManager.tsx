"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../lib/api";
import { useAuth } from "../store/auth";

export default function NotificationManager() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);

    // Verificar permisos de notificación
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    // Registrar service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registrado:", registration);
          checkSubscription(registration);
        })
        .catch((error) => {
          console.error("Error registrando Service Worker:", error);
        });
    }

    // Verificar notificaciones pendientes periódicamente
    const interval = setInterval(() => {
      checkPendingNotifications();
    }, 5 * 60 * 1000); // Cada 5 minutos

    checkPendingNotifications();

    return () => clearInterval(interval);
  }, [user]);

  async function checkSubscription(registration: ServiceWorkerRegistration) {
    try {
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      
      if (sub) {
        // Enviar subscription al backend
        await api.post("/notifications/subscribe", {
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
            auth: arrayBufferToBase64(sub.getKey("auth")!)
          }
        });
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      alert("Tu navegador no soporta notificaciones");
      return;
    }

    const permission = await Notification.requestPermission();
    setPermission(permission);

    if (permission === "granted" && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // En una implementación real, necesitarías un servidor de push (VAPID)
        // Por ahora, usamos notificaciones locales
        await checkSubscription(registration);
      } catch (error) {
        console.error("Error requesting permission:", error);
      }
    }
  }

  async function checkPendingNotifications() {
    if (!user || permission !== "granted") return;

    try {
      const res = await api.get("/notifications/pending");
      const notifications = res.data.notifications || [];

      notifications.forEach((notif: any) => {
        // Verificar si ya mostramos esta notificación hoy
        const key = `${notif.type}-${JSON.stringify(notif.data)}`;
        const lastShown = localStorage.getItem(`notif-${key}`);
        const today = new Date().toDateString();

        if (lastShown !== today) {
          showNotification(notif);
          localStorage.setItem(`notif-${key}`, today);
        }
      });
    } catch (error) {
      console.error("Error checking notifications:", error);
    }
  }

  function showNotification(notif: any) {
    if (permission !== "granted") return;

    const notification = new Notification(notif.title, {
      body: notif.message,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: notif.type,
      requireInteraction: notif.priority === "high",
      vibrate: notif.priority === "high" ? [200, 100, 200] : [200],
      data: notif.data
    });

    notification.onclick = () => {
      window.focus();
      let url = "/dashboard";
      
      if (notif.data.transactionId) {
        url = "/transactions";
      } else if (notif.data.goalId) {
        url = "/dashboard";
      }
      
      window.location.href = url;
      notification.close();
    };
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (permission === "default") {
    return (
      <div style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "white",
        padding: "16px",
        borderRadius: "12px",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
        zIndex: 1000,
        maxWidth: "300px"
      }}>
        <div style={{ marginBottom: "12px", fontWeight: "600" }}>
          ¿Activar notificaciones?
        </div>
        <div style={{ fontSize: "14px", color: "#666", marginBottom: "12px" }}>
          Recibe alertas sobre presupuestos, transacciones recurrentes y metas
        </div>
        <button
          onClick={requestPermission}
          style={{
            width: "100%",
            padding: "10px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          Activar Notificaciones
        </button>
      </div>
    );
  }

  return null;
}

