import { Response } from "express";
import { AuthRequest } from "../server/middleware/auth.js";
import { db } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import sharp from "sharp";
import { docToObject } from "../lib/firestore-helpers.js";
import admin from "firebase-admin";

// Obtener bucket de Firebase Storage
function getStorageBucket() {
  try {
    return admin.storage().bucket();
  } catch (error) {
    console.error("Error getting storage bucket:", error);
    throw new Error("Firebase Storage no está configurado correctamente");
  }
}

/**
 * POST /transactions/:id/attachments
 * Sube una imagen adjunta a una transacción
 */
export async function uploadAttachment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
    // Verificar que la transacción existe y pertenece al usuario
    const transactionDoc = await db.collection("transactions").doc(id).get();
    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }
    
    const transaction = transactionDoc.data()!;
    if (transaction.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    // Verificar que no exceda el límite de 2 fotos
    const existingAttachments = transaction.attachments || [];
    if (existingAttachments.length >= 2) {
      return res.status(400).json({ error: "Máximo 2 imágenes por transacción" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ninguna imagen" });
    }
    
    // Validar tamaño (máx 5 MB antes de comprimir)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "La imagen es demasiado grande (máximo 5 MB)" });
    }
    
    // Comprimir imagen usando sharp
    const compressedImage = await sharp(req.file.buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    
    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const filename = `transactions/${userId}/${id}/${timestamp}.jpg`;
    
    // Subir a Firebase Storage
    const bucket = getStorageBucket();
    const file = bucket.file(filename);
    
    await file.save(compressedImage, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          userId,
          transactionId: id,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Hacer el archivo público (o usar signed URL según preferencia)
    await file.makePublic();
    const bucketName = bucket.name;
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
    
    // Crear thumbnail
    const thumbnail = await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const thumbnailFilename = `transactions/${userId}/${id}/${timestamp}_thumb.jpg`;
    const thumbnailFile = bucket.file(thumbnailFilename);
    await thumbnailFile.save(thumbnail, {
      metadata: { contentType: 'image/jpeg' }
    });
    await thumbnailFile.makePublic();
    const thumbnailUrl = `https://storage.googleapis.com/${bucketName}/${thumbnailFilename}`;
    
    // Actualizar transacción con la nueva imagen
    const newAttachment = {
      url: publicUrl,
      thumbnailUrl,
      filename,
      uploadedAt: Timestamp.now(),
      size: compressedImage.length
    };
    
    const updatedAttachments = [...existingAttachments, newAttachment];
    await db.collection("transactions").doc(id).update({
      attachments: updatedAttachments,
      updatedAt: Timestamp.now()
    });
    
    res.json({
      attachment: newAttachment,
      message: "Imagen adjuntada exitosamente"
    });
  } catch (error: any) {
    console.error("Error uploading attachment:", error);
    res.status(500).json({ error: "Error al subir imagen" });
  }
}

/**
 * DELETE /transactions/:id/attachments/:attachmentId
 * Elimina una imagen adjunta
 */
export async function deleteAttachment(req: AuthRequest, res: Response) {
  try {
    const { id, attachmentId } = req.params;
    const userId = req.user!.userId;
    
    // Verificar que la transacción existe y pertenece al usuario
    const transactionDoc = await db.collection("transactions").doc(id).get();
    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }
    
    const transaction = transactionDoc.data()!;
    if (transaction.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }
    
    const attachments = transaction.attachments || [];
    const attachmentIndex = parseInt(attachmentId);
    
    if (attachmentIndex < 0 || attachmentIndex >= attachments.length) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }
    
    const attachment = attachments[attachmentIndex];
    
    // Eliminar de Firebase Storage
    const bucket = getStorageBucket();
    try {
      await bucket.file(attachment.filename).delete();
      // Eliminar thumbnail si existe
      if (attachment.thumbnailUrl) {
        const thumbnailFilename = attachment.filename.replace('.jpg', '_thumb.jpg');
        await bucket.file(thumbnailFilename).delete().catch(() => {}); // Ignorar error si no existe
      }
    } catch (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continuar aunque falle la eliminación del storage
    }
    
    // Actualizar transacción
    const updatedAttachments = attachments.filter((_: any, idx: number) => idx !== attachmentIndex);
    await db.collection("transactions").doc(id).update({
      attachments: updatedAttachments,
      updatedAt: Timestamp.now()
    });
    
    res.json({ message: "Imagen eliminada exitosamente" });
  } catch (error: any) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: "Error al eliminar imagen" });
  }
}

