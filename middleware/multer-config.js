const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'images');
  },
  filename: (req, file, callback) => {
    const name = file.originalname.split(' ').join('_');
    const extension = MIME_TYPES[file.mimetype];
    const filename = name + Date.now() + '.' + extension;
    file.originalRawName = filename; // pour s’en souvenir
    callback(null, filename);
  }
});

const upload = multer({ storage: storage }).single('image');

// Middleware combiné : multer + sharp
module.exports = (req, res, next) => {
  upload(req, res, async function (err) {
    if (err) return res.status(400).json({ error: 'Erreur lors du téléchargement du fichier.' });
    if (!req.file) return next(); // aucun fichier envoyé

    const inputPath = path.join(__dirname, '../images', req.file.filename);
    const outputFilename = req.file.filename.split('.')[0] + '.webp';
    const outputPath = path.join(__dirname, '../images', outputFilename);

    try {
      // Compression avec sharp
      await sharp(inputPath)
        .resize(500)
        .toFormat('webp')
        .toFile(outputPath);

      // Suppression du fichier original
      fs.unlink(inputPath, err => {
        if (err) console.error('Erreur suppression image originale :', err);
      });

      // Mise à jour de req.file avec le fichier webp
      req.file.filename = outputFilename;
      req.file.path = outputPath;
      req.file.mimetype = 'image/webp';

      next();
    } catch (error) {
      console.error('Erreur durant la compression de l’image :', error);
      res.status(500).json({ error: 'Erreur durant la compression de l’image.' });
    }
  });
};
