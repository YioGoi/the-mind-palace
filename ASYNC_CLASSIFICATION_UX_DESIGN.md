# Async Classification UX Pattern

## User Experience Flow

### Current (Blocking):
1. User taps "Create" → Modal shows "Creating..."
2. Wait for DB write + AI classification (2-5 seconds)
3. Modal closes, note appears in final context

**Problem**: User waits for AI, poor perceived performance

### Proposed (Non-blocking):
1. User taps "Create" → Modal closes immediately
2. Note appears in temporary "Classifying..." context
3. Context headers show loading spinner on count badges
4. AI classifies in background (2-5 seconds)
5. Note smoothly moves to final context (or new context appears)

**Benefit**: Instant feedback, AI works in background

---

## Technical Implementation

### Phase 1: Instant Note Creation (Already Works!)
```typescript
// note-creator.ts - CURRENT
await NotesRepo.saveNote(note)  // ✅ Instant
classifyNoteAsync(id)           // ✅ Fire-and-forget
```

### Phase 2: Classification Status Tracking

**Database Schema** (already added):
```sql
ALTER TABLE notes ADD COLUMN classificationStatus TEXT; -- 'pending' | 'assigned' | 'error'
```

**Update note-creator.ts**:
```typescript
const note = { 
  id, title, body, category, 
  contextId: null,                    // Start unassigned
  classificationStatus: 'pending'     // NEW
}
await NotesRepo.saveNote(note)
classifyNoteAsync(id)  // Async, updates status when done
```

### Phase 3: UI Loading States

#### Option A: Real-time SQLite Subscription (Ideal)
```typescript
// Use expo-sqlite onUpdate events
useEffect(() => {
  const subscription = db.on('update', (tableName) => {
    if (tableName === 'notes') load() // Reload when notes change
  })
  return () => subscription.remove()
}, [])
```

#### Option B: Polling (Simpler)
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const pending = notes.filter(n => n.classificationStatus === 'pending')
    if (pending.length > 0) load() // Re-fetch if any pending
  }, 500) // Check every 500ms
  return () => clearInterval(interval)
}, [notes])
```

#### Option C: Event-based (Best)
```typescript
// classification-pipeline.ts - emit event when done
import { EventEmitter } from 'events'
export const classificationEvents = new EventEmitter()

export async function classifyNoteAsync(noteId: string) {
  // ... classification logic
  classificationEvents.emit('classified', { noteId, contextId })
}

// have.tsx - listen for events
useEffect(() => {
  const handler = () => load()
  classificationEvents.on('classified', handler)
  return () => classificationEvents.off('classified', handler)
}, [])
```

### Phase 4: Visual Loading Indicators

#### Section Header with Loading Badge:
```tsx
<Text style={styles.sectionTitle}>
  {section.title}
  {hasPendingNotes ? (
    <ActivityIndicator size="small" style={{ marginLeft: 8 }} />
  ) : (
    <Text style={styles.sectionCount}> ({count})</Text>
  )}
</Text>
```

#### Skeleton for New Context (if AI might create one):
```tsx
{notes.some(n => n.classificationStatus === 'pending') && (
  <View style={styles.skeletonContext}>
    <ActivityIndicator />
    <Text>AI is creating a new context...</Text>
  </View>
)}
```

#### Note Card with Pending State:
```tsx
<NoteCard
  id={item.id}
  title={item.title}
  subtitle={item.classificationStatus === 'pending' ? 'Classifying...' : section?.title}
  isPending={item.classificationStatus === 'pending'}
/>
```

---

## Recommended Implementation Order

### Step 1: Update note-creator.ts
- Set `contextId: null` and `classificationStatus: 'pending'` on creation
- Keep `classifyNoteAsync(id)` fire-and-forget

### Step 2: Add polling to category screens
- Every 500ms, check for notes with `classificationStatus === 'pending'`
- If any exist, reload data

### Step 3: Add visual indicators
- Show spinner on context count badges when pending notes exist
- Add subtle pulse/shimmer to pending notes

### Step 4: (Optional) Optimize with events
- Replace polling with EventEmitter for better performance

---

## Edge Cases

1. **AI takes too long (>10s)**: Show timeout message, let user manually assign
2. **AI fails**: Status becomes 'error', show retry button
3. **Multiple pending notes**: Show spinner on all affected contexts
4. **User navigates away**: Classification continues, updates on return
5. **New context created**: Smoothly insert into section list (no jarring re-order)

---

## Performance Considerations

- **Polling**: 500ms interval is cheap (just checking in-memory array)
- **Re-render**: Only reload when status changes (avoid unnecessary DB hits)
- **Animation**: Use native driver for smooth spinner/pulse animations
- **Debounce**: If many notes created rapidly, debounce reload to avoid flicker
