
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initDashboard();
});

/* --- TAB NAVIGATION --- */
function initTabs() {
    const tabs = document.querySelectorAll('.tabs li');
    const tabContentBoxes = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(item => item.classList.remove('is-active'));
            // Remove active content
            tabContentBoxes.forEach(box => {
                box.style.display = 'none';
                box.classList.remove('is-active');
            });

            // Activate clicked tab
            tab.classList.add('is-active');
            const target = tab.dataset.tab;
            const targetContent = document.getElementById(target);
            if (targetContent) {
                targetContent.style.display = 'block';
                setTimeout(() => targetContent.classList.add('is-active'), 10); // Fade effect hook
            }
        });
    });
}

/* --- DASHBOARD LOGIC --- */

// State
let allData = {}; // structure: data[model][index][language] = [ {answer, scores...} ]
let models = new Set();
let queryMap = new Map(); // index -> English Query String
let availableIndices = new Set();
let modelFileMap = new Map(); // Model Name -> Filename

const CSV_FILES = [
    'assets/cohere-8b_eval_scoring.csv',
    'assets/cohere-32b_eval_scoring.csv',
    'assets/magistral_eval_scoring.csv',
    'assets/qwen_eval_scoring.csv',
    'assets/sarvam_eval_scoring.csv'
];

const TARGET_LANGUAGES = ['english', 'hindi', 'chinese', 'swahili', 'hebrew', 'braz-port'];
const LANG_DISPLAY_MAP = {
    'english': 'English',
    'hindi': 'Hindi',
    'chinese': 'Chinese',
    'swahili': 'Swahili',
    'hebrew': 'Hebrew',
    'braz-port': 'Brazilian Portuguese'
};

async function initDashboard() {
    const loader = document.getElementById('loading-indicator');

    try {
        await loadAllCSVs();
        populateDropdowns();

        loader.style.display = 'none';

        // Listeners
        document.getElementById('model-select').addEventListener('change', () => {
            updateDownloadButton();
            renderGrid();
        });
        document.getElementById('query-select').addEventListener('change', renderGrid);

        // Initial render if data exists
        const modelSelect = document.getElementById('model-select');
        const querySelect = document.getElementById('query-select');
        if (modelSelect.options.length > 1 && querySelect.options.length > 1) {
            modelSelect.selectedIndex = 1; // Select first real model
            querySelect.selectedIndex = 1; // Select first real query
            updateDownloadButton();
            renderGrid();
        }

    } catch (error) {
        console.error("Dashboard Init Error:", error);
        loader.innerHTML = `<p class="has-text-danger">Error loading data. Please reload.</p>`;
    }
}

function loadAllCSVs() {
    const promises = CSV_FILES.map(file => fetch(file).then(res => res.text()));

    return Promise.all(promises).then(results => {
        results.forEach((csvText, i) => {
            const parsed = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true // helps with scores
            });

            processData(parsed.data, CSV_FILES[i]);
        });
    });
}

function processData(rows, filename) {
    rows.forEach(row => {
        // Expected cols: model, query, language, answer, scores...
        const model = row['model'];
        const query = row['query'];
        const lang = (row['language'] || "").toLowerCase();
        const index = row['index']; // Using index as unique identifier for query across languages

        if (!model || !query || !lang || index === undefined || index === null) return;

        models.add(model);
        availableIndices.add(index);

        // Map model to filename if not already mapped
        if (filename && !modelFileMap.has(model)) {
            modelFileMap.set(model, filename);
        }

        // Map index to English query for display
        if (lang === 'english' && !queryMap.has(index)) {
            queryMap.set(index, query);
        }
        // Fallback: if map doesn't have index yet, just put current query (will be overwritten by english hopefully, or at least have something)
        if (!queryMap.has(index)) {
            queryMap.set(index, query);
        }


        if (!allData[model]) allData[model] = {};
        if (!allData[model][index]) allData[model][index] = {};
        if (!allData[model][index][lang]) allData[model][index][lang] = [];

        allData[model][index][lang].push(row);
    });
}

