import fs from 'fs';
import iconv from 'iconv-lite';

// Read the backup file with Windows-1251 encoding and convert to UTF-8
const inputFile = './backups/backup_2026-01-29_00-16-50.sql';
const outputFile = './backups/backup_converted.sql';

try {
    const buffer = fs.readFileSync(inputFile);
    const originalString = iconv.decode(buffer, 'win1251');
    fs.writeFileSync(outputFile, originalString, 'utf8');
    console.log('Conversion completed successfully!');
} catch (error) {
    console.error('Error during conversion:', error.message);
}