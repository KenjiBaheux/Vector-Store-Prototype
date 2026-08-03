# Vector Store API Polyfill

An end-to-end, zero-dependency JavaScript polyfill for the proposed **Vector Store API**, built on top of the experimental on-device **[Semantic Embedder API](./vector-store.js#L30)** (`EmbeddingGemma-300m`).

This library enables web applications to perform privacy-preserving, low-latency semantic search, document ingestion, and Retrieval-Augmented Generation (RAG) entirely on the client side without server-side embedding costs.

---

## Features

- **100% On-Device AI**: Leverages the experimental `window.SemanticEmbedder` API (`embeddinggemma-300m`) when available, keeping sensitive user data strictly on-device.
- **Automatic `taskType` Optimization**:
  - Automatically passes `{ taskType: "retrieval-document" }` during [vectorStore.insert()](./vector-store.js#L265) and [updateContent()](./vector-store.js#L377) so document embeddings are optimized for indexing.
  - Automatically passes `{ taskType: "retrieval-query" }` during [vectorStore.findNearest()](./vector-store.js#L327) so queries are optimized for similarity search.
- **Intelligent Text Chunking**: Automatically chunks input strings based on configurable `maxChunkSizeTokens` and `chunkOverlapTokens`, respecting sentence and word boundaries.
- **Persistent IndexedDB Backing**: Stores database metadata, original items, and embedding vectors (`Float32Array`) in an IndexedDB database (`VectorStorePolyfillDB`), enabling [VectorStore.list()](./vector-store.js#L484) and [VectorStore.retrieve(id)](./vector-store.js#L503) across browser sessions without re-ingesting documents.
- **Multiple Similarity Metrics**: Supports `Cosine` (default), `DotProduct`, and `Euclidean` similarity calculations.
- **Strict Native Engine Detection**: Detects whether the native `SemanticEmbedder` is enabled and available on desktop platforms, providing clear actionable instructions when the experimental flag needs to be enabled.

---

## Initial Setup and Configuration

To begin testing, ensure you are using the latest version of Chrome Canary ie, it should be greater than **153.0.7979.0**. You must manually enable the following experimental flag to access the Semantic Embedder API:

- **Semantic Embedder API**: Enable `chrome://flags/#semantic-embedder-api`

### Semantic Embedder API
The Semantic Embedder API enables the generation of text embeddings on-device. This allows for privacy-preserving semantic understanding, low-latency applications, and avoids server-side costs.  
The API is currently supported only on desktops (**Linux, Mac and Windows**).

---

## How to Use the API

### 1. Including the Polyfill

Since the library has zero dependencies, simply include [vector-store.js](./vector-store.js) via `<script>` tag or import it as an ES module:

```html
<script src="vector-store.js"></script>
```

```javascript
// Or import as an ES module / Node module
import VectorStore from './vector-store.js';
```

### 2. Standard Built-in AI Lifecycle

The API follows the common Built-in AI sequence: `availability() -> create() -> execute -> close()`.

```javascript
// 1. Check if the API is available
if (!VectorStore || (await VectorStore.availability()) === "unavailable") {
  console.error("Vector Store API is not available on this device.");
  return;
}

// 2. Discover model parameters and capabilities
const params = await VectorStore.params();
console.log("Max supported chunk size:", params.maxChunkSizeTokens);

// 3. Create a vector store with a chunking strategy
const vectorStore = await VectorStore.create({
  id: "my-app-notes",
  chunkingStrategy: {
    maxChunkSizeTokens: 400, // Maximum tokens per chunk
    chunkOverlapTokens: 50   // Overlap tokens between adjacent chunks
  },
  distance_type: 'Cosine',
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Model download progress: ${Math.round(e.loaded * 100)}%`);
    });
  }
});
```

---

## Example Use Cases & Key Articulations

### 1. Basic Usage: Create, Insert, and Semantic Search
By passing raw text strings into `insert()`, the browser automatically chunks the text according to the store's configuration, generates embeddings using the on-device model (`taskType: "retrieval-document"`), and indexes the results into IndexedDB.

```javascript
// A. Insert raw text strings
const insertResult = await vectorStore.insert([
  {
    id: "note_123",
    content: "The quick brown fox jumps over the lazy dog. Fox is an agile canine."
  },
  {
    id: "note_456",
    content: "Built-in AI APIs use on-device models to generate semantic embeddings."
  }
]);
console.log("Inserted count:", insertResult.insertedCount);

