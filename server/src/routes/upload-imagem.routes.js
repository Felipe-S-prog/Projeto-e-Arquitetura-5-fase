import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError.js';

const uploadDir = fileURLToPath(new URL('../../uploads/questoes/', import.meta.url));
const maxFileSize = 5 * 1024 * 1024;

const allowedTypes = new Map([
  ['image/jpeg', { extension: '.jpg', signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { extension: '.png', signature: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { extension: '.webp', signature: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }],
  ['image/gif', { extension: '.gif', signature: (b) => b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)) }],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, allowedTypes.has(file.mimetype));
  },
});

export function createUploadImagemRoutes() {
  const router = Router();

  router.post(
    '/upload-imagem',
    (req, res, next) => {
      upload.single('imagem')(req, res, (error) => {
        if (error) {
          const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'A imagem deve ter no máximo 5 MB.'
            : 'Não foi possível receber a imagem. Envie um arquivo JPG, PNG, WEBP ou GIF de até 5 MB.';
          return next(AppError.badRequest(message));
        }
        next();
      });
    },
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw AppError.badRequest('Selecione uma imagem JPG, PNG, WEBP ou GIF de até 5 MB.');
        }

        const type = allowedTypes.get(req.file.mimetype);
        if (!type.signature(req.file.buffer)) {
          throw AppError.badRequest('O conteúdo do arquivo não corresponde a uma imagem válida.');
        }

        await mkdir(uploadDir, { recursive: true });

        const filename = `${randomUUID()}${type.extension}`;
        await writeFile(path.join(uploadDir, filename), req.file.buffer);

        res.status(201).json({
          imageUrl: `/uploads/questoes/${filename}`,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
