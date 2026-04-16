<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useRelayStore } from '~/stores/relay'
import { useListingsStore } from '~/stores/listings'
import { useOrdersStore } from '~/stores/orders'
import { usePaymentsStore } from '~/stores/payments'
import { useProfileStore } from '~/stores/profile'
import { useDesignStore } from '~/stores/design'
import { useMintsStore } from '~/stores/mints'
import { useBlossom } from '~/composables/useBlossom'
import { parseCanonicalNamedSiteFromHostname, parseSourceNpubFromHostname, useNsiteClone } from '~/composables/useNsiteClone'
import { npubEncode } from 'nostr-tools/nip19'

const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/OpenMarketsFoundation/Store-Front-Nsite/master/public/version.json'
const UPDATE_SOURCE_IDENTIFIER = 'portal'

useSeoMeta({
  title: 'Nostr Boutique Admin',
  description: 'Admin client for listings, orders, payments, and merchant settings management.'
})

const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'listings', label: 'Listings' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'settings', label: 'Settings' },
  { id: 'mints', label: 'Mints' },
  { id: 'design', label: 'Design' },
  { id: 'relays', label: 'Relays' },
  { id: 'blossom', label: 'Blossom Servers' }
]

const activeTab = ref('home')
const listingsView = ref('existing')

const authStore = useAuthStore()
const relayStore = useRelayStore()
const listingsStore = useListingsStore()
const ordersStore = useOrdersStore()
const paymentsStore = usePaymentsStore()
const profileStore = useProfileStore()
const designStore = useDesignStore()
const mintsStore = useMintsStore()

const { uploadFile } = useBlossom()

const nsecInput = ref('')
const bunkerInput = ref('')
const authMethod = ref('extension')
const themeMode = ref('light')
const newBootstrapRelay = ref('')
const newBlossomServer = ref('')
const newMintUrl = ref('')
const designView = ref('existing')
const loadingAll = ref(false)
const logoUploadStatus = ref('')
const isMobileMenuOpen = ref(false)
const frontendVersionState = reactive({
  loading: false,
  error: '',
  name: '',
  version: '',
  hostname: '',
  npub: '',
  siteIdentifier: ''
})
const githubVersionState = reactive({
  loading: false,
  error: '',
  name: '',
  version: ''
})
const updateState = reactive({
  busy: false,
  error: '',
  success: ''
})

const paymentRequestDrafts = reactive({})
const manualVerification = reactive({})

const statusDrafts = reactive({})
const shippingDrafts = reactive({})

const {
  uniq: uniqRelays,
  fetchSourceManifest,
  publishClonedManifest,
  fixedMuseNpub
} = useNsiteClone()

const dashboardStats = computed(() => {
  return {
    activeListings: listingsStore.activeCount,
    totalOrders: ordersStore.summary.total,
    pendingOrders: ordersStore.summary.pending,
    confirmedOrders: ordersStore.summary.confirmed,
    processingOrders: ordersStore.summary.processing,
    completedOrders: ordersStore.summary.completed,
    cancelledOrders: ordersStore.summary.cancelled,
    paymentRequests: paymentsStore.totals.totalRequests,
    paymentReceipts: paymentsStore.totals.totalReceipts,
    pendingPayments: paymentsStore.totals.pendingRequests
  }
})

const publishReady = computed(() => {
  return authStore.isConnected && listingsStore.draft.d && listingsStore.draft.title && listingsStore.draft.priceAmount && listingsStore.draft.priceCurrency
})

const paymentBoard = computed(() => {
  return ordersStore.formattedOrders.map((order) => {
    const relatedRequests = paymentsStore.paymentRequests.filter((item) => item.order === order.orderId)
    const relatedReceipts = paymentsStore.paymentReceipts.filter((item) => item.order === order.orderId)

    const orderCreated = order.timeline.find((item) => item.type === '1')
    const dueAmount = Number.parseInt(orderCreated?.amount || relatedRequests[0]?.amount || '0', 10) || 0
    const requestedAmount = relatedRequests.reduce((sum, item) => sum + (Number.parseInt(item.amount || '0', 10) || 0), 0)
    const receivedAmount = relatedReceipts.reduce((sum, item) => sum + (Number.parseInt(item.amount || '0', 10) || 0), 0)
    const balance = Math.max(dueAmount - receivedAmount, 0)

    const hasProof = relatedReceipts.some((item) => item.paymentMethods.some((method) => method.proof))
    const hasSignatureShape = relatedReceipts.some((item) => item.id && String(item.id).length === 64)

    let verificationState = 'unverified'
    if (manualVerification[order.orderId]) {
      verificationState = 'externally-verified'
    } else if (hasProof) {
      verificationState = 'parsed'
    } else if (hasSignatureShape) {
      verificationState = 'relay-signed'
    }

    let paymentStatus = 'unpaid'
    if (dueAmount > 0 && receivedAmount >= dueAmount) {
      paymentStatus = 'paid'
    } else if (receivedAmount > 0 && receivedAmount < dueAmount) {
      paymentStatus = 'partially-paid'
    } else if (requestedAmount > 0 && receivedAmount === 0) {
      paymentStatus = 'awaiting-payment'
    }

    return {
      order,
      dueAmount,
      requestedAmount,
      receivedAmount,
      balance,
      paymentStatus,
      verificationState,
      requests: relatedRequests,
      receipts: relatedReceipts
    }
  })
})

const signerSecurityNote = computed(() => {
  if (authStore.connectionMethod === 'nsec') {
    return 'Using pasted nsec signer. Treat this session as sensitive and disconnect after publishing.'
  }

  if (authStore.connectionMethod === 'bunker') {
    return 'Remote signer may require external authorization approvals.'
  }

  return 'Authenticated session active.'
})

const isConnectedStage = computed(() => authStore.isConnected)
const relaySourceLabel = computed(() => relayStore.relaySource === 'nip65_event' ? 'NIP-65 inbox/outbox' : 'Fallback default')
const blossomSourceLabel = computed(() => relayStore.blossomSource === 'kind10063_event' ? 'Kind 10063 server list' : 'Fallback default')
const designPublishReady = computed(() => {
  return Boolean(
    authStore.isConnected
    && designStore.draft.d
    && designStore.draft.title
    && designStore.draft.primary
    && designStore.draft.text
    && designStore.draft.background
  )
})
const npubDisplay = computed(() => {
  if (!authStore.pubkey) return ''

  try {
    const npub = npubEncode(authStore.pubkey)
    return `${npub.slice(0, 16)}...${npub.slice(-10)}`
  } catch {
    return authStore.shortPubkey
  }
})

const cloneSourceNpub = computed(() => {
  if (!authStore.pubkey) return ''

  try {
    return npubEncode(authStore.pubkey)
  } catch {
    return ''
  }
})

const cloneCandidateRelays = computed(() => {
  return Array.from(new Set([
    ...relayStore.effectiveOutboxRelays,
    ...relayStore.effectiveInboxRelays,
    ...relayStore.bootstrapRelays
  ]))
})

const activeTabLabel = computed(() => {
  return tabs.find((tab) => tab.id === activeTab.value)?.label || 'Home'
})

const frontendVersionSummary = computed(() => {
  if (frontendVersionState.loading) return 'Checking deployed front-end version...'
  if (frontendVersionState.error) return frontendVersionState.error
  if (frontendVersionState.name && frontendVersionState.version) {
    return `${frontendVersionState.name} v${frontendVersionState.version}`
  }
  if (frontendVersionState.version) {
    return `Front-end version ${frontendVersionState.version}`
  }
  return 'Version information not available yet.'
})

