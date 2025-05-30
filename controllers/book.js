const path = require('path'); // Needed for proper file path joining
const Book = require('../models/Book');
const fs = require('fs');
const sharp = require('sharp');
const { error } = require('console');

exports.createBook = async (req, res, next) => {
  try {
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;

    const inputPath = path.join('images', req.file.filename);
    const outputFilename = req.file.filename.split('.')[0] + '.webp';
    const outputPath = path.join('images', outputFilename);

    // 1. Optimize the image
    await sharp(inputPath)
      .resize(500)
      .toFormat('webp')
      .toFile(outputPath);

    // 2. Delete original image (optional)
    fs.unlink(inputPath, (err) => {
      if (err) console.error('Failed to delete original image:', err);
    });

    // 3. Save book with optimized image URL
    const book = new Book({
      ...bookObject,
      userId: req.auth.userId,
      imageUrl: `${req.protocol}://${req.get('host')}/images/${outputFilename}`,
      ratings: [{ userId: req.auth.userId, grade: bookObject.ratings[0].grade }]
    });

    await book.save();
    res.status(201).json({ message: 'Objet enregistré !' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création du livre.' });
  }
};

exports.modifyBook = (req, res, next) => {
  const bookObject = req.file ? {
    ...JSON.parse(req.body.book),
    imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  } : { ...req.body };

  delete bookObject._userId;
  Book.findOne({ _id: req.params.id })
    .then((book) => {
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: 'Not authorized' });
      } else {
        Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
          .then(() => res.status(200).json({ message: 'Objet modifié!' }))
          .catch(error => res.status(401).json({ error }));
      }
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

exports.deleteBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then(book => {
      if (book.userId != req.auth.userId) {
        res.status(401).json({ message: 'Not authorized' });
      } else {
        const filename = book.imageUrl.split('/images/')[1];
        fs.unlink(`images/${filename}`, () => {
          Book.deleteOne({ _id: req.params.id })
            .then(() => { res.status(200).json({ message: 'Objet supprimé !' }) })
            .catch(error => res.status(401).json({ error }));
        });
      }
    })
    .catch(error => {
      res.status(500).json({ error });
    });
};

exports.getOneBook = (req, res, next) => {
  Book.findOne({
    _id: req.params.id
  }).then(
    (book) => {
      res.status(200).json(book);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
}

exports.getAllBooks = (req, res, next) => {
  Book.find().then(
    (books) => {
      res.status(200).json(books);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
}

exports.bestRating = (req, res, next) => {
  Book.find().limit(3).sort({averageRating:-1}).then(
    (books) => {
      res.status(200).json(books);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
}

exports.rateBook = (req, res, next) => {
  const userId = req.body.userId;
  const bookId = req.params.id;
  const grade = req.body.rating;

  Book.findOne({ _id: bookId })
    .then(book => {
      // Vérifie si l'utilisateur a déjà noté
      const userRating = book.ratings.find(rating => rating.userId === userId);

      if (!userRating) {
        // Ajoute la note
        book.ratings.push({ userId, grade });

        // Recalcule la moyenne
        let totalGrade = 0;
        const totalRatings = book.ratings.length;

        book.ratings.forEach(rating => {
          totalGrade += rating.grade;
        });

        book.averageRating = Math.round((totalGrade / totalRatings)*100)/100 ;

        // Sauvegarde
        book.save()
          .then(updatedBook => res.status(200).json(updatedBook))
          .catch(error => res.status(500).json({ error }));
      } else {
        res.status(400).json({ error: "Déjà une note pour cet utilisateur." });
      }
    })
    .catch(error => res.status(404).json({ error }));
};
