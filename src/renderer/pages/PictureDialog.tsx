import { Fab, useTheme } from '@mui/material'
import { useTranslation } from 'react-i18next'
import * as atoms from '../stores/atoms'
import { useSetAtom, useAtomValue } from 'jotai'
import { Img } from '@/components/Image'
import storage from '@/storage'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import platform from '@/platform'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { MessagePicture } from 'src/shared/types'
import { useEffect, useState, useCallback } from 'react'

export default function PictureDialog(props: {}) {
  const pictureShow = useAtomValue(atoms.pictureShowAtom)
  if (!pictureShow) {
    return null
  }
  if (!pictureShow.picture.url && !pictureShow.picture.storageKey) {
    return null
  }
  return (
    <_PictureDialog picture={pictureShow.picture} onSave={pictureShow.onSave} extraButtons={pictureShow.extraButtons} />
  )
}

function _PictureDialog(props: {
  picture: MessagePicture
  onSave?: () => void
  extraButtons?: {
    onClick: () => void
    icon: React.ReactNode
  }[]
}) {
  const { picture, onSave, extraButtons } = props
  const theme = useTheme()
  const setPictureShow = useSetAtom(atoms.pictureShowAtom)
  const [url, setUrl] = useState(picture.url)

  useEffect(() => {
    ;(async () => {
      if (picture.url) {
        return
      }
      if (picture.storageKey) {
        const base64 = await storage.getBlob(picture.storageKey)
        if (base64) {
          const picBase64 = base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`
          setUrl(picBase64)
        }
      }
    })()
  }, [picture.url, picture.storageKey])

  const onClose = () => setPictureShow(null)
  const onSaveDefault = async () => {
    if (!picture) {
      return
    }
    const basename = `export_${Math.random().toString(36).substring(7)}`
    if (picture.storageKey) {
      const base64 = await storage.getBlob(picture.storageKey)
      if (!base64) {
        return
      }
      platform.exporter.exportImageFile(basename, base64)
    }
    if (picture.url) {
      if (picture.url.startsWith('data:image')) {
        platform.exporter.exportImageFile(basename, picture.url)
        return
      }
      platform.exporter.exportByUrl(`${basename}.png`, picture.url)
    }
  }

  // 点击 Esc 关闭
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onKeyDown])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
      onClick={onClose}
      tabIndex={0}
    >
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 1001,
          display: 'flex',
          gap: '12px',
          paddingTop: 'var(--mobile-safe-area-inset-top, 0px)',
          paddingRight: 'var(--mobile-safe-area-inset-right, 0px)',
          paddingBottom: 'var(--mobile-safe-area-inset-bottom, 0px)',
          paddingLeft: 'var(--mobile-safe-area-inset-left, 0px)',
        }}
      >
        {extraButtons?.map((button, index) => (
          <Fab
            key={index}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              button.onClick()
              onClose()
            }}
          >
            {button.icon}
          </Fab>
        ))}
        <Fab
          color="primary"
          aria-label="save"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSaveDefault()
          }}
        >
          <SaveIcon />
        </Fab>
        <Fab
          aria-label="close"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }}
        >
          <CloseIcon />
        </Fab>
      </div>
      {url && (
        <div
          className="animate-in fade-in duration-300 ease-in-out"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <TransformWrapper initialScale={1} centerOnInit={true} minScale={0.1} maxScale={8} limitToBounds={false}>
            <TransformComponent
              wrapperStyle={{
                width: '100%',
                height: '100%',
              }}
              wrapperProps={{
                onClick: (e) => {
                  onClose()
                },
              }}
              contentStyle={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.palette.background.default, // 透明的流程图、线框图需要背景色
              }}
              contentProps={{
                onClick: (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                },
              }}
            >
              {/* 这里不能使用异步的 ImageInStorage，否则会导致图片位置不对 */}
              <Img
                src={url}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </div>
  )
}
