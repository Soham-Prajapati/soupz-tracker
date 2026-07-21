# Sem V Campaign

## Open it (Mac, no server needed)
Double-click `Campaign.html` — it is a fully self-contained build.

## Rebuild after I change the plan
```
npm run build && cp dist/index.html Campaign.html && node export-json.mjs
```

## Menu bar (SwiftBar)
1. Install SwiftBar: `brew install --cask swiftbar`
2. On first launch it asks for a plugins folder — pick one.
3. Copy the plugin in:
   `cp swiftbar/campaign.15m.mjs <your-plugins-folder>/`
4. It refreshes every 15 minutes. Shows today's DSA+contest count and the next deadline.
   Click any task to open its link.

## Phone access (Vercel)
```
npx vercel        # first time: follow the login prompts
npx vercel --prod # deploy
```
Progress is stored in browser localStorage, so phone and laptop track separately.
