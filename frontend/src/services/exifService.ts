import ExifReader from 'exifreader';

export interface ParsedExif {
  focalLength?: number;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  dateTime?: number; // timestamp
}

export async function parsePhotoExif(file: File): Promise<ParsedExif> {
  try {
    const tags = await ExifReader.load(file);
    const result: ParsedExif = {};

    // 1. Focal Length (e.g., "50 mm" or "50.0 mm")
    if (tags['FocalLength']?.description) {
      const match = tags['FocalLength'].description.match(/([\d.]+)/);
      if (match) {
        result.focalLength = Math.round(parseFloat(match[1]));
      }
    }

    // 2. Aperture (e.g., "f/2.8" or "2.8")
    if (tags['FNumber']?.description) {
      const desc = tags['FNumber'].description;
      result.aperture = desc.startsWith('f/') ? desc : `f/${desc}`;
    }

    // 3. Shutter Speed (e.g., "1/125" or "0.5" or "1")
    if (tags['ExposureTime']?.description) {
      result.shutterSpeed = tags['ExposureTime'].description;
    }

    // 4. ISO Speed
    if (tags['ISOSpeedRatings']?.description) {
      result.iso = parseInt(tags['ISOSpeedRatings'].description, 10);
    }

    // 5. DateTime Original (usually formatted as "YYYY:MM:DD HH:MM:SS")
    if (tags['DateTimeOriginal']?.description) {
      const dateStr = tags['DateTimeOriginal'].description;
      const parts = dateStr.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split(':'); // YYYY, MM, DD
        const timeParts = parts[1].split(':'); // HH, MM, SS
        if (dateParts.length === 3 && timeParts.length === 3) {
          const date = new Date(
            parseInt(dateParts[0], 10),
            parseInt(dateParts[1], 10) - 1,
            parseInt(dateParts[2], 10),
            parseInt(timeParts[0], 10),
            parseInt(timeParts[1], 10),
            parseInt(timeParts[2], 10)
          );
          if (!isNaN(date.getTime())) {
            result.dateTime = date.getTime();
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.warn('No EXIF tags parsed or file unreadable by ExifReader', error);
    return {};
  }
}
