// DOM Elements
const translationSelect = document.getElementById('translation');
const bookSelect = document.getElementById('book');
const chapterSelect = document.getElementById('chapter');
const searchInput = document.getElementById('search');
const searchButton = document.getElementById('searchButton');
const contentDiv = document.getElementById('content');
const searchResultsDiv = document.getElementById('searchResults');
const resultsListDiv = document.getElementById('resultsList');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const generateKeyButton = document.getElementById('generateKey');
const apiKeyDisplay = document.querySelector('.api-key-display');
const apiKeyValue = document.querySelector('.api-key-value');
const apiKeyDetails = document.querySelector('.api-key-details');
const copyButton = document.querySelector('.copy-button');

// State
let translations = {};
let books = [];
let currentApiKey = null;

// Generate API Key
async function generateApiKey() {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    
    if (!name || !email) {
        alert('Please enter both name and email');
        return;
    }
    
    try {
        const response = await fetch('/api/generate-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate API key');
        }
        
        const data = await response.json();
        currentApiKey = data.apiKey;
        
        // Display API key
        apiKeyValue.textContent = currentApiKey;
        apiKeyDetails.innerHTML = `
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Created:</strong> ${new Date(data.created).toLocaleString()}</p>
        `;
        
        apiKeyDisplay.classList.remove('hidden');
        
        // Store API key in localStorage
        localStorage.setItem('bibleApiKey', currentApiKey);
    } catch (error) {
        alert(error.message);
    }
}

// Copy API key to clipboard
function copyApiKey() {
    if (!currentApiKey) return;
    
    navigator.clipboard.writeText(currentApiKey).then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
    }).catch(() => {
        alert('Failed to copy API key');
    });
}

// Load saved API key
function loadSavedApiKey() {
    const savedKey = localStorage.getItem('bibleApiKey');
    if (savedKey) {
        currentApiKey = savedKey;
        apiKeyValue.textContent = savedKey;
        apiKeyDisplay.classList.remove('hidden');
        
        // Fetch API key info
        fetchApiKeyInfo(savedKey);
    }
}

// Fetch API key info
async function fetchApiKeyInfo(apiKey) {
    try {
        const response = await fetch('/api/key-info', {
            headers: {
                'x-api-key': apiKey
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            apiKeyDetails.innerHTML = `
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Created:</strong> ${new Date(data.created).toLocaleString()}</p>
                <p><strong>Last Used:</strong> ${new Date(data.lastUsed).toLocaleString()}</p>
            `;
        }
    } catch (error) {
        console.error('Error fetching API key info:', error);
    }
}

// Update API key usage
async function updateApiKeyUsage() {
    if (!currentApiKey) return;
    
    try {
        await fetch('/api/update-key-usage', {
            method: 'POST',
            headers: {
                'x-api-key': currentApiKey
            }
        });
    } catch (error) {
        console.error('Error updating API key usage:', error);
    }
}

// Load translations
async function loadTranslations() {
    try {
        const response = await fetch('/api/translations');
        translations = await response.json();
        
        translationSelect.innerHTML = '<option value="">Select a translation...</option>';
        Object.entries(translations).forEach(([name, id]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            translationSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

// Load books
async function loadBooks() {
    try {
        const response = await fetch('/api/books');
        books = await response.json();
        
        bookSelect.innerHTML = '<option value="">Select a book...</option>';
        books.forEach(book => {
            const option = document.createElement('option');
            option.value = book;
            option.textContent = book;
            bookSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading books:', error);
    }
}

// Load chapters
async function loadChapters(translation, book) {
    try {
        const response = await fetch(`/api/book/${translation}/${book}`);
        const data = await response.json();
        
        chapterSelect.innerHTML = '<option value="">Select a chapter...</option>';
        Object.keys(data.chapters).forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = `Chapter ${chapter}`;
            chapterSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading chapters:', error);
    }
}

// Load chapter content
async function loadChapterContent(translation, book, chapter) {
    try {
        const response = await fetch(`/api/chapter/${translation}/${book}/${chapter}`);
        const data = await response.json();
        
        let html = `
            <h2>${book} ${chapter}</h2>
            <div class="verses">
        `;
        
        data.verses.forEach(verse => {
            html += `
                <div class="verse">
                    <div class="verse-reference">${verse.reference}</div>
                    <div class="verse-content">${verse.content}</div>
                </div>
            `;
        });
        
        if (data.copyright) {
            html += `<div class="copyright">${data.copyright}</div>`;
        }
        
        html += '</div>';
        contentDiv.innerHTML = html;
    } catch (error) {
        console.error('Error loading chapter content:', error);
        contentDiv.innerHTML = '<p class="error">Error loading chapter content. Please try again.</p>';
    }
}

// Search verses
async function searchVerses(translation, query) {
    try {
        const response = await fetch(`/api/search/${translation}?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results.length === 0) {
            resultsListDiv.innerHTML = '<p>No results found.</p>';
        } else {
            let html = '';
            data.results.forEach(result => {
                html += `
                    <div class="search-result-item">
                        <div class="verse-reference">${result.reference}</div>
                        <div class="verse-content">${result.content}</div>
                    </div>
                `;
            });
            resultsListDiv.innerHTML = html;
        }
        
        searchResultsDiv.classList.remove('hidden');
    } catch (error) {
        console.error('Error searching verses:', error);
        resultsListDiv.innerHTML = '<p class="error">Error searching verses. Please try again.</p>';
    }
}

// Event Listeners
translationSelect.addEventListener('change', () => {
    const translation = translationSelect.value;
    if (translation) {
        bookSelect.value = '';
        chapterSelect.value = '';
        contentDiv.innerHTML = '';
        searchResultsDiv.classList.add('hidden');
    }
});

bookSelect.addEventListener('change', () => {
    const translation = translationSelect.value;
    const book = bookSelect.value;
    if (translation && book) {
        loadChapters(translation, book);
        chapterSelect.value = '';
        contentDiv.innerHTML = '';
        searchResultsDiv.classList.add('hidden');
    }
});

chapterSelect.addEventListener('change', () => {
    const translation = translationSelect.value;
    const book = bookSelect.value;
    const chapter = chapterSelect.value;
    if (translation && book && chapter) {
        loadChapterContent(translation, book, chapter);
        searchResultsDiv.classList.add('hidden');
    }
});

searchButton.addEventListener('click', () => {
    const translation = translationSelect.value;
    const query = searchInput.value.trim();
    
    if (!translation) {
        alert('Please select a translation first.');
        return;
    }
    
    if (!query) {
        alert('Please enter a search term.');
        return;
    }
    
    searchVerses(translation, query);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchButton.click();
    }
});

generateKeyButton.addEventListener('click', generateApiKey);
copyButton.addEventListener('click', copyApiKey);

// Initialize
loadTranslations();
loadBooks();
loadSavedApiKey();

// Update API key usage periodically
setInterval(updateApiKeyUsage, 60000); // Update every minute 