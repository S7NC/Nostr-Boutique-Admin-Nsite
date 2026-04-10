const now = () => Math.floor(Date.now() / 1000)

const getTagValue = (tags, name, fallback = '') => {
  const tag = tags.find((item) => item[0] === name)
  return tag?.[1] || fallback
}

const getColorByRole = (tags, role, fallback) => {
  const tag = tags.find((item) => item[0] === 'c' && item[2] === role)
  return tag?.[1] || fallback
}

const getFontByRole = (tags, role) => {
  const tag = tags.find((item) => item[0] === 'f' && item[3] === role)
  if (!tag) {
    return { family: '', url: '' }
  }

  return {
    family: tag[1] || '',
    url: tag[2] || ''
  }
}

const getBackground = (tags) => {
  const tag = tags.find((item) => item[0] === 'bg')
  if (!tag) {
    return { url: '', mode: 'cover', mime: '' }
  }

  const parts = tag.slice(1)
  const read = (key) => {
    const found = parts.find((part) => part.startsWith(`${key} `))
    return found ? found.slice(key.length + 1) : ''
  }

  return {
    url: read('url'),
    mode: read('mode') || 'cover',
    mime: read('m')
  }
}

export const parseDittoThemeEvent = (event) => {
  const tags = event.tags || []
  const bodyFont = getFontByRole(tags, 'body')
  const titleFont = getFontByRole(tags, 'title')
  const background = getBackground(tags)

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    d: getTagValue(tags, 'd'),
    title: getTagValue(tags, 'title', 'Untitled Theme'),
    primary: getColorByRole(tags, 'primary', '#0f766e'),
    text: getColorByRole(tags, 'text', '#11221c'),
    background: getColorByRole(tags, 'background', '#eef3ee'),
    bodyFontFamily: bodyFont.family,
    bodyFontUrl: bodyFont.url,
    titleFontFamily: titleFont.family,
    titleFontUrl: titleFont.url,
    bgUrl: background.url,
    bgMode: background.mode,
    bgMime: background.mime
  }
}

const colorTag = (value, role) => ['c', value.toLowerCase(), role]

export const buildThemeDefinitionTemplate = (pubkey, draft) => {
  const tags = [
    ['d', draft.d],
    colorTag(draft.primary, 'primary'),
    colorTag(draft.text, 'text'),
    colorTag(draft.background, 'background'),
    ['title', draft.title],
    ['alt', `Theme ${draft.title}`]
  ]

  if (draft.bodyFontFamily && draft.bodyFontUrl) {
    tags.push(['f', draft.bodyFontFamily, draft.bodyFontUrl, 'body'])
  }

  if (draft.titleFontFamily && draft.titleFontUrl) {
    tags.push(['f', draft.titleFontFamily, draft.titleFontUrl, 'title'])
  }

  if (draft.bgUrl) {
    const bgTag = ['bg', `url ${draft.bgUrl}`, `mode ${draft.bgMode || 'cover'}`]
    if (draft.bgMime) {
      bgTag.push(`m ${draft.bgMime}`)
    }
    tags.push(bgTag)
  }

  return {
    kind: 36767,
    created_at: now(),
    pubkey,
    tags,
    content: ''
  }
}

export const buildActiveThemeTemplate = (pubkey, theme) => {
  const tags = [
    colorTag(theme.primary, 'primary'),
    colorTag(theme.text, 'text'),
    colorTag(theme.background, 'background'),
    ['title', theme.title],
    ['alt', 'Active profile theme']
  ]

  if (theme.bodyFontFamily && theme.bodyFontUrl) {
    tags.push(['f', theme.bodyFontFamily, theme.bodyFontUrl, 'body'])
  }

  if (theme.titleFontFamily && theme.titleFontUrl) {
    tags.push(['f', theme.titleFontFamily, theme.titleFontUrl, 'title'])
  }

  if (theme.bgUrl) {
    const bgTag = ['bg', `url ${theme.bgUrl}`, `mode ${theme.bgMode || 'cover'}`]
    if (theme.bgMime) {
      bgTag.push(`m ${theme.bgMime}`)
    }
    tags.push(bgTag)
  }

  return {
    kind: 16767,
    created_at: now(),
    pubkey,
    tags,
    content: ''
  }
}
