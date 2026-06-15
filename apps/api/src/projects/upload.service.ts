import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly publicDir = path.join(__dirname, '..', '..', 'public');
  private readonly uploadLimitBytes = 500 * 1024 * 1024; // 500MB

  constructor() {
    // Ensure directories exist
    this.ensureDirExists(path.join(this.publicDir, 'uploads', 'temp'));
    this.ensureDirExists(path.join(this.publicDir, 'uploads', 'videos'));
    this.ensureDirExists(path.join(this.publicDir, 'uploads', 'thumbnails'));
  }

  private ensureDirExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Save a single chunk to the temp directory
   */
  async saveChunk(
    projectId: string,
    chunkIndex: number,
    totalChunks: number,
    buffer: Buffer,
    fileName: string,
  ): Promise<{ completed: boolean; filePath?: string; relativePath?: string }> {
    // Basic extension/format validation
    const allowedExts = ['.mp4', '.avi', '.mkv', '.mov', '.webm'];
    const ext = path.extname(fileName).toLowerCase();
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(`File format ${ext} is not supported.`);
    }

    const tempProjectDir = path.join(this.publicDir, 'uploads', 'temp', projectId);
    this.ensureDirExists(tempProjectDir);

    // Sanitize filename to prevent directory traversal
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
    const chunkPath = path.join(tempProjectDir, `${safeFileName}.part_${chunkIndex}`);

    // Save current chunk buffer asynchronously
    await fs.promises.writeFile(chunkPath, buffer);
    this.logger.log(`[Upload] Saved chunk ${chunkIndex + 1}/${totalChunks} for project: ${projectId}`);

    // Check if all chunks have arrived asynchronously
    let allChunksArrived = true;
    for (let i = 0; i < totalChunks; i++) {
      const partPath = path.join(tempProjectDir, `${safeFileName}.part_${i}`);
      try {
        await fs.promises.access(partPath);
      } catch {
        allChunksArrived = false;
        break;
      }
    }

    if (allChunksArrived) {
      this.logger.log(`[Upload] All ${totalChunks} chunks arrived. Merging files for project: ${projectId}`);
      const finalProjectDir = path.join(this.publicDir, 'uploads', 'videos', projectId);
      this.ensureDirExists(finalProjectDir);
      
      const finalFilePath = path.join(finalProjectDir, safeFileName);
      const writeStream = fs.createWriteStream(finalFilePath);

      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(tempProjectDir, `${safeFileName}.part_${i}`);
        const chunkData = await fs.promises.readFile(partPath);
        
        // Wait for drain if write stream backpressure buffer is full
        const canWrite = writeStream.write(chunkData);
        if (!canWrite) {
          await new Promise<void>((resolve) => writeStream.once('drain', resolve));
        }
        
        // Clean up part file immediately to save space asynchronously
        await fs.promises.unlink(partPath);
      }

      writeStream.end();

      // Wait for write stream to finish flushing completely to disk
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Check final file size limit asynchronously
      const stats = await fs.promises.stat(finalFilePath);
      if (stats.size > this.uploadLimitBytes) {
        await fs.promises.unlink(finalFilePath);
        throw new BadRequestException('Uploaded file exceeds the maximum size limit of 500MB.');
      }

      // Cleanup temp project dir if empty asynchronously
      try {
        const files = await fs.promises.readdir(tempProjectDir);
        if (files.length === 0) {
          await fs.promises.rmdir(tempProjectDir);
        }
      } catch (e) {
        this.logger.warn(`Failed to clean temp directory: ${e.message}`);
      }

      const relativePath = `/uploads/videos/${projectId}/${safeFileName}`;
      return {
        completed: true,
        filePath: finalFilePath,
        relativePath,
      };
    }

    return { completed: false };
  }
}
