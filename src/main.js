import './style.css';

// Default target folder structures
const DEFAULT_FOLDERS = {
  Datasets_And_Reports: { title: "Datasets & Reports", sub: "CSV, Excel, PowerBI, databases", active: true },
  Study_Materials: { title: "Study Materials", sub: "Exam routines, roadmaps, cheat sheets", active: true },
  Official_Docs_And_IDs: { title: "Official Docs & IDs", sub: "Aadhaar, PAN, agreements, licenses", active: true },
  Personal_And_Resumes: { title: "Resumes & Personal", sub: "Resumes, CVs, name-specific folders", active: true },
  Installers: { title: "Installers", sub: "Executable setups (.exe, .msi)", active: true },
  Archives: { title: "Archives", sub: "Compressed files (.zip, .rar, .7z)", active: true },
  Code_And_Projects: { title: "Code & Projects", sub: "Notebooks, scripts, codebase directories", active: true },
  Media_And_Images: { title: "Media & Images", sub: "Pictures, logos, screenshots, audio/video", active: true },
  Other: { title: "Other / Unsorted", sub: "Miscellaneous files and folders", active: true }
};

// State Variables
let rootDirHandle = null;
let rawItems = [];
let activeDecisions = [];
let customExtensionRules = {}; // ext -> category

// Helper: Get file extension
function getExtension(name) {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return '';
  return name.slice(lastDot).toLowerCase();
}

// Helper: Check Browser Support
function checkBrowserSupport() {
  const isSupported = 'showDirectoryPicker' in window;
  if (!isSupported) {
    const mainContainer = document.getElementById('main-container');
    mainContainer.innerHTML = `
      <section class="screen active">
        <div class="glass-card text-center" style="max-width: 620px; margin: 2rem auto;">
          <span style="font-size: 4rem; display: block; margin-bottom: 1rem;">⚠️</span>
          <h2 class="section-title">Browser Not Supported</h2>
          <p class="welcome-subtitle" style="margin-bottom: 1.5rem;">
            FolderFlow utilizes the modern <strong>File System Access API</strong> to organize files directly on your disk.
            This API is currently supported only on Chromium-based browsers like <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
          </p>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem; border-radius: 8px; text-align: left; font-size: 0.85rem; color: var(--text-muted);">
            Please open this application in Chrome or Edge to organize your local directories.
          </div>
        </div>
      </section>
    `;
    // Hide standard select buttons
    const selectBtn = document.getElementById('btn-select-folder');
    if (selectBtn) selectBtn.style.display = 'none';
  }
}

// Helper: Screen switching
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const activeScreen = document.getElementById(screenId);
  if (activeScreen) {
    activeScreen.classList.add('active');
  }
}

