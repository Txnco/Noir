Here are five carefully crafted, production-ready UI color palettes, all anchored in the muted blue-gray `#495a65` base. Each has been balanced for contrast, elegance, and calm modernity.
---
## 1. Slate Mist
*Clean, minimal SaaS dashboards & productivity tools*

| Role | HEX | Description |
|---|---|---|
| **Primary** | `#3D4F59` | Slightly deepened base — grounded and authoritative |
| **Secondary** | `#6B8FA3` | Airy mid-blue, great for nav bars and cards |
| **Accent** | `#7DB5C8` | Soft sky-blue, ideal for CTAs and highlights |
| **Background** | `#F5F4F0` | Warm off-white — easy on the eyes for long sessions |
| **Neutral** | `#2C3840` | Near-dark text color with readable contrast |

Works best for B2B SaaS platforms, admin dashboards, and data-heavy interfaces where calm hierarchy matters most.


@plugin "daisyui/theme" {
  name: "lofi";
  default: false;
  prefersdark: false;
  color-scheme: "light";
  --color-base-100: oklch(98% 0.003 247.858);
  --color-base-200: oklch(92% 0.006 264.531);
  --color-base-300: oklch(96% 0.007 247.896);
  --color-base-content: oklch(0% 0 0);
  --color-primary: #456981;
  --color-primary-content: oklch(100% 0 0);
  --color-secondary: #6B8FA3;
  --color-secondary-content: oklch(96% 0.003 264.542);
  --color-accent: #7DB5C8;
  --color-accent-content: oklch(29% 0.066 243.157);
  --color-neutral: #2C3840;
  --color-neutral-content: oklch(100% 0 0);
  --color-info: oklch(52% 0.105 223.128);
  --color-info-content: oklch(95% 0.026 236.824);
  --color-success: oklch(50% 0.118 165.612);
  --color-success-content: oklch(95% 0.052 163.051);
  --color-warning: oklch(76% 0.188 70.08);
  --color-warning-content: oklch(96% 0.059 95.617);
  --color-error: oklch(50% 0.213 27.518);
  --color-error-content: oklch(93% 0.032 17.717);
  --radius-selector: 1rem;
  --radius-field: 0.5rem;
  --radius-box: 1rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}

