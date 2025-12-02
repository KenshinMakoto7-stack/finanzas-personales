import nodemailer from "nodemailer";
import { logger } from "../lib/monitoring.js";

// Función para enviar email usando SendGrid REST API (más confiable que SMTP)
async function sendEmailViaSendGridAPI(
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY no configurada");
  }

  try {
    logger.info(`📧 Llamando a SendGrid API REST para ${to} desde ${from}`);
    
    const requestBody = {
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: { email: from },
      subject: subject,
      content: [
        {
          type: "text/plain",
          value: text,
        },
        {
          type: "text/html",
          value: html,
        },
      ],
    };

    logger.info(`📧 Request body preparado, enviando a SendGrid...`);
    
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    logger.info(`📧 SendGrid API respondió con status: ${response.status}`);

    if (response.ok) {
      logger.info(`✅ SendGrid API respondió OK para ${to}`);
      return true;
    } else {
      const errorText = await response.text();
      logger.error(`❌ SendGrid API error: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    logger.error("❌ Error calling SendGrid API", error as Error);
    throw error;
  }
}

// Configuración del transporter de email
// Soporta múltiples proveedores: Gmail, SendGrid, Mailgun, Resend, etc.
const createTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  
  // Configuración especial para proveedores comunes
  if (host.includes("sendgrid") || process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: { user: "apikey", pass: process.env.SENDGRID_API_KEY || pass },
      connectionTimeout: 10000, // 10 segundos timeout
      socketTimeout: 10000, // 10 segundos timeout
    });
  }
  
  if (host.includes("resend")) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY || pass },
      connectionTimeout: 10000,
      socketTimeout: 10000,
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

  // Determinar el email "from" según el proveedor
  let fromEmail: string;
  if (hasSendgridConfig) {
    // SendGrid requiere un email verificado en su dashboard
    fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || "noreply@finanzas-personales.com";
    if (!process.env.SENDGRID_FROM_EMAIL) {
      logger.warn("⚠️ SENDGRID_FROM_EMAIL no configurado. Usando valor por defecto. El email puede fallar.");
    }
  } else if (hasResendConfig) {
    // Resend requiere un email verificado en su dashboard
    fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_USER || "noreply@finanzas-personales.com";
  } else {
    // SMTP genérico
    fromEmail = process.env.SMTP_USER || "noreply@finanzas-personales.com";
  }

  const emailHtml = `
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
  `;

  const emailText = `
    Recuperación de Contraseña - Finanzas Personales
    
    Hola,
    
    Recibimos una solicitud para recuperar tu contraseña. Si fuiste tú, visita el siguiente enlace:
    
    ${resetUrl}
    
    Este enlace expirará en 1 hora.
    
    Si no solicitaste este cambio, puedes ignorar este email de forma segura.
  `;

  try {
    // Si SendGrid está configurado, usar API REST (más confiable que SMTP)
    if (hasSendgridConfig) {
      logger.info(`📧 Enviando email vía SendGrid API REST a ${email}`);
      const success = await Promise.race([
        sendEmailViaSendGridAPI(
          email,
          fromEmail,
          "Recuperación de Contraseña - Finanzas Personales",
          emailHtml,
          emailText
        ),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error("SendGrid API timeout")), 10000)
        )
      ]);
      
      if (success) {
        logger.info(`✅ Password reset email sent successfully to ${email} via SendGrid API`);
        return true;
      } else {
        throw new Error("SendGrid API returned false");
      }
    }

    // Para otros proveedores, usar SMTP
    const transporter = createTransporter();
    const mailOptions = {
      from: `"Finanzas Personales" <${fromEmail}>`,
      to: email,
      subject: "Recuperación de Contraseña - Finanzas Personales",
      html: emailHtml,
      text: emailText,
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
