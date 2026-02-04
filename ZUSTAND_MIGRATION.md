# Zustand Store Migration: From Polling to Reactive State

## 🎯 What Changed

Replaced **1-second polling** in all category screens with **Zustand reactive state management** for instant, efficient UI updates.

---

## 🏗️ Architecture

### Before (Polling):
```tsx
// Each screen (have.tsx, urgent.tsx, nice.tsx)
const [notes, setNotes] = useState([])
const [contexts, setContexts] = useState([])

useEffect(() => {
  const interval = setInterval(() => {
    const pending = notes.filter(n => n.classificationStatus === 'pending')
    if (pending.length > 0) load() // Re-fetch from DB every second
  }, 1000)
  return () => clearInterval(interval)
}, [notes])
```

**Problems:**
- ❌ Inefficient (3 screens × 1 poll/second = 3 DB hits/second)
- ❌ Delay up to 1 second before UI updates
- ❌ Duplicated logic across 3 screens
- ❌ CPU/battery waste

### After (Zustand):
```tsx
// Centralized store (app/store/notes-store.ts)
export const useNotesStore = create<NotesStore>((set) => ({
  notes: [],
  contexts: [],
  addNote: (note) => set(state => ({ notes: [...state.notes, note] })),
  updateNoteClassification: (noteId, contextId, status) => 
    set(state => ({ notes: state.notes.map(n => n.id === noteId ? {...n, contextId, status} : n) })),
}))

// Each screen
const notes = useNotesStore(state => state.notes.filter(n => n.category === CATEGORY))
const contexts = useNotesStore(state => state.contexts.filter(c => c.category === CATEGORY))
```

**Benefits:**
- ✅ **Instant updates** (0ms delay)
- ✅ **Single source of truth**
- ✅ **Automatic re-renders** only when relevant data changes
- ✅ **No polling overhead**
- ✅ **Cleaner code** (removed ~40 lines per screen)

---

## 📁 Files Modified

### 1. **New Store** ([app/store/notes-store.ts](app/store/notes-store.ts))
```typescript
// State
notes: Note[]
contexts: Context[]
loading: boolean
pendingCount: number (computed)

// Actions
loadNotes(category?: string): Promise<void>
addNote(note: Note): void
updateNoteClassification(noteId, contextId, status): void
addContext(context: Context): void
refreshData(): Promise<void>
```

**Key Features:**
- Centralized state for all notes and contexts
- Computed `pendingCount` property
- Automatic deduplication of contexts
- Logging for all state changes

### 2. **Classification Pipeline** ([services/classification-pipeline.ts](services/classification-pipeline.ts))
**Added:**
```typescript
import { useNotesStore } from '../app/store/notes-store'

// After DB update, update store
useNotesStore.getState().updateNoteClassification(noteId, result.contextId, 'assigned')

// When AI creates new context
useNotesStore.getState().addContext(newContext)
```

**Flow:**
1. AI classification completes
2. Update SQLite database
3. **Update Zustand store** (instant UI update)
4. All subscribed screens re-render automatically

### 3. **Note Creator** ([app/services/note-creator.ts](app/services/note-creator.ts))
**Added:**
```typescript
import { useNotesStore } from '../store/notes-store'

// After creating note in DB, add to store
const note = { id, title, body, category, contextId: null, classificationStatus: 'pending' }
await NotesRepo.saveNote(note)
useNotesStore.getState().addNote(note) // ← Instant UI update
classifyNoteAsync(id) // Background classification
```

**Result:** 
- Modal closes instantly
- Note appears in UI immediately (via store)
- No need to wait for `load()` callback

### 4. **Category Screens** (have.tsx, urgent.tsx, nice.tsx)
**Removed:**
- `useState` for notes/contexts
- `load()` function
- Polling `useEffect`
- Manual DB queries

**Added:**
```typescript
const allNotes = useNotesStore(state => state.notes)
const allContexts = useNotesStore(state => state.contexts)
const loadNotes = useNotesStore(state => state.loadNotes)

const notes = allNotes.filter(n => n.category === CATEGORY)
const contexts = allContexts.filter(c => c.category === CATEGORY)

useEffect(() => {
  loadNotes(CATEGORY) // Load once on mount
}, [loadNotes])
```

