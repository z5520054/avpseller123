## Third-party MCP and skills

Use these external tools when useful:

### Chrome DevTools MCP

Use Chrome DevTools MCP for:
- browser screenshots
- layout debugging
- performance traces
- Core Web Vitals investigation
- console/network issues
- checking real browser rendering

Use it after major frontend changes.

### Figma MCP

Use Figma MCP when the task includes a Figma file, frame, selection, design system or visual reference.

Rules:
- Preserve spacing, typography, color tokens and layout intent.
- Do not blindly copy messy auto-layout artifacts.
- Convert design into clean responsive code.
- Ask for a Figma link or selected frame only when required.

### Supabase MCP

Use Supabase MCP for:
- reading database schema
- reading docs
- checking tables
- generating TypeScript types
- understanding auth/storage/database setup

Default mode is read-only. Never write to Supabase without explicit permission.

### Stripe MCP

Use Stripe MCP for:
- reading Stripe docs
- planning payment architecture
- checking sandbox/test integration steps
- creating implementation guidance

Never perform live payment actions without explicit permission.

### Notion MCP

Use Notion MCP for:
- reading project notes
- reading product requirements
- turning Notion content into website copy
- syncing documentation context

Do not edit Notion pages unless explicitly asked.

### Magic UI MCP

Use Magic UI MCP when the UI needs:
- tasteful motion
- animated text
- bento sections
- marquee logos
- grid backgrounds
- polished landing page effects

Do not overuse effects. Motion should improve the design, not distract.

### Vercel / React / Next skills

Use installed skills when relevant:
- web-design-guidelines for UI/accessibility/UX audit
- vercel-react-best-practices for React performance
- next-best-practices for Next.js architecture

Before finishing frontend work:
- run build/lint if available
- inspect desktop/tablet/mobile
- check no horizontal scroll
- check focus states
- check semantic HTML
- check accessibility basics
- check performance issues if possible