const frontendVersionMeta = computed(() => {
  if (frontendVersionState.siteIdentifier && frontendVersionState.npub) {
    return `Named site ${frontendVersionState.siteIdentifier} resolved from ${frontendVersionState.npub}`
  }

  if (frontendVersionState.npub) {
    return `Resolved from ${frontendVersionState.npub}`
  }

  if (frontendVersionState.hostname) {
    return `Source host ${frontendVersionState.hostname}`
  }

  return ''
})

const githubVersionSummary = computed(() => {
  if (githubVersionState.loading) return 'Checking GitHub version...'
  if (githubVersionState.error) return githubVersionState.error
  if (githubVersionState.name && githubVersionState.version) {
    return `${githubVersionState.name} v${githubVersionState.version}`
  }
  if (githubVersionState.version) {
    return `GitHub version ${githubVersionState.version}`
  }
  return 'GitHub version not available yet.'
})

const hasUpdateAvailable = computed(() => {
  if (!frontendVersionState.version || !githubVersionState.version) return false
  return compareVersions(githubVersionState.version, frontendVersionState.version) > 0
})

const canUpdateFrontend = computed(() => {
  return authStore.isConnected && Boolean(authStore.signer) && hasUpdateAvailable.value && !updateState.busy
})

const updateButtonLabel = computed(() => {
  if (updateState.busy) return 'Updating front end...'
  if (hasUpdateAvailable.value) return 'Update to latest version'
  return 'Already up to date'
})

const updateStatusMessage = computed(() => {
  if (updateState.error) return updateState.error
  if (updateState.success) return updateState.success
  if (!authStore.isConnected) return 'Connect your signer to publish updated root and portal manifests.'
  if (githubVersionState.error) return ''
  if (frontendVersionState.error) return ''
  if (hasUpdateAvailable.value) {
    return `GitHub has ${githubVersionState.version} while this portal is on ${frontendVersionState.version}.`
  }
  if (frontendVersionState.version && githubVersionState.version) {
    return 'This portal already matches the latest GitHub version.'
  }
  return ''
})

const pickVersionField = (payload, keys) => {
  for (const key of keys) {
    const value = payload?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }

  return ''
}

const compareVersions = (left, right) => {
  const leftParts = String(left || '').split(/[^0-9a-zA-Z]+/).filter(Boolean)
  const rightParts = String(right || '').split(/[^0-9a-zA-Z]+/).filter(Boolean)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || '0'
    const rightPart = rightParts[index] || '0'
    const leftNumber = /^\d+$/.test(leftPart) ? Number.parseInt(leftPart, 10) : Number.NaN
    const rightNumber = /^\d+$/.test(rightPart) ? Number.parseInt(rightPart, 10) : Number.NaN

    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
      if (leftNumber > rightNumber) return 1
      if (leftNumber < rightNumber) return -1
      continue
    }

    if (leftPart > rightPart) return 1
    if (leftPart < rightPart) return -1
  }

  return 0
}

const hydrateVersionState = (target, payload, fallbackName) => {
  target.name = pickVersionField(payload, ['name', 'appName', 'title', 'frontendName']) || fallbackName
  target.version = pickVersionField(payload, ['version', 'appVersion', 'tag', 'buildVersion'])

  if (!target.version) {
    throw new Error('The version source did not include a version field.')
  }
}

