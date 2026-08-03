/**
 * Vector Store API Polyfill - Interactive Showcase Application
 * Zero Dependencies | Vanilla JavaScript
 * Enforces strict DOM manipulation security (no innerHTML, textContent / createElement only)
 */

(function () {
  'use strict';

  let activeStore = null;
  let activeStoreId = null;

  // DOM Elements
  const elStatusPill = document.getElementById('embedder-status-pill');
  const elStatusDot = document.getElementById('embedder-status-dot');
  const elStatusText = document.getElementById('embedder-status-text');
  const elBtnResetDB = document.getElementById('btn-reset-db');

  const elStoreListContainer = document.getElementById('store-list-container');
  const elBadgeStoreCount = document.getElementById('badge-store-count');

  const elInputStoreId = document.getElementById('input-store-id');
  const elInputMaxTokens = document.getElementById('input-max-tokens');
  const elInputOverlapTokens = document.getElementById('input-overlap-tokens');
  const elSelectDistanceType = document.getElementById('select-distance-type');
  const elBtnCreateStore = document.getElementById('btn-create-store');

  const elCurrentStoreTitle = document.getElementById('current-store-title');
  const elCurrentStoreSubtitle = document.getElementById('current-store-subtitle');
  const elBadgeContentCount = document.getElementById('badge-content-count');

  const elTextareaInsert = document.getElementById('textarea-insert-content');
  const elChunkPreviewInfo = document.getElementById('chunk-preview-info');
  const elBtnInsertNote = document.getElementById('btn-insert-note');
  const elContentItemsContainer = document.getElementById('content-items-container');

  const elInputSearchQuery = document.getElementById('input-search-query');
  const elInputMaxResults = document.getElementById('input-max-results');
  const elLabelMaxResults = document.getElementById('label-max-results');
  const elInputScoreThreshold = document.getElementById('input-score-threshold');
  const elLabelScoreThreshold = document.getElementById('label-score-threshold');
  const elBtnRunSearch = document.getElementById('btn-run-search');
  const elSearchResultsContainer = document.getElementById('search-results-container');
  const elBadgeSearchResults = document.getElementById('badge-search-results');

  // RAG Elements
  const elBtnSeedDocs = document.getElementById('btn-seed-docs');
  const elRagChatMessages = document.getElementById('rag-chat-messages');
  const elInputRagQuestion = document.getElementById('input-rag-question');
  const elBtnRagSubmit = document.getElementById('btn-rag-submit');
  const elRagPipelineLog = document.getElementById('rag-pipeline-log');
  const elBadgeRagStatus = document.getElementById('badge-rag-status');

  // Moderation Elements
  const elBtnSeedModeration = document.getElementById('btn-seed-moderation');
  const elTextareaModDraft = document.getElementById('textarea-mod-draft');
  const elModAlertContainer = document.getElementById('mod-alert-container');
  const elModReferenceList = document.getElementById('mod-reference-list');
  const elBadgeModCount = document.getElementById('badge-mod-count');

  // Edit Dialog Elements
  const elEditDialog = document.getElementById('edit-dialog');
  const elEditDialogItemId = document.getElementById('edit-dialog-item-id');
  const elTextareaEditContent = document.getElementById('textarea-edit-content');
  const elBtnCloseDialog = document.getElementById('btn-close-dialog');
  const elBtnCancelEdit = document.getElementById('btn-cancel-edit');
  const elBtnSaveEdit = document.getElementById('btn-save-edit');

  let activeEditDialogResolver = null;
  
  // Similarity Matrix Elements
  const elSelectMatrixStore = document.getElementById('select-matrix-store');
  const elBtnGenerateMatrix = document.getElementById('btn-generate-matrix');
  const elMatrixProgressContainer = document.getElementById('matrix-progress-container');
  const elMatrixProgressText = document.getElementById('matrix-progress-text');
  const elMatrixProgressPercent = document.getElementById('matrix-progress-percent');
  const elMatrixProgressBar = document.getElementById('matrix-progress-bar');
  const elMatrixItemsList = document.getElementById('matrix-items-list');
  const elCanvasSimilarityMatrix = document.getElementById('canvas-similarity-matrix');
  const elMatrixTooltip = document.getElementById('matrix-tooltip');
  const elMatrixInspectorEmpty = document.getElementById('matrix-inspector-empty');
  const elMatrixInspectorContent = document.getElementById('matrix-inspector-content');
  const elInspectorScoreBadge = document.getElementById('inspector-score-badge');
  const elInspectorRelationBadge = document.getElementById('inspector-relation-badge');
  const elInspectorDocAId = document.getElementById('inspector-doc-a-id');
  const elInspectorDocAText = document.getElementById('inspector-doc-a-text');
  const elInspectorDocBId = document.getElementById('inspector-doc-b-id');
  const elInspectorDocBText = document.getElementById('inspector-doc-b-text');
  const elInputMatrixQuery = document.getElementById('input-matrix-query');
  const elBtnMatrixQueryScan = document.getElementById('btn-matrix-query-scan');
  const elRelationshipInspectorCard = document.getElementById('relationship-inspector-card');
  const elInspectorCardSubtitle = document.getElementById('inspector-card-subtitle');

  // Similarity Matrix State
  let matrixItems = [];
  let matrixScores = [];
  let matrixQueryScores = null;
  let matrixHoveredCell = null;
  let matrixActiveAxisHighlight = null;
  let matrixInspectedCell = null;
  let matrixInspectorHovered = false;
  let matrixPinnedCell = null;

  // ---------------------------------------------------------------------------
  // Helper: Show setup instructions alert/banner
  // ---------------------------------------------------------------------------
  function showSetupAlert(err) {
    const banner = document.getElementById('setup-banner-container');
    if (banner) {
      banner.style.display = 'block';
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const msg = err && err.message ? err.message : 'Please enable chrome://flags/#semantic-embedder-api in Chrome Canary (>153.0.7979.0) on desktop (Linux, Mac, or Windows).';
    alert('Semantic Embedder API Required\n\n' + msg);
  }

  // ---------------------------------------------------------------------------
  // 1. Initialization & Hardware Detection
  // ---------------------------------------------------------------------------
  async function initApp() {
    setupTabs();
    setupEventListeners();

    // Check availability & model parameters
    const availability = await window.VectorStore.availability();
    const params = await window.VectorStore.params();
    const isAvailable = availability !== 'unavailable' && availability !== 'no';
    const banner = document.getElementById('setup-banner-container');

    if (isAvailable && params.model && params.model.includes('Native')) {
      if (banner) banner.style.display = 'none';
      elStatusDot.classList.remove('simulated');
      elStatusDot.style.background = 'var(--accent-green)';
      elStatusText.textContent = 'Native Semantic Embedder API (' + availability + ')';

      try {
        await seedDefaultStores();
        await refreshStoreList();
        await loadStore('my-app-notes');
        await renderModerationReferenceList();
      } catch (err) {
        console.warn('Error initializing demo stores:', err);
      }
    } else {
      if (banner) banner.style.display = 'block';
      elStatusDot.classList.add('simulated');
      elStatusDot.style.background = 'var(--accent-amber)';
      elStatusText.textContent = 'Semantic Embedder API: Disabled / Unavailable';
      await refreshStoreList();
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Tab Navigation
  // ---------------------------------------------------------------------------
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add('active');

        if (targetId === 'tab-matrix') {
          if (activeStoreId && elSelectMatrixStore) {
            elSelectMatrixStore.value = activeStoreId;
          }
          drawMatrixCanvas();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Helper: Modern Edit Dialog Controller
  // ---------------------------------------------------------------------------
  function showEditDialog(itemId, currentContent) {
    return new Promise((resolve) => {
      if (activeEditDialogResolver) {
        activeEditDialogResolver(null);
      }
      activeEditDialogResolver = resolve;

      elEditDialogItemId.textContent = itemId;
      elTextareaEditContent.value = currentContent || '';

      elEditDialog.showModal();
      
      // Auto-focus and place cursor at the end of content
      elTextareaEditContent.focus();
      const valLength = elTextareaEditContent.value.length;
      elTextareaEditContent.setSelectionRange(valLength, valLength);
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Event Listeners
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Reset DB
    elBtnResetDB.addEventListener('click', async () => {
      const stores = await window.VectorStore.list();
      for (const st of stores) {
        await window.VectorStore.delete(st.id);
      }
      activeStore = null;
      activeStoreId = null;
      matrixPinnedCell = null;
      if (elRelationshipInspectorCard) elRelationshipInspectorCard.classList.remove('pinned');
      if (elInspectorCardSubtitle) {
        elInspectorCardSubtitle.textContent = 'Hover over a grid cell to compare texts';
        elInspectorCardSubtitle.classList.remove('pinned');
      }
      await initApp();
    });

    // Create / Retrieve Store Form
    elBtnCreateStore.addEventListener('click', async () => {
      const storeId = elInputStoreId.value.trim();
      if (!storeId) return;

      const maxTokens = parseInt(elInputMaxTokens.value, 10) || 400;
      const overlapTokens = parseInt(elInputOverlapTokens.value, 10) || 50;
      const distanceType = elSelectDistanceType.value || 'Cosine';

      try {
        const store = await window.VectorStore.create({
          id: storeId,
          chunkingStrategy: {
            maxChunkSizeTokens: maxTokens,
            chunkOverlapTokens: overlapTokens
          },
          distance_type: distanceType
        });
        activeStore = store;
        activeStoreId = store.id;
        await refreshStoreList();
        await renderActiveStore();
      } catch (err) {
        console.error('Error creating store:', err);
        showSetupAlert(err);
      }
    });

    // Textarea Chunk Preview Info
    elTextareaInsert.addEventListener('input', () => {
      const text = elTextareaInsert.value.trim();
      const maxTokens = activeStore ? activeStore.metadata.configuration.maxChunkSizeTokens : 400;
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      const estTokens = Math.max(0, Math.ceil(words * 1.3));
      const estChunks = estTokens === 0 ? 0 : Math.max(1, Math.ceil(estTokens / maxTokens));
      elChunkPreviewInfo.textContent = `Estimated tokens: ${estTokens} | Estimated chunks: ${estChunks} | Chunk size limit: ${maxTokens}`;
    });

    // Insert Note Button
    elBtnInsertNote.addEventListener('click', async () => {
      if (!activeStore) return;
      const content = elTextareaInsert.value.trim();
      if (!content) return;

      elBtnInsertNote.disabled = true;
      elBtnInsertNote.textContent = 'Indexing & Embedding...';
      try {
        await activeStore.insert([
          {
            id: 'note_' + Date.now().toString().slice(-6),
            content: content
          }
        ]);
        elTextareaInsert.value = '';
        elChunkPreviewInfo.textContent = 'Note successfully embedded and stored in IndexedDB!';
        await refreshStoreList();
        await renderActiveStore();
      } catch (e) {
        console.error('Insert error:', e);
      } finally {
        elBtnInsertNote.disabled = false;
        elBtnInsertNote.textContent = 'Ingest & Index Note';
      }
    });

    // Search Controls
    elInputMaxResults.addEventListener('input', () => {
      elLabelMaxResults.textContent = elInputMaxResults.value;
    });
    elInputScoreThreshold.addEventListener('input', () => {
      const val = (parseInt(elInputScoreThreshold.value, 10) / 100).toFixed(2);
      elLabelScoreThreshold.textContent = val;
    });
    elBtnRunSearch.addEventListener('click', () => runSemanticSearch());
    elInputSearchQuery.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSemanticSearch();
    });

    // RAG Assistant
    elBtnSeedDocs.addEventListener('click', async () => {
      elBtnSeedDocs.disabled = true;
      elBtnSeedDocs.textContent = 'Seeding Docs DB...';
      await seedOfflineDocsDB();
      elBtnSeedDocs.disabled = false;
      elBtnSeedDocs.textContent = '📥 Seed Docs DB (\'offline-docs-db\')';
      appendChatMessage('assistant', 'Documentation database offline-docs-db seeded with router configuration, network security, and AI API specifications! Try asking a question below.');
      await refreshStoreList();
    });

    elBtnRagSubmit.addEventListener('click', () => submitRagQuestion());
    elInputRagQuestion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitRagQuestion();
    });

    // Live Moderation AI
    elBtnSeedModeration.addEventListener('click', async () => {
      elBtnSeedModeration.disabled = true;
      elBtnSeedModeration.textContent = 'Seeding Moderation DB...';
      await seedModerationDB();
      elBtnSeedModeration.disabled = false;
      elBtnSeedModeration.textContent = '🛡️ Seed Moderation DB';
      await renderModerationReferenceList();
      await refreshStoreList();
    });

    elTextareaModDraft.addEventListener('input', () => debounce(handleLiveModerationCheck, 250)());

    // Edit Dialog Controls
    elBtnSaveEdit.addEventListener('click', () => {
      if (activeEditDialogResolver) {
        activeEditDialogResolver(elTextareaEditContent.value);
        activeEditDialogResolver = null;
      }
      elEditDialog.close();
    });

    elBtnCancelEdit.addEventListener('click', () => {
      if (activeEditDialogResolver) {
        activeEditDialogResolver(null);
        activeEditDialogResolver = null;
      }
      elEditDialog.close();
    });

    elBtnCloseDialog.addEventListener('click', () => {
      if (activeEditDialogResolver) {
        activeEditDialogResolver(null);
        activeEditDialogResolver = null;
      }
      elEditDialog.close();
    });

    // Dismiss dialog when clicking backdrop
    elEditDialog.addEventListener('click', (e) => {
      const rect = elEditDialog.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                          rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        if (activeEditDialogResolver) {
          activeEditDialogResolver(null);
          activeEditDialogResolver = null;
        }
        elEditDialog.close();
      }
    });

    // Handle ESC press (natively closes, triggers 'close' event on the dialog)
    elEditDialog.addEventListener('close', () => {
      if (activeEditDialogResolver) {
        activeEditDialogResolver(null);
        activeEditDialogResolver = null;
      }
    });

    // Ctrl+Enter or Cmd+Enter to save changes inside edit textarea
    elTextareaEditContent.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeEditDialogResolver) {
          activeEditDialogResolver(elTextareaEditContent.value);
          activeEditDialogResolver = null;
        }
        elEditDialog.close();
      }
    });

    // Similarity Matrix Event Listeners
    if (elBtnGenerateMatrix) {
      elBtnGenerateMatrix.addEventListener('click', generateSimilarityMatrix);
    }
    if (elCanvasSimilarityMatrix) {
      elCanvasSimilarityMatrix.addEventListener('mousemove', handleMatrixCanvasMouseMove);
      elCanvasSimilarityMatrix.addEventListener('mouseleave', handleMatrixCanvasMouseLeave);
      elCanvasSimilarityMatrix.addEventListener('click', handleMatrixCanvasClick);
    }
    if (elBtnMatrixQueryScan) {
      elBtnMatrixQueryScan.addEventListener('click', scanMatrixQuery);
    }
    if (elInputMatrixQuery) {
      elInputMatrixQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          scanMatrixQuery();
        }
      });
    }

    if (elMatrixInspectorContent) {
      elMatrixInspectorContent.addEventListener('mouseenter', () => {
        matrixInspectorHovered = true;
        drawMatrixCanvas();
      });
      elMatrixInspectorContent.addEventListener('mouseleave', () => {
        matrixInspectorHovered = false;
        drawMatrixCanvas();
      });
    }
  }

  // Debounce utility
  let debounceTimer = null;
  function debounce(fn, delay) {
    return function (...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn(...args), delay);
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Default Seed Data
  // ---------------------------------------------------------------------------
  async function seedDefaultStores() {
    const avail = await window.VectorStore.availability();
    if (avail === 'unavailable' || avail === 'no') return;

    const existing = await window.VectorStore.list();
    const existingIds = existing.map((s) => s.id);

    // 1. my-app-notes
    if (!existingIds.includes('my-app-notes')) {
      const storeNotes = await window.VectorStore.create({
        id: 'my-app-notes',
        chunkingStrategy: { maxChunkSizeTokens: 400, chunkOverlapTokens: 50 },
        distance_type: 'Cosine'
      });
      await storeNotes.insert([
        {
          id: 'note_123',
          content: 'The quick brown fox jumps over the lazy dog. Fox is a small, agile canine known for its bushy tail.'
        },
        {
          id: 'note_456',
          content: 'Built-in AI APIs use on-device models like EmbeddingGemma to generate high-dimensional vectors representing semantic meaning.'
        },
        {
          id: 'note_789',
          content: 'A fast, dark-colored fox leaps over a resting hound in the quiet meadow.'
        }
      ]);
    }

    // 2. offline-docs-db
    if (!existingIds.includes('offline-docs-db')) {
      await seedOfflineDocsDB();
    }

    // 3. moderation-db
    if (!existingIds.includes('moderation-db')) {
      await seedModerationDB();
    }
  }

  async function seedOfflineDocsDB() {
    const storeDocs = await window.VectorStore.create({
      id: 'offline-docs-db',
      chunkingStrategy: { maxChunkSizeTokens: 300, chunkOverlapTokens: 30 },
      distance_type: 'Cosine'
    });
    await storeDocs.insert([
      {
        id: 'doc_router_1',
        content: 'To configure the main router, connect your Ethernet cable to LAN port 1 and open http://192.168.1.1 in your browser. Log in with admin credentials.'
      },
      {
        id: 'doc_router_2',
        content: 'When setting up WiFi network security on the main router, select WPA3-Personal encryption and choose a strong passphrase with at least 12 characters.'
      },
      {
        id: 'doc_ai_1',
        content: 'Built-in AI APIs operate entirely offline on desktop devices using local models like EmbeddingGemma-300m for semantic embeddings.'
      }
    ]);
  }

  async function seedModerationDB() {
    const storeMod = await window.VectorStore.create({
      id: 'moderation-db',
      chunkingStrategy: { maxChunkSizeTokens: 200, chunkOverlapTokens: 20 },
      distance_type: 'Cosine'
    });
    await storeMod.insert([
      { id: 'mod_1', content: 'You are an idiot and this is stupid terrible spam.', category: 'toxic' },
      { id: 'mod_2', content: 'I hate everything about this post, complete garbage.', category: 'toxic' },
      { id: 'mod_3', content: 'Shut up you moron, terrible content.', category: 'toxic' },
      { id: 'mod_4', content: 'Thank you for the helpful explanation! Great article.', category: 'helpful' },
      { id: 'mod_5', content: 'Awesome code snippet, really love how clear this is.', category: 'helpful' },
      { id: 'mod_6', content: 'Thanks! This solved my networking router issue.', category: 'helpful' }
    ]);
  }

  // ---------------------------------------------------------------------------
  // 5. Store Explorer Rendering (DOM Manipulation - Secure Vanilla JS)
  // ---------------------------------------------------------------------------
  async function refreshStoreList() {
    const stores = await window.VectorStore.list();
    elStoreListContainer.replaceChildren();
    elBadgeStoreCount.textContent = `${stores.length} STORES`;

    stores.forEach((storeMeta) => {
      const item = document.createElement('div');
      item.className = 'store-item' + (activeStoreId === storeMeta.id ? ' active' : '');
      item.addEventListener('click', () => loadStore(storeMeta.id));

      const leftDiv = document.createElement('div');
      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = '700';
      titleEl.style.color = 'var(--text-primary)';
      titleEl.textContent = storeMeta.id;

      const subEl = document.createElement('div');
      subEl.style.fontSize = '0.78rem';
      subEl.style.color = 'var(--text-muted)';
      subEl.textContent = `maxTokens: ${storeMeta.configuration.maxChunkSizeTokens} | metric: ${storeMeta.distance_type || 'Cosine'}`;

      leftDiv.appendChild(titleEl);
      leftDiv.appendChild(subEl);

      const rightDiv = document.createElement('div');
      rightDiv.style.display = 'flex';
      rightDiv.style.alignItems = 'center';
      rightDiv.style.gap = '0.5rem';

      const badge = document.createElement('span');
      badge.className = 'badge badge-blue';
      badge.textContent = `${storeMeta.itemCount} ITEMS`;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete Store';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.VectorStore.delete(storeMeta.id);
        if (activeStoreId === storeMeta.id) {
          activeStore = null;
          activeStoreId = null;
        }
        await refreshStoreList();
        if (activeStoreId) {
          await renderActiveStore();
        } else {
          elCurrentStoreTitle.textContent = 'Active Store: None';
          elCurrentStoreSubtitle.textContent = 'Select or create a vector store on the left';
          elContentItemsContainer.replaceChildren();
        }
      });

      rightDiv.appendChild(badge);
      rightDiv.appendChild(deleteBtn);

      item.appendChild(leftDiv);
      item.appendChild(rightDiv);
      elStoreListContainer.appendChild(item);
    });

    // Sync select-matrix-store dropdown in the Matrix tab
    if (elSelectMatrixStore) {
      const selectedVal = elSelectMatrixStore.value;
      elSelectMatrixStore.replaceChildren();
      stores.forEach((storeMeta) => {
        const option = document.createElement('option');
        option.value = storeMeta.id;
        option.textContent = storeMeta.id;
        elSelectMatrixStore.appendChild(option);
      });
      if (selectedVal && stores.some(s => s.id === selectedVal)) {
        elSelectMatrixStore.value = selectedVal;
      } else if (activeStoreId && stores.some(s => s.id === activeStoreId)) {
        elSelectMatrixStore.value = activeStoreId;
      }
    }
  }

  async function loadStore(storeId) {
    try {
      activeStore = await window.VectorStore.retrieve(storeId);
      activeStoreId = storeId;
      await refreshStoreList();
      await renderActiveStore();
    } catch (e) {
      console.error('Error retrieving store:', e);
    }
  }

  async function renderActiveStore() {
    if (!activeStore) return;
    const meta = activeStore.metadata;

    elCurrentStoreTitle.textContent = `Active Store: ${meta.id}`;
    elCurrentStoreSubtitle.textContent = `Max Token Size: ${meta.configuration.maxChunkSizeTokens} | Overlap: ${meta.configuration.chunkOverlapTokens} | Metric: ${meta.distance_type}`;
    elBadgeContentCount.textContent = `${meta.itemCount} ITEMS`;

    const contents = await activeStore.listContents();
    elContentItemsContainer.replaceChildren();

    if (contents.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.fontSize = '0.85rem';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = '1.5rem';
      emptyMsg.textContent = 'No text notes indexed in this store yet. Insert one above!';
      elContentItemsContainer.appendChild(emptyMsg);
      return;
    }

    contents.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'result-card';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '0.4rem';

      const idEl = document.createElement('strong');
      idEl.style.color = 'var(--accent-cyan)';
      idEl.style.fontSize = '0.85rem';
      idEl.textContent = item.id;

      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '0.4rem';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = '✏️ Edit';
      editBtn.addEventListener('click', async () => {
        const newText = await showEditDialog(item.id, item.content);
        if (newText !== null && newText !== item.content) {
          await activeStore.updateContent(item.id, newText);
          await refreshStoreList();
          await renderActiveStore();
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async () => {
        await activeStore.deleteContent(item.id);
        await refreshStoreList();
        await renderActiveStore();
      });

      btnGroup.appendChild(editBtn);
      btnGroup.appendChild(delBtn);
      header.appendChild(idEl);
      header.appendChild(btnGroup);

      const contentText = document.createElement('p');
      contentText.style.fontSize = '0.85rem';
      contentText.style.color = 'var(--text-secondary)';
      contentText.textContent = item.content;

      card.appendChild(header);
      card.appendChild(contentText);
      elContentItemsContainer.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Semantic Search Execution (Tab 1 Right Panel)
  // ---------------------------------------------------------------------------
  async function runSemanticSearch() {
    if (!activeStore) {
      alert('Please select or create a Vector Store first.');
      return;
    }
    const query = elInputSearchQuery.value.trim();
    if (!query) return;

    const maxResults = parseInt(elInputMaxResults.value, 10) || 3;
    const minScore = parseInt(elInputScoreThreshold.value, 10) / 100;

    elBtnRunSearch.disabled = true;
    elBtnRunSearch.textContent = 'Searching with taskType: \'retrieval-query\'...';

    try {
      const results = await activeStore.findNearest(query, {
        max_num_results: maxResults,
        score_threshold: minScore
      });

      renderSearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      elBtnRunSearch.disabled = false;
      elBtnRunSearch.textContent = '🔍 Execute Semantic Search';
    }
  }

  function renderSearchResults(results) {
    elSearchResultsContainer.replaceChildren();
    elBadgeSearchResults.textContent = `${results.length} RESULTS`;

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = 'var(--text-muted)';
      empty.style.fontSize = '0.85rem';
      empty.style.textAlign = 'center';
      empty.style.padding = '2rem';
      empty.textContent = 'No semantic matches found above the minimum score threshold.';
      elSearchResultsContainer.appendChild(empty);
      return;
    }

    results.forEach((res, index) => {
      const card = document.createElement('div');
      card.className = 'result-card';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const rankEl = document.createElement('strong');
      rankEl.style.color = 'var(--accent-blue)';
      rankEl.style.fontSize = '0.85rem';
      rankEl.textContent = `#${index + 1} — Score: ${res.score.toFixed(4)}`;

      const parentEl = document.createElement('span');
      parentEl.className = 'badge badge-purple';
      parentEl.textContent = `ID: ${res.id}`;

      header.appendChild(rankEl);
      header.appendChild(parentEl);

      const barContainer = document.createElement('div');
      barContainer.className = 'score-bar-container';
      const barFill = document.createElement('div');
      barFill.className = 'score-bar-fill';
      barFill.style.width = `${Math.min(100, Math.max(0, res.score * 100))}%`;
      barContainer.appendChild(barFill);

      const snippetEl = document.createElement('p');
      snippetEl.style.fontSize = '0.88rem';
      snippetEl.style.color = 'var(--text-primary)';
      snippetEl.style.marginTop = '0.5rem';
      snippetEl.style.lineHeight = '1.5';
      snippetEl.textContent = res.content;

      card.appendChild(header);
      card.appendChild(barContainer);
      card.appendChild(snippetEl);
      elSearchResultsContainer.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // 7. RAG Bot Q&A (Tab 2)
  // ---------------------------------------------------------------------------
  function appendChatMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + role;
    bubble.textContent = text;
    elRagChatMessages.appendChild(bubble);
    elRagChatMessages.scrollTop = elRagChatMessages.scrollHeight;
  }

  function updateRagPipelineStep(stepIndex, title, messageText, statusBadge) {
    const cards = elRagPipelineLog.querySelectorAll('.result-card');
    if (cards[stepIndex]) {
      const p = cards[stepIndex].querySelector('p');
      if (p) p.textContent = messageText;
    }
    if (statusBadge) {
      elBadgeRagStatus.textContent = statusBadge;
    }
  }

  async function submitRagQuestion() {
    const userQuestion = elInputRagQuestion.value.trim();
    if (!userQuestion) return;

    appendChatMessage('user', userQuestion);
    elInputRagQuestion.value = '';
    elBadgeRagStatus.textContent = 'RETRIEVING...';

    // Step 1: Retrieve existing offline-docs-db
    let docsStore;
    try {
      docsStore = await window.VectorStore.retrieve('offline-docs-db');
    } catch (e) {
      // Create and seed if missing
      await seedOfflineDocsDB();
      docsStore = await window.VectorStore.retrieve('offline-docs-db');
    }

    // Pipeline log step 1
    updateRagPipelineStep(0, 'Step 1: Query Embedding', `Embedded query "${userQuestion}" with taskType: 'retrieval-query'`);

    // Step 2: Query VectorStore.findNearest
    const searchResults = await docsStore.findNearest(userQuestion, {
      max_num_results: 2,
      score_threshold: 0.2
    });

    const retrievedSummary = searchResults
      .map((r, i) => `[#${i + 1}] (Score: ${r.score.toFixed(2)}) "${r.content.slice(0, 70)}..."`)
      .join(' | ');

    updateRagPipelineStep(
      1,
      'Step 2: Semantic Retrieval',
      searchResults.length > 0
        ? `Retrieved ${searchResults.length} relevant chunks: ${retrievedSummary}`
        : 'No high-confidence chunks retrieved from offline-docs-db.'
    );

    // Step 3: Combine context and synthesize answer
    const context = searchResults.map((r) => r.content).join('\n\n');

    elBadgeRagStatus.textContent = 'SYNTHESIZING...';
    updateRagPipelineStep(2, 'Step 3: Answer Synthesis', 'Synthesizing response on-device from retrieved context...');

    let answerText = '';

    // Check if LanguageModel is available
    if (typeof window.LanguageModel !== 'undefined' && typeof window.LanguageModel.create === 'function') {
      try {
        const session = await window.LanguageModel.create({
          initialPrompts: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Answer the user\'s question using ONLY the provided context. Context:\n' + context
            }
          ]
        });
        answerText = await session.prompt(userQuestion);
      } catch (err) {
        console.warn('LanguageModel.prompt() failed, using RAG fallback synthesizer:', err);
      }
    }

    // Seamless on-device RAG fallback synthesizer
    if (!answerText) {
      if (searchResults.length > 0) {
        const bestChunk = searchResults[0].content;
        answerText = `Based on the on-device knowledge base (offline-docs-db): ${bestChunk}`;
      } else {
        answerText = 'I checked our local VectorStore (offline-docs-db), but could not find specific documentation answering that question. Try clicking "Seed Docs DB" or asking about main router configuration!';
      }
    }

    updateRagPipelineStep(2, 'Step 3: Answer Synthesis', `Answer synthesized: "${answerText.slice(0, 80)}..."`, 'DONE');
    appendChatMessage('assistant', answerText);
  }

  // ---------------------------------------------------------------------------
  // 8. Live Moderation AI (Tab 3)
  // ---------------------------------------------------------------------------
  async function renderModerationReferenceList() {
    let modStore;
    try {
      modStore = await window.VectorStore.retrieve('moderation-db');
    } catch (e) {
      await seedModerationDB();
      modStore = await window.VectorStore.retrieve('moderation-db');
    }

    const items = await modStore.listContents();
    elModReferenceList.replaceChildren();
    elBadgeModCount.textContent = `${items.length} REFERENCE ITEMS`;

    items.forEach((it) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';

      const textEl = document.createElement('span');
      textEl.style.fontSize = '0.85rem';
      textEl.style.color = 'var(--text-primary)';
      textEl.textContent = it.content;

      const badgeEl = document.createElement('span');
      if (it.category === 'toxic') {
        badgeEl.className = 'badge badge-purple';
        badgeEl.style.background = 'hsla(0, 85%, 60%, 0.2)';
        badgeEl.style.color = 'var(--accent-red)';
        badgeEl.textContent = 'TOXIC ANCHOR';
      } else {
        badgeEl.className = 'badge badge-green';
        badgeEl.textContent = 'HELPFUL ANCHOR';
      }

      card.appendChild(textEl);
      card.appendChild(badgeEl);
      elModReferenceList.appendChild(card);
    });
  }

  async function handleLiveModerationCheck() {
    const draftText = elTextareaModDraft.value.trim();
    elModAlertContainer.replaceChildren();

    if (!draftText) {
      const defaultAlert = document.createElement('div');
      defaultAlert.className = 'alert-box alert-success';
      const icon = document.createElement('span');
      icon.textContent = '✓';
      const body = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = 'Content Status: Constructive & Safe';
      const sub = document.createElement('p');
      sub.style.fontSize = '0.82rem';
      sub.style.marginTop = '0.2rem';
      sub.style.opacity = '0.9';
      sub.textContent = 'No high-similarity matches with toxic/unhelpful patterns detected in the Vector Store.';
      body.appendChild(title);
      body.appendChild(sub);
      defaultAlert.appendChild(icon);
      defaultAlert.appendChild(body);
      elModAlertContainer.appendChild(defaultAlert);
      return;
    }

    let modStore;
    try {
      modStore = await window.VectorStore.retrieve('moderation-db');
    } catch (e) {
      return;
    }

    // Search nearest in moderation-db with taskType: 'retrieval-query'
    const results = await modStore.findNearest(draftText, {
      max_num_results: 3,
      score_threshold: 0.35
    });

    const toxicMatch = results.find((r) => r.id.startsWith('mod_1') || r.id.startsWith('mod_2') || r.id.startsWith('mod_3') || r.content.includes('idiot') || r.content.includes('hate') || r.content.includes('stupid'));

    const alertBox = document.createElement('div');
    const icon = document.createElement('span');
    const body = document.createElement('div');
    const title = document.createElement('strong');
    const sub = document.createElement('p');
    sub.style.fontSize = '0.82rem';
    sub.style.marginTop = '0.2rem';

    if (toxicMatch) {
      alertBox.className = 'alert-box alert-danger';
      icon.textContent = '⚠️';
      title.textContent = `Client-Side Warning: High Similarity (${(toxicMatch.score * 100).toFixed(0)}%) to Toxic/Unhelpful Patterns`;
      sub.textContent = `Matching reference: "${toxicMatch.content}". Consider rephrasing before submission to ensure a helpful community.`;
    } else {
      alertBox.className = 'alert-box alert-success';
      icon.textContent = '✓';
      title.textContent = 'Content Status: Constructive & Safe';
      sub.textContent = 'Draft text checked against moderation-db using taskType: \'retrieval-query\'. No unhelpful patterns matched.';
    }

    body.appendChild(title);
    body.appendChild(sub);
    alertBox.appendChild(icon);
    alertBox.appendChild(body);
    elModAlertContainer.appendChild(alertBox);
  }

  // ---------------------------------------------------------------------------
  // 9. Semantic Similarity Adjacency Matrix (Tab 4 logic)
  // ---------------------------------------------------------------------------
  async function generateSimilarityMatrix() {
    const storeId = elSelectMatrixStore.value;
    if (!storeId) {
      alert('Please select or create a Vector Store first.');
      return;
    }

    elBtnGenerateMatrix.disabled = true;
    elMatrixProgressContainer.style.display = 'block';
    
    try {
      const store = await window.VectorStore.retrieve(storeId);
      const items = await store.listContents();
      
      if (items.length === 0) {
        alert('Active store is empty. Please add some notes first in the Store Explorer tab.');
        elMatrixProgressContainer.style.display = 'none';
        elBtnGenerateMatrix.disabled = false;
        return;
      }

      matrixItems = items;
      const N = items.length;
      matrixScores = Array.from({ length: N }, () => Array(N).fill(0));
      matrixQueryScores = null; // reset live query scanner
      matrixPinnedCell = null; // reset pinned cell
      
      // Update items list on the left
      renderMatrixItemsList(items);

      // Perform N findNearest calls
      for (let i = 0; i < N; i++) {
        const itemA = items[i];
        
        // Update progress bar
        const percent = Math.round((i / N) * 100);
        elMatrixProgressPercent.textContent = `${percent}%`;
        elMatrixProgressText.textContent = `Analyzing item ${i + 1} of ${N}: "${itemA.id}"`;
        elMatrixProgressBar.style.width = `${percent}%`;

        // Query the store with Item A's content
        // We set score_threshold: -1 to get all results regardless of score
        // Retrieve a large number of results to ensure we capture all document chunks
        const results = await store.findNearest(itemA.content, {
          max_num_results: 9999,
          score_threshold: -1
        });

        // Map results back to index
        // Find the max score for each item ID
        const idToMaxScore = {};
        results.forEach(r => {
          if (idToMaxScore[r.id] === undefined || r.score > idToMaxScore[r.id]) {
            idToMaxScore[r.id] = r.score;
          }
        });

        // Fill in the matrix row
        for (let j = 0; j < N; j++) {
          const itemB = items[j];
          if (i === j) {
            matrixScores[i][j] = 1.0;
          } else {
            matrixScores[i][j] = idToMaxScore[itemB.id] !== undefined ? idToMaxScore[itemB.id] : 0.0;
          }
        }
      }

      // Finish progress bar
      elMatrixProgressPercent.textContent = '100%';
      elMatrixProgressText.textContent = 'Analysis complete!';
      elMatrixProgressBar.style.width = '100%';
      
      setTimeout(() => {
        elMatrixProgressContainer.style.display = 'none';
      }, 1000);

      // Draw the matrix canvas
      drawMatrixCanvas();
      
      // Update inspector state
      elMatrixInspectorEmpty.style.display = 'block';
      elMatrixInspectorContent.style.display = 'none';
      if (elRelationshipInspectorCard) elRelationshipInspectorCard.classList.remove('pinned');
      if (elInspectorCardSubtitle) {
        elInspectorCardSubtitle.textContent = 'Hover over a grid cell to compare texts';
        elInspectorCardSubtitle.classList.remove('pinned');
      }

    } catch (err) {
      console.error('Error generating matrix:', err);
      alert('Error generating matrix: ' + err.message);
      elMatrixProgressContainer.style.display = 'none';
    } finally {
      elBtnGenerateMatrix.disabled = false;
    }
  }

  function renderMatrixItemsList(items) {
    elMatrixItemsList.replaceChildren();
    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'matrix-item-card';

      card.addEventListener('mouseenter', () => {
        matrixActiveAxisHighlight = index;
        drawMatrixCanvas();
      });
      card.addEventListener('mouseleave', () => {
        matrixActiveAxisHighlight = null;
        drawMatrixCanvas();
      });

      const badge = document.createElement('span');
      badge.className = 'matrix-axis-badge';
      badge.textContent = index.toString();

      const body = document.createElement('div');
      body.style.overflow = 'hidden';

      const idEl = document.createElement('strong');
      idEl.style.color = 'var(--accent-cyan)';
      idEl.style.fontSize = '0.8rem';
      idEl.textContent = item.id;

      const textEl = document.createElement('div');
      textEl.style.fontSize = '0.72rem';
      textEl.style.color = 'var(--text-secondary)';
      textEl.style.whiteSpace = 'nowrap';
      textEl.style.overflow = 'hidden';
      textEl.style.textOverflow = 'ellipsis';
      textEl.textContent = item.content;

      body.appendChild(idEl);
      body.appendChild(textEl);
      card.appendChild(badge);
      card.appendChild(body);
      elMatrixItemsList.appendChild(card);
    });
  }

  function drawMatrixCanvas() {
    const canvas = elCanvasSimilarityMatrix;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const N = matrixItems.length;
    if (N === 0) {
      // Draw empty placeholder text
      ctx.fillStyle = 'hsl(215, 15%, 55%)';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No matrix data. Click Generate above.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const hasQuery = matrixQueryScores !== null;
    const cols = N;
    const rows = hasQuery ? N + 1 : N;

    const offsetX = 45;
    const offsetY = 45;
    const gridWidth = canvas.width - offsetX - 15;
    const gridHeight = canvas.height - offsetY - 15;

    const cellW = gridWidth / cols;
    const cellH = gridHeight / rows;

    // Draw grid background
    ctx.fillStyle = 'rgb(11, 14, 22)'; // --bg-primary
    ctx.fillRect(offsetX, offsetY, gridWidth, gridHeight);

    // Draw cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let score = 0;
        let isQueryRow = false;

        if (r < N) {
          score = matrixScores[r][c];
        } else {
          score = matrixQueryScores[c];
          isQueryRow = true;
        }

        // Get color for similarity score
        ctx.fillStyle = getScoreColor(score);
        
        // Draw fill rect
        const rx = offsetX + c * cellW;
        const ry = offsetY + r * cellH;
        ctx.fillRect(rx + 1, ry + 1, cellW - 2, cellH - 2);

        // 1. Solid highlight for the exact hovered cell on canvas (salient pink)
        if (matrixHoveredCell && matrixHoveredCell.row === r && matrixHoveredCell.col === c) {
          ctx.strokeStyle = 'hsl(328, 100%, 65%)';
          ctx.lineWidth = 2;
          ctx.strokeRect(rx, ry, cellW, cellH);
        }

        // 2. Solid highlight for the inspected cell on Relationship Inspector hover
        if (matrixInspectorHovered && matrixInspectedCell && matrixInspectedCell.row === r && matrixInspectedCell.col === c) {
          ctx.strokeStyle = 'hsl(265, 85%, 65%)'; // Bold Purple border for inspected cell
          ctx.lineWidth = 2.5;
          ctx.strokeRect(rx, ry, cellW, cellH);
        }

        // 3. Solid highlight for the pinned cell
        if (matrixPinnedCell && matrixPinnedCell.row === r && matrixPinnedCell.col === c) {
          ctx.strokeStyle = 'hsl(38, 95%, 55%)'; // Gold/Amber border for pinned cell
          ctx.lineWidth = 3;
          ctx.strokeRect(rx + 1, ry + 1, cellW - 2, cellH - 2);
        }

        // Special border for the live query row
        if (isQueryRow) {
          ctx.strokeStyle = 'hsla(265, 85%, 65%, 0.4)'; // Purple border
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, ry, cellW, cellH);
        }
      }
    }

    // Draw Column Labels (on top X axis)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let c = 0; c < cols; c++) {
      const rx = offsetX + c * cellW + cellW / 2;
      if (matrixActiveAxisHighlight !== null && matrixActiveAxisHighlight === c) {
        ctx.fillStyle = 'hsla(210, 100%, 60%, 0.2)';
        ctx.beginPath();
        ctx.arc(rx, offsetY - 13, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'hsl(210, 100%, 60%)';
        ctx.font = 'bold 11px Fira Code, monospace';
      } else {
        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 10px Fira Code, monospace';
      }
      ctx.fillText(c.toString(), rx, offsetY - 8);
    }

    // Draw Row Labels (on left Y axis)
    ctx.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      const ry = offsetY + r * cellH + cellH / 2;
      if (r < N) {
        if (matrixActiveAxisHighlight !== null && matrixActiveAxisHighlight === r) {
          ctx.fillStyle = 'hsla(210, 100%, 60%, 0.2)';
          ctx.beginPath();
          ctx.arc(offsetX - 15, ry, 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'hsl(210, 100%, 60%)';
          ctx.font = 'bold 11px Fira Code, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(r.toString(), offsetX - 15, ry);
        } else {
          ctx.fillStyle = '#9ca3af';
          ctx.font = 'bold 10px Fira Code, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(r.toString(), offsetX - 10, ry);
        }
      } else {
        ctx.fillStyle = 'hsl(265, 85%, 65%)';
        ctx.font = 'bold 10px Fira Code, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('Q', offsetX - 10, ry);
      }
    }

    // Draw borders / dividing line for query row
    if (hasQuery) {
      ctx.strokeStyle = 'hsl(265, 85%, 65%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + N * cellH);
      ctx.lineTo(offsetX + gridWidth, offsetY + N * cellH);
      ctx.stroke();
    }
  }

  function getScoreColor(score) {
    const s = Math.max(0, Math.min(1, score));

    if (s <= 0.3) {
      const factor = s / 0.3;
      const r = Math.round(22 + (28 - 22) * factor);
      const g = Math.round(26 + (48 - 26) * factor);
      const b = Math.round(37 + (80 - 37) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (s <= 0.6) {
      const factor = (s - 0.3) / 0.3;
      const r = Math.round(28 + (59 - 28) * factor);
      const g = Math.round(48 + (130 - 48) * factor);
      const b = Math.round(80 + (246 - 80) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (s <= 0.85) {
      const factor = (s - 0.6) / 0.25;
      const r = Math.round(59 + (0 - 59) * factor);
      const g = Math.round(130 + (229 - 130) * factor);
      const b = Math.round(246 + (255 - 246) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const factor = (s - 0.85) / 0.15;
      const r = Math.round(0 + (34 - 0) * factor);
      const g = Math.round(229 + (197 - 229) * factor);
      const b = Math.round(255 + (94 - 255) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function handleMatrixCanvasMouseMove(e) {
    const canvas = elCanvasSimilarityMatrix;
    const wrapper = document.getElementById('matrix-canvas-wrapper');
    if (!canvas || !wrapper) return;

    const canvasRect = canvas.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    
    // Mouse coordinates relative to the parent wrapper (for absolute positioning)
    const wrapperX = e.clientX - wrapperRect.left;
    const wrapperY = e.clientY - wrapperRect.top;
    
    // Mouse coordinates relative to the canvas (for index grid calculations)
    const canvasX = e.clientX - canvasRect.left;
    const canvasY = e.clientY - canvasRect.top;
    
    const x = (canvasX / canvasRect.width) * canvas.width;
    const y = (canvasY / canvasRect.height) * canvas.height;

    const N = matrixItems.length;
    if (N === 0) return;

    const hasQuery = matrixQueryScores !== null;
    const cols = N;
    const rows = hasQuery ? N + 1 : N;

    const offsetX = 45;
    const offsetY = 45;
    const gridWidth = canvas.width - offsetX - 15;
    const gridHeight = canvas.height - offsetY - 15;

    if (x >= offsetX && x < offsetX + gridWidth && y >= offsetY && y < offsetY + gridHeight) {
      const cellW = gridWidth / cols;
      const cellH = gridHeight / rows;
      
      const col = Math.floor((x - offsetX) / cellW);
      const row = Math.floor((y - offsetY) / cellH);

      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        // Track tooltip position smoothly on every move
        showMatrixTooltip(wrapperX, wrapperY, row, col);

        if (!matrixHoveredCell || matrixHoveredCell.row !== row || matrixHoveredCell.col !== col) {
          matrixHoveredCell = { row, col };
          drawMatrixCanvas();
          if (!matrixPinnedCell) {
            updateMatrixInspector(row, col);
          }
        }
      }
    } else {
      if (matrixHoveredCell !== null) {
        matrixHoveredCell = null;
        drawMatrixCanvas();
        hideMatrixTooltip();
      }
    }
  }

  function handleMatrixCanvasMouseLeave() {
    if (matrixHoveredCell !== null) {
      matrixHoveredCell = null;
      drawMatrixCanvas();
      hideMatrixTooltip();
    }
  }

  function handleMatrixCanvasClick(e) {
    const canvas = elCanvasSimilarityMatrix;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - canvasRect.left;
    const canvasY = e.clientY - canvasRect.top;
    
    const x = (canvasX / canvasRect.width) * canvas.width;
    const y = (canvasY / canvasRect.height) * canvas.height;

    const N = matrixItems.length;
    if (N === 0) return;

    const hasQuery = matrixQueryScores !== null;
    const cols = N;
    const rows = hasQuery ? N + 1 : N;

    const offsetX = 45;
    const offsetY = 45;
    const gridWidth = canvas.width - offsetX - 15;
    const gridHeight = canvas.height - offsetY - 15;

    if (x >= offsetX && x < offsetX + gridWidth && y >= offsetY && y < offsetY + gridHeight) {
      const cellW = gridWidth / cols;
      const cellH = gridHeight / rows;
      
      const col = Math.floor((x - offsetX) / cellW);
      const row = Math.floor((y - offsetY) / cellH);

      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        if (matrixPinnedCell && matrixPinnedCell.row === row && matrixPinnedCell.col === col) {
          matrixPinnedCell = null;
          updateMatrixInspector(row, col);
        } else {
          matrixPinnedCell = { row, col };
          updateMatrixInspector(row, col);
        }
        drawMatrixCanvas();
      }
    }
  }

  function showMatrixTooltip(localX, localY, row, col) {
    const tooltip = elMatrixTooltip;
    const N = matrixItems.length;
    let score = 0;
    let rowName = '';
    const colName = matrixItems[col].id;

    if (row < N) {
      score = matrixScores[row][col];
      rowName = matrixItems[row].id;
    } else {
      score = matrixQueryScores[col];
      rowName = 'Live Query';
    }

    tooltip.textContent = `[${rowName}] x [${colName}]: ${score.toFixed(4)}`;
    tooltip.style.left = `${localX + 15}px`;
    tooltip.style.top = `${localY + 15}px`;
    tooltip.style.display = 'block';
  }

  function hideMatrixTooltip() {
    elMatrixTooltip.style.display = 'none';
  }

  function updateMatrixInspector(row, col) {
    matrixInspectedCell = { row, col };
    const N = matrixItems.length;
    const itemB = matrixItems[col];
    let itemA = null;
    let score = 0;

    if (row < N) {
      itemA = matrixItems[row];
      score = matrixScores[row][col];
    } else {
      itemA = {
        id: 'Live Query',
        content: elInputMatrixQuery.value.trim() || '(Empty search string)'
      };
      score = matrixQueryScores[col];
    }

    elInspectorScoreBadge.textContent = `SCORE: ${score.toFixed(4)}`;
    
    let relationText = 'UNRELATED';
    let relationClass = 'badge-red';
    if (score >= 0.85) {
      relationText = 'IDENTITY / EXCELLENT MATCH';
      relationClass = 'badge-green';
    } else if (score >= 0.6) {
      relationText = 'STRONG MATCH';
      relationClass = 'badge-green';
    } else if (score >= 0.3) {
      relationText = 'WEAK MATCH';
      relationClass = 'badge-blue';
    } else {
      relationText = 'UNRELATED';
      relationClass = 'badge-red';
    }

    elInspectorRelationBadge.textContent = relationText;
    elInspectorRelationBadge.className = `badge ${relationClass}`;

    elInspectorDocAId.textContent = `Document A (Row ${row < N ? row : 'Q'}): ${itemA.id}`;
    elInspectorDocAText.textContent = itemA.content;

    elInspectorDocBId.textContent = `Document B (Col ${col}): ${itemB.id}`;
    elInspectorDocBText.textContent = itemB.content;

    const isPinned = matrixPinnedCell && matrixPinnedCell.row === row && matrixPinnedCell.col === col;
    if (isPinned) {
      if (elRelationshipInspectorCard) elRelationshipInspectorCard.classList.add('pinned');
      if (elInspectorCardSubtitle) {
        elInspectorCardSubtitle.textContent = '📌 Pinned Comparison (Click cell again to unpin)';
        elInspectorCardSubtitle.classList.add('pinned');
      }
    } else {
      if (elRelationshipInspectorCard) elRelationshipInspectorCard.classList.remove('pinned');
      if (elInspectorCardSubtitle) {
        elInspectorCardSubtitle.textContent = 'Hover over a grid cell to compare texts';
        elInspectorCardSubtitle.classList.remove('pinned');
      }
    }

    elMatrixInspectorEmpty.style.display = 'none';
    elMatrixInspectorContent.style.display = 'flex';
  }

  async function scanMatrixQuery() {
    const storeId = elSelectMatrixStore.value;
    const query = elInputMatrixQuery.value.trim();
    if (!storeId || !query) {
      alert('Please enter query text and generate a matrix first.');
      return;
    }

    if (matrixItems.length === 0) {
      alert('Please generate the matrix first.');
      return;
    }

    matrixPinnedCell = null;

    elBtnMatrixQueryScan.disabled = true;
    elBtnMatrixQueryScan.textContent = 'Embedding & Scanning...';

    try {
      const store = await window.VectorStore.retrieve(storeId);
      const N = matrixItems.length;

      // Retrieve a large number of results to ensure we capture all document chunks
      const results = await store.findNearest(query, {
        max_num_results: 9999,
        score_threshold: -1
      });

      const idToMaxScore = {};
      results.forEach(r => {
        if (idToMaxScore[r.id] === undefined || r.score > idToMaxScore[r.id]) {
          idToMaxScore[r.id] = r.score;
        }
      });

      matrixQueryScores = Array(N).fill(0);
      for (let j = 0; j < N; j++) {
        const item = matrixItems[j];
        matrixQueryScores[j] = idToMaxScore[item.id] !== undefined ? idToMaxScore[item.id] : 0.0;
      }

      drawMatrixCanvas();

      matrixHoveredCell = { row: N, col: 0 };
      updateMatrixInspector(N, 0);
      drawMatrixCanvas();

    } catch (e) {
      console.error('Live query error:', e);
      alert('Live query scan failed: ' + e.message);
    } finally {
      elBtnMatrixQueryScan.disabled = false;
      elBtnMatrixQueryScan.textContent = '🔍 Scan & Project onto Matrix';
    }
  }

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initApp);
})();
