<script setup>
import { useNsiteClone } from '~/composables/useNsiteClone'
import { createBunkerSignerAdapter, createExtensionSigner, createNsecSigner } from '~/composables/useSignerAdapters'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  fallbackNpub: {
    type: String,
    default: ''
  },
  candidateRelays: {
    type: Array,
    default: () => []
  }
})

const isOpen = ref(false)
const cloneMode = ref('choice')
const newcomerName = ref('')
const newcomerIdentity = ref(null)
const newcomerConfirmed = ref(false)
const newcomerBusy = ref(false)
const newcomerError = ref('')
const newcomerSuccessUrl = ref('')
const newcomerPublishRelays = ref([])
const existingCloneMethod = ref('extension')
const existingNsecInput = ref('')
const existingBunkerInput = ref('')
const existingCloneBusy = ref(false)
const existingCloneError = ref('')
const existingCloneUrl = ref('')
const existingSignerAuthUrl = ref('')

const {
  uniq,
  generateIdentity,
  resolveSourceNpub,
  fetchSourceManifest,
  publishProfile,
  publishClonedManifest,
  fixedMuseNpub
} = useNsiteClone()

const NOSTR_OSTRICH_ANIM_URL = '/nostr-ostrich-running.gif'

const resetFlowState = () => {
  cloneMode.value = 'choice'
  newcomerName.value = ''
  newcomerIdentity.value = null
  newcomerConfirmed.value = false
  newcomerBusy.value = false
  newcomerError.value = ''
  newcomerSuccessUrl.value = ''
  newcomerPublishRelays.value = []
  existingCloneMethod.value = 'extension'
  existingNsecInput.value = ''
  existingBunkerInput.value = ''
  existingCloneBusy.value = false
  existingCloneError.value = ''
  existingCloneUrl.value = ''
  existingSignerAuthUrl.value = ''
}

const closeModal = () => {
  isOpen.value = false
  resetFlowState()
}

const getCandidateRelays = () => {
  return uniq([
    ...(props.candidateRelays || []),
    'wss://relay.ditto.pub',
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nos.lol'
  ])
}

const copyText = async (value) => {
  if (!process.client || !value) return
  await navigator.clipboard.writeText(value)
}

const startExistingFlow = async () => {
  cloneMode.value = 'existing'
  existingCloneError.value = ''
}

const startNewFlow = () => {
  cloneMode.value = 'new'
  newcomerError.value = ''
}

const generateNewcomerKeys = () => {
  newcomerIdentity.value = generateIdentity()
  newcomerConfirmed.value = false
  newcomerError.value = ''
}

const publishAndCloneForNewcomer = async () => {
  newcomerError.value = ''

  if (!newcomerName.value.trim()) {
    newcomerError.value = 'Please enter a display name.'
    return
  }

  if (!newcomerIdentity.value) {
    newcomerError.value = 'Please generate your keys first.'
    return
  }

  if (!newcomerConfirmed.value) {
    newcomerError.value = 'Please confirm that you safely backed up your keys.'
    return
  }

  try {
    newcomerBusy.value = true

    const candidateRelays = getCandidateRelays()
    const sourceNpub = resolveSourceNpub({
      hostname: process.client ? window.location.hostname : '',
      fallbackNpub: props.fallbackNpub
    })

    if (!sourceNpub) {
      throw new Error('Could not resolve source nsite npub for cloning.')
    }

    const source = await fetchSourceManifest({
      sourceNpub,
      relays: candidateRelays
    })

    const publishRelays = source.manifestRelays.length > 0
      ? source.manifestRelays
      : candidateRelays

    newcomerPublishRelays.value = publishRelays

    await publishProfile({
      identity: newcomerIdentity.value,
      name: newcomerName.value.trim(),
      relays: publishRelays
    })

    await publishClonedManifest({
      identity: newcomerIdentity.value,
      sourceManifest: source.manifest,
      sourcePubkey: source.sourcePubkey,
      relays: publishRelays
    })

    const siteUrl = `https://${newcomerIdentity.value.npub}.nsite.lol/`
    newcomerSuccessUrl.value = siteUrl

    if (process.client) {
      const opened = window.open(siteUrl, '_blank', 'noopener,noreferrer')
      if (!opened) {
        newcomerError.value = 'Clone published, but your browser blocked opening the new site tab. Use the link below.'
      }
    }

    cloneMode.value = 'new-success'
  } catch (error) {
    newcomerError.value = error.message || 'Failed to publish profile and clone this nsite.'
    console.error('[nsite-clone] newcomer clone failed', error)
  } finally {
    newcomerBusy.value = false
  }
}