// Helper: Compute SHA-256 Hash of File
async function calculateHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Classifier Logic
function classifyItem(name, isDir, customRules) {
  const nameLower = name.toLowerCase();
  const ext = getExtension(nameLower);
  
  // Check custom rules first
  if (!isDir && customRules && customRules[ext]) {
    return customRules[ext];
  }
  
  // 1. Resumes
  if (nameLower.includes('resume') || nameLower.includes('cv')) {
    if (!isDir && ['.pdf', '.docx', '.doc', '.xlsx'].includes(ext)) {
      return 'Personal_And_Resumes';
    }
    if (isDir) {
      return 'Personal_And_Resumes';
    }
  }
  
  // 2. Official Docs & IDs
  const officialKeywords = [
    'aadhaar', 'sumanpan', 'driving license', 'driving_license', 'pan.pdf', 'pan_card',
    'rentagreement', 'rent_agreement', 'rentargreement', 'policeverification', 'police_verification',
    'identity', 'deed', 'possession', 'water_test', '112_203_list_of_director', 'proof_of_identity',
    'proof_of_possession', 'declaration', 'partnership_deed', 'suman (ma).pdf', 'driving'
  ];
  if (officialKeywords.some(kw => nameLower.includes(kw))) {
    return 'Official_Docs_And_IDs';
  }
  
  // 3. Code & Projects
  const codeExtensions = ['.py', '.ipynb', '.sql', '.json', '.tsx', '.html', '.css', '.js', '.sh', '.bat', '.xml'];
  if (!isDir && codeExtensions.includes(ext)) {
    return 'Code_And_Projects';
  }
  const codeKeywords = [
    'scaffold', 'nextjs', 'react', 'sqlpractice', 'code', 'script', 'pipeline',
    'crawler', 'bot', 'api', 'server', 'app', 'git', 'github', 'programming',
    'assignment', 'biocorrector', 'bindformer', 'telco_automl'
  ];
  if (isDir && codeKeywords.some(kw => nameLower.includes(kw))) {
    return 'Code_And_Projects';
  }
  if (isDir && (nameLower.startsWith('af-') || nameLower.startsWith('qf-') || nameLower.startsWith('archive') || nameLower.startsWith('attachments'))) {
    return 'Code_And_Projects';
  }
  
  // 4. Datasets & Reports
  const datasetExtensions = ['.csv', '.xlsx', '.xls', '.pbix', '.db', '.sqlite'];
  if (!isDir && datasetExtensions.includes(ext)) {
    return 'Datasets_And_Reports';
  }
  const datasetKeywords = [
    'dataset', 'census', 'loyalty', 'sales', 'employee', 'inventory', 'mock_data',
    'churn', 'pricing', 'cust_table', 'cust_loyalty', 'electronics_dataset',
    'insurance_dataset', 'laptop_pricing', 'trading_data', 'rent.csv', 'rrrrr.csv',
    'countaa.xlsx', 'car_sales', 'vlookup', 'xlookup', 'pivot', 'dashboard', 'report'
  ];
  if (datasetKeywords.some(kw => nameLower.includes(kw))) {
    if (isDir) {
      return 'Datasets_And_Reports';
    }
    if (!isDir && ext !== '.pdf') {
      return 'Datasets_And_Reports';
    }
  }
  
  // 5. Study Materials
  const studyKeywords = [
    'study', 'routine', 'ssc', 'cgl', 'jssc', 'jpsc', 'police', 'constable',
    'syllabus', 'exam', 'polity', 'sambhidhan', 'gs', 'grokking', 'algorithms',
    'cheat_sheet', 'cheat sheet', 'cheatsheet', 'practice', 'exercise', 'formulas',
    'questions', 'quant', 'gmat', 'vocab', 'lecture', 'notes', 'tutorial',
    'roadmaps', 'roadmap', 'mcq', 'test_series', 'solved', 'unsolved', 'paper',
    'spreadsheet practice', 'excel practical', 'gpc', 'ctr', 'cpc'
  ];
  if (studyKeywords.some(kw => nameLower.includes(kw))) {
    if (!isDir && !['.csv', '.xlsx', '.xls', '.ipynb', '.sql'].includes(ext)) {
      return 'Study_Materials';
    }
  }
  
  // 6. Installers
  const installerExtensions = ['.exe', '.msi', '.dmg', '.pkg'];
  if (!isDir && installerExtensions.includes(ext)) {
    return 'Installers';
  }
  if (isDir && nameLower === '[guru3d]-ddu') {
    return 'Installers';
  }
  
  // 7. Archives
  const archiveExtensions = ['.zip', '.tar', '.gz', '.rar', '.7z'];
  if (!isDir && archiveExtensions.includes(ext)) {
    return 'Archives';
  }
  
  // 8. Media & Images
  const mediaExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp4', '.mp3', '.wav', '.pptx', '.ppt'];
  if (!isDir && mediaExtensions.includes(ext)) {
    return 'Media_And_Images';
  }
  
  // 9. Personal Folders Fallback
  if (['suman', 'pankaj'].some(kw => nameLower.includes(kw))) {
    return 'Personal_And_Resumes';
  }
  
  // Fallbacks by Extension
  if (!isDir) {
    if (['.pdf', '.docx', '.doc', '.rtf', '.txt', '.md'].includes(ext)) {
      return 'Study_Materials';
    }
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
      return 'Media_And_Images';
    }
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
      return 'Archives';
    }
    if (['.exe', '.msi'].includes(ext)) {
      return 'Installers';
    }
    if (['.py', '.ipynb', '.js', '.ts', '.tsx', '.html', '.css', '.sql', '.sh', '.bat'].includes(ext)) {
      return 'Code_And_Projects';
    }
    if (['.csv', '.xlsx', '.xls', '.pbix', '.db'].includes(ext)) {
      return 'Datasets_And_Reports';
    }
  } else {
    if (['practice', 'learn', 'class'].some(kw => nameLower.includes(kw))) {
      return 'Study_Materials';
    }
    if (['data', 'excel', 'powerbi', 'db', 'lookup', 'chart'].some(kw => nameLower.includes(kw))) {
      return 'Datasets_And_Reports';
    }
    if (['project', 'src', 'web', 'app'].some(kw => nameLower.includes(kw))) {
      return 'Code_And_Projects';
    }
  }
  
  return 'Other';
}

