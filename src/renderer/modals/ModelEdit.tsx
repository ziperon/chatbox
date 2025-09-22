import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Checkbox, Flex, Modal, Stack, Text, TextInput, Select } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProviderModelInfo } from 'src/shared/types'

const ModelEdit = NiceModal.create((props: { model?: ProviderModelInfo }) => {
  const modal = useModal()
  const { t } = useTranslation()

  const isNew = !props.model
  const [modelId, setModelId] = useState(props.model?.modelId || '')
  const [nickname, setNickname] = useState(props.model?.nickname || '')
  const [capabilities, setCapabilities] = useState(props.model?.capabilities || [])
  const [type, setType] = useState<ProviderModelInfo['type']>(props.model?.type || 'chat')

  const typeOptions = [
    { value: 'chat', label: t('Chat')?.toString() ?? 'Chat' },
    { value: 'embedding', label: t('Embedding')?.toString() ?? 'Embedding' },
    { value: 'rerank', label: t('Rerank')?.toString() ?? 'Rerank' },
  ]

  useEffect(() => {
    setModelId(props.model?.modelId || '')
    setNickname(props.model?.nickname || '')
    setCapabilities(props.model?.capabilities || [])
    setType(props.model?.type || 'chat')
  }, [props])

  const handleCancel = () => {
    modal.resolve()
    modal.hide()
  }

  const handleSave = () => {
    modal.resolve({
      modelId,
      type,
      nickname,
      capabilities,
    })
    modal.hide()
  }

  return (
    <Modal
      keepMounted={false}
      opened={modal.visible}
      onClose={handleCancel}
      title={t('Edit Model')}
      centered={true}
      w={456}
    >
      <Stack gap="md">
        {/* Model ID & NickName */}
        <Stack gap="xs">
          <Flex align="center" gap="lg">
            <Stack gap={0}>
              <Text>{t('Model ID')}</Text>
              <Text className="select-none h-0 overflow-hidden opacity-0">{t('Nickname')}</Text>
            </Stack>
            <TextInput disabled={!isNew} flex={1} value={modelId} onChange={(e) => setModelId(e.currentTarget.value)} />
          </Flex>
          <Flex align="center" gap="lg">
            <Stack gap={0}>
              <Text className="select-none h-0 overflow-hidden opacity-0">{t('Model ID')}</Text>
              <Text>{t('Nickname')}</Text>
            </Stack>
            <TextInput
              placeholder={String(t('optional') ?? 'optional')}
              flex={1}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </Flex>
        </Stack>

        {/* Model Type */}
        <Stack gap="xs">
          <Text fw="600">{t('Model Type')}</Text>
          <Select
            comboboxProps={{ withinPortal: false }}
            allowDeselect={false}
            styles={{
              label: {
                fontWeight: 400,
              },
            }}
            data={typeOptions}
            value={type}
            onChange={(v) => setType(v as ProviderModelInfo['type'])}
          />
        </Stack>

        {/* Capabilities */}
        {type === 'chat' && (
          <Stack gap="xs">
            <Text fw="600">{t('Capabilities')}</Text>
            <Flex align="center" gap="md">
              <Checkbox
                flex={1}
                label={t('Vision')}
                checked={capabilities?.includes('vision')}
                onChange={(e) => {
                  const checked = e.currentTarget.checked
                  if (checked) {
                    setCapabilities([...(capabilities || []), 'vision'])
                  } else {
                    setCapabilities([...(capabilities?.filter((c) => c !== 'vision') || [])])
                  }
                }}
              />
              <Checkbox
                flex={1}
                label={t('Reasoning')}
                checked={capabilities?.includes('reasoning')}
                onChange={(e) => {
                  const checked = e.currentTarget.checked
                  if (checked) {
                    setCapabilities([...(capabilities || []), 'reasoning'])
                  } else {
                    setCapabilities([...(capabilities?.filter((c) => c !== 'reasoning') || [])])
                  }
                }}
              />
              <Checkbox
                flex={1}
                label={t('Tool use')}
                checked={capabilities?.includes('tool_use')}
                onChange={(e) => {
                  const checked = e.currentTarget.checked
                  if (checked) {
                    setCapabilities([...(capabilities || []), 'tool_use'])
                  } else {
                    setCapabilities([...(capabilities?.filter((c) => c !== 'tool_use') || [])])
                  }
                }}
              />
            </Flex>
          </Stack>
        )}

        <Flex align="center" justify="flex-end" gap="xs">
          <Button onClick={handleCancel} color="chatbox-gray" variant="light">
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave}>{t('Save')}</Button>
        </Flex>
      </Stack>
    </Modal>
  )
})

export default ModelEdit
