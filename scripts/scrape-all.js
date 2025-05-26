const BibleScraper = require('../lib');
const fs = require('fs').promises;
const path = require('path');

// Create output directory if it doesn't exist
const OUTPUT_DIR = path.join(__dirname, '../data');

async function ensureDirectoryExists(dir) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

async function scrapeTranslation(translationId, translationName) {
    console.log(`Scraping ${translationName} (ID: ${translationId})...`);
    const bible = new BibleScraper(translationId);
    const result = {
        translation: translationName,
        translationId: translationId,
        books: {}
    };

    // Get all books
    for (const book of BibleScraper.BOOKS) {
        console.log(`  Processing book: ${book}`);
        result.books[book] = {
            chapters: {}
        };

        // Get all chapters (we'll start with chapter 1 and increment until we get an error)
        let chapterNum = 1;
        while (true) {
            try {
                const chapterRef = `${book}.${chapterNum}`;
                console.log(`    Processing chapter: ${chapterNum}`);
                const chapter = await bible.chapter(chapterRef);
                
                result.books[book].chapters[chapterNum] = {
                    reference: chapter.reference,
                    version: chapter.version,
                    verses: chapter.verses,
                    copyright: chapter.copyright,
                    audioBibleUrl: chapter.audioBibleUrl,
                    audioBibleCopyright: chapter.audioBibleCopyright
                };

                chapterNum++;
            } catch (error) {
                // If we get an error, we've probably reached the end of the book
                break;
            }
        }
    }

    return result;
}

async function main() {
    try {
        await ensureDirectoryExists(OUTPUT_DIR);

        // Create a metadata file with translation information
        const metadata = {
            translations: BibleScraper.TRANSLATIONS,
            books: BibleScraper.BOOKS,
            lastUpdated: new Date().toISOString()
        };

        await fs.writeFile(
            path.join(OUTPUT_DIR, 'metadata.json'),
            JSON.stringify(metadata, null, 2)
        );

        // Scrape each translation
        for (const [name, id] of Object.entries(BibleScraper.TRANSLATIONS)) {
            try {
                const data = await scrapeTranslation(id, name);
                await fs.writeFile(
                    path.join(OUTPUT_DIR, `${name.toLowerCase()}.json`),
                    JSON.stringify(data, null, 2)
                );
                console.log(`Completed scraping ${name}`);
            } catch (error) {
                console.error(`Error scraping ${name}:`, error);
            }
        }

        console.log('Scraping completed successfully!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main(); 