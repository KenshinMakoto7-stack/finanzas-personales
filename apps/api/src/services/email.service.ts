import nodemailer from "nodemailer";
import { logger } from "../lib/monitoring.js";

// Configuración del transporter de email
// Soporta múltiples proveedores: Gmail, SendGrid, Mailgun, Resend, etc.
const createTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  
  // Configuración especial para proveedores comunes
  if (host.includes("sendgrid")) {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: { user: "apikey", pass: process.env.SENDGRID_API_KEY || pass },
    });
  }
  
  if (host.includes("resend")) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY || pass },
    });
  }

  // Configuración genérica (Gmail, etc.)
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000, // 10 segundos timeout
    socketTimeout: 10000, // 10 segundos timeout
  });
};

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  // Verificar configuración de email
  const hasSmtpConfig = process.env.SMTP_USER && process.env.SMTP_PASS;
  const hasSendgridConfig = process.env.SENDGRID_API_KEY;
  const hasResendConfig = process.env.RESEND_API_KEY;
  
  if (!hasSmtpConfig && !hasSendgridConfig && !hasResendConfig) {
    logger.warn("Email service not configured. Set SMTP_USER/SMTP_PASS, SENDGRID_API_KEY, or RESEND_API_KEY");
    logger.info(`Password reset requested for ${email}. Reset URL: ${resetUrl}`);
    logger.warn(`⚠️ EMAIL NO ENVIADO - Configura las variables de entorno de email en Render`);
    return false; // Indica que NO se envió
  }

  try {
    const transporter = createTransporter();

    // Determinar el email "from" según el proveedor
    let fromEmail: string;
    if (hasSendgridConfig) {
      // SendGrid requiere un email verificado en su dashboard
      fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || "noreply@finanzas-personales.com";
    } else if (hasResendConfig) {
      // Resend requiere un email verificado en su dashboard
      fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_USER || "noreply@finanzas-personales.com";
    } else {
      // SMTP genérico
      fromEmail = process.env.SMTP_USER || "noreply@finanzas-personales.com";
    }

    const mailOptions = {
      from: `"Finanzas Personales" <${fromEmail}>`,
      to: email,
      subject: "Recuperación de Contraseña - Finanzas Personales",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Recuperación de Contraseña</h1>
            </div>
            <div class="content">
              <p>Hola,</p>
              <p>Recibimos una solicitud para recuperar tu contraseña. Si fuiste tú, haz clic en el botón siguiente para restablecerla:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              </p>
              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
              <p><strong>Este enlace expirará en 1 hora.</strong></p>
              <p>Si no solicitaste este cambio, puedes ignorar este email de forma segura.</p>
            </div>
            <div class="footer">
              <p>© Finanzas Personales - Este es un email automático, por favor no respondas.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Recuperación de Contraseña - Finanzas Personales
        
        Hola,
        
        Recibimos una solicitud para recuperar tu contraseña. Si fuiste tú, visita el siguiente enlace:
        
        ${resetUrl}
        
        Este enlace expirará en 1 hora.
        
        Si no solicitaste este cambio, puedes ignorar este email de forma segura.
      `,
    };

    // Agregar timeout de 10 segundos para el envío de email
    await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Email send timeout")), 10000)
      )
    ]);
    logger.info(`✅ Password reset email sent successfully to ${email}`);
    return true; // Indica que SÍ se envió
  } catch (error) {
    logger.error("❌ Error sending password reset email", error as Error, { email });
    // Fallback: log the reset URL for manual recovery
    logger.warn(`⚠️ Password reset URL for ${email} (email failed): ${resetUrl}`);
    // NO re-throw - solo loguear el error y retornar false
    return false; // Indica que NO se envió
  }
}

