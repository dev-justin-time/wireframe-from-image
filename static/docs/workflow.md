# Floorplan 3D - Page Workflow

## Navigation Flow

### 1. Landing Page (index.html)
**Entry point for all users**
- Hero section with product overview
- Feature highlights
- Call-to-action buttons
- Navigation links to all major sections

**Navigation Options:**
- Sign Up / Log In → demo.html (Try the product)
- Features → features.html
- Pricing → pricing.html
- About Us → about.html
- Contact → contact.html
- Quick Links (footer) → Modal with all page links
- Gallery → gallery.html

---

### 2. Demo Page (demo.html)
**Interactive product demonstration**
- Split-screen: 2D blueprint editor + 3D/Panorama viewer
- Upload blueprint functionality
- Drawing tools for manual editing
- Real-time 3D preview

**User Journey:**
1. Upload a floor plan image OR
2. Start drawing from scratch
3. View in 3D or panorama mode
4. Export project

**Navigation Options:**
- Back to Home → index.html
- Help Panel (in-app)
- Upload Blueprint (modal)

---

### 3. Editor Page (Editor.html)
**Advanced blueprint editing interface**
- Professional drawing tools
- Item library (bathroom, kitchen, furniture)
- Template library
- Customization panel (textures, materials, colors)
- Dual view: Blueprint + 3D/Panorama

**User Journey:**
1. Choose template OR import blueprint OR start from scratch
2. Add/edit walls and fixtures
3. Customize materials and colors
4. Toggle between 3D and panorama views
5. Export final project

**Navigation Options:**
- Back to Home → index.html
- Import Blueprint (file upload)
- Scan Kitchen Photo (AI processing)
- Export Project (download)
- Template Library (sidebar)
- Item Categories (collapsible sidebar)

---

### 4. Features Page (features.html)
**Detailed product capabilities**
- Feature cards with icons
- Descriptions of each capability
- Call-to-action to try demo

**Navigation Options:**
- Back to Home → index.html
- Try It Now → demo.html

---

### 5. Pricing Page (pricing.html)
**Subscription tiers and pricing**
- Free, Pro, Enterprise plans
- Feature comparison
- Call-to-action buttons

**Navigation Options:**
- Back to Home → index.html
- Get Started (Free) → demo.html
- Start Free Trial (Pro) → demo.html
- Contact Sales (Enterprise) → contact.html

---

### 6. About Page (about.html)
**Company information**
- Mission statement
- Statistics
- Company values

**Navigation Options:**
- Back to Home → index.html
- Try It Now → demo.html

---

### 7. Contact Page (contact.html)
**User communication**
- Contact form
- Email, chat, help center info
- Support channels

**Navigation Options:**
- Back to Home → index.html
- Submit form (form submission)

---

### 8. Gallery Page (gallery.html)
**Project showcase**
- Sample projects
- Visual examples
- Inspiration for users

**Navigation Options:**
- Back to Home → index.html
- Project cards → demo.html (opens demo)
- Create Your Own → demo.html

---

### 9. Security Page (security.html)
**User account security**
- Linked accounts management
- Session security settings
- API authentication
- MFA setup

**Navigation Options:**
- Profile → (future implementation)
- Notifications → (future implementation)
- Billing → (future implementation)
- Settings → (future implementation)
- Log out → index.html

---

## User Flow Paths

### New User Journey
1. index.html → features.html → pricing.html → demo.html → Editor.html

### Quick Start Journey
1. index.html → demo.html (immediate trial)

### Learning Journey
1. index.html → features.html → gallery.html → demo.html

### Purchase Journey
1. index.html → pricing.html → contact.html (Enterprise) OR demo.html (Free/Pro)

### Support Journey
1. Any page → Quick Links → contact.html

---

## Technical Integration

### Cross-Page Elements
- Consistent header with logo and primary navigation
- Footer with quick links modal
- Theme toggle (dark/light mode)
- Responsive design on all pages

### State Management
- User session (demo.html, Editor.html)
- Project data (local storage / cloud sync)
- User preferences (theme, settings)

### Data Flow
1. index.html (marketing) → demo.html (trial) → Editor.html (full features)
2. All pages can access security.html for account management
3. Contact and pricing pages feed into conversion funnel

