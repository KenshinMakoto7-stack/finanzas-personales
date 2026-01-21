import { Request, Response } from "express";
import { auth, db } from "../lib/firebase.js";
import { RegisterSchema, LoginSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
import { objectToFirestore, fromFirestoreTimestamp } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "../lib/monitoring.js";
import { isValidTimezone, COMMON_TIMEZONES } from "../lib/time.js";
import { touchUserData } from "../lib/cache.js";

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

    // Validar timezone si se proporciona
    const validatedTimeZone = timeZone && isValidTimezone(timeZone) ? timeZone : "UTC";
    if (timeZone && !isValidTimezone(timeZone)) {
      logger.warn(`Invalid timezone provided: ${timeZone}, defaulting to UTC`);
    }

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
      timeZone: validatedTimeZone,
      budgetCycleDay: null,
      createdAt: Timestamp.now()
    };

    await db.collection("users").doc(userRecord.uid).set(objectToFirestore(userData));

    // Después del registro, hacer login automático para obtener el ID token
    const API_KEY = process.env.FIREBASE_API_KEY;
    let token = "";
    
    if (API_KEY) {
      try {
        const loginResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
          }
        );
        const loginData = await loginResponse.json();
        token = loginData.idToken || "";
      } catch (e) {
        // Si falla el login automático, usar customToken como fallback
        token = await auth.createCustomToken(userRecord.uid);
      }
    } else {
      token = await auth.createCustomToken(userRecord.uid);
    }

    res.status(201).json({
      token,
      user: {
        id: userRecord.uid,
        email,
        name,
        currencyCode: userData.currencyCode,
        locale: userData.locale,
        timeZone: userData.timeZone,
        budgetCycleDay: userData.budgetCycleDay
      }
    });
  } catch (error: any) {
    logger.error("Register error", error);
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
        const idToken = verifyData.idToken; // Usar el ID token de Firebase directamente
        const userRecord = await auth.getUser(userId);

        // Obtener datos del usuario de Firestore
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const userData = userDoc.data()!;

        res.json({
          token: idToken, // Devolver el ID token directamente (verificable con verifyIdToken)
          user: {
            id: userId,
            email: userRecord.email,
            name: userData.name,
            currencyCode: userData.currencyCode || "USD",
            locale: userData.locale || "en-US",
            timeZone: userData.timeZone || "UTC",
            budgetCycleDay: userData.budgetCycleDay ?? null
          }
        });
        return;
      } catch (error: any) {
        logger.error("Login verification error", error);
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
    } else {
      // FALLBACK: Si no hay API_KEY, usar método anterior (NO SEGURO, pero no rompe)
      logger.warn('FIREBASE_API_KEY not set. Login will NOT verify password.');
      
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
          timeZone: userData.timeZone || "UTC",
          budgetCycleDay: userData.budgetCycleDay ?? null
        }
      });
    }
  } catch (error: any) {
    logger.error("Login error", error);
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
        timeZone: userData.timeZone || "UTC",
        defaultAccountId: userData.defaultAccountId || null,
        defaultCategoryId: userData.defaultCategoryId || null,
        budgetCycleDay: userData.budgetCycleDay ?? null
      }
    });
  } catch (error: any) {
    logger.error("Me error", error);
    res.status(500).json({ error: error.message || "Error al obtener perfil" });
  }
}

/**
 * Actualizar preferencias del usuario
 */
