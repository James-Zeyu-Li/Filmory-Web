import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { authenticateJWT } from './middleware/auth';
import { login, refresh, logout } from './controllers/authController';
import { getCameras, createCamera, uploadCameraAvatar } from './controllers/cameraController';
import { getLenses, createLens } from './controllers/lensController';
import { getRolls, createRoll, updateRoll } from './controllers/rollController';
import { getFilms, updateFilmStock } from './controllers/filmController';
import { getEquipments, createEquipment, updateEquipment, deleteEquipment } from './controllers/otherEquipmentController';
import { ImageService } from './services/imageService';
import { StorageFactory } from './services/StorageFactory';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Setup Multer for memory storage upload
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // Limit to 20MB

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  immutable: true
}));

// Public health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoints
app.post('/api/auth/login', login);
app.post('/api/auth/refresh', refresh);
app.post('/api/auth/logout', logout);

// Protected API routes
app.get('/api/cameras', authenticateJWT, getCameras);
app.post('/api/cameras', authenticateJWT, createCamera);
app.post('/api/cameras/:id/avatar', authenticateJWT, upload.single('avatar'), uploadCameraAvatar);

app.get('/api/lenses', authenticateJWT, getLenses);
app.post('/api/lenses', authenticateJWT, createLens);

app.get('/api/films', authenticateJWT, getFilms);
app.post('/api/films/:id/stock', authenticateJWT, updateFilmStock);

app.get('/api/rolls', authenticateJWT, getRolls);
app.post('/api/rolls', authenticateJWT, createRoll);
app.put('/api/rolls/:id', authenticateJWT, updateRoll);

app.get('/api/equipments', authenticateJWT, getEquipments);
app.post('/api/equipments', authenticateJWT, createEquipment);
app.put('/api/equipments/:id', authenticateJWT, updateEquipment);
app.delete('/api/equipments/:id', authenticateJWT, deleteEquipment);

// Multipart file upload with EXIF metadata parsing, resizing & object storage write
app.post('/api/photos/upload', authenticateJWT, upload.single('photo'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const { buffer, originalname, size, mimetype } = req.file;

    // 1. Extract EXIF metadata
    const exifData = await ImageService.extractMetadata(buffer);

    // 2. Generate optimized sub-spec buffers (thumbnail, preview, original)
    const processed = await ImageService.processPhoto(buffer);

    // 3. Upload to storage (local or cloud)
    const storageService = StorageFactory.getStorageService();
    const baseName = `${Date.now()}_${originalname}`;
    
    const thumbnailKey = `photos/thumbnails/${baseName}`;
    const previewKey = `photos/previews/${baseName}`;
    const originalKey = `photos/originals/${baseName}`;

    const thumbnailUrl = await storageService.uploadFile(thumbnailKey, processed.thumbnail, 'image/jpeg');
    const previewUrl = await storageService.uploadFile(previewKey, processed.preview, 'image/jpeg');
    const originalUrl = await storageService.uploadFile(originalKey, processed.original, 'image/jpeg');

    res.status(201).json({
      message: 'Photo uploaded and parsed successfully',
      photo: {
        originalFileName: originalname,
        fileSize: size,
        metadata: exifData,
        thumbnailUrl,
        previewUrl,
        originalUrl,
        storageKey: baseName
      }
    });
  } catch (error: any) {
    console.error('Error handling photo upload:', error);
    res.status(500).json({ error: 'Internal server error during upload processing' });
  }
});

// Start listening
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🚀 Filmory Node.js API Service running on http://localhost:${port}`);
  });
}

export default app;
