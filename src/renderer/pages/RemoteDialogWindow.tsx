import React from 'react'
import { Box, Button, Dialog, DialogContent, DialogActions, DialogContentText } from '@mui/material'
import { useTranslation } from 'react-i18next'
import * as remote from '../packages/remote'
import { getDefaultStore } from 'jotai'
import platform from '@/platform'
import { settingsAtom } from '../stores/atoms'
import storage from '../storage'
import Markdown from '@/components/Markdown'
import { trackingEvent } from '@/packages/event'

const { useEffect, useState } = React

export default function RemoteDialogWindow() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [dialogConfig, setDialogConfig] = useState<remote.DialogConfig | null>(null)

  const checkRemoteDialog = async () => {
    const store = getDefaultStore()
    const config = await platform.getConfig()
    const settings = store.get(settingsAtom)
    const version = await platform.getVersion()
    if (version === '0.0.1') {
      return // 本地开发环境不显示远程弹窗
    }
    try {
      const dialog = await remote.getDialogConfig({
        uuid: config.uuid,
        language: settings.language,
        version: version,
      })
      setDialogConfig(dialog)
      if (dialog) {
        setOpen(true)
      }
    } catch (e) {
      console.log(e)
    }
  }
  useEffect(() => {
    checkRemoteDialog()
    setInterval(checkRemoteDialog, 1000 * 60 * 60 * 24) // 对于常年不关机的用户，也要每天检查一次
  }, [])
  // 打点上报
  useEffect(() => {
    if (open) {
      trackingEvent('remote_dialog_window', { event_category: 'screen_view' })
    }
  }, [open])

  const onClose = (event?: any, reason?: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick') {
      return
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <DialogContentText>
          <Markdown>{dialogConfig?.markdown || ''}</Markdown>
          <Box>
            {dialogConfig?.buttons.map((button, index) => (
              <Button onClick={() => platform.openLink(button.url)}>{button.label}</Button>
            ))}
          </Box>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>{t('cancel')}</Button>
      </DialogActions>
    </Dialog>
  )
}