function populateDropdowns() {
    const modelSelect = document.getElementById('model-select');
    const querySelect = document.getElementById('query-select');

    // Clear loading
    modelSelect.innerHTML = '<option value="">Select a Model</option>';
    querySelect.innerHTML = '<option value="">Select a Query</option>';

    Array.from(models).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = m;
        modelSelect.appendChild(opt);
    });

    // Populate queries using the map (Index -> English Query)
    // Sort by index numeric
    const sortedIndices = Array.from(availableIndices).sort((a, b) => a - b);

    sortedIndices.forEach(idx => {
        const queryText = queryMap.get(idx) || `Query ${idx}`;
        const opt = document.createElement('option');
        opt.value = idx; // Value is the index
        opt.innerText = queryText.length > 120 ? queryText.substring(0, 120) + '...' : queryText;
        opt.title = queryText; // Tooltip full query
        querySelect.appendChild(opt);
    });
}

function updateDownloadButton() {
    const model = document.getElementById('model-select').value;
    const downloadBtn = document.getElementById('download-csv-btn');

    if (!downloadBtn) return;

    if (model && modelFileMap.has(model)) {
        const filename = modelFileMap.get(model);
        downloadBtn.href = filename;
        // filename is like '/assets/foo.csv'. 
        downloadBtn.setAttribute('download', filename.split('/').pop());
        downloadBtn.style.display = 'inline-flex';
    } else {
        downloadBtn.style.display = 'none';
        downloadBtn.removeAttribute('download');
    }
}

function renderGrid() {
    const model = document.getElementById('model-select').value;
    const queryIdx = document.getElementById('query-select').value; // This is the index (string or number)
    const grid = document.getElementById('response-grid');

    grid.innerHTML = ''; // clear

    if (!model || !queryIdx) {
        grid.innerHTML = '<div class="column is-12 has-text-centered">Please select both a model and a query.</div>';
        return;
    }

    TARGET_LANGUAGES.forEach(lang => {
        const col = document.createElement('div');
        col.className = 'column is-6'; // 2 per row

        // Retrieve data using model, queryIdx, and lang
        // queryIdx comes from value which might be string, but CSV parser dynamicTyping makes index number. 
        // Let's handle loosely.
        const modelData = allData[model];
        const queryData = modelData ? modelData[queryIdx] : null;
        const langDataList = queryData ? queryData[lang] : null;

        // Build Card
        let contentHtml = '';
        if (!langDataList || langDataList.length === 0) {
            contentHtml = `<p class="has-text-grey-light is-italic">No response found for ${lang}</p>`;
        } else {
            // Randomly select one response from the list
            const randomIndex = Math.floor(Math.random() * langDataList.length);
            const item = langDataList[randomIndex];

            // Extract scores
            // CSV headers: Detail and Completeness, Linguistic Quality, Factual Correctness, Actionability, Riskiness, Overall
            const scores = {
                'Detail': item['Detail and Completeness'],
                'Linguistic': item['Linguistic Quality'],
                'Factual': item['Factual Correctness'],
                'Actionability': item['Actionability'],
                'Riskiness': item['Riskiness'],
                'Overall': item['Overall']
            };

            contentHtml = `
                <div class="dashboard-card">
                    <header class="card-header">
                        <p class="card-header-title has-background-light">
                             ${LANG_DISPLAY_MAP[lang] || lang}
                        </p>
                    </header>
                    <div class="card-response-content">
                        ${item.answer}
                    </div>
                    <div class="card-scores">
                         ${Object.entries(scores).map(([k, v]) => `
                            <div class="score-item">
                                <span class="score-label">${k}</span>
                                <span class="score-value ${k === 'Overall' ? 'overall' : ''}">${v !== undefined ? v : '-'}</span>
                            </div>
                         `).join('')}
                    </div>
                </div>
            `;
        }

        col.innerHTML = contentHtml || `
             <div class="dashboard-card empty">
                <header class="card-header"><p class="card-header-title">${LANG_DISPLAY_MAP[lang] || lang}</p></header>
                <div class="card-response-content has-text-grey">No Data</div>
             </div>
        `;
        grid.appendChild(col);
    });
}
