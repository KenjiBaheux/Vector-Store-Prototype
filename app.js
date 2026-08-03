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

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initApp);
})();
