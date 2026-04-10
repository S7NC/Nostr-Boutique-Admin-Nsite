import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useNostrPool } from '~/composables/useNostrPool'
import { buildActiveThemeTemplate, buildThemeDefinitionTemplate, parseDittoThemeEvent } from '~/composables/useDittoThemeProtocol'

const emptyDraft = () => ({
  d: '',
  title: '',
  primary: '#0f766e',
  text: '#11221c',
  background: '#eef3ee',
  bodyFontFamily: '',
  bodyFontUrl: '',
  titleFontFamily: '',
  titleFontUrl: '',
  bgUrl: '',
  bgMode: 'cover',
  bgMime: ''
})

export const useDesignStore = defineStore('design', () => {
  const { queryEvents, publishEvent } = useNostrPool()

  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const themes = ref([])
  const activeTheme = ref(null)
  const draft = ref(emptyDraft())

  const hasThemes = computed(() => themes.value.length > 0)

  const resetDraft = () => {
    draft.value = emptyDraft()
  }

  const applyThemeToDraft = (theme) => {
    draft.value = {
      d: theme.d || '',
      title: theme.title || '',
      primary: theme.primary || '#0f766e',
      text: theme.text || '#11221c',
      background: theme.background || '#eef3ee',
      bodyFontFamily: theme.bodyFontFamily || '',
      bodyFontUrl: theme.bodyFontUrl || '',
      titleFontFamily: theme.titleFontFamily || '',
      titleFontUrl: theme.titleFontUrl || '',
      bgUrl: theme.bgUrl || '',
      bgMode: theme.bgMode || 'cover',
      bgMime: theme.bgMime || ''
    }
  }

  const loadThemes = async ({ pubkey, relays }) => {
    if (!pubkey) return

    loading.value = true
    error.value = ''
    try {
      const [themeEvents, activeEvents] = await Promise.all([
        queryEvents(relays, {
          kinds: [36767],
          authors: [pubkey],
          limit: 100
        }),
        queryEvents(relays, {
          kinds: [16767],
          authors: [pubkey],
          limit: 1
        })
      ])

      themes.value = themeEvents
        .map(parseDittoThemeEvent)
        .sort((a, b) => b.createdAt - a.createdAt)

      activeTheme.value = activeEvents[0] ? parseDittoThemeEvent(activeEvents[0]) : null
    } catch (err) {
      error.value = err.message || 'Failed to load themes'
    } finally {
      loading.value = false
    }
  }

  const publishThemeDefinition = async ({ signer, pubkey, relays, signAuthChallenge }) => {
    saving.value = true
    error.value = ''
    try {
      const template = buildThemeDefinitionTemplate(pubkey, draft.value)
      const signed = await signer.signEvent(template)
      await publishEvent(relays, signed, signAuthChallenge)
      await loadThemes({ pubkey, relays })
      return parseDittoThemeEvent(signed)
    } catch (err) {
      error.value = err.message || 'Failed to publish theme'
      throw err
    } finally {
      saving.value = false
    }
  }

  const publishActiveTheme = async ({ signer, pubkey, relays, signAuthChallenge, theme }) => {
    saving.value = true
    error.value = ''
    try {
      const template = buildActiveThemeTemplate(pubkey, theme)
      const signed = await signer.signEvent(template)
      await publishEvent(relays, signed, signAuthChallenge)
      activeTheme.value = parseDittoThemeEvent(signed)
      return activeTheme.value
    } catch (err) {
      error.value = err.message || 'Failed to set active theme'
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    loading,
    saving,
    error,
    themes,
    activeTheme,
    draft,
    hasThemes,
    resetDraft,
    applyThemeToDraft,
    loadThemes,
    publishThemeDefinition,
    publishActiveTheme
  }
})