**Line Count Reduction:**
- **Before:** ~230 lines per screen
- **After:** ~180 lines per screen
- **Saved:** ~150 lines total across 3 screens

---

## 🔄 Data Flow

### Creating a Note:
```
User taps "Create"
    ↓
createNote() called
    ↓
1. Save to SQLite
2. addNote() → Zustand store  ← Instant UI update! 🎉
3. Modal closes immediately
    ↓
classifyNoteAsync() (background)
    ↓
AI responds (2-5s later)
    ↓
1. Update SQLite
2. updateNoteClassification() → Zustand store  ← Instant UI update! 🎉
    ↓
All screens re-render automatically
```

### AI Proposes New Context:
```
classifyNoteAsync() completes
    ↓
result.type === 'propose'
    ↓
1. Create context in SQLite
2. addContext() → Zustand store  ← New context appears! 🎉
3. updateNoteClassification() → Zustand store  ← Note moves to context! 🎉
    ↓
All screens re-render with new context visible
```

---

## 🎯 Performance Comparison

| Metric | Polling | Zustand |
|--------|---------|---------|
| **UI Update Latency** | 0-1000ms | 0ms (instant) |
| **DB Queries/sec** | 3/sec (worst case) | 0 (event-driven) |
| **Re-renders** | Every second (all screens) | Only when data changes |
| **Memory** | ~Same | ~Same |
| **Battery Impact** | Higher (polling) | Lower (reactive) |
| **Code Complexity** | Medium | Low |

---

## 🧪 Testing

### Verify Store Updates:
1. Create a note → Check store has new note with `pending` status
2. Wait 2-5s → Check store updated to `assigned` status
3. Open multiple category tabs → All sync instantly
4. AI creates new context → Check `contexts` array updated

### Debug Store:
```typescript
// Add this temporarily to see store changes
useEffect(() => {
  console.log('Store state:', useNotesStore.getState())
  const unsub = useNotesStore.subscribe(state => {
    console.log('Store updated:', state)
  })
  return unsub
}, [])
```

---

## 🚀 Benefits Summary

1. **Instant UI Updates** ⚡
   - No polling delay
   - Updates appear immediately when state changes

2. **Better Performance** 🏃
   - No unnecessary DB queries
   - Only re-render when data actually changes
   - Better battery life on mobile

3. **Cleaner Code** 🧹
   - Single source of truth
   - No duplicated `load()` functions
   - Removed ~150 lines of boilerplate

4. **Scalability** 📈
   - Easy to add more screens
   - Easy to add more state (e.g., filters, search)
   - Easy to add middleware (persist, devtools)

5. **Developer Experience** 💻
   - TypeScript autocomplete for store
   - Easy to debug with Zustand DevTools
   - Clear separation of concerns

---

## 🔮 Future Enhancements

### 1. Persist Store (Optional)
```typescript
import { persist } from 'zustand/middleware'

export const useNotesStore = create(
  persist<NotesStore>(
    (set) => ({ /* ... */ }),
    { name: 'notes-storage' }
  )
)
```
**Benefit:** App state survives restarts

### 2. Add DevTools (Development)
```typescript
import { devtools } from 'zustand/middleware'

export const useNotesStore = create(
  devtools<NotesStore>((set) => ({ /* ... */ }))
)
```
**Benefit:** Time-travel debugging, inspect state changes

### 3. Optimistic Updates
```typescript
addNote: (note) => {
  set(state => ({ notes: [...state.notes, note] }))
  NotesRepo.saveNote(note).catch(() => {
    // Rollback on error
    set(state => ({ notes: state.notes.filter(n => n.id !== note.id) }))
  })
}
```
**Benefit:** Even faster perceived performance

### 4. Add Selectors
```typescript
export const selectPendingNotes = (state: NotesStore) => 
  state.notes.filter(n => n.classificationStatus === 'pending')

// Usage
const pending = useNotesStore(selectPendingNotes)
```
**Benefit:** Reusable, memoized selectors

---

## ✅ Migration Complete!

**No polling** → **Reactive Zustand store** → **Instant UI updates** 🎉

All category screens now use centralized state management with zero polling overhead.