// Filename Cleaner
function cleanFilename(filename, category, casing) {
  if (casing === 'none') {
    return filename;
  }
  
  const lastDot = filename.lastIndexOf('.');
  let base = lastDot === -1 ? filename : filename.slice(0, lastDot);
  const ext = lastDot === -1 ? '' : filename.slice(lastDot);
  
  // 1. Strip trailing duplicates or copies
  const pattern = /\s*[-_]?\s*(?:Copy|\(\d+\))\s*$/i;
  let prevBase = null;
  while (prevBase !== base) {
    prevBase = base;
    base = base.replace(pattern, '');
  }
  
  // 2. Replace spacing variants
  base = base.replace(/[\s_+]+/g, ' ').trim();
  base = base.replace(/^[-_]+|[-_]+$/g, '');
  
  if (!base) {
    base = lastDot === -1 ? filename : filename.slice(0, lastDot);
  }
  
  // 3. Apply Casing Style
  if (casing === 'snake_case') {
    base = base.replace(/\s+/g, '_');
  } else if (casing === 'camelCase') {
    base = base.split(' ').map((word, idx) => {
      const w = word.toLowerCase();
      if (idx === 0) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  } else if (casing === 'title_case') {
    const words = base.split(' ');
    const caps = words.map(word => {
      const wUpper = word.toUpperCase();
      if (['SSC', 'CGL', 'JSSC', 'JPSC', 'PAN', 'PDF', 'ID', 'IDS', 'SQL', 'CPC', 'CTR', 'CPM', 'GMAT', 'DDU', 'OBS', 'VLOOKUP', 'XLOOKUP'].includes(wUpper)) {
        return wUpper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
    base = caps.join(' ');
  }
  
  return base + ext;
}

// Step 1: Scan selected directory
async function selectDirectory() {
  try {
    rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    showScreen('screen-scanning');
    await scanDirectory();
  } catch (err) {
    console.error("Directory picking failed/aborted:", err);
  }
}

// Step 2: Read handles and catalog metadata
async function scanDirectory() {
  rawItems = [];
  const statusEl = document.getElementById('scanning-status');
  const progressEl = document.getElementById('scanning-progress');
  
  statusEl.textContent = "Cataloging folder contents...";
  progressEl.style.width = "10%";
  
  const entries = [];
  for await (const entry of rootDirHandle.values()) {
    entries.push(entry);
  }
  
  const total = entries.length;
  if (total === 0) {
    alert("The selected directory is empty!");
    showScreen('screen-welcome');
    return;
  }
  
  const ignoreNames = ['desktop.ini', 'organize_downloads.py', 'Duplicates'];
  let processed = 0;
  
  for (const entry of entries) {
    const nameLower = entry.name.toLowerCase();
    
    // Ignore self, system file, and our target category directory name
    if (ignoreNames.includes(entry.name) || nameLower.startsWith('~$') || Object.keys(DEFAULT_FOLDERS).includes(entry.name)) {
      processed++;
      continue;
    }
    
    const isDir = entry.kind === 'directory';
    let size = 0;
    let hash = null;
    
    statusEl.textContent = `Analyzing ${entry.name}...`;
    
    if (!isDir) {
      try {
        const file = await entry.getFile();
        size = file.size;
        
        // Hash files < 30MB for duplicates isolation
        if (size < 30 * 1024 * 1024) {
          hash = await calculateHash(file);
        } else {
          hash = `pseudo-${entry.name}-${size}`;
        }
      } catch (err) {
        console.warn(`Could not read metadata for file: ${entry.name}`, err);
      }
    }
    
    rawItems.push({
      name: entry.name,
      isDir,
      size,
      hash,
      handle: entry
    });
    
    processed++;
    const percent = Math.round((processed / total) * 100);
    progressEl.style.width = `${percent}%`;
  }
  
  // Populate UI settings & stats
  document.getElementById('summary-dir-name').textContent = rootDirHandle.name;
  document.getElementById('summary-total-items').textContent = rawItems.length;
  
  renderFolderChecklist();
  renderSummaryCategories();
  populateCustomExtensionSelects();
  
  showScreen('screen-customize');
}

// Render checkboxes for folder creation
function renderFolderChecklist() {
  const container = document.getElementById('checklist-folders');
  container.innerHTML = '';
  
  Object.entries(DEFAULT_FOLDERS).forEach(([key, config]) => {
    container.innerHTML += `
      <label class="checklist-item">
        <input type="checkbox" value="${key}" checked>
        <div class="checklist-label-wrapper">
          <span class="checklist-title">${config.title}</span>
          <span class="checklist-sub">${config.sub}</span>
        </div>
      </label>
    `;
  });
}

// Render categorization stats
function renderSummaryCategories() {
  const container = document.getElementById('summary-categories-list');
  container.innerHTML = '';
  
  const counts = {};
  rawItems.forEach(item => {
    const cat = classifyItem(item.name, item.isDir, customExtensionRules);
    counts[cat] = (counts[cat] || 0) + 1;
  });
  
  Object.entries(counts).forEach(([cat, val]) => {
    const title = DEFAULT_FOLDERS[cat]?.title || cat;
    container.innerHTML += `
      <div class="mini-cat-item">
        <span>${title}</span>
        <strong>${val}</strong>
      </div>
    `;
  });
}

// Populate the custom rule select dropdown
function populateCustomExtensionSelects() {
  const select = document.getElementById('select-custom-target');
  select.innerHTML = '';
  
  Object.entries(DEFAULT_FOLDERS).forEach(([key, config]) => {
    select.innerHTML += `<option value="${key}">${config.title}</option>`;
  });
}

// Add Custom Rule Button action
function addCustomExtensionRule() {
  const input = document.getElementById('input-custom-ext');
  let ext = input.value.trim().toLowerCase();
  
  if (!ext) return;
  if (!ext.startsWith('.')) {
    ext = '.' + ext;
  }
  
  const select = document.getElementById('select-custom-target');
  const target = select.value;
  
  customExtensionRules[ext] = target;
  input.value = '';
  
  renderCustomRulesTags();
  renderSummaryCategories();
}

// Render custom tag filters
function renderCustomRulesTags() {
  const container = document.getElementById('custom-rules-list');
  container.innerHTML = '';
  
  Object.entries(customExtensionRules).forEach(([ext, target]) => {
    const targetTitle = DEFAULT_FOLDERS[target]?.title || target;
    const tag = document.createElement('span');
    tag.className = 'rule-tag';
    tag.innerHTML = `
      <span>${ext} ➔ ${targetTitle}</span>
      <span class="rule-tag-close" data-ext="${ext}">×</span>
    `;
    container.appendChild(tag);
  });
  
  // Close tag click
  container.querySelectorAll('.rule-tag-close').forEach(close => {
    close.addEventListener('click', (e) => {
      const extToDelete = e.target.dataset.ext;
      delete customExtensionRules[extToDelete];
      renderCustomRulesTags();
      renderSummaryCategories();
    });
  });
}

// Step 3: Run dry run and show preview
function showPreviewScreen() {
  planOrganization();
  renderPreviewTable();
  
  // Populate filter dropdown
  const filterSelect = document.getElementById('preview-filter-category');
  filterSelect.innerHTML = `<option value="all">All Categories</option>`;
  
  const activeFolders = new Set(activeDecisions.map(d => d.destFolder));
  activeFolders.forEach(folder => {
    const title = DEFAULT_FOLDERS[folder]?.title || folder;
    filterSelect.innerHTML += `<option value="${folder}">${title}</option>`;
  });
  
  // Metrics
  const moves = activeDecisions.filter(d => !d.isDup).length;
  const dups = activeDecisions.filter(d => d.isDup).length;
  document.getElementById('preview-stat-moves').textContent = moves;
  document.getElementById('preview-stat-duplicates').textContent = dups;
  
  showScreen('screen-preview');
}

// Plan moves, casing, duplicates
function planOrganization() {
  const casing = document.querySelector('input[name="file-casing"]:checked').value;
  const isolateDuplicates = document.getElementById('chk-isolate-duplicates').checked;
  
  const selectedFolders = new Set();
  document.querySelectorAll('#checklist-folders input[type="checkbox"]:checked').forEach(chk => {
    selectedFolders.add(chk.value);
  });
  
  const hashGroups = {};
  rawItems.forEach(item => {
    if (!item.isDir && item.hash) {
      if (!hashGroups[item.hash]) hashGroups[item.hash] = [];
      hashGroups[item.hash].push(item);
    }
  });
  
  activeDecisions = [];
  const takenNames = {};
  Object.keys(DEFAULT_FOLDERS).forEach(k => takenNames[k] = new Set());
  takenNames['Duplicates'] = new Set();
  
  const processedFiles = new Set();
  
  // 1. Files
  rawItems.forEach(item => {
    if (item.isDir) return;
    if (processedFiles.has(item.name)) return;
    
    let category = classifyItem(item.name, false, customExtensionRules);
    if (!selectedFolders.has(category)) {
      category = 'Other';
    }
    
    const clean = cleanFilename(item.name, category, casing);
    
    if (isolateDuplicates && item.hash && hashGroups[item.hash].length > 1) {
      const sortedDups = [...hashGroups[item.hash]].sort((a, b) => a.name.length - b.name.length);
      const primary = sortedDups[0];
      const duplicates = sortedDups.slice(1);
      
      sortedDups.forEach(d => processedFiles.add(d.name));
      
      // Primary Copy
      let finalName = cleanFilename(primary.name, category, casing);
      const lastDot = finalName.lastIndexOf('.');
      const base = lastDot === -1 ? finalName : finalName.slice(0, lastDot);
      const ext = lastDot === -1 ? '' : finalName.slice(lastDot);
      
      let counter = 1;
      let checkName = finalName.toLowerCase();
      while (takenNames[category].has(checkName)) {
        finalName = `${base}_${counter}${ext}`;
        checkName = finalName.toLowerCase();
        counter++;
      }
      takenNames[category].add(checkName);
      
      activeDecisions.push({
        srcItem: primary,
        destFolder: category,
        destName: finalName,
        isDup: false,
        reason: "Primary copy of hashed files"
      });
      
      // Duplicates
      duplicates.forEach(dup => {
        let cleanDup = cleanFilename(dup.name, 'Duplicates', casing);
        const dDot = cleanDup.lastIndexOf('.');
        const dBase = dDot === -1 ? cleanDup : cleanDup.slice(0, dDot);
        const dExt = dDot === -1 ? '' : cleanDup.slice(dDot);
        
        let dCounter = 1;
        let dCheck = cleanDup.toLowerCase();
        while (takenNames['Duplicates'].has(dCheck)) {
          cleanDup = `${dBase}_duplicate_${dCounter}${dExt}`;
          dCheck = cleanDup.toLowerCase();
          dCounter++;
        }
        takenNames['Duplicates'].add(dCheck);
        
        activeDecisions.push({
          srcItem: dup,
          destFolder: 'Duplicates',
          destName: cleanDup,
          isDup: true,
          reason: `Exact duplicate of ${primary.name}`
        });
      });
    } else {
      processedFiles.add(item.name);
      
      let finalName = clean;
      const lastDot = finalName.lastIndexOf('.');
      const base = lastDot === -1 ? finalName : finalName.slice(0, lastDot);
      const ext = lastDot === -1 ? '' : finalName.slice(lastDot);
      
      let counter = 1;
      let checkName = finalName.toLowerCase();
      while (takenNames[category].has(checkName)) {
        finalName = `${base}_${counter}${ext}`;
        checkName = finalName.toLowerCase();
        counter++;
      }
      takenNames[category].add(checkName);
      
      activeDecisions.push({
        srcItem: item,
        destFolder: category,
        destName: finalName,
        isDup: false,
        reason: "Unique file"
      });
    }
  });
  
  // 2. Directories
  rawItems.forEach(item => {
    if (!item.isDir) return;
    
    let category = classifyItem(item.name, true, customExtensionRules);
    if (!selectedFolders.has(category)) {
      category = 'Other';
    }
    
    let clean = item.name.replace(/[\s_+]+/g, ' ').trim();
    clean = clean.split(' ').map(w => {
      const u = w.toUpperCase();
      if (['DVC', 'DDU', 'SQL', 'CPC', 'CTR', 'CPM'].includes(u)) return u;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
    
    if (category === 'Code_And_Projects') {
      clean = clean.replace(/\s+/g, '_');
    }
    
    let finalName = clean;
    let counter = 1;
    let checkName = finalName.toLowerCase();
    while (takenNames[category].has(checkName)) {
      finalName = `${clean}_${counter}`;
      checkName = finalName.toLowerCase();
      counter++;
    }
    takenNames[category].add(checkName);
    
    activeDecisions.push({
      srcItem: item,
      destFolder: category,
      destName: finalName,
      isDup: false,
      reason: "Directory"
    });
  });
}

// Render Preview rows
function renderPreviewTable(filterQuery = '', filterCategory = 'all') {
  const tbody = document.getElementById('preview-tbody');
  tbody.innerHTML = '';
  
  const query = filterQuery.toLowerCase();
  
  const filtered = activeDecisions.filter(d => {
    const nameMatch = d.srcItem.name.toLowerCase().includes(query) || d.destName.toLowerCase().includes(query);
    const categoryMatch = filterCategory === 'all' || d.destFolder === filterCategory;
    return nameMatch && categoryMatch;
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 2rem; color: var(--text-dark);">No planned moves match filters</td></tr>`;
    return;
  }
  
  filtered.forEach(d => {
    const isDir = d.srcItem.isDir ? ' (DIR)' : '';
    const badgeClass = d.isDup ? 'dest-badge dest-badge-duplicate' : 'dest-badge';
    const folderTitle = DEFAULT_FOLDERS[d.destFolder]?.title || d.destFolder;
    
    tbody.innerHTML += `
      <tr>
        <td class="preview-original">${d.srcItem.name}${isDir}</td>
        <td class="col-arrow">➔</td>
        <td>
          <span class="${badgeClass}">${folderTitle}</span>
          <span class="dest-name-clean">${d.destName}</span>
        </td>
      </tr>
    `;
  });
}

// Helper: Move directories recursively
async function moveDirectory(srcDirHandle, destParentHandle, newName) {
  const destDirHandle = await destParentHandle.getDirectoryHandle(newName, { create: true });
  
  // 1. Gather child entries into an array to avoid mutating the directory while iterating
  const entries = [];
  for await (const entry of srcDirHandle.values()) {
    entries.push(entry);
  }
  
  // 2. Relocate entries
  for (const entry of entries) {
    try {
      if (entry.kind === 'file') {
        await entry.move(destDirHandle);
      } else if (entry.kind === 'directory') {
        await moveDirectory(entry, destDirHandle, entry.name);
      }
    } catch (err) {
      console.error(`Error moving child entry '${entry.name}' within '${srcDirHandle.name}':`, err);
    }
  }
  
  // 3. Remove the now-empty source folder
  await srcDirHandle.remove({ recursive: true });
}

// Step 4: Run moves on disk
async function executeMovements() {
  showScreen('screen-executing');
  document.getElementById('exec-progress-container').style.display = 'block';
  document.getElementById('exec-success-container').style.display = 'none';
  
  const statusEl = document.getElementById('exec-status');
  const progressEl = document.getElementById('exec-progress');
  
  let movedCount = 0;
  let dupCount = 0;
  
  const total = activeDecisions.length;
  const neededFolders = new Set(activeDecisions.map(d => d.destFolder));
  const folderHandles = {};
  
  // Create folders
  for (const f of neededFolders) {
    statusEl.textContent = `Creating directory: ${f}...`;
    folderHandles[f] = await rootDirHandle.getDirectoryHandle(f, { create: true });
  }
  
  let index = 0;
  for (const decision of activeDecisions) {
    const { srcItem, destFolder, destName, isDup } = decision;
    const destDir = folderHandles[destFolder];
    
    statusEl.textContent = `Moving: ${srcItem.name} ➔ ${destFolder}/${destName}...`;
    
    try {
      if (srcItem.isDir) {
        await moveDirectory(srcItem.handle, destDir, destName);
      } else {
        await srcItem.handle.move(destDir, destName);
      }
      
      if (isDup) dupCount++;
      else movedCount++;
    } catch (err) {
      console.error(`Move failed for ${srcItem.name}:`, err);
    }
    
    index++;
    const percent = Math.round((index / total) * 100);
    progressEl.style.width = `${percent}%`;
  }
  
  // Successful layout
  document.getElementById('success-stat-moved').textContent = movedCount;
  document.getElementById('success-stat-dups').textContent = dupCount;
  
  document.getElementById('exec-progress-container').style.display = 'none';
  document.getElementById('exec-success-container').style.display = 'block';
}

// Reset App state
function resetApp() {
  rootDirHandle = null;
  rawItems = [];
  activeDecisions = [];
  customExtensionRules = {};
  document.getElementById('custom-rules-list').innerHTML = '';
  document.getElementById('preview-search').value = '';
  showScreen('screen-welcome');
}

// Helper for safe event listeners
function safeAddListener(id, event, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, callback);
  }
}

// Bind Event Listeners
function initEventListeners() {
  safeAddListener('btn-select-folder', 'click', selectDirectory);
  safeAddListener('logo-refresh', 'click', resetApp);
  
  // Screen 3 Custom rules builder
  safeAddListener('btn-add-custom-rule', 'click', addCustomExtensionRule);
  const inputCustomExt = document.getElementById('input-custom-ext');
  if (inputCustomExt) {
    inputCustomExt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCustomExtensionRule();
    });
  }
  
  // Screen 3 navigation to Preview
  safeAddListener('btn-show-preview', 'click', showPreviewScreen);
  
  // Screen 4 navigation back
  safeAddListener('btn-back-to-customize', 'click', () => {
    showScreen('screen-customize');
  });
  
  // Screen 4 apply
  safeAddListener('btn-execute-moves', 'click', executeMovements);
  
  // Screen 4 Search/Filters
  const previewSearch = document.getElementById('preview-search');
  const previewFilter = document.getElementById('preview-filter-category');
  
  if (previewSearch && previewFilter) {
    const handleFilterChange = () => {
      renderPreviewTable(previewSearch.value, previewFilter.value);
    };
    previewSearch.addEventListener('input', handleFilterChange);
    previewFilter.addEventListener('change', handleFilterChange);
  }
  
  // Screen 5 reset
  safeAddListener('btn-reset-app', 'click', resetApp);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  checkBrowserSupport();
  initEventListeners();
});
