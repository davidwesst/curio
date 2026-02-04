# Core Library Specification (TypeScript) — Collector App Core (`core-lib`)

**Status:** Draft v1  
**Audience:** Developer implementing the TypeScript core library used by an offline-first React/Svelte client (PWA).  
**Goal:** Implement the “headless” data + domain engine for a personal-first collector app (games + retro hardware + future media). Core must be framework-agnostic, offline-first, exportable, and extensible via **data-only Extensions** and **code Plugins**.

---

## 1. Scope & Principles

### 1.1 What Core Is
`core-lib` is an embedded library that runs in the same JS runtime as the UI (web/PWA now; Tauri/desktop later). It is **not a server** and exposes no HTTP API.

Core is responsible for:
- Data model + persistence
- Business rules + validation
- Extension installation + registry
- ChangeLog for all mutations
- Asset storage references (photos/files)
- Export/import snapshots
- Event emission for UI reactivity

Core is NOT responsible for:
- Network calls (IGDB, eBay, price tracking, LLM)
- Heavy compute engines (search indexing, fuzzy match, hashing) beyond simple TS defaults
- Multi-user / hosted sync in v1

### 1.2 Key Design Rules
1. **Local-first:** All core operations must work offline.
2. **Source-of-truth:** Core owns persistence; UI must never touch IndexedDB directly.
3. **Extensions define vocabulary:** data-only definitions (fields, UI recipes, libraries).
4. **Plugins do work:** executable capabilities; plugins may depend on extensions, not vice versa.
5. **Portability:** Core must not depend on React/Svelte or DOM APIs.
6. **Determinism:** ChangeLog + export/import must be stable and deterministic.
7. **Testable:** Public API should be verifiable through unit tests and roundtrip tests.

---

## 2. Architecture Overview

### 2.1 Layers
- **UI Client (React/Svelte PWA):** calls core via `CoreClient` adapter.
- **Core Library (this spec):** TS package, headless.
- **Extensions (data-only):** declarative bundles loaded by core.
- **Plugins (code):** optional modules registering commands.
- **Engines (optional):** TS baseline + later Rust/WASM kernels (search, match, hash, merge).

### 2.2 Dependency Direction
- ✅ Plugin → Extension (allowed)
- ❌ Extension → Plugin (not allowed)
- ✅ Core → Extension registry (allowed)
- ✅ Core → Plugin host (allowed)
- ✅ Core/Plugins → Engines (allowed)

---

## 3. Core Data Model (Kernel)

Core must support multiple media types (games, retro hardware, etc.) without hardcoding media-specific fields. Media meaning comes from extensions.

### 3.1 Entities
#### 3.1.1 Work
Represents “the thing” (game title, hardware item type, etc.).

Minimum fields:
- `id: string` (ULID or UUID; deterministic format required)
- `displayTitle: string`
- `mediaTypeKey: string` (e.g., `media.game`, `media.hardware`)
- `createdAt: number` (epoch ms)
- `updatedAt: number` (epoch ms)

#### 3.1.2 Holding
Represents “your instance/access” of a Work (physical copy, digital license, hardware unit).

Minimum fields:
- `id: string`
- `workId: string` (FK)
- `ownerKey: string` (dimension key; default = `owner.default`)
- `locationKey: string` (dimension key; default = `location.default`)
- `createdAt: number`
- `updatedAt: number`

> Note: Physical/digital can be represented as an extension field (recommended) or as a core field later if necessary.

#### 3.1.3 FieldValue (Custom Fields)
Stores extension-defined values for either Work or Holding.

- `id: string`
- `entityType: "work" | "holding"`
- `entityId: string`
- `fieldKey: string` (namespaced, see §4)
- `valueJson: any` (JSON-serializable)
- `updatedAt: number`

#### 3.1.4 DimensionValue
A registry for user-defined keys used in core (owners, locations) and potentially extension-defined dimensions.

- `key: string` (e.g., `owner.default`, `location.shelfA.bin3`)
- `label: string`
- `dimensionType: string` (e.g., `owner`, `location`)
- `metaJson?: any` (optional: parentKey, sortOrder, type)
- `createdAt: number`
- `updatedAt: number`

#### 3.1.5 Asset
Represents a stored file (photo, scan, model).

- `id: string`
- `assetType: "image" | "model" | "video" | "file"`
- `mimeType: string`
- `byteSize: number`
- `contentHash?: string` (optional)
- `createdAt: number`

#### 3.1.6 AssetLink
Associates an asset with a Work or Holding using a role string.

- `id: string`
- `assetId: string`
- `entityType: "work" | "holding"`
- `entityId: string`
- `role: string` (e.g., `photo.item.front`, `cover.front`)
- `createdAt: number`

#### 3.1.7 Library
Saved “smart list” definition.

- `id: string`
- `label: string`
- `definitionJson: any` (see §8 Libraries)
- `createdAt: number`
- `updatedAt: number`

#### 3.1.8 ChangeLogEntry
Append-only record of mutations for export/import and future sync.

- `id: string`
- `timestamp: number`
- `opType: string` (e.g., `work.create`, `field.set`, `asset.link`)
- `payloadJson: any`
- `deviceId?: string` (optional v1)
- `seq?: number` (optional v1)

**Requirement:** Every mutation that changes stored data MUST generate a ChangeLog entry.

---

## 4. Extension System (Data-only)

### 4.1 Purpose
Extensions define:
- Field definitions (keys, types, validation rules)
- UI recipes (forms/panels/actions declarations)
- Library templates (saved filters)
- Default dimensions (optional; e.g., baseline locations)

Extensions contain **no executable code**.

### 4.2 Namespacing
All extension-defined keys must be namespaced:
- Field keys: `ext.<extensionId>.<name>`  
  Example: `ext.media.games.play_status`
- Asset roles: `role.<extensionId>.<name>` (or shared roles if desired)  
  Example: `role.media.games.cover_front`
- Action IDs: `action.<extensionId>.<name>`

### 4.3 Extension Manifest (Minimum)
```ts
type ExtensionManifest = {
  id: string;                 // e.g., "media.games"
  version: string;            // semver
  tier: "public" | "private"; // private excluded from release builds
  fields?: FieldDef[];
  ui?: UiRecipeBundle;
  libraries?: LibraryTemplate[];
  dimensions?: DimensionTemplate[];
};