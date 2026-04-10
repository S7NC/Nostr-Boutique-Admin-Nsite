# AI Agent Development Guide for Nuxtstack

This document provides comprehensive guidelines for AI agents working with the Nuxtstack project - a framework for building Nostr applications with modern web technologies.

## 🤖 Agent Overview

**Nuxtstack** is designed for AI-assisted development workflows. This guide ensures agents can effectively build, modify, and maintain Nostr applications using this framework.

## 🎯 Project Context

### Primary Goal
Build decentralized Nostr applications rapidly using Vue.js/Nuxt framework with TailwindCSS styling.

### Technology Stack
- **Framework**: Nuxt (Vue.js-based)
- **Styling**: TailwindCSS v4.1 or higher
- **State Management**: Pinia
- **Build Tool**: Vite
- **Language**: JavaScript (NO TypeScript)
- **Protocol**: Nostr (decentralized social networking protocol)
- **Animations**: GSAP
- **WebGPU effects**: Shaders

## 📋 Critical First Actions

### 🚨 First Prompt Detection
A prompt is "first" if the app name is still "Nuxtstack" (not yet renamed for specific project).

**MANDATORY steps for first prompts:**
1. ✅ Read `AGENTS.md` file completely
2. ✅ Run `npm update` or `npm install` (if there is no package-lock.json available)
3. ✅ Check all configured MCP server connections defined in `.mcp.json`
4. ✅ **Template Application**: When applying templates, integrate them directly into the existing codebase structure. Never create separate `app` directories or subdirectories for template content.
5. ✅ **Git Workflow**: If you apply a template, make sure to commit the current changes with Git on the current branch and start coding after you've created a new Git branch.
6. ✅ Summarize what you understood, and ask important questions to ensure all requirements are crystal clear before starting any code.

### 🔧 MCP Server Verification
Check these configured MCP servers:
- **js-dev**: JavaScript development tools (`@soapbox.pub/js-dev-mcp`)
- **Nostr**: Nostr protocol tools (`@nostrbook/mcp`)
- **Nuxt**: Nuxt framework tools (`https://nuxt.com/mcp`)
- **GASP**: JavaScript animation library (`bruzethegreat-gsap-master-mcp-server`)

### 📦 Package Management
Always manage packages via the CLI to ensure latest compatible versions are resolved.

```bash
npm install
npm update
```

## 📁 Project Structure Guide

```
nuxtstack/
├── components/             # Vue components
│   ├── nostr-components/   # Nostr-specific reusable components
│   └── *.vue               # General UI components
├── pages/                  # Auto-routing based on file structure
│   ├── index.vue           # Homepage (/)
│   ├── profile/            # Profile pages (/profile/*)
│   └── *.vue               # Other pages
├── layouts/                # Page layouts
│   ├── default.vue         # Default layout
│   └── *.vue               # Custom layouts
├── composables/            # Reusable Vue composition functions
├── plugins/                # Nuxt plugins
├── middleware/             # Route middleware
├── assets/                 # Static assets and global styles
│   └── tailwind.css        # TailwindCSS base styles
├── public/                 # Static files served directly
├── stores/                 # Pinia stores for state management
├── App.vue                 # Root component
├── nuxt.config.js          # Nuxt configuration
└── .mcp.json               # MCP server configuration
```

## 🛠️ Development Workflows

### Applying Nuxt Templates

**Important**: Use official Nuxt templates from <https://nuxt.com/templates> to accelerate development.

#### 🎯 Template Selection Strategy
1. **Browse templates**: Visit <https://nuxt.com/templates>
2. **Filter by category**: UI Kit, Landing, Portfolio, Blog, E-commerce, etc.
3. **Consider these factors**:
   - Design aesthetic compatibility with Nostr apps
   - Component structure (matches our needs)
   - Technology stack compatibility (Vue 3, Nuxt 4+, TailwindCSS required)
   - Responsive design quality
   - Performance characteristics

#### 🔄 Template Integration Process

**Step 1: Template Analysis**
```bash
# Clone template to temporary directory for analysis
git clone [TEMPLATE_REPO_URL] /tmp/nuxt-template-analysis
cd /tmp/nuxt-template-analysis

# Examine structure
ls -la
cat package.json
cat nuxt.config.js
```

**Step 2: Identify Integration Strategy**
Choose one of these approaches based on project state:

**A) Fresh Start (Recommended for empty projects):**
- Copy entire template structure
- Preserve our `.mcp.json` and `AGENTS.md`
- Adapt for Nostr integration

**B) Selective Integration:**
- Extract specific components/layouts
- Copy styling patterns
- Merge configurations

**C) Component Library Approach:**
- Extract reusable components only
- Maintain existing structure
- Add template components to our library

**Step 3: Template Application Commands**

**CRITICAL**: Always apply templates directly to the existing codebase structure. Never create separate `app` directories or subdirectories for template content.

