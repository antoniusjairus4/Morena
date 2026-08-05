import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

/**
 * Bundles directory contents into a ZIP archive and removes the staging directory.
 * 
 * @param {string} sourceDir - The staging folder path to compress.
 * @param {string} outputPath - Desired destination path for the ZIP file.
 * @returns {Promise<{ archivePath: string, sizeBytes: number }>}
 */
export async function createZipArchive(sourceDir, outputPath) {
  const fullOutputPath = path.resolve(outputPath);
  await fsPromises.mkdir(path.dirname(fullOutputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const outputStream = fs.createWriteStream(fullOutputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    outputStream.on('close', async () => {
      try {
        const stats = await fsPromises.stat(fullOutputPath);
        // Clean up staging directory after archiving
        await fsPromises.rm(sourceDir, { recursive: true, force: true });
        resolve({
          archivePath: fullOutputPath,
          sizeBytes: stats.size
        });
      } catch (err) {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(outputStream);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Safely removes directory if it exists.
 * @param {string} dirPath 
 */
export async function cleanupStaging(dirPath) {
  if (dirPath) {
    try {
      await fsPromises.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
