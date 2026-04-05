import { logger } from '@/lib/utils/logger'
import { useAppTheme } from '@/hooks/use-app-theme'
import React, { useEffect, useState } from 'react'
import { Alert, Button, FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native'

type Props = {
  visible: boolean
  onClose: () => void
}

export const LogViewer: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useAppTheme()
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
        <View style={[styles.panel, { backgroundColor: colors.colorBgElevated }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.colorTextMain }]}>Logs (dev)</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => setFilter('AI_FEEDBACK')} style={[styles.actionBtn, { backgroundColor: colors.colorPrimarySoft }]}><Text style={{ color: colors.colorTextMain }}>AI</Text></Pressable>
              <Pressable onPress={() => setFilter('NOTE_CREATED')} style={[styles.actionBtn, { backgroundColor: colors.colorPrimarySoft }]}><Text style={{ color: colors.colorTextMain }}>NOTE</Text></Pressable>
              <Pressable onPress={() => setFilter(null)} style={[styles.actionBtn, { backgroundColor: colors.colorPrimarySoft }]}><Text style={{ color: colors.colorTextMain }}>All</Text></Pressable>
              <Pressable onPress={refresh} style={[styles.actionBtn, { backgroundColor: colors.colorPrimarySoft }]}><Text style={{ color: colors.colorTextMain }}>Refresh</Text></Pressable>
              <Pressable onPress={clear} style={[styles.actionBtn, { backgroundColor: colors.colorPrimarySoft }]}><Text style={{ color: colors.colorTextMain }}>Clear</Text></Pressable>
              <Pressable onPress={async () => {
                try {
                  const data = (filter ? logger.getLogs((l) => (l.message || '').includes(filter) || JSON.stringify(l.meta || {}).includes(filter)) : logger.getLogs()).slice().reverse()
                  const message = JSON.stringify(data, null, 2)
                  await Share.share({ message })
                } catch (e) {
                  Alert.alert('Export failed', String(e))
                }
              }} style={[styles.actionBtn, { backgroundColor: colors.colorPrimarySoft }]}><Text style={{ color: colors.colorTextMain }}>Export</Text></Pressable>
            </View>
          </View>

          <FlatList
            data={logs.slice().reverse()}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={[styles.row, { borderColor: colors.colorDivider }]}>
                <Text style={[styles.ts, { color: colors.colorTextMuted }]}>{item.ts}</Text>
                <Text style={[styles.line, { color: colors.colorTextMain }]}>{item.level.toUpperCase()} — {item.message}</Text>
                <Text style={[styles.meta, { color: colors.colorTextSecondary }]}>{JSON.stringify(item.meta)}</Text>
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
  panel: { margin: 20, borderRadius: 10, padding: 12, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { marginLeft: 8, padding: 6, borderRadius: 6 },
  row: { paddingVertical: 8, borderBottomWidth: 1 },
  ts: { fontSize: 10 },
  line: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 12 },
  footer: { marginTop: 8 },
})

export default LogViewer