const loadFrontendVersion = async () => {
  if (!process.client) return

  frontendVersionState.loading = true
  frontendVersionState.error = ''
  frontendVersionState.hostname = window.location.hostname

  const namedSite = parseCanonicalNamedSiteFromHostname(window.location.hostname)
  frontendVersionState.npub = parseSourceNpubFromHostname(window.location.hostname)
  frontendVersionState.siteIdentifier = namedSite?.identifier || ''

  try {
    const response = await fetch(`${window.location.origin}/version.json`, {
      headers: {
        accept: 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Unable to load /version.json from this nsite.')
    }

    hydrateVersionState(frontendVersionState, await response.json(), 'Front end')
  } catch (error) {
    frontendVersionState.name = ''
    frontendVersionState.version = ''
    frontendVersionState.error = error.message || 'Failed to read deployed front-end version.'
  } finally {
    frontendVersionState.loading = false
  }
}

const loadGithubVersion = async () => {
  if (!process.client) return

  githubVersionState.loading = true
  githubVersionState.error = ''

  try {
    const response = await fetch(GITHUB_VERSION_URL, {
      headers: {
        accept: 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Unable to load the GitHub version source.')
    }

    hydrateVersionState(githubVersionState, await response.json(), 'GitHub front end')
  } catch (error) {
    githubVersionState.name = ''
    githubVersionState.version = ''
    githubVersionState.error = error.message || 'Failed to read the GitHub version source.'
  } finally {
    githubVersionState.loading = false
  }
}

const refreshVersionSources = async () => {
  await Promise.all([
    loadFrontendVersion(),
    loadGithubVersion()
  ])
}

const updateFrontendFromMuse = async () => {
  if (!authStore.signer || !authStore.pubkey) return

  updateState.busy = true
  updateState.error = ''
  updateState.success = ''

  try {
    const candidateRelays = uniqRelays([
      ...cloneCandidateRelays.value,
      'wss://relay.ditto.pub',
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol'
    ])

    const [rootSource, portalSource] = await Promise.all([
      fetchSourceManifest({
        sourceNpub: fixedMuseNpub,
        relays: candidateRelays
      }),
      fetchSourceManifest({
        sourceNpub: fixedMuseNpub,
        relays: candidateRelays,
        identifier: UPDATE_SOURCE_IDENTIFIER
      })
    ])

    const publishRelays = uniqRelays([
      ...candidateRelays,
      ...rootSource.manifestRelays,
      ...portalSource.manifestRelays
    ])

    await publishClonedManifest({
      signer: authStore.signer,
      pubkey: authStore.pubkey,
      sourceManifest: rootSource.manifest,
      sourcePubkey: rootSource.sourcePubkey,
      relays: publishRelays
    })

    await publishClonedManifest({
      signer: authStore.signer,
      pubkey: authStore.pubkey,
      sourceManifest: portalSource.manifest,
      sourcePubkey: portalSource.sourcePubkey,
      relays: publishRelays,
      identifier: UPDATE_SOURCE_IDENTIFIER
    })

    updateState.success = `Published updated root and ${UPDATE_SOURCE_IDENTIFIER} manifests from ${fixedMuseNpub}.`
    await refreshVersionSources()
  } catch (error) {
    updateState.error = error.message || 'Failed to publish the updated front-end manifests.'
  } finally {
    updateState.busy = false
  }
}

const runFetchAll = async () => {
  if (!authStore.pubkey) return

  loadingAll.value = true
  try {
    await Promise.all([
      listingsStore.loadProducts({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays }),
      ordersStore.loadOrders({
        merchantPubkey: authStore.pubkey,
        inboxRelays: relayStore.effectiveInboxRelays,
        outboxRelays: relayStore.effectiveOutboxRelays
      }),
      paymentsStore.loadPayments({
        merchantPubkey: authStore.pubkey,
        inboxRelays: relayStore.effectiveInboxRelays,
        outboxRelays: relayStore.effectiveOutboxRelays
      }),
      profileStore.loadProfile({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays }),
      designStore.loadThemes({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays }),
      mintsStore.loadMints({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays })
    ])
  } finally {
    loadingAll.value = false
  }
}

const refreshRoutingAndData = async () => {
  if (!authStore.pubkey) return
  await relayStore.refreshRouting(authStore.pubkey)
  await runFetchAll()
}

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const autoDValue = ref('')
const autoThemeDValue = ref('')

watch(() => listingsStore.draft.title, (title) => {
  const slug = slugify(title || '')
  if (!slug) return

  const generated = `${slug}-${(authStore.pubkey || 'merchant').slice(0, 6)}`
  if (!listingsStore.draft.d || listingsStore.draft.d === autoDValue.value) {
    listingsStore.draft.d = generated
    autoDValue.value = generated
  }
})

watch(() => designStore.draft.title, (title) => {
  const slug = slugify(title || '')
  if (!slug) return

  const generated = `${slug}-${(authStore.pubkey || 'merchant').slice(0, 6)}`
  if (!designStore.draft.d || designStore.draft.d === autoThemeDValue.value) {
    designStore.draft.d = generated
    autoThemeDValue.value = generated
  }
})

const connectExtension = async () => {
  await authStore.connectExtension()
  if (authStore.isConnected) {
    await refreshRoutingAndData()
  }
}

const connectNsec = async () => {
  if (!nsecInput.value.trim()) return
  await authStore.connectNsec(nsecInput.value)
  if (authStore.isConnected) {
    await refreshRoutingAndData()
  }
}

const connectBunker = async () => {
  if (!bunkerInput.value.trim()) return
  await authStore.connectBunker(bunkerInput.value)
  if (authStore.isConnected) {
    await refreshRoutingAndData()
  }
}

const publishListing = async () => {
  if (!authStore.signer) return
  await listingsStore.publishDraft({
    signer: authStore.signer,
    pubkey: authStore.pubkey,
    relays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge
  })
  listingsStore.resetDraft()
  listingsView.value = 'existing'
}

const openNewListing = () => {
  listingsStore.resetDraft()
  autoDValue.value = ''
  listingsView.value = 'new'
}

const openExistingListings = () => {
  listingsView.value = 'existing'
}

const openTab = (tabId) => {
  activeTab.value = tabId
  isMobileMenuOpen.value = false
  if (tabId === 'listings') {
    openExistingListings()
  }
  if (tabId === 'design') {
    openExistingThemes()
  }
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const editListing = (product) => {
  listingsStore.hydrateDraftFromProduct(product)
  autoDValue.value = ''
  listingsView.value = 'new'
}

const removeDraftImage = (index) => {
  listingsStore.removeDraftImage(index)
}

const readImageDimensions = async (file) => {
  return await new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(`${image.width}x${image.height}`)
    image.onerror = () => resolve('')
    image.src = URL.createObjectURL(file)
  })
}

const onImageSelected = async (event) => {
  if (!event.target.files?.length) return
  const selectedFiles = Array.from(event.target.files)

  listingsStore.uploadLog = []

  for (const file of selectedFiles) {
    const dimensions = await readImageDimensions(file)
    const uploadResults = await Promise.allSettled(
      relayStore.effectiveBlossomServers.map((serverUrl) => {
        return uploadFile({
          serverUrl,
          file,
          signer: authStore.signer,
          requireAuth: relayStore.requireBlossomAuth
        })
      })
    )

    const successful = uploadResults.filter((item) => item.status === 'fulfilled').map((item) => item.value)
    const failed = uploadResults.filter((item) => item.status === 'rejected').map((item) => item.reason?.message || 'Upload failed')

    if (successful.length) {
      const chosen = successful[0]
      listingsStore.addImageToDraft({
        url: chosen.descriptor.url,
        dimensions,
        order: String(listingsStore.draft.images.length + 1)
      })
      listingsStore.uploadLog.push(`Uploaded ${file.name} to ${chosen.serverUrl}`)
    } else {
      listingsStore.uploadLog.push(`Failed ${file.name}: ${failed.join(' | ')}`)
    }
  }

  event.target.value = ''
}

const onLogoSelected = async (event) => {
  if (!event.target.files?.length) return
  if (!authStore.signer) {
    logoUploadStatus.value = 'Connect a signer before uploading a logo.'
    return
  }

  const file = event.target.files[0]
  logoUploadStatus.value = 'Uploading logo...'

  const uploadResults = await Promise.allSettled(
    relayStore.effectiveBlossomServers.map((serverUrl) => {
      return uploadFile({
        serverUrl,
        file,
        signer: authStore.signer,
        requireAuth: relayStore.requireBlossomAuth
      })
    })
  )

  const successful = uploadResults.filter((item) => item.status === 'fulfilled').map((item) => item.value)
  const failed = uploadResults.filter((item) => item.status === 'rejected').map((item) => item.reason?.message || 'Upload failed')

  if (successful.length) {
    profileStore.picture = successful[0].descriptor.url
    logoUploadStatus.value = `Logo uploaded via ${successful[0].serverUrl}`
  } else {
    logoUploadStatus.value = `Logo upload failed: ${failed.join(' | ')}`
  }

  event.target.value = ''
}

const orderStatusState = (orderId) => {
  if (!statusDrafts[orderId]) {
    statusDrafts[orderId] = {
      status: 'processing',
      note: ''
    }
  }

  return statusDrafts[orderId]
}

const shippingState = (orderId) => {
  if (!shippingDrafts[orderId]) {
    shippingDrafts[orderId] = {
      status: 'shipped',
      tracking: '',
      carrier: '',
      eta: '',
      note: ''
    }
  }

  return shippingDrafts[orderId]
}

const sendOrderStatus = async (order) => {
  const state = orderStatusState(order.orderId)
  await ordersStore.sendStatusUpdate({
    signer: authStore.signer,
    outboxRelays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge,
    merchantPubkey: authStore.pubkey,
    buyerPubkey: order.buyer,
    orderId: order.orderId,
    status: state.status,
    content: state.note
  })
  await ordersStore.loadOrders({
    merchantPubkey: authStore.pubkey,
    inboxRelays: relayStore.effectiveInboxRelays,
    outboxRelays: relayStore.effectiveOutboxRelays
  })
}

const sendShipping = async (order) => {
  const state = shippingState(order.orderId)
  await ordersStore.sendShippingUpdate({
    signer: authStore.signer,
    outboxRelays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge,
    merchantPubkey: authStore.pubkey,
    buyerPubkey: order.buyer,
    orderId: order.orderId,
    status: state.status,
    tracking: state.tracking,
    carrier: state.carrier,
    eta: state.eta,
    content: state.note
  })
  await ordersStore.loadOrders({
    merchantPubkey: authStore.pubkey,
    inboxRelays: relayStore.effectiveInboxRelays,
    outboxRelays: relayStore.effectiveOutboxRelays
  })
}

const getPaymentRequestDraft = (orderId, fallbackAmount = 0) => {
  if (!paymentRequestDrafts[orderId]) {
    paymentRequestDrafts[orderId] = {
      amount: fallbackAmount ? String(fallbackAmount) : '',
      medium: 'lightning',
      reference: '',
      proof: '',
      expiration: '',
      note: ''
    }
  }

  return paymentRequestDrafts[orderId]
}

const sendPaymentRequestForOrder = async (row) => {
  const draft = getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount)
  if (!row.order.buyer || !row.order.orderId || !draft.amount) return

  await paymentsStore.sendPaymentRequest({
    signer: authStore.signer,
    signAuthChallenge: authStore.signAuthChallenge,
    outboxRelays: relayStore.effectiveOutboxRelays,
    merchantPubkey: authStore.pubkey,
    buyerPubkey: row.order.buyer,
    orderId: row.order.orderId,
    amount: draft.amount,
    paymentRows: [
      {
        medium: draft.medium,
        reference: draft.reference,
        proof: draft.proof
      }
    ],
    expiration: draft.expiration,
    content: draft.note
  })

  await paymentsStore.loadPayments({
    merchantPubkey: authStore.pubkey,
    inboxRelays: relayStore.effectiveInboxRelays,
    outboxRelays: relayStore.effectiveOutboxRelays
  })
}

const toggleManualVerification = (orderId) => {
  manualVerification[orderId] = !manualVerification[orderId]
}

const saveProfile = async () => {
  await profileStore.publishProfile({
    signer: authStore.signer,
    pubkey: authStore.pubkey,
    relays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge
  })
}

const addBootstrapRelay = () => {
  relayStore.addBootstrapRelay(newBootstrapRelay.value)
  newBootstrapRelay.value = ''
}

const addFallbackBlossomServer = () => {
  relayStore.addFallbackBlossomServer(newBlossomServer.value)
  newBlossomServer.value = ''
}

const addMintUrl = () => {
  mintsStore.addMint(newMintUrl.value)
  newMintUrl.value = ''
}

const publishMintList = async () => {
  if (!authStore.isConnected || !authStore.signer) return

  await mintsStore.publishMints({
    signer: authStore.signer,
    pubkey: authStore.pubkey,
    relays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge
  })
}

const applyTheme = (mode) => {
  themeMode.value = mode === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', themeMode.value)
  localStorage.setItem('nb-admin-theme', themeMode.value)
}

const toggleTheme = () => {
  applyTheme(themeMode.value === 'light' ? 'dark' : 'light')
}

const openNewTheme = () => {
  designStore.resetDraft()
  autoThemeDValue.value = ''
  designView.value = 'new'
}

const openExistingThemes = () => {
  designView.value = 'existing'
}

const editTheme = (theme) => {
  designStore.applyThemeToDraft(theme)
  autoThemeDValue.value = ''
  designView.value = 'new'
}

const publishTheme = async () => {
  if (!authStore.signer) return
  await designStore.publishThemeDefinition({
    signer: authStore.signer,
    pubkey: authStore.pubkey,
    relays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge
  })
  designView.value = 'existing'
}

const setActiveTheme = async (theme) => {
  if (!authStore.signer) return
  await designStore.publishActiveTheme({
    signer: authStore.signer,
    pubkey: authStore.pubkey,
    relays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge,
    theme
  })
}

const publishAndSetActiveTheme = async () => {
  const publishedTheme = await designStore.publishThemeDefinition({
    signer: authStore.signer,
    pubkey: authStore.pubkey,
    relays: relayStore.effectiveOutboxRelays,
    signAuthChallenge: authStore.signAuthChallenge
  })

  await setActiveTheme(publishedTheme)
  designView.value = 'existing'
}

onMounted(async () => {
  const savedTheme = localStorage.getItem('nb-admin-theme') || 'light'
  applyTheme(savedTheme)

  await refreshVersionSources()

  if (authStore.isConnected) {
    await refreshRoutingAndData()
  }
})
</script>

<template>
  <div :class="isConnectedStage ? 'min-h-screen p-0' : 'min-h-screen px-4 py-6 md:px-10 lg:px-12'">
    <div v-if="!isConnectedStage" class="mx-auto max-w-xl rounded-3xl bg-[var(--bg)] p-5 md:p-7">
      <header class="mb-5 text-center">
        <img src="/Logo.png" alt="Nostr Boutique" class="brand-logo--invert mx-auto h-20 w-auto" />
        <h1 class="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] admin-muted md:text-xs">Merchant Portal</h1>
        <p class="mt-2 text-sm admin-muted">Authenticate with your Nostr key to access merchant tools.</p>
      </header>

      <section class="rounded-2xl p-4">
        <div class="mb-4 grid grid-cols-3 gap-2 rounded-xl p-1">
          <button
            class="rounded-lg border px-2 py-2 text-xs font-medium"
            :class="authMethod === 'extension' ? 'auth-method-active' : 'auth-method-inactive'"
            @click="authMethod = 'extension'"
          >
            Extension
          </button>
          <button
            class="rounded-lg border px-2 py-2 text-xs font-medium"
            :class="authMethod === 'nsec' ? 'auth-method-active' : 'auth-method-inactive'"
            @click="authMethod = 'nsec'"
          >
            Key
          </button>
          <button
            class="rounded-lg border px-2 py-2 text-xs font-medium"
            :class="authMethod === 'bunker' ? 'auth-method-active' : 'auth-method-inactive'"
            @click="authMethod = 'bunker'"
          >
            Remote
          </button>
        </div>

        <div v-if="authMethod === 'extension'" class="space-y-3">
          <p class="text-sm admin-meta">Sign in using your browser extension signer (NIP-07).</p>
          <button class="w-full rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]" @click="connectExtension">
            Continue with Extension
          </button>
        </div>

        <div v-if="authMethod === 'bunker'" class="space-y-3">
          <p class="text-sm admin-meta">Use bunker URL, nostrconnect URL, or NIP-05 bunker input.</p>
          <input v-model="bunkerInput" class="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm" placeholder="bunker://... or nostrconnect://..." />
          <button class="w-full rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]" @click="connectBunker">
            Continue with Remote Signer
          </button>
          <a v-if="authStore.authUrl" :href="authStore.authUrl" target="_blank" rel="noreferrer" class="block text-xs text-[var(--brand-strong)]">Open auth challenge</a>
        </div>

        <div v-if="authMethod === 'nsec'" class="space-y-3">
          <p class="text-sm text-[var(--warn)]">Session key login. Use only for temporary trusted sessions.</p>
          <input v-model="nsecInput" class="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm" placeholder="nsec1..." type="password" />
          <button class="w-full rounded-lg bg-[var(--warn)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95" @click="connectNsec">
            Continue with Key
          </button>
        </div>

        <p v-if="authStore.error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--error)]">{{ authStore.error }}</p>
      </section>

      <div class="mt-4 flex items-center justify-center gap-2">
        <button class="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink-1)]" :title="themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'" @click="toggleTheme">
          <svg v-if="themeMode === 'light'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.5 17.5l1.57 1.57M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.5 6.5l1.57-1.57" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <div v-else class="admin-shell relative min-h-screen overflow-hidden lg:flex lg:items-stretch lg:p-0">
      <div
        v-if="isMobileMenuOpen"
        class="fixed inset-0 z-40 bg-black/45 lg:hidden"
        @click="toggleMobileMenu"
      ></div>

      <aside class="admin-sidebar nb-admin-sidebar fixed inset-y-0 left-0 z-50 w-[18rem] max-w-[82vw] -translate-x-full border-r border-[var(--line)] px-4 py-5 shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:w-[19rem] lg:max-w-none lg:translate-x-0 lg:shadow-none" :class="isMobileMenuOpen ? 'translate-x-0' : ''">
        <div class="flex h-full flex-col">
          <div class="admin-sidebar-brand p-4 backdrop-blur">
            <img src="/Logo.png" alt="Nostr Boutique" class="brand-logo--invert h-12 w-auto" />
            <h1 class="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] admin-muted">Merchant Admin</h1>
            <div class="admin-subpanel mt-4 px-3 py-3 text-xs">
              <div class="font-mono admin-meta">{{ npubDisplay }}</div>
              <div class="mt-1 admin-muted">{{ signerSecurityNote }}</div>
            </div>
          </div>

          <nav class="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="admin-nav-item flex w-full items-center justify-between px-4 py-3 text-left text-sm transition"
              :class="activeTab === tab.id ? 'admin-nav-item-active' : ''"
              @click="openTab(tab.id)"
            >
              <span class="font-medium">{{ tab.label }}</span>
            </button>
          </nav>

          <div class="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
            <button class="admin-primary w-full px-4 py-3 text-sm font-semibold" @click="openTab('listings'); openNewListing()">
              Create New Listing
            </button>
            <button class="admin-action w-full px-4 py-3 text-sm" @click="authStore.reset">
              Disconnect
            </button>
          </div>
        </div>
      </aside>

      <div class="min-w-0 flex-1 lg:min-h-screen">
        <header class="admin-topbar sticky top-0 z-30 border-b border-[var(--line)] backdrop-blur">
          <div class="flex flex-wrap items-center gap-3 px-4 py-4 md:px-6 xl:px-8">
            <button class="admin-action inline-flex h-11 w-11 items-center justify-center lg:hidden" @click="toggleMobileMenu">
              <span class="sr-only">Toggle menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>

            <div class="min-w-0 flex-1">
              <div class="text-[11px] font-semibold uppercase tracking-[0.22em] admin-muted">Merchant Portal</div>
              <div class="truncate text-xl font-semibold text-[var(--ink-0)]">{{ activeTabLabel }}</div>
            </div>

            <div class="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
              <button class="admin-action px-3 py-2 text-sm" :title="themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'" @click="toggleTheme">
                <svg v-if="themeMode === 'light'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
                  <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.5 17.5l1.57 1.57M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.5 6.5l1.57-1.57" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
              <button
                class="admin-action px-3 py-2"
                :disabled="loadingAll || relayStore.routingLoading"
                :title="loadingAll ? 'Refreshing data' : 'Refresh data'"
                @click="refreshRoutingAndData"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" :class="loadingAll ? 'animate-spin' : ''" aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M20 4v4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main class="min-w-0 px-4 py-4 md:px-6 xl:px-8">
          <section v-if="activeTab === 'home'" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="admin-panel p-4">
            <div class="text-xs uppercase admin-muted">Listings</div>
            <div class="mt-2 text-3xl font-semibold">{{ dashboardStats.activeListings }}</div>
            <div class="mt-1 text-sm admin-muted">Active products</div>
          </div>
          <div class="admin-panel p-4">
            <div class="text-xs uppercase admin-muted">Orders</div>
            <div class="mt-2 text-3xl font-semibold">{{ dashboardStats.totalOrders }}</div>
            <div class="mt-1 text-sm admin-muted">Pending {{ dashboardStats.pendingOrders }} / Processing {{ dashboardStats.processingOrders }}</div>
          </div>
          <div class="admin-panel p-4">
            <div class="text-xs uppercase admin-muted">Payments</div>
            <div class="mt-2 text-3xl font-semibold">{{ dashboardStats.paymentReceipts }}</div>
            <div class="mt-1 text-sm admin-muted">Receipts out of {{ dashboardStats.paymentRequests }} requests</div>
          </div>
        </div>

        <div class="admin-panel p-4">
          <h3 class="font-semibold">Version Control</h3>
          <div class="mt-2 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm text-[var(--ink-1)]">{{ frontendVersionSummary }}</p>
              <p v-if="frontendVersionMeta" class="mt-1 text-xs admin-muted">{{ frontendVersionMeta }}</p>
              <p class="mt-1 text-xs admin-muted">{{ githubVersionSummary }}</p>
              <p v-if="updateStatusMessage" class="mt-1 text-xs" :class="updateState.error ? 'text-red-500' : updateState.success ? 'text-emerald-500' : 'admin-muted'">{{ updateStatusMessage }}</p>
            </div>
            <button
              class="deploy-primary-btn rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              :disabled="!canUpdateFrontend"
              @click="updateFrontendFromMuse"
            >
              {{ updateButtonLabel }}
            </button>
          </div>
        </div>
      </section>

          <section v-if="activeTab === 'listings'" class="space-y-5">
            <div v-if="listingsView === 'existing'" class="admin-panel p-4 md:p-6">
              <div class="mb-3 flex items-center justify-between gap-2">
                <h4 class="text-lg font-semibold">Existing Listings</h4>
                <div class="flex items-center gap-2">
                  <button :disabled="!authStore.isConnected" class="admin-action px-4 py-2" @click="listingsStore.loadProducts({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays })">
                    Refresh Listings
                  </button>
                </div>
              </div>

              <div v-if="listingsStore.products.length" class="space-y-2 text-sm">
                <div v-for="product in listingsStore.products" :key="product.id" class="admin-subpanel p-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="font-semibold">{{ product.title }}</div>
                      <div class="text-xs admin-muted">{{ product.d }} / {{ product.visibility }} / {{ product.price.amount }} {{ product.price.currency }}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="text-xs admin-muted">images: {{ product.images.length }}</div>
                      <button class="admin-action px-3 py-1 text-xs" @click="editListing(product)">Edit</button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="admin-subpanel border-dashed p-5 text-center">
                <p class="text-sm admin-meta">No listings yet.</p>
                <button class="mt-3 admin-primary px-4 py-2 text-sm" @click="openNewListing">Create a listing</button>
              </div>
            </div>

            <div v-if="listingsView === 'new'" class="admin-panel p-4 md:p-6">
              <div class="mb-3 flex items-center justify-between">
                <h4 class="text-lg font-semibold">{{ listingsStore.editingListingId ? 'Update Listing' : 'Create Listing' }}</h4>
                <button class="admin-action px-3 py-1 text-sm" @click="listingsStore.resetDraft">Clear Draft</button>
              </div>

              <div class="grid gap-3 md:grid-cols-2">
                <input v-model="listingsStore.draft.d" placeholder="Product ID (auto-generated)" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="listingsStore.draft.title" placeholder="Product title" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="listingsStore.draft.summary" placeholder="Summary" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-2" />
                <textarea v-model="listingsStore.draft.content" rows="4" placeholder="Markdown description" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-2"></textarea>
              </div>
              <p class="mt-2 text-xs admin-muted">Use the same Product ID to update an existing listing. It is auto-generated from title and can be edited.</p>

              <div class="mt-4 grid gap-3 md:grid-cols-5">
                <input v-model="listingsStore.draft.priceAmount" placeholder="Amount" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="listingsStore.draft.priceCurrency" placeholder="Currency" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="listingsStore.draft.stock" placeholder="Stock" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <select v-model="listingsStore.draft.visibility" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]">
                  <option value="on-sale">on-sale</option>
                  <option value="pre-order">pre-order</option>
                  <option value="hidden">hidden</option>
                </select>
                <select v-model="listingsStore.draft.format" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]">
                  <option value="physical">physical</option>
                  <option value="digital">digital</option>
                </select>
              </div>

              <div class="mt-4 grid gap-3 md:grid-cols-2">
                <textarea v-model="listingsStore.draft.categoriesText" rows="3" placeholder="Categories separated by comma" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]"></textarea>
                <textarea v-model="listingsStore.draft.specsText" rows="3" placeholder="Specs key:value per line" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]"></textarea>
                <textarea v-model="listingsStore.draft.collectionsText" rows="3" placeholder="Collection refs (30405:pubkey:d-tag)" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]"></textarea>
                <textarea v-model="listingsStore.draft.shippingText" rows="3" placeholder="Shipping refs per line, optionally ref|extra-cost" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]"></textarea>
              </div>

              <div class="mt-4 admin-subpanel border-dashed p-4">
                <div class="mb-2 font-medium">Listing Images (Blossom public servers)</div>
                <input type="file" multiple accept="image/*" @change="onImageSelected" />
                <ul class="mt-3 space-y-2">
                  <li v-for="(image, index) in listingsStore.draft.images" :key="image.url + index" class="admin-subpanel flex items-center justify-between px-3 py-2 text-xs">
                    <span class="break-all">{{ image.url }}</span>
                    <button class="ml-3 rounded bg-red-50 px-2 py-1 text-[var(--error)]" @click="removeDraftImage(index)">remove</button>
                  </li>
                </ul>
                <ul class="mt-2 space-y-1 text-xs admin-muted">
                  <li v-for="item in listingsStore.uploadLog" :key="item">{{ item }}</li>
                </ul>
              </div>

              <div class="mt-4 flex flex-wrap gap-3">
                <button :disabled="!publishReady || listingsStore.publishing" class="admin-primary px-4 py-2 font-semibold disabled:opacity-40" @click="publishListing">
                  {{ listingsStore.publishing ? 'Publishing...' : (listingsStore.editingListingId ? 'Update Listing' : 'Publish Listing') }}
                </button>
                <button class="admin-action px-4 py-2" @click="openExistingListings">Back to Existing Listings</button>
              </div>
              <p v-if="listingsStore.error" class="mt-3 text-sm text-[var(--error)]">{{ listingsStore.error }}</p>
            </div>
          </section>

          <section v-if="activeTab === 'orders'" class="space-y-4">
        <div class="admin-panel p-4 md:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">Orders Timeline</h3>
            <button
              :disabled="!authStore.isConnected || ordersStore.loading"
              class="admin-action px-4 py-2"
              @click="ordersStore.loadOrders({ merchantPubkey: authStore.pubkey, inboxRelays: relayStore.effectiveInboxRelays, outboxRelays: relayStore.effectiveOutboxRelays })"
            >
              {{ ordersStore.loading ? 'Loading...' : 'Refresh Orders' }}
            </button>
          </div>
          <p class="mt-2 text-sm admin-muted">Order messages are grouped by the `order` tag and include type 1/2/3/4 events.</p>
          <p v-if="ordersStore.error" class="mt-2 text-sm text-[var(--error)]">{{ ordersStore.error }}</p>
        </div>

        <div class="space-y-4">
          <div v-for="order in ordersStore.formattedOrders" :key="order.orderId" class="admin-panel p-4 md:p-6">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div class="text-sm uppercase tracking-wide admin-muted">Order</div>
                <div class="font-mono text-sm">{{ order.orderId }}</div>
                <div class="text-xs admin-muted">buyer {{ order.buyer }}</div>
              </div>
              <div class="rounded-md bg-[var(--panel-strong)] px-3 py-1 text-sm text-[var(--ink-1)]">{{ order.currentStatus }}</div>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div class="admin-subpanel p-3">
                <h4 class="font-medium">Send Status Update</h4>
                <select v-model="orderStatusState(order.orderId).status" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]">
                  <option value="pending">pending</option>
                  <option value="confirmed">confirmed</option>
                  <option value="processing">processing</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
                <input v-model="orderStatusState(order.orderId).note" placeholder="Optional note" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <button class="admin-primary mt-2 px-3 py-2" @click="sendOrderStatus(order)">Send Status</button>
              </div>

              <div class="admin-subpanel p-3">
                <h4 class="font-medium">Send Shipping Update</h4>
                <select v-model="shippingState(order.orderId).status" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]">
                  <option value="processing">processing</option>
                  <option value="shipped">shipped</option>
                  <option value="delivered">delivered</option>
                  <option value="exception">exception</option>
                </select>
                <input v-model="shippingState(order.orderId).tracking" placeholder="Tracking" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="shippingState(order.orderId).carrier" placeholder="Carrier" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="shippingState(order.orderId).eta" placeholder="ETA unix timestamp" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="shippingState(order.orderId).note" placeholder="Optional note" class="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <button class="mt-2 rounded-md bg-[var(--ink-1)] px-3 py-2 text-white" @click="sendShipping(order)">Send Shipping</button>
              </div>
            </div>

            <div class="mt-4 space-y-2 text-xs">
              <div v-for="entry in order.timeline" :key="entry.id" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]">
                <div class="font-semibold">{{ entry.typeLabel }} / {{ entry.createdAt }}</div>
                <div class="admin-muted">{{ entry.rawContent || 'No human-readable content' }}</div>
              </div>
            </div>
          </div>
          <div v-if="!ordersStore.formattedOrders.length" class="admin-panel p-4 admin-muted">No orders loaded yet.</div>
        </div>
          </section>

          <section v-if="activeTab === 'payments'" class="space-y-4">
            <div class="admin-panel p-4 md:p-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-lg font-semibold">Payments Reconciliation</h3>
                <button
                  :disabled="!authStore.isConnected || paymentsStore.loading"
                  class="admin-action px-4 py-2"
                  @click="paymentsStore.loadPayments({ merchantPubkey: authStore.pubkey, inboxRelays: relayStore.effectiveInboxRelays, outboxRelays: relayStore.effectiveOutboxRelays })"
                >
                  {{ paymentsStore.loading ? 'Loading...' : 'Refresh Payments' }}
                </button>
              </div>
              <p class="mt-2 text-sm admin-muted">Use this board to confirm whether each order has been paid, then request payment only when needed.</p>
              <p v-if="paymentsStore.error" class="mt-2 text-sm text-[var(--error)]">{{ paymentsStore.error }}</p>
            </div>

            <div class="space-y-4">
              <div v-for="row in paymentBoard" :key="row.order.orderId" class="admin-panel p-4 md:p-6">
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div class="text-sm uppercase tracking-wide admin-muted">Order</div>
                    <div class="font-mono text-sm">{{ row.order.orderId }}</div>
                    <div class="text-xs admin-muted">buyer {{ row.order.buyer }}</div>
                  </div>
                  <div class="flex flex-wrap gap-2 text-xs">
                    <span class="rounded-md bg-[var(--panel-strong)] px-3 py-1 text-[var(--ink-1)]">{{ row.paymentStatus }}</span>
                    <span class="rounded-md bg-[var(--panel-strong)] px-3 py-1 text-[var(--ink-1)]">{{ row.verificationState }}</span>
                  </div>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div class="admin-subpanel p-3 text-sm">
                    <div class="text-xs admin-muted">Due</div>
                    <div class="font-semibold">{{ row.dueAmount || 'unknown' }}</div>
                  </div>
                  <div class="admin-subpanel p-3 text-sm">
                    <div class="text-xs admin-muted">Requested</div>
                    <div class="font-semibold">{{ row.requestedAmount }}</div>
                  </div>
                  <div class="admin-subpanel p-3 text-sm">
                    <div class="text-xs admin-muted">Received</div>
                    <div class="font-semibold">{{ row.receivedAmount }}</div>
                  </div>
                  <div class="admin-subpanel p-3 text-sm">
                    <div class="text-xs admin-muted">Balance</div>
                    <div class="font-semibold">{{ row.balance }}</div>
                  </div>
                  <div class="admin-subpanel p-3 text-sm">
                    <div class="text-xs admin-muted">Receipts</div>
                    <div class="font-semibold">{{ row.receipts.length }}</div>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="admin-action px-3 py-2 text-xs" @click="toggleManualVerification(row.order.orderId)">
                    {{ manualVerification[row.order.orderId] ? 'Undo external verification' : 'Mark externally verified' }}
                  </button>
                </div>

                <div class="mt-4 admin-subpanel p-3">
                  <h4 class="font-medium">Request Payment (if unpaid)</h4>
                  <div class="mt-2 grid gap-2 md:grid-cols-4">
                    <input v-model="getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount).amount" placeholder="Amount" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)]" />
                    <select v-model="getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount).medium" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)]">
                      <option value="lightning">lightning</option>
                      <option value="bitcoin">bitcoin</option>
                      <option value="ecash">ecash</option>
                      <option value="fiat">fiat</option>
                    </select>
                    <input v-model="getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount).reference" placeholder="Invoice/address/request" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)] md:col-span-2" />
                    <input v-model="getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount).proof" placeholder="Optional proof" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)] md:col-span-2" />
                    <input v-model="getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount).expiration" placeholder="Expiration unix timestamp" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)] md:col-span-2" />
                    <textarea v-model="getPaymentRequestDraft(row.order.orderId, row.balance || row.dueAmount).note" rows="2" placeholder="Payment note" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)] md:col-span-4"></textarea>
                  </div>
                  <button :disabled="paymentsStore.sending || !authStore.isConnected" class="mt-3 admin-primary px-4 py-2 text-sm disabled:opacity-40" @click="sendPaymentRequestForOrder(row)">
                    {{ paymentsStore.sending ? 'Sending...' : 'Send Payment Request' }}
                  </button>
                </div>
              </div>
              <div v-if="!paymentBoard.length" class="admin-panel p-4 admin-muted">No order-linked payments available.</div>
            </div>
          </section>

          <section v-if="activeTab === 'settings'" class="space-y-4">
        <div class="admin-panel p-4 md:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">Merchant Settings (kind:0)</h3>
            <button :disabled="!authStore.isConnected || profileStore.loading" class="admin-action px-4 py-2" @click="profileStore.loadProfile({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays })">
              {{ profileStore.loading ? 'Loading...' : 'Refresh Settings' }}
            </button>
          </div>

            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <input v-model="profileStore.name" placeholder="Shop name" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
              <input v-model="profileStore.lud16" placeholder="Lightning address (lud16)" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
            <input v-model="profileStore.picture" placeholder="Logo URL" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-2" />
            <div class="admin-subpanel border-dashed p-3 md:col-span-2">
              <p class="text-sm font-medium">Upload logo via Blossom</p>
              <input type="file" accept="image/*" class="mt-2" @change="onLogoSelected" />
              <p v-if="logoUploadStatus" class="mt-2 text-xs admin-muted">{{ logoUploadStatus }}</p>
            </div>
              <input v-model="profileStore.website" placeholder="Website URL" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-2" />
              <textarea v-model="profileStore.about" rows="4" placeholder="About" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-2"></textarea>
            </div>

            <div class="mt-4 admin-subpanel p-4">
              <h4 class="font-medium">Upload Authorization</h4>
              <label class="mt-3 flex items-center gap-2 text-sm">
                <input v-model="relayStore.requireBlossomAuth" type="checkbox" />
                Sign uploads with your Nostr key (required by some Blossom servers)
              </label>
              <p class="mt-2 text-xs admin-muted">
                Turn this on if a server rejects uploads without authentication.
              </p>
            </div>

            <button :disabled="profileStore.saving || !authStore.isConnected" class="admin-primary mt-4 px-4 py-2 disabled:opacity-40" @click="saveProfile">
              {{ profileStore.saving ? 'Publishing...' : 'Publish Settings' }}
            </button>

          <p v-if="profileStore.error" class="mt-2 text-sm text-[var(--error)]">{{ profileStore.error }}</p>
        </div>
          </section>

          <section v-if="activeTab === 'mints'" class="space-y-4">
            <div class="admin-panel p-4 md:p-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-lg font-semibold">Cashu Mints</h3>
                  <p class="mt-2 text-sm admin-muted">Manage your Nostr mint list event and publish the mint URLs you want wallets to discover.</p>
                </div>
                <button :disabled="!authStore.isConnected || mintsStore.loading" class="admin-action px-4 py-2 text-sm" @click="mintsStore.loadMints({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays })">
                  {{ mintsStore.loading ? 'Loading...' : 'Refresh Mints' }}
                </button>
              </div>

              <div class="mt-4 admin-subpanel p-4">
                <div class="flex flex-wrap gap-2">
                  <input v-model="newMintUrl" placeholder="https://mint.example.com" class="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink-1)]" />
                  <button class="admin-primary px-4 py-2 text-sm font-semibold" @click="addMintUrl">Add Mint</button>
                </div>
                <p class="mt-2 text-xs admin-muted">Use full mint base URLs. Duplicate entries are ignored.</p>
              </div>

              <div class="mt-4 space-y-2">
                <div v-if="mintsStore.mintUrls.length" class="space-y-2">
                  <div v-for="mint in mintsStore.mintUrls" :key="mint" class="admin-subpanel flex items-center justify-between gap-3 p-3">
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-mono text-sm text-[var(--ink-1)]">{{ mint }}</div>
                    </div>
                    <button class="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-[var(--error)]" @click="mintsStore.removeMint(mint)">
                      Remove
                    </button>
                  </div>
                </div>
                <div v-else class="admin-subpanel border-dashed p-4 text-sm admin-muted">
                  No mints in your list yet.
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-3">
                <button :disabled="!authStore.isConnected || mintsStore.saving" class="admin-primary px-4 py-2 text-sm font-semibold disabled:opacity-40" @click="publishMintList">
                  {{ mintsStore.saving ? 'Publishing...' : 'Publish Mint List' }}
                </button>
                <p v-if="mintsStore.eventId" class="text-xs admin-muted">Latest event: {{ mintsStore.eventId.slice(0, 16) }}...</p>
              </div>

              <p v-if="mintsStore.error" class="mt-3 text-sm text-[var(--error)]">{{ mintsStore.error }}</p>
            </div>
          </section>

          <section v-if="activeTab === 'design'" class="space-y-4">
            <div class="admin-panel p-4 md:p-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-lg font-semibold">Theme Design (Ditto kinds 36767 / 16767)</h3>
                <div class="flex gap-2">
                  <button class="admin-action px-4 py-2 text-sm" :disabled="designStore.loading" @click="designStore.loadThemes({ pubkey: authStore.pubkey, relays: relayStore.effectiveOutboxRelays })">
                    {{ designStore.loading ? 'Loading...' : 'Refresh Themes' }}
                  </button>
                  <button class="admin-primary px-4 py-2 text-sm" @click="openNewTheme">New Theme</button>
                </div>
              </div>
              <p class="mt-2 text-sm admin-muted">Create a theme for your storefront and publish it to Nostr. Then set one theme as active.</p>
            </div>

            <div v-if="designStore.activeTheme" class="admin-panel p-4 md:p-6">
              <h4 class="font-semibold">Active Theme</h4>
              <div class="admin-subpanel mt-3 flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div class="font-medium">{{ designStore.activeTheme.title }}</div>
                  <div class="text-xs admin-muted">{{ designStore.activeTheme.d || 'no d-tag (kind 16767)' }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="h-6 w-6 rounded-full border" :style="{ backgroundColor: designStore.activeTheme.primary }"></span>
                  <span class="h-6 w-6 rounded-full border" :style="{ backgroundColor: designStore.activeTheme.text }"></span>
                  <span class="h-6 w-6 rounded-full border" :style="{ backgroundColor: designStore.activeTheme.background }"></span>
                </div>
              </div>
            </div>

            <div v-if="designView === 'existing'" class="admin-panel p-4 md:p-6">
              <h4 class="font-semibold">Published Themes</h4>
              <div v-if="designStore.hasThemes" class="mt-3 space-y-2">
                <div v-for="theme in designStore.themes" :key="theme.id" class="admin-subpanel p-3">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div class="font-medium">{{ theme.title }}</div>
                      <div class="text-xs admin-muted">{{ theme.d }} / {{ theme.createdAt }}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="h-5 w-5 rounded-full border" :style="{ backgroundColor: theme.primary }"></span>
                      <span class="h-5 w-5 rounded-full border" :style="{ backgroundColor: theme.text }"></span>
                      <span class="h-5 w-5 rounded-full border" :style="{ backgroundColor: theme.background }"></span>
                    </div>
                    <div class="flex items-center gap-2">
                      <button class="admin-action px-3 py-1 text-xs" @click="editTheme(theme)">Edit</button>
                      <button class="rounded-md bg-[var(--ink-1)] px-3 py-1 text-xs text-white" @click="setActiveTheme(theme)">Set Active</button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="mt-3 admin-subpanel border-dashed p-4 text-sm admin-muted">
                No themes published yet.
                <button class="admin-primary ml-2 px-3 py-1 text-xs" @click="openNewTheme">Create first theme</button>
              </div>
            </div>

            <div v-if="designView === 'new'" class="admin-panel p-4 md:p-6">
              <div class="mb-3 flex items-center justify-between">
                <h4 class="font-semibold">Theme Editor</h4>
                <button class="admin-action px-3 py-1 text-sm" @click="openExistingThemes">Back to Themes</button>
              </div>

              <div class="grid gap-3 md:grid-cols-2">
                <input v-model="designStore.draft.title" placeholder="Theme title" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                <input v-model="designStore.draft.d" placeholder="Theme ID (auto-generated)" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
              </div>

              <div class="mt-4 grid gap-3 md:grid-cols-3">
                <label class="admin-subpanel p-3 text-sm">
                  <div class="mb-2 font-medium">Primary color</div>
                  <div class="flex items-center gap-2">
                    <input v-model="designStore.draft.primary" type="color" class="h-10 w-12 rounded border border-[var(--line)]" />
                    <input v-model="designStore.draft.primary" class="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs" />
                  </div>
                </label>
                <label class="admin-subpanel p-3 text-sm">
                  <div class="mb-2 font-medium">Text color</div>
                  <div class="flex items-center gap-2">
                    <input v-model="designStore.draft.text" type="color" class="h-10 w-12 rounded border border-[var(--line)]" />
                    <input v-model="designStore.draft.text" class="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs" />
                  </div>
                </label>
                <label class="admin-subpanel p-3 text-sm">
                  <div class="mb-2 font-medium">Background color</div>
                  <div class="flex items-center gap-2">
                    <input v-model="designStore.draft.background" type="color" class="h-10 w-12 rounded border border-[var(--line)]" />
                    <input v-model="designStore.draft.background" class="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs" />
                  </div>
                </label>
              </div>

              <div class="mt-4 admin-subpanel p-4">
                <h5 class="font-medium">Optional fonts</h5>
                <div class="mt-2 grid gap-3 md:grid-cols-2">
                  <input v-model="designStore.draft.bodyFontFamily" placeholder="Body font family" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                  <input v-model="designStore.draft.bodyFontUrl" placeholder="Body font URL" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                  <input v-model="designStore.draft.titleFontFamily" placeholder="Title font family" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                  <input v-model="designStore.draft.titleFontUrl" placeholder="Title font URL" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]" />
                </div>
              </div>

              <div class="mt-4 admin-subpanel p-4">
                <h5 class="font-medium">Optional background media</h5>
                <div class="mt-2 grid gap-3 md:grid-cols-3">
                  <input v-model="designStore.draft.bgUrl" placeholder="Background URL" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-2" />
                  <select v-model="designStore.draft.bgMode" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)]">
                    <option value="cover">cover</option>
                    <option value="tile">tile</option>
                  </select>
                  <input v-model="designStore.draft.bgMime" placeholder="MIME type (image/jpeg)" class="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink-1)] md:col-span-3" />
                </div>
              </div>

              <div class="mt-4 admin-subpanel p-4" :style="{ backgroundColor: designStore.draft.background, color: designStore.draft.text }">
                <div class="text-sm">Theme preview</div>
                <div class="mt-2 text-xl font-semibold" :style="{ color: designStore.draft.primary }">{{ designStore.draft.title || 'Theme Title' }}</div>
                <div class="mt-2 text-sm">This preview uses your selected primary, text, and background colors.</div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <button :disabled="!designPublishReady || designStore.saving" class="admin-primary px-4 py-2 text-sm font-semibold disabled:opacity-40" @click="publishTheme">
                  {{ designStore.saving ? 'Publishing...' : 'Publish Theme (36767)' }}
                </button>
                <button :disabled="!designPublishReady || designStore.saving" class="admin-action px-4 py-2 text-sm" @click="publishAndSetActiveTheme">
                  Publish and Set Active (16767)
                </button>
              </div>
              <p v-if="designStore.error" class="mt-2 text-sm text-[var(--error)]">{{ designStore.error }}</p>
            </div>
          </section>

          <section v-if="activeTab === 'relays'" class="space-y-4">
            <div class="admin-panel p-4 md:p-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-lg font-semibold">Relay Routing</h3>
                <button class="admin-action px-4 py-2 text-sm" :disabled="relayStore.routingLoading" @click="refreshRoutingAndData">
                  {{ relayStore.routingLoading ? 'Refreshing...' : 'Refresh Routing' }}
                </button>
              </div>
              <p class="mt-2 text-sm admin-muted">Source: {{ relaySourceLabel }}. Initial lookup uses bootstrap relays only.</p>
              <p v-if="relayStore.routingError" class="mt-2 text-sm text-[var(--error)]">{{ relayStore.routingError }}</p>

              <div class="mt-4 grid gap-4 md:grid-cols-3">
                <div class="admin-subpanel p-3">
                  <h4 class="font-medium">Bootstrap Relays</h4>
                  <p class="mt-1 text-xs admin-muted">Used for initial key lookup and relay list discovery</p>
                  <div class="mt-2 flex gap-2">
                    <input v-model="newBootstrapRelay" placeholder="wss://relay.example" class="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--ink-1)]" />
                    <button class="admin-primary px-2 py-1 text-xs font-semibold" @click="addBootstrapRelay">+</button>
                  </div>
                  <ul class="mt-2 space-y-1 text-xs font-mono">
                    <li v-for="relay in relayStore.bootstrapRelays" :key="relay" class="flex items-center justify-between gap-2">
                      <span class="truncate">{{ relay }}</span>
                      <button class="rounded bg-red-50 px-2 py-0.5 text-[10px] text-[var(--error)]" @click="relayStore.removeBootstrapRelay(relay)">x</button>
                    </li>
                  </ul>
                </div>
                <div class="admin-subpanel p-3">
                  <h4 class="font-medium">Inbox Relays (Read)</h4>
                  <ul class="mt-2 space-y-1 text-xs font-mono">
                    <li v-for="relay in relayStore.effectiveInboxRelays" :key="relay">{{ relay }}</li>
                  </ul>
                </div>
                <div class="admin-subpanel p-3">
                  <h4 class="font-medium">Outbox Relays (Write)</h4>
                  <ul class="mt-2 space-y-1 text-xs font-mono">
                    <li v-for="relay in relayStore.effectiveOutboxRelays" :key="relay">{{ relay }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section v-if="activeTab === 'blossom'" class="space-y-4">
            <div class="admin-panel p-4 md:p-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-lg font-semibold">Blossom Server List</h3>
                <button class="admin-action px-4 py-2 text-sm" :disabled="relayStore.routingLoading" @click="refreshRoutingAndData">
                  {{ relayStore.routingLoading ? 'Refreshing...' : 'Refresh Server List' }}
                </button>
              </div>
              <p class="mt-2 text-sm admin-muted">Source: {{ blossomSourceLabel }}.</p>
              <div class="mt-4 admin-subpanel p-3">
                <h4 class="font-medium">Fallback Blossom Servers</h4>
                <p class="mt-1 text-xs admin-muted">Used only if no kind 10063 server list is found</p>
                <div class="mt-2 flex gap-2">
                  <input v-model="newBlossomServer" placeholder="https://cdn.example.com" class="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--ink-1)]" />
                  <button class="admin-primary px-2 py-1 text-xs font-semibold" @click="addFallbackBlossomServer">+</button>
                </div>
                <ul class="mt-2 space-y-1 text-xs font-mono">
                  <li v-for="server in relayStore.fallbackBlossomServers" :key="`fallback-${server}`" class="flex items-center justify-between gap-2">
                    <span class="truncate">{{ server }}</span>
                    <button class="rounded bg-red-50 px-2 py-0.5 text-[10px] text-[var(--error)]" @click="relayStore.removeFallbackBlossomServer(server)">x</button>
                  </li>
                </ul>
              </div>

              <div class="mt-4 admin-subpanel p-3">
                <h4 class="font-medium">Effective Blossom Servers</h4>
                <ul class="mt-2 space-y-1 text-xs font-mono">
                  <li v-for="server in relayStore.effectiveBlossomServers" :key="server">{{ server }}</li>
                </ul>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>

    <NsiteCloneFab :fallback-npub="cloneSourceNpub" :candidate-relays="cloneCandidateRelays" />
  </div>
</template>
