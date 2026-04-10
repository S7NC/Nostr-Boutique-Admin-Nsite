const now = () => Math.floor(Date.now() / 1000)

const getTagsByName = (tags = [], key) => tags.filter((tag) => tag[0] === key)

const getFirstTagValue = (tags = [], key, fallback = '') => {
  const tag = tags.find((item) => item[0] === key)
  return tag?.[1] ?? fallback
}

const getAddressTag = (kind, pubkey, identifier) => `${kind}:${pubkey}:${identifier}`

export const parseProductEvent = (event) => {
  const tags = event.tags || []
  const priceTag = tags.find((tag) => tag[0] === 'price') || []

  return {
    id: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    d: getFirstTagValue(tags, 'd'),
    title: getFirstTagValue(tags, 'title', 'Untitled Product'),
    summary: getFirstTagValue(tags, 'summary'),
    visibility: getFirstTagValue(tags, 'visibility', 'on-sale'),
    stock: Number.parseInt(getFirstTagValue(tags, 'stock', '0'), 10) || 0,
    type: {
      product: (tags.find((tag) => tag[0] === 'type') || [])[1] || 'simple',
      format: (tags.find((tag) => tag[0] === 'type') || [])[2] || 'digital'
    },
    price: {
      amount: priceTag[1] || '',
      currency: priceTag[2] || '',
      frequency: priceTag[3] || ''
    },
    images: getTagsByName(tags, 'image').map((tag) => ({
      url: tag[1] || '',
      dimensions: tag[2] || '',
      order: tag[3] || ''
    })),
    categories: getTagsByName(tags, 't').map((tag) => tag[1]).filter(Boolean),
    specs: getTagsByName(tags, 'spec').map((tag) => ({ key: tag[1] || '', value: tag[2] || '' })),
    collections: getTagsByName(tags, 'a').map((tag) => tag[1]).filter((value) => value?.startsWith('30405:')),
    shippingOptions: getTagsByName(tags, 'shipping_option').map((tag) => ({
      ref: tag[1] || '',
      extraCost: tag[2] || ''
    })),
    content: event.content || ''
  }
}

export const parseOrderMessage = (event) => {
  const tags = event.tags || []
  const type = getFirstTagValue(tags, 'type')

  return {
    id: event.id,
    kind: event.kind,
    createdAt: event.created_at,
    pubkey: event.pubkey,
    recipient: getFirstTagValue(tags, 'p'),
    order: getFirstTagValue(tags, 'order'),
    subject: getFirstTagValue(tags, 'subject'),
    type,
    status: getFirstTagValue(tags, 'status'),
    amount: getFirstTagValue(tags, 'amount'),
    tracking: getFirstTagValue(tags, 'tracking'),
    carrier: getFirstTagValue(tags, 'carrier'),
    eta: getFirstTagValue(tags, 'eta'),
    paymentMethods: getTagsByName(tags, 'payment').map((tag) => ({
      medium: tag[1] || '',
      reference: tag[2] || '',
      proof: tag[3] || ''
    })),
    items: getTagsByName(tags, 'item').map((tag) => ({
      ref: tag[1] || '',
      qty: tag[2] || '1'
    })),
    rawContent: event.content || '',
    rawTags: tags
  }
}

export const buildProductTemplate = (pubkey, draft) => {
  const tags = [
    ['d', draft.d],
    ['title', draft.title],
    ['price', draft.priceAmount, draft.priceCurrency, draft.priceFrequency || '']
  ]

  if (draft.type || draft.format) {
    tags.push(['type', draft.type || 'simple', draft.format || 'digital'])
  }

  if (draft.visibility) tags.push(['visibility', draft.visibility])
  if (draft.stock !== '') tags.push(['stock', String(draft.stock)])
  if (draft.summary) tags.push(['summary', draft.summary])

  for (const image of draft.images || []) {
    tags.push(['image', image.url, image.dimensions || '', image.order || ''])
  }

  for (const category of draft.categories || []) {
    if (category.trim()) tags.push(['t', category.trim()])
  }

  for (const spec of draft.specs || []) {
    if (spec.key?.trim() && spec.value?.trim()) {
      tags.push(['spec', spec.key.trim(), spec.value.trim()])
    }
  }

  for (const collectionRef of draft.collections || []) {
    if (collectionRef.trim()) tags.push(['a', collectionRef.trim()])
  }

  for (const shippingOption of draft.shippingOptions || []) {
    if (shippingOption.ref?.trim()) {
      tags.push(['shipping_option', shippingOption.ref.trim(), shippingOption.extraCost?.trim() || ''])
    }
  }

  return {
    kind: 30402,
    created_at: now(),
    pubkey,
    tags,
    content: draft.content || ''
  }
}

export const buildOrderStatusTemplate = ({ merchantPubkey, buyerPubkey, orderId, status, content = '' }) => ({
  kind: 16,
  created_at: now(),
  pubkey: merchantPubkey,
  tags: [
    ['p', buyerPubkey],
    ['subject', 'order-info'],
    ['type', '3'],
    ['order', orderId],
    ['status', status]
  ],
  content
})

export const buildShippingUpdateTemplate = ({ merchantPubkey, buyerPubkey, orderId, status, tracking = '', carrier = '', eta = '', content = '' }) => {
  const tags = [
    ['p', buyerPubkey],
    ['subject', 'shipping-info'],
    ['type', '4'],
    ['order', orderId],
    ['status', status]
  ]

  if (tracking) tags.push(['tracking', tracking])
  if (carrier) tags.push(['carrier', carrier])
  if (eta) tags.push(['eta', eta])

  return {
    kind: 16,
    created_at: now(),
    pubkey: merchantPubkey,
    tags,
    content
  }
}

export const buildPaymentRequestTemplate = ({ merchantPubkey, buyerPubkey, orderId, amount, paymentRows, expiration = '', content = '' }) => {
  const tags = [
    ['p', buyerPubkey],
    ['subject', 'order-payment'],
    ['type', '2'],
    ['order', orderId],
    ['amount', amount]
  ]

  for (const row of paymentRows || []) {
    if (row.medium?.trim() && row.reference?.trim()) {
      tags.push(['payment', row.medium.trim(), row.reference.trim(), row.proof?.trim() || ''])
    }
  }

  if (expiration) tags.push(['expiration', expiration])

  return {
    kind: 16,
    created_at: now(),
    pubkey: merchantPubkey,
    tags,
    content
  }
}

export const getMerchantCollectionAddress = (merchantPubkey, dTag) => getAddressTag(30405, merchantPubkey, dTag)
export const getShippingOptionAddress = (merchantPubkey, dTag) => getAddressTag(30406, merchantPubkey, dTag)