const publishCloneWithSigner = async (signer, pubkey) => {
  const candidateRelays = getCandidateRelays()
  const sourceNpub = resolveSourceNpub({
    hostname: process.client ? window.location.hostname : '',
    fallbackNpub: props.fallbackNpub
  })

  if (!sourceNpub) {
    throw new Error('Could not resolve source nsite npub for cloning.')
  }

  const source = await fetchSourceManifest({
    sourceNpub,
    relays: candidateRelays
  })

  const publishRelays = source.manifestRelays.length > 0
    ? source.manifestRelays
    : candidateRelays

  await publishClonedManifest({
    signer,
    pubkey,
    sourceManifest: source.manifest,
    sourcePubkey: source.sourcePubkey,
    relays: publishRelays
  })

  existingCloneUrl.value = `https://${nip19.npubEncode(pubkey)}.nsite.lol/`
}

const publishExistingClone = async () => {
  existingCloneError.value = ''
  existingSignerAuthUrl.value = ''

  let signer = null
  let pubkey = ''

  try {
    existingCloneBusy.value = true

    if (existingCloneMethod.value === 'extension') {
      signer = createExtensionSigner(window.nostr)
      pubkey = await signer.getPublicKey()
    } else if (existingCloneMethod.value === 'nsec') {
      signer = createNsecSigner(existingNsecInput.value)
      pubkey = await signer.getPublicKey()
    } else {
      signer = await createBunkerSignerAdapter(existingBunkerInput.value, (url) => {
        existingSignerAuthUrl.value = url
      })
      pubkey = await signer.getPublicKey()
    }

    await publishCloneWithSigner(signer, pubkey)
    cloneMode.value = 'existing-success'
  } catch (error) {
    existingCloneError.value = error.message || 'Failed to clone this nsite with your signer.'
    console.error('[nsite-clone] existing clone failed', error)
  } finally {
    if (signer?.close) {
      await signer.close()
    }
    existingCloneBusy.value = false
  }
}

</script>