**For Fresh Start Integration:**
```bash
# Backup critical files
cp .mcp.json .mcp.json.backup
cp AGENTS.md AGENTS.md.backup
cp README.md README.md.backup
cp .goosehints .goosehints.backup

# Clear existing structure (except backups and node_modules)
find . -name "*.vue" -not -path "./node_modules/*" -delete
find . -name "*.js" -not -path "./node_modules/*" -not -name "*.backup" -delete
rm -rf components pages layouts assets public stores composables plugins middleware

# Copy template files DIRECTLY to current directory (NOT to subdirectories)
cp -r /tmp/nuxt-template-analysis/* .

# Restore our critical files
cp .mcp.json.backup .mcp.json
cp AGENTS.md.backup AGENTS.md
cp README.md.backup README.md
cp .goosehints.backup .goosehints

# Update package.json name and add our dependencies
```

**For Selective Integration:**
```bash
# Copy specific directories DIRECTLY to current directory root
cp -r /tmp/nuxt-template-analysis/components ./
cp -r /tmp/nuxt-template-analysis/layouts ./
cp -r /tmp/nuxt-template-analysis/pages ./

# Merge configurations
# Compare and merge nuxt.config.js manually
# Update package.json dependencies
# IMPORTANT: Do NOT create app/ subdirectories - integrate at root level
```

**Step 4: Post-Integration Tasks**

1. **Update Dependencies**
```bash
npm install
npm update
```

2. **Merge Configurations**
- Compare template's `nuxt.config.js` with ours
- Preserve our MCP configurations
- Add useful template configurations
- Ensure TailwindCSS setup is maintained

3. **Adapt for Nostr**
- Rename app from template name to project name
- Update meta tags and SEO
- Prepare component structure for Nostr features
- Create `nostr-components` directory if not exists

4. **Test Integration**
```bash
npm run generate
```

#### 🎨 Popular Template Categories for Nostr Apps

**Landing Page Templates** (for Nostr app marketing):
- Good for: App introduction, feature showcases
- Look for: Hero sections, feature grids, testimonials

**Dashboard Templates** (for Nostr clients):
- Good for: Social feeds, user profiles, analytics
- Look for: Sidebar navigation, card layouts, data visualization

**Blog Templates** (for Nostr publishing):
- Good for: Content-focused Nostr apps
- Look for: Article layouts, author profiles, comment systems

**E-commerce Templates** (for Nostr marketplaces):
- Good for: Nostr-based marketplaces, zap shops
- Look for: Product grids, shopping carts, payment flows

#### ⚠️ Template Integration Checklist

Before applying any template:
- [ ] Template uses Vue 3 + Nuxt 3/4
- [ ] Compatible with TailwindCSS (or easily convertible)
- [ ] No conflicts with our MCP server setup
- [ ] Responsive design implemented
- [ ] Performance optimized
- [ ] License compatible with our project

After integration:
- [ ] TailwindCSS properly configured
- [ ] Components auto-import correctly
- [ ] Build process (`npm run generate`) succeeds
- [ ] MCP servers still functional
- [ ] Ready for Nostr feature integration

#### 🔧 Common Template Adaptations

**Update App Title and Meta:**
```js
// nuxt.config.js
export default defineNuxtConfig({
  app: {
    head: {
      title: 'Your Nostr App Name',
      meta: [
        { name: 'description', content: 'Your Nostr app description' }
      ]
    }
  }
})
```

**Update Color Scheme (if needed):**
```css
/* assets/css/main.css or tailwind.css */
/* Adapt template colors to match Nostr app branding */
```

### Component Development
1. **Create in `components/`**: Auto-imported, use PascalCase
2. **Nostr components**: Place in `components/nostr-components/`
3. **Styling**: Use TailwindCSS utility classes
4. **Logic**: Vue Composition API with `<script setup>`

### Page Creation
1. **File-based routing**: Create `.vue` files in `pages/`
2. **Dynamic routes**: Use `[param].vue` format
3. **Nested routes**: Create folders with `index.vue`

### State Management
1. **Use Pinia stores** in `stores/` directory

## 🌐 Nostr Integration Guidelines

### Core Nostr Concepts
- **Events**: JSON objects signed with private keys
- **Relays**: Servers that store and forward events
- **NIPs**: Nostr Implementation Possibilities (protocol specs)
- **Keys**: Public/private keypairs for identity

### Common Nostr Features to Implement
1. **User Authentication**: Key generation/import
2. **Profile Management**: Kind 0 events (metadata)
3. **Note Publishing**: Kind 1 events (text notes)
4. **Social Features**: Follows, reactions, reposts
5. **Relay Management**: Connect/disconnect from relays

