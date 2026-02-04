import { logger } from '@/app/utils/logger'
import { Palette } from '@/constants/palette'
import React, { useEffect, useState } from 'react'
import { Alert, Button, FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native'

type Props = {
  visible: boolean
  onClose: () => void
}

export const LogViewer: React.FC<Props> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState<string | null>(null)

  function refresh() {
    const all = logger.getLogs()
    if (filter) {
      setLogs(all.filter((l) => (l.message || '').includes(filter) || JSON.stringify(l.meta || {}).includes(filter)))
    } else {
      setLogs(all)
    }
  }

  useEffect(() => {
    if (visible) refresh()
  }, [visible, filter])

  function clear() {
    logger.clearLogs()
    setLogs([])
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Logs (dev)</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => setFilter('AI_FEEDBACK')} style={styles.actionBtn}><Text>AI</Text></Pressable>
              <Pressable onPress={() => setFilter('NOTE_CREATED')} style={styles.actionBtn}><Text>NOTE</Text></Pressable>
              <Pressable onPress={() => setFilter(null)} style={styles.actionBtn}><Text>All</Text></Pressable>
              <Pressable onPress={refresh} style={styles.actionBtn}><Text>Refresh</Text></Pressable>
              <Pressable onPress={clear} style={styles.actionBtn}><Text>Clear</Text></Pressable>
              <Pressable onPress={async () => {
                try {
                  const data = (filter ? logger.getLogs((l) => (l.message || '').includes(filter) || JSON.stringify(l.meta || {}).includes(filter)) : logger.getLogs()).slice().reverse()
                  const message = JSON.stringify(data, null, 2)
                  await Share.share({ message })
                } catch (e) {
                  Alert.alert('Export failed', String(e))
                }
              }} style={styles.actionBtn}><Text>Export</Text></Pressable>
            </View>
          </View>

          <FlatList
            data={logs.slice().reverse()}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.ts}>{item.ts}</Text>
                <Text style={styles.line}>{item.level.toUpperCase()} — {item.message}</Text>
                <Text style={styles.meta}>{JSON.stringify(item.meta)}</Text>
              </View>
            )}
          />

          <View style={styles.footer}>
            <Button
              title="Export"
              onPress={async () => {
                try {
                  const data = (filter ? logger.getLogs((l) => (l.message || '').includes(filter) || JSON.stringify(l.meta || {}).includes(filter)) : logger.getLogs()).slice().reverse()
                  const message = JSON.stringify(data, null, 2)
                  await Share.share({ message })
                } catch (e) {
                  Alert.alert('Export failed', String(e))
                }
              }}
            />
            <Button title="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center' },
  panel: { backgroundColor: Palette.colorBgElevated, margin: 20, borderRadius: 10, padding: 12, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16, color: Palette.colorTextMain },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { marginLeft: 8, padding: 6, backgroundColor: Palette.colorPrimarySoft, borderRadius: 6 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderColor: Palette.colorDivider },
  ts: { fontSize: 10, color: Palette.colorTextMuted },
  line: { fontSize: 12, fontWeight: '600', color: Palette.colorTextMain },
  meta: { fontSize: 12, color: Palette.colorTextSecondary },
  footer: { marginTop: 8 },
})

export default LogViewer
