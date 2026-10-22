# Windbell Valley project guidance

The user has made the original Meadowbell hand-painted art direction a persistent requirement. Preserve its blue skies, cumulus clouds, warm yellow-green grass, painterly textures, and the recognizable boy and beagle. The original hillside, garden, sheep pasture, and kite hill are actual game locations. Keep the original supplied files alongside edited gameplay variants.

Read `docs/美术素材与生成记录.md` before changing world or character art. Use actual raster artwork for scenery, characters, plants and animals. UI icons, interaction hints, puzzle boards and challenge targets may be code-native. New art must be checked beside the existing scenes for palette, brushwork, lighting and character proportions.

The existing landing page remains at `dist/index.html`. The modular buildless game lives in `dist/play/`. Keep simulation in `engine.mjs`, artwork handling in `art.mjs`, persistence in `storage.mjs`, interactions in `game.js`, and challenge simulation in `minigames.mjs`.

Run `npm test` for changed rules. Verify changed game behavior in a real browser. Preserve both upstream routes, the six-action day, overnight-only plant growth, atomic resource deductions, repeat-safe rewards and save recovery. Never let cosmetic scene state become the source of truth for quests. Player saves are local; do not claim cloud synchronization.

No build step or dependency installation is required. `npm run dev` starts a loopback static server. Use the persisted Sites project ID and preserve its audience when publishing.
