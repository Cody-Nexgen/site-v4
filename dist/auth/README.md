# Auth page images

Replace these files to change the login/signup carousel (no code changes needed):

| File | Used for |
|------|----------|
| `slide-1.svg` (or `.webp` / `.jpg`) | First slide |
| `slide-2.svg` | Second slide |
| `slide-3.svg` | Third slide |

1. Drop your images here (recommended: **1600×1200** or wider, landscape).
2. Update paths in `website/lib/auth-slides.ts` if you use different names or extensions.

Example:

```ts
{ src: '/auth/slide-1.webp', title: '...', subtitle: '...' },
```
