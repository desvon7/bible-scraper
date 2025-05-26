const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3001;

// API Key storage
const API_KEYS_FILE = path.join(__dirname, '../data/api-keys.json');
let apiKeys = {};

// Load API keys
async function loadApiKeys() {
    try {
        const data = await fs.readFile(API_KEYS_FILE, 'utf8');
        apiKeys = JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, create it with empty object
        apiKeys = {};
        await fs.writeFile(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
    }
}
loadApiKeys();

// Save API keys
async function saveApiKeys() {
    await fs.writeFile(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
}

// Generate API key
function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

// API Key middleware
const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !apiKeys[apiKey]) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
};

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load metadata
let metadata;
async function loadMetadata() {
    const metadataPath = path.join(__dirname, '../data/metadata.json');
    const data = await fs.readFile(metadataPath, 'utf8');
    metadata = JSON.parse(data);
}
loadMetadata();

// Cache for Bible translations
const translationCache = new Map();

// Helper function to load a translation
async function loadTranslation(translation) {
    if (translationCache.has(translation)) {
        return translationCache.get(translation);
    }

    const filePath = path.join(__dirname, `../data/${translation.toLowerCase()}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        translationCache.set(translation, parsed);
        return parsed;
    } catch (error) {
        return null;
    }
}

// Routes

// Get all available translations
app.get('/api/translations', (req, res) => {
    res.json(metadata.translations);
});

// Get all books
app.get('/api/books', (req, res) => {
    res.json(metadata.books);
});

// Get a specific verse
app.get('/api/verse/:translation/:book/:chapter/:verse', async (req, res) => {
    const { translation, book, chapter, verse } = req.params;
    
    try {
        const bibleData = await loadTranslation(translation);
        if (!bibleData) {
            return res.status(404).json({ error: 'Translation not found' });
        }

        const chapterData = bibleData.books[book]?.chapters[chapter];
        if (!chapterData) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const verseData = chapterData.verses.find(v => v.reference.endsWith(`:${verse}`));
        if (!verseData) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        res.json({
            translation: bibleData.translation,
            book,
            chapter,
            verse,
            content: verseData.content,
            reference: verseData.reference
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific chapter
app.get('/api/chapter/:translation/:book/:chapter', async (req, res) => {
    const { translation, book, chapter } = req.params;
    
    try {
        const bibleData = await loadTranslation(translation);
        if (!bibleData) {
            return res.status(404).json({ error: 'Translation not found' });
        }

        const chapterData = bibleData.books[book]?.chapters[chapter];
        if (!chapterData) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        res.json({
            translation: bibleData.translation,
            book,
            chapter,
            verses: chapterData.verses,
            copyright: chapterData.copyright,
            audioBibleUrl: chapterData.audioBibleUrl
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific book
app.get('/api/book/:translation/:book', async (req, res) => {
    const { translation, book } = req.params;
    
    try {
        const bibleData = await loadTranslation(translation);
        if (!bibleData) {
            return res.status(404).json({ error: 'Translation not found' });
        }

        const bookData = bibleData.books[book];
        if (!bookData) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json({
            translation: bibleData.translation,
            book,
            chapters: bookData.chapters
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search verses
app.get('/api/search/:translation', async (req, res) => {
    const { translation } = req.params;
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        const bibleData = await loadTranslation(translation);
        if (!bibleData) {
            return res.status(404).json({ error: 'Translation not found' });
        }

        const results = [];
        const searchQuery = query.toLowerCase();

        for (const [book, bookData] of Object.entries(bibleData.books)) {
            for (const [chapter, chapterData] of Object.entries(bookData.chapters)) {
                for (const verse of chapterData.verses) {
                    if (verse.content.toLowerCase().includes(searchQuery)) {
                        results.push({
                            translation: bibleData.translation,
                            book,
                            chapter,
                            verse: verse.reference.split(':')[1],
                            content: verse.content,
                            reference: verse.reference
                        });
                    }
                }
            }
        }

        res.json({
            query,
            results,
            total: results.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get entire database (requires API key)
app.get('/api/database', requireApiKey, async (req, res) => {
    try {
        const dataDir = path.join(__dirname, '../data');
        const files = await fs.readdir(dataDir);
        const database = {};

        for (const file of files) {
            if (file.endsWith('.json') && file !== 'metadata.json') {
                const filePath = path.join(dataDir, file);
                const data = await fs.readFile(filePath, 'utf8');
                const translation = file.replace('.json', '');
                database[translation] = JSON.parse(data);
            }
        }

        res.json({
            timestamp: new Date().toISOString(),
            translations: Object.keys(database),
            data: database
        });
    } catch (error) {
        console.error('Error loading database:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate new API key
app.post('/api/generate-key', async (req, res) => {
    try {
        const { name, email } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }
        
        const apiKey = generateApiKey();
        const timestamp = new Date().toISOString();
        
        apiKeys[apiKey] = {
            name,
            email,
            created: timestamp,
            lastUsed: timestamp
        };
        
        await saveApiKeys();
        
        res.json({
            apiKey,
            name,
            email,
            created: timestamp
        });
    } catch (error) {
        console.error('Error generating API key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update API key usage
app.post('/api/update-key-usage', requireApiKey, async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    apiKeys[apiKey].lastUsed = new Date().toISOString();
    await saveApiKeys();
    res.json({ success: true });
});

// Get API key info
app.get('/api/key-info', requireApiKey, async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const { name, email, created, lastUsed } = apiKeys[apiKey];
    res.json({ name, email, created, lastUsed });
});

// Start server
app.listen(port, () => {
    console.log(`Bible API server running at http://localhost:${port}`);
}); 