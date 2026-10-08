import { Controller, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (requires CLOUDINARY_URL in .env)
cloudinary.config({
  secure: true
});

const UPLOAD_DIR = './uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 1024 * 1024 * 500 // 500 MB limit for videos
    },
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
      }
    })
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string
  ) {
    if (!file) {
      throw new HttpException('File required', HttpStatus.BAD_REQUEST);
    }

    // If type is menu, upload to Cloudinary and delete local file
    if (type === 'menu') {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'karvaan_pos',
          use_filename: true,
          unique_filename: true,
        });
        
        // Delete the temporary local file asynchronously
        fs.promises.unlink(file.path).catch(err => console.error('Failed to delete temp file:', err));

        return {
          url: result.secure_url,
          filename: file.filename,
          mimetype: file.mimetype
        };
      } catch (error) {
        console.error(`Cloudinary upload failed: ${error.message}. Falling back to local storage.`);
        // Fallback to local storage
        return {
          url: `/uploads/${file.filename}`,
          filename: file.filename,
          mimetype: file.mimetype
        };
      }
    }

    // Default: Return local URL for promo media
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype
    };
  }
}