// B. Perform semantic search using natural language
// Automatically embeds query using taskType: "retrieval-query"
const searchResults = await vectorStore.findNearest("fox, the animal", {
  max_num_results: 1,
  score_threshold: 0.5
});

console.log("Top semantic match:", searchResults);
/*
[
  {
    score: 0.89,
    content: "The quick brown fox jumps over the lazy dog. Fox is an agile canine.",
    id: "note_123",
    chunkIndex: 0
  }
]
*/

// C. Proactively close connection when done
vectorStore.close();
```

---

### 2. Retrieval-Augmented Generation (RAG)
Combine the `VectorStore` API (for retrieval) with the built-in `LanguageModel` Prompt API (for text generation) to create an offline-capable Q&A bot.

```javascript
// 1. Retrieve a pre-indexed vector store containing documentation
const vectorStore = await VectorStore.retrieve("offline-docs-db");

// 2. User submits a question
const userQuestion = "How do I configure the main router?";

// 3. Query Vector Store to find the most relevant passages
const searchResults = await vectorStore.findNearest(userQuestion, {
  max_num_results: 3,
  score_threshold: 0.25
});

// 4. Extract text content from search results to build prompt context
const context = searchResults.map(result => result.content).join("\n\n");

// 5. Use the built-in LanguageModel API to synthesize an answer
const session = await window.LanguageModel.create({
  initialPrompts: [
    {
      role: "system",
      content: "You are a helpful assistant. Answer the user's question using ONLY the provided context.\n\nContext:\n" + context
    }
  ]
});

// 6. Generate answer entirely on-device
const answer = await session.prompt(userQuestion);
console.log("Answer:", answer);
```

---

### 3. Real-Time Content Intelligence (Live Moderation)
Pre-index a vector store with examples of known toxic or unhelpful comments. As the user types their post, continuously query the vector store with the draft text to flag unhelpful content before submission.

```javascript
// 1. Retrieve the pre-indexed moderation reference database
const moderationStore = await VectorStore.retrieve("moderation-db");

// 2. Listen to textarea input changes (debounced)
const draftText = "You are an idiot and this is stupid terrible spam.";

// 3. Query the store in real time with taskType: 'retrieval-query'
const matches = await moderationStore.findNearest(draftText, {
  max_num_results: 1,
  score_threshold: 0.5
});

// 4. Instantly warn the user client-side if similarity is high
if (matches.length > 0) {
  console.warn(`Warning: High similarity (${Math.round(matches[0].score * 100)}%) to toxic patterns.`);
  showClientSideWarningBanner(matches[0].content);
}
```

---

### 4. Incremental Updates & Persistent Store Management
Because vector stores persistently index data in IndexedDB, developers can list available databases, update individual content items without rebuilding the entire store, and delete databases when no longer needed.

```javascript
// 1. List all available stores on this origin
const availableStores = await VectorStore.list();
console.log("Available databases:", availableStores);
/*
[
  {
    id: "my-app-notes",
    createdAt: 1718293849392,
    lastModified: 1718293999123,
    itemCount: 42,
    configuration: { maxChunkSizeTokens: 400, chunkOverlapTokens: 50 },
    distance_type: "Cosine"
  }
]
*/

// 2. Retrieve existing store by ID without re-ingesting documents
const store = await VectorStore.retrieve("my-app-notes");

