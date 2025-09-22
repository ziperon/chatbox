import { Box, Button, Flex, Modal, ScrollArea, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomProviderBaseInfo, ModelProviderEnum, ProviderInfo, ProviderSettings } from 'src/shared/types'
import { ModelProviderType } from 'src/shared/types'
import { ModelList } from '@/components/ModelList'
import { useSettings } from '@/hooks/useSettings'
import { add as addToast } from '@/stores/toastActions'

interface ImportProviderModalProps {
  opened: boolean
  onClose: () => void
  importedConfig: ProviderInfo | (ProviderSettings & { id: ModelProviderEnum }) | null
  existingProvider: ProviderInfo | null
}

// Common styles for read-only inputs
const readOnlyInputStyles = {
  label: {
    fontWeight: 'normal',
  },
  input: {
    backgroundColor: 'var(--mantine-color-chatbox-background-secondary-text)',
    border: 'none',
    color: 'var(--mantine-color-chatbox-primary-text)',
    cursor: 'default',
  },
}

// Reusable read-only input component
const ReadOnlyInput = ({ label, value, ...props }: { label: string; value: string; [key: string]: any }) => {
  const { t } = useTranslation()
  return <TextInput label={t(label)} value={value} readOnly styles={readOnlyInputStyles} {...props} />
}

export function ImportProviderModal({ opened, onClose, importedConfig, existingProvider }: ImportProviderModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { settings, setSettings } = useSettings()

  // Derive form values from props directly
  const providerName =
    (importedConfig && ('name' in importedConfig ? importedConfig?.name : '')) ||
    (existingProvider && 'name' in existingProvider ? existingProvider.name : '') ||
    ''
  const providerId = importedConfig?.id || ''
  const apiHost = importedConfig?.apiHost || existingProvider?.apiHost || ''
  const apiPath = importedConfig?.apiPath || ''
  const apiKey = importedConfig?.apiKey || ''
  const urls = importedConfig && 'urls' in importedConfig ? importedConfig?.urls : existingProvider?.urls || {}

  // Filter out duplicate model IDs, fallback to existing provider models
  const allModels = importedConfig?.models || existingProvider?.models || []
  const uniqueModels = allModels.filter(
    (model, index, array) => array.findIndex((m) => m.modelId === model.modelId) === index
  )

  const handleConfirmImport = useCallback(() => {
    // 如果有 existing provider， 可能是 built-in 也可能是 custom provider，如果没有，一定是 custom provider

    const providerSettings = {
      ...settings.providers?.[providerId],
      ...{
        apiHost,
        apiPath,
        apiKey,
        models: uniqueModels,
      },
    }
    if (existingProvider && !existingProvider.isCustom) {
      // import for built-in provder，only import provider settings
      const updatedSettings = {
        providers: {
          ...settings.providers,
          [providerId]: providerSettings,
        },
      }
      setSettings(updatedSettings)
    } else {
      // import custom provider, include provider base info
      const baseProviderInfo: CustomProviderBaseInfo = {
        id: providerId,
        name: providerName,
        type: ModelProviderType.OpenAI,
        iconUrl: importedConfig && 'iconUrl' in importedConfig ? importedConfig?.iconUrl : undefined,
        urls,
        isCustom: true,
      }
      const updatedSettings = {
        // replace or insert custom provider info
        customProviders: existingProvider
          ? (settings.customProviders || []).map((p) => (p.id === providerId ? { ...p, ...baseProviderInfo } : p))
          : [...(settings.customProviders || []), baseProviderInfo],
        providers: {
          ...settings.providers,
          [providerId]: providerSettings,
        },
      }
      setSettings(updatedSettings)
    }
    addToast(t(existingProvider ? 'Provider updated successfully' : 'Provider imported successfully'))
    onClose()

    navigate({
      to: '/settings/provider/$providerId',
      params: { providerId },
    })
  }, [
    providerId,
    providerName,
    apiHost,
    apiPath,
    apiKey,
    urls,
    uniqueModels,
    existingProvider,
    settings,
    setSettings,
    navigate,
    t,
    onClose,
    importedConfig,
  ])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Import Provider Configuration')}
      centered
      size="lg"
      styles={{
        content: {
          borderRadius: '12px',
        },
        header: {
          borderBottom: 'none',
          paddingBottom: 0,
        },
        body: {
          paddingTop: 0,
        },
      }}
    >
      <Stack gap="md">
        {/* Status alerts */}
        {existingProvider ? (
          <Flex
            align="center"
            gap="xs"
            p="sm"
            style={{
              backgroundColor: 'var(--mantine-color-chatbox-background-error-secondary-5)',
              borderRadius: '8px',
            }}
          >
            <IconAlertTriangle size={16} color="var(--mantine-color-chatbox-error-5)" />
            <Box flex={1}>
              <Text size="sm" fw={600} c="chatbox-error">
                {t('Provider already exists')}
              </Text>
              <Text size="sm" c="chatbox-error">
                {t('A provider with this ID already exists. Continuing will overwrite the existing configuration.')}
              </Text>
            </Box>
          </Flex>
        ) : null}

        {/* Form fields */}
        <Box>
          <Flex gap="md" mb="md">
            <ReadOnlyInput label="Provider Name" value={providerName} style={{ flex: 1 }} />
            <ReadOnlyInput label="ID" value={providerId} style={{ flex: 1 }} />
          </Flex>

          {(importedConfig?.apiHost || importedConfig?.apiPath) && (
            <Flex gap="md" mb="md">
              {importedConfig?.apiHost && <ReadOnlyInput label="API Host" value={apiHost} style={{ flex: 1 }} />}
              {importedConfig?.apiPath && <ReadOnlyInput label="API Path" value={apiPath} style={{ flex: 1 }} />}
            </Flex>
          )}

          <ReadOnlyInput label="API Key" value={apiKey} mb="md" />

          {/* Model list */}
          {importedConfig?.models && importedConfig.models.length > 0 && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                {t('Model')}
              </Text>
              <ScrollArea h={200}>
                <ModelList models={uniqueModels} showActions={false} />
              </ScrollArea>
            </Box>
          )}
        </Box>

        {/* Action buttons */}
        <Flex justify="flex-end" gap="sm" mt="lg">
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirmImport} disabled={!providerName || !providerId}>
            {t('Save')}
          </Button>
        </Flex>
      </Stack>
    </Modal>
  )
}