### Recommended Nostr Libraries
Consider integrating these in components:
- `nostr-tools` - Low-level Nostr utilities
- `nostr-tools` - Low-level Nostr utilities
- `applesauce-core` - Preferred library to be used which can be extended with
  - `applesauce-content`
  - `applesauce-signer`
  - `applesauce-accounts`
  - `applesauce-factory`
  - `applesauce-factory`
  - `applesauce-loaders`
  - `applesauce-actions`
  - `applesauce-relays`
  - `applesauce-wallet`
  - Don't use `applesauce-factory` as this project is not the React development framework.
- `@welshman/lib` - Modern Nostr client library

Each of these libraries can be installed with `npm`. Don't install multiple of one of these libraries to avoid conflicts.

## 🎨 Styling Guidelines

### TailwindCSS Best Practices
1. **Utility-first**: Use utility classes over custom CSS
2. **Responsive design**: Use `sm:`, `md:`, `lg:` prefixes
3. **Color scheme**: Create consistent color palette
4. **Components**: Extract repeated patterns into Vue components

### Design System Suggestions
```css
/* Color Palette Example */
- Primary: purple-600, purple-700, purple-800
- Secondary: blue-500, blue-600
- Success: green-500
- Warning: yellow-500
- Error: red-500
- Gray: gray-100 to gray-900
```

## 🔄 Common Development Patterns

### 1. Creating a New Page
```vue
<!-- pages/example.vue -->
<script setup>
// Page-specific logic
const title = 'Page Title'

// SEO
useSeoMeta({
  title: title,
  description: 'Page description'
})
</script>

<template>
  <div class="container mx-auto px-4">
    <h1 class="text-3xl font-bold">{{ title }}</h1>
    <!-- Page content -->
  </div>
</template>
```

### 2. Creating a Reusable Component
```vue
<!-- components/NostrNote.vue -->
<script setup>
const props = defineProps({
  note: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <p>{{ note.content }}</p>
    <div class="text-sm text-gray-500 mt-2">
      {{ new Date(note.created_at * 1000).toLocaleString() }}
    </div>
  </div>
</template>
```

### 3. Using Pinia Store
```js
// stores/nostr.js
export const useNostrStore = defineStore('nostr', () => {
  const relays = ref([])
  const profile = ref(null)
  
  const connectToRelay = async (url) => {
    // Implementation
  }
  
  return {
    relays,
    profile,
    connectToRelay
  }
})
```

## ⚡ Performance Best Practices

1. **Lazy Loading**: Use `defineAsyncComponent` for heavy components
2. **Image Optimization**: Use Nuxt's `<NuxtImg>` component
3. **Bundle Splitting**: Leverage Nuxt's automatic code splitting
4. **Caching**: Implement proper caching strategies for Nostr data

## 🔍 Debugging Guidelines

### Development Tools
- **Vue DevTools**: For component inspection
- **Nuxt DevTools**: Built-in development panel
- **Network Tab**: Monitor Nostr relay connections
- **Console Logging**: Use `console.log` strategically

### Common Issues
1. **Hydration mismatches**: Ensure SSR/client consistency
2. **Relay connection failures**: Handle WebSocket errors gracefully
3. **Key management**: Secure private key handling
4. **Event validation**: Validate Nostr event signatures

## 📚 Learning Resources

### Nostr Protocol
- [Nostr NIPs Repository](https://github.com/nostr-protocol/nips)
- [Awesome Nostr](https://github.com/aljazceru/awesome-nostr)
- [NostrBook](https://nostrbook.dev/)
- [Nostr Event Kinds reference](https://nostr.dev/)

### Vue/Nuxt
- [Nuxt Documentation](https://nuxt.com/docs)
- [Vue Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia Documentation](https://pinia.vuejs.org/)

### GSAP
 - [GSAP documentation](https://gsap.com/docs/v3/) 

### Shaders
- [Shaders documentation](https://shaders.com/docs/guide)

## 🚀 Deployment Considerations

1. **Static Generation**: Use `npm run generate` for static hosting
2. **Server Deployment**: Use `npm run build` + `npm run preview`
3. **Environment Variables**: Configure relay URLs, API keys
4. **HTTPS Required**: Nostr relays require secure connections

## ✅ Quality Checklist

Before completing any feature:
- [ ] Components are properly typed and documented
- [ ] TailwindCSS classes are used consistently
- [ ] Nostr events are properly validated
- [ ] Error handling is implemented
- [ ] Responsive design is tested
- [ ] Accessibility standards are met
- [ ] Performance is optimized

## 🛡️ Security Guidelines

1. **Private Key Handling**: Never log or expose private keys
2. **Input Validation**: Sanitize all user inputs
3. **Relay Trust**: Validate events from external relays
4. **CORS Policies**: Configure appropriate CORS settings
5. **Content Filtering**: Implement content moderation if needed

---

**Remember**: This framework prioritizes rapid development while maintaining code quality and security. Always clarify requirements before implementation and follow Nostr protocol specifications strictly.