// 3. Update an individual content item (automatically removes old chunks & re-embeds)
await store.updateContent("note_123", "Here is the updated note text with new information.");

// 4. Delete an individual item
await store.deleteContent("note_123");

// 5. Delete entire store when no longer needed
await VectorStore.delete("my-app-notes");
```

---

### 5. Direct Usage of the Underlying Semantic Embedder API
The polyfill is built directly on top of the experimental `SemanticEmbedder` API (`EmbeddingGemma-300m`). Here is how you can use the underlying API directly when granular control over `taskType` is required:

```javascript
// 1. Check if the Semantic Embedder API is available
if (!SemanticEmbedder || (await SemanticEmbedder.availability()) !== "available") {
  console.error("Semantic Embedder API is not available on this device.");
}

// 2. Create an embedder instance with download progress monitoring
const embedder = await SemanticEmbedder.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${Math.round(e.loaded * 100)}%`);
    });
  }
});

// 3. Embed a single string optimized for semantic similarity
const result1 = await embedder.embed(
  "The quick brown fox jumps over the lazy dog.",
  { taskType: "semantic-similarity" }
);
const vector1 = result1.embeddings[0].values; // Float32Array(256)

// 4. Embed a batch of strings optimized for document retrieval indexing
const passages = [
  "Built-in AI APIs use on-device models.",
  "Embeddings are high-dimensional vectors representing semantic meaning."
];
const batchResult = await embedder.embed(passages, { taskType: "retrieval-document" });
batchResult.embeddings.forEach((emb, index) => {
  console.log(`Passage ${index} vector length:`, emb.values.length);
});

// 5. Release GPU / CPU resources
embedder.destroy();
```

#### Supported `taskType` Parameters in Chrome Canary

| `taskType` | Use Case & Description |
|---|---|
| **`"retrieval-document"`** | **Document Retrieval Indexing**: Used when embedding a collection of documents so they can be stored in a vector database. |
| **`"retrieval-query"`** | **Search Query**: Used when embedding a user search query in real time to compare against `"retrieval-document"` embeddings. |
| **`"semantic-similarity"`** | **General Similarity**: Used to assess direct semantic similarity between two texts (not intended for asymmetric search/retrieval). |
| **`"classification"`** | **Text Classification**: Optimized for classifying texts according to preset labels (e.g., sentiment analysis, spam detection). |
| **`"clustering"`** | **Clustering & Organization**: Optimized for grouping texts based on conceptual similarity (e.g., document clustering, anomaly detection). |

---

## Running the Interactive Showcase Demo

This repository includes a multi-tab interactive workbench ([index.html](./index.html), [styles.css](./styles.css), and [app.js](./app.js)) that demonstrates:
1. **Store Explorer & Search**: CRUD operations on Vector Stores and real-time cosine similarity search.
2. **RAG Assistant**: Offline Q&A bot over local documentation (`offline-docs-db`).
3. **Live Moderation AI**: Continuous client-side text classification and warning alerts as you type.
4. **Architecture & Spec Walkthrough**: Detailed technical documentation.

To run the showcase locally, start any static HTTP server from the project directory.

For example, using Python 3:
```bash
# Navigate into the project directory
python3 -m http.server 8000
```

Or using Node.js (`npx`):
```bash
npx serve .
```

Then navigate to [http://localhost:8000](http://localhost:8000) (or the URL provided by your local server) in **Chrome Canary** with `chrome://flags/#semantic-embedder-api` enabled.

---

## File Reference
- **[vector-store.js](./vector-store.js)**: Standalone zero-dependency polyfill library (`window.VectorStore`).
- **[app.js](./app.js)**: Showcase UI controller with strict Vanilla JS DOM security (no `innerHTML`).
- **[index.html](./index.html)**: Multi-tab interactive HTML workbench.
- **[styles.css](./styles.css)**: Premium dark-mode design system.