import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { authenticateJWT } from './middleware/auth';
import { login } from './controllers/authController';
import { getCameras, createCamera } from './controllers/cameraController';
import { getLenses, createLens } from './controllers/lensController';
import { getRolls, createRoll, updateRoll } from './controllers/rollController';
import { getFilms, updateFilmStock } from './controllers/filmController';
import { getEquipments, createEquipment, updateEquipment, deleteEquipment } from './controllers/otherEquipmentController';
import { ImageService } from './services/imageService';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Setup Multer for memory storage upload
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // Limit to 20MB

// Middlewares
app.use(cors());
app.use(express.json());

// Public health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoint
app.post('/api/auth/login', login);

// Protected API routes
app.get('/api/cameras', authenticateJWT, getCameras);
app.post('/api/cameras', authenticateJWT, createCamera);

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

// Multipart file upload with EXIF metadata parsing & thumbnail generation
app.post('/api/photos/upload', authenticateJWT, upload.single('photo'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const { buffer, originalname, size } = req.file;

    // 1. Extract EXIF metadata
    const exifData = await ImageService.extractMetadata(buffer);

    // 2. Generate web-optimized thumbnail
    const thumbnailBuffer = await ImageService.generateThumbnail(buffer);

    res.status(201).json({
      message: 'Photo uploaded and parsed successfully',
      photo: {
        originalFileName: originalname,
        fileSize: size,
        metadata: exifData,
        thumbnailSize: thumbnailBuffer.length
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
