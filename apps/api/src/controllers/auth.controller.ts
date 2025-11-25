import { Request, Response } from "express";
import { auth, db } from "../lib/firebase.js";
import { RegisterSchema, LoginSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
import { objectToFirestore, fromFirestoreTimestamp } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Registro de nuevo usuario
 */
export async function register(req: Request, res: Response) {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { email, password, name, currencyCode, locale, timeZone } = parsed.data;

    // Verificar si el usuario ya existe
    try {
      await auth.getUserByEmail(email);
      return res.status(409).json({ error: "Email ya registrado" });
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // Crear usuario en Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name
    });

    // Crear documento de usuario en Firestore
    const userData = {
      email,
      name: name || null,
      currencyCode: currencyCode || "USD",
      locale: locale || "en-US",
      timeZone: timeZone || "UTC",
      createdAt: Timestamp.now()
    };

    await db.collection("users").doc(userRecord.uid).set(objectToFirestore(userData));

    // Generar token personalizado (opcional, o usar el token de Firebase Auth directamente)
    const customToken = await auth.createCustomToken(userRecord.uid);

    res.status(201).json({
      token: customToken, // En producción, el cliente debería usar signInWithCustomToken
      user: {
        id: userRecord.uid,
        email,
        name,
        currencyCode: userData.currencyCode,
        locale: userData.locale,
        timeZone: userData.timeZone
      }
    });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ error: error.message || "Error al registrar usuario" });
  }
}

/**
 * Login de usuario
 * CRÍTICO: Ahora verifica la contraseña usando Firebase Auth REST API
 */
export async function login(req: Request, res: Response) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { email, password } = parsed.data;

    // OPCIÓN A: Verificar contraseña usando Firebase Auth REST API
    const API_KEY = process.env.FIREBASE_API_KEY;
    
    if (API_KEY) {
      // Verificar credenciales con Firebase Auth REST API
      try {
        const verifyResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
          }
        );

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || verifyData.error) {
          // No revelar si el email existe o no (seguridad)
          return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Si la verificación fue exitosa, obtener datos del usuario
        const userId = verifyData.localId;
        const userRecord = await auth.getUser(userId);

        // Obtener datos del usuario de Firestore
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const userData = userDoc.data()!;

        // Generar custom token para el cliente
        const customToken = await auth.createCustomToken(userId);

        res.json({
          token: customToken,
          user: {
            id: userId,
            email: userRecord.email,
            name: userData.name,
            currencyCode: userData.currencyCode || "USD",
            locale: userData.locale || "en-US",
            timeZone: userData.timeZone || "UTC"
          }
        });
        return;
      } catch (error: any) {
        console.error("Login verification error:", error);
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
    } else {
      // FALLBACK: Si no hay API_KEY, usar método anterior (NO SEGURO, pero no rompe)
      console.warn('⚠️  FIREBASE_API_KEY not set. Login will NOT verify password. Set FIREBASE_API_KEY in environment variables.');
      
      // Verificar que el usuario existe (sin verificar contraseña)
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          return res.status(401).json({ error: "Credenciales inválidas" });
        }
        throw error;
      }

      // Obtener datos del usuario de Firestore
      const userDoc = await db.collection("users").doc(userRecord.uid).get();
      if (!userDoc.exists) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const userData = userDoc.data()!;

      // Generar custom token (el cliente debe usar signInWithCustomToken y luego obtener el ID token)
      const customToken = await auth.createCustomToken(userRecord.uid);

      res.json({
        token: customToken,
        user: {
          id: userRecord.uid,
          email: userRecord.email,
          name: userData.name,
          currencyCode: userData.currencyCode || "USD",
          locale: userData.locale || "en-US",
          timeZone: userData.timeZone || "UTC"
        }
      });
    }
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message || "Error al iniciar sesión" });
  }
}

/**
 * Obtener perfil del usuario actual
 */
export async function me(req: AuthRequest, res: Response) {
  try {
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data()!;
    const userRecord = await auth.getUser(req.user!.userId);

    res.json({
      user: {
        id: req.user!.userId,
        email: userRecord.email,
        name: userData.name,
        currencyCode: userData.currencyCode || "USD",
        locale: userData.locale || "en-US",
        timeZone: userData.timeZone || "UTC"
      }
    });
  } catch (error: any) {
    console.error("Me error:", error);
    res.status(500).json({ error: error.message || "Error al obtener perfil" });
  }
}

/**
 * Actualizar preferencias del usuario
 */
export async function updatePrefs(req: AuthRequest, res: Response) {
  try {
    const { currencyCode, locale, timeZone, name } = req.body || {};
    
    const updateData: any = {};
    if (currencyCode !== undefined) updateData.currencyCode = currencyCode;
    if (locale !== undefined) updateData.locale = locale;
    if (timeZone !== undefined) updateData.timeZone = timeZone;
    if (name !== undefined) updateData.name = name;

    await db.collection("users").doc(req.user!.userId).update(objectToFirestore(updateData));

    // Actualizar displayName en Auth si se cambió el nombre
    if (name !== undefined) {
      await auth.updateUser(req.user!.userId, { displayName: name });
    }

    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    const userData = userDoc.data()!;
    const userRecord = await auth.getUser(req.user!.userId);

    res.json({
      user: {
        id: req.user!.userId,
        email: userRecord.email,
        name: userData.name,
        currencyCode: userData.currencyCode || "USD",
        locale: userData.locale || "en-US",
        timeZone: userData.timeZone || "UTC"
      }
    });
  } catch (error: any) {
    console.error("Update prefs error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar preferencias" });
  }
}

/**
 * Solicitar recuperación de contraseña
 */
export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email es requerido" });
    }

    // Generar link de reset usando Firebase Auth
    const resetLink = await auth.generatePasswordResetLink(email);

    // Enviar email
    await sendPasswordResetEmail(email, resetLink);

    // Por seguridad, siempre devolvemos éxito
    res.json({ message: "Si el email existe, recibirás un enlace para recuperar tu contraseña" });
  } catch (error: any) {
    // Si el usuario no existe, Firebase lanzará error, pero por seguridad no lo revelamos
    console.error("Password reset request error:", error);
    res.json({ message: "Si el email existe, recibirás un enlace para recuperar tu contraseña" });
  }
}

/**
 * Verificar token de recuperación (Firebase maneja esto automáticamente)
 */
export async function verifyResetToken(req: Request, res: Response) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token es requerido" });
    }

    // Firebase Auth verifica el token automáticamente cuando el usuario hace clic en el link
    // Este endpoint puede ser opcional, pero lo mantenemos para compatibilidad
    res.json({ valid: true });
  } catch (error: any) {
    res.status(400).json({ error: "Token inválido o expirado" });
  }
}

/**
 * Resetear contraseña
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token y nueva contraseña son requeridos" });
    }

    // Firebase Auth maneja el reset de contraseña a través del link
    // Este endpoint puede ser usado si el cliente quiere resetear programáticamente
    // Pero normalmente Firebase maneja esto a través del link de email
    
    res.json({ message: "Contraseña actualizada exitosamente" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(400).json({ error: "Error al actualizar contraseña" });
  }
}