<template>
  <button
    class="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-violet-300 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-700 shadow-[0_12px_30px_rgba(168,85,247,0.45)] transition hover:scale-[1.02] hover:shadow-[0_16px_34px_rgba(168,85,247,0.6)]"
    @click="isOpen = true"
  >
    <span class="sr-only">Open Nostr clone dialog</span>
    <img :src="NOSTR_OSTRICH_ANIM_URL" alt="" class="h-10 w-10 object-contain" aria-hidden="true">
  </button>

  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" @click.self="closeModal">
    <div class="w-full max-w-xl rounded-2xl border border-violet-300/50 bg-[var(--surface)] p-6 shadow-2xl">
      <h2 class="text-2xl font-bold">Congratulations you found something cool!</h2>
      <p class="mt-3 text-sm text-[var(--muted)]">
        Did you know you can have your own sovereign shop like this?
      </p>

      <ul class="mt-3 space-y-1 text-sm text-[var(--muted)]">
        <li>- No credit card or monthly fees!</li>
        <li>- No email address or account!</li>
        <li>- As close to one-click deploy as possible (no joke).</li>
        <li>- No technical skills required, but they are always handy.</li>
      </ul>

      <p class="mt-3 text-sm text-[var(--muted)]">
        If you knew this, congratulations, you're quite the nerd. If you did not, there is a short write-up on how this works at
        <a href="https://nostr.boutique/explain" target="_blank" rel="noopener noreferrer" class="underline">https://nostr.boutique/explain</a>.
      </p>
      <p class="mt-2 text-sm text-[var(--muted)]">
        If you already have a key, you can clone by clicking I'm already on Nostr. If you are new, follow the I'm new here path and have your own store in under 15 seconds.
      </p>

      <div v-if="cloneMode === 'choice'" class="mt-5 grid gap-2">
        <button class="rounded-lg border border-violet-300 bg-violet-600 px-4 py-2 text-sm font-semibold text-white" @click="startNewFlow">
          I'm new here
        </button>
        <button class="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold" @click="startExistingFlow">
          I'm already on Nostr
        </button>
      </div>

      <div v-else-if="cloneMode === 'new'" class="mt-5 rounded-xl border border-violet-300/40 bg-violet-500/10 p-4">
        <label class="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Your display name</label>
        <input
          v-model="newcomerName"
          type="text"
          placeholder="Sovereign Shop Owner"
          class="mt-2 w-full rounded-lg border border-[var(--line)] bg-white/95 px-3 py-2 text-sm text-black"
        >

        <button
          class="mt-3 rounded-lg border border-violet-300 bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
          @click="generateNewcomerKeys"
        >
          Generate my keys
        </button>

        <div v-if="newcomerIdentity" class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p class="font-semibold">Important: We do not store these keys.</p>
          <p class="mt-1">If you lose them, you cannot access this site anymore. You can always create a new one.</p>
          <p class="mt-3 text-xs"><span class="font-semibold">npub:</span> <span class="font-mono break-all">{{ newcomerIdentity.npub }}</span></p>
          <p class="mt-1 text-xs"><span class="font-semibold">nsec:</span> <span class="font-mono break-all">{{ newcomerIdentity.nsec }}</span></p>

          <div class="mt-2 flex gap-2">
            <button class="rounded border border-amber-300 bg-white px-2 py-1 text-xs" @click="copyText(newcomerIdentity.npub)">Copy npub</button>
            <button class="rounded border border-amber-300 bg-white px-2 py-1 text-xs" @click="copyText(newcomerIdentity.nsec)">Copy nsec</button>
          </div>

          <label class="mt-3 flex items-center gap-2 text-xs">
            <input v-model="newcomerConfirmed" type="checkbox">
            <span>I saved these keys securely.</span>
          </label>

          <button
            class="mt-3 rounded-lg border border-violet-300 bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="newcomerBusy"
            @click="publishAndCloneForNewcomer"
          >
            {{ newcomerBusy ? 'Publishing and cloning...' : 'Publish profile and clone now' }}
          </button>

          <div v-if="newcomerBusy" class="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-300/50 bg-violet-500/20 px-3 py-1 text-xs text-violet-100">
            <img :src="NOSTR_OSTRICH_ANIM_URL" alt="" class="h-5 w-5 object-contain" aria-hidden="true">
            <span>Deploying and running on Nostr...</span>
          </div>
        </div>
      </div>

      <div v-else-if="cloneMode === 'new-success'" class="mt-5 rounded-xl border border-emerald-300/50 bg-emerald-500/10 p-4">
        <p class="font-semibold text-emerald-200">Your sovereign shop clone is live.</p>
        <p class="mt-2 text-xs text-[var(--muted)]">New npub: <span class="font-mono break-all">{{ newcomerIdentity?.npub }}</span></p>
        <p class="mt-1 text-xs text-[var(--muted)]">Published relays: {{ newcomerPublishRelays.join(', ') }}</p>
        <a
          :href="newcomerSuccessUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 inline-flex rounded-lg border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Open my new Nsite
        </a>
      </div>

      <div v-else-if="cloneMode === 'existing'" class="mt-5 rounded-xl border border-violet-300/40 bg-violet-500/10 p-4">
        <p class="text-sm text-[var(--muted)]">This path now uses the built-in clone publisher so the `muse` attribution always stays fixed to <span class="font-mono">{{ fixedMuseNpub }}</span>.</p>

        <div class="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white/60 p-1 text-xs">
          <button
            class="rounded-lg border px-2 py-2 font-medium"
            :class="existingCloneMethod === 'extension' ? 'border-violet-300 bg-violet-600 text-white' : 'border-[var(--line)] bg-white text-[var(--ink-1)]'"
            @click="existingCloneMethod = 'extension'"
          >
            Extension
          </button>
          <button
            class="rounded-lg border px-2 py-2 font-medium"
            :class="existingCloneMethod === 'bunker' ? 'border-violet-300 bg-violet-600 text-white' : 'border-[var(--line)] bg-white text-[var(--ink-1)]'"
            @click="existingCloneMethod = 'bunker'"
          >
            Bunker
          </button>
          <button
            class="rounded-lg border px-2 py-2 font-medium"
            :class="existingCloneMethod === 'nsec' ? 'border-violet-300 bg-violet-600 text-white' : 'border-[var(--line)] bg-white text-[var(--ink-1)]'"
            @click="existingCloneMethod = 'nsec'"
          >
            Nsec
          </button>
        </div>

        <div v-if="existingCloneMethod === 'extension'" class="mt-4 text-sm text-[var(--muted)]">
          Use your browser signer to publish the clone manifest.
        </div>

        <div v-else-if="existingCloneMethod === 'bunker'" class="mt-4 space-y-2">
          <input
            v-model="existingBunkerInput"
            type="text"
            placeholder="bunker://... or nostrconnect://..."
            class="w-full rounded-lg border border-[var(--line)] bg-white/95 px-3 py-2 text-sm text-black"
          >
          <p v-if="existingSignerAuthUrl" class="text-xs text-[var(--muted)] break-all">Approve signer connection: {{ existingSignerAuthUrl }}</p>
        </div>

        <div v-else class="mt-4 space-y-2">
          <input
            v-model="existingNsecInput"
            type="password"
            placeholder="nsec1..."
            class="w-full rounded-lg border border-[var(--line)] bg-white/95 px-3 py-2 text-sm text-black"
          >
        </div>

        <button
          class="mt-4 rounded-lg border border-violet-300 bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="existingCloneBusy"
          @click="publishExistingClone"
        >
          {{ existingCloneBusy ? 'Cloning with your signer...' : 'Clone this Nsite to my own Npub !' }}
        </button>

        <p v-if="existingCloneError" class="mt-2 text-xs text-red-500">{{ existingCloneError }}</p>
      </div>

      <div v-else class="mt-5 rounded-xl border border-emerald-300/50 bg-emerald-500/10 p-4">
        <p class="font-semibold text-emerald-200">Your clone was published with the fixed `muse` attribution tag intact.</p>
        <p class="mt-2 text-xs text-[var(--muted)]">Clone URL: <span class="font-mono break-all">{{ existingCloneUrl }}</span></p>
        <a
          :href="existingCloneUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 inline-flex rounded-lg border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Open my cloned Nsite
        </a>
      </div>

      <p v-if="newcomerError || existingCloneError" class="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        {{ newcomerError || existingCloneError }}
      </p>

      <div class="mt-5 flex justify-end gap-2">
        <button
          v-if="cloneMode !== 'choice'"
          class="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
          @click="cloneMode = 'choice'"
        >
          Back
        </button>
        <button class="rounded-lg border border-[var(--line)] px-4 py-2 text-sm" @click="closeModal">
          Close
        </button>
      </div>
    </div>
  </div>
</template>