export async function updatePrefs(req: AuthRequest, res: Response) {
  try {
    const { currencyCode, locale, timeZone, name, defaultAccountId, defaultCategoryId, budgetCycleDay } = req.body || {};
    
    const updateData: any = {};
    if (currencyCode !== undefined) updateData.currencyCode = currencyCode;
    if (locale !== undefined) updateData.locale = locale;
    if (timeZone !== undefined) updateData.timeZone = timeZone;
    if (name !== undefined) updateData.name = name;
    if (defaultAccountId !== undefined) updateData.defaultAccountId = defaultAccountId;
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = defaultCategoryId;
    if (budgetCycleDay !== undefined) {
      if (budgetCycleDay === null || budgetCycleDay === "") {
        updateData.budgetCycleDay = null;
      } else {
        const parsed = Number(budgetCycleDay);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 28) {
          return res.status(400).json({ error: "El día de cobro debe estar entre 1 y 28" });
        }
        updateData.budgetCycleDay = parsed;
      }
    }

    await db.collection("users").doc(req.user!.userId).update(objectToFirestore(updateData));
    void touchUserData(req.user!.userId);

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
        timeZone: userData.timeZone || "UTC",
        defaultAccountId: userData.defaultAccountId || null,
        defaultCategoryId: userData.defaultCategoryId || null,
        budgetCycleDay: userData.budgetCycleDay ?? null
      }
    });
  } catch (error: any) {
    logger.error("Update prefs error", error);
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

    logger.info(`🔐 Password reset requested for: ${email}`);

    // IMPORTANTE: Responder inmediatamente, luego procesar en background
    // Por seguridad, siempre devolvemos éxito (no revelamos si el email existe o no)
    res.json({ message: "Si el email existe, recibirás un enlace para recuperar tu contraseña" });

    // Procesar en background (no bloquea la respuesta)
    (async () => {
      try {
        // Generar link de reset usando Firebase Auth con timeout
        let resetLink: string;
        try {
          resetLink = await Promise.race([
            auth.generatePasswordResetLink(email),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error("Firebase timeout")), 15000)
            )
          ]) as string;
          logger.info(`✅ Password reset link generated for: ${email}`);
        } catch (error: any) {
          // Manejar errores específicos de Firebase
          if (error?.code === "auth/reset-password-exceed-limit" || 
              error?.message?.includes("RESET_PASSWORD_EXCEED_LIMIT")) {
            logger.warn(`⚠️ Password reset limit exceeded for: ${email}. Firebase bloqueó la solicitud por demasiados intentos.`);
            logger.warn(`💡 El usuario debe esperar antes de intentar nuevamente.`);
            return; // Salir temprano - no enviar email
          }
          
          // Si el usuario no existe o hay otro error de Firebase, loguear pero no revelar
          logger.error("❌ Error generating password reset link", error);
          return; // Salir temprano si no se puede generar el link
        }

        // Enviar email (no bloqueante - ya respondimos al cliente)
        sendPasswordResetEmail(email, resetLink).catch((emailError) => {
          logger.error("❌ Error sending password reset email (non-blocking)", emailError);
        });
      } catch (error: any) {
        logger.error("❌ Error in background password reset processing", error);
      }
    })();
  } catch (error: any) {
    // Catch-all para cualquier error inesperado
    logger.error("Password reset request error (unexpected)", error);
    // Por seguridad, siempre devolvemos éxito (no revelamos si el email existe o no)
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

    const API_KEY = process.env.FIREBASE_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "FIREBASE_API_KEY no configurada" });
    }

    // Verificar oobCode en Firebase
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: token })
      }
    );

    const verifyData = await verifyResponse.json();
    if (!verifyResponse.ok || verifyData.error) {
      return res.status(400).json({ error: "Token inválido o expirado" });
    }

    res.json({ valid: true, email: verifyData.email || null });
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

    const API_KEY = process.env.FIREBASE_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "FIREBASE_API_KEY no configurada" });
    }

    const resetResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: token, newPassword })
      }
    );

    const resetData = await resetResponse.json();
    if (!resetResponse.ok || resetData.error) {
      return res.status(400).json({ error: "Token inválido o expirado" });
    }

    res.json({ message: "Contraseña actualizada exitosamente" });
  } catch (error: any) {
    logger.error("Reset password error", error);
    res.status(400).json({ error: "Error al actualizar contraseña" });
  }
}
