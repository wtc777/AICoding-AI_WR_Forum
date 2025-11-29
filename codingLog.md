### 2025-11-29 19:05 - Align frontend proxy port
- Files: `frontend/vite.config.ts`
- Summary: Updated Vite dev proxy port to match backend uvicorn startup.
- Reason: Avoid socket hang up errors during register API calls.
- Impact: Frontend /api and /uploads requests now reach running backend.
- Scope: Dev server proxy configuration only; build output unchanged.
- Risk: Assumes backend continues to run on 127.0.0.1:8001.
- Mitigation: Adjust backend start script or proxy target together if port changes.
- Test: Not run (verify by starting frontend and registering).
- FollowUp: Validate registration flow after restarting dev server.
- Config: No environment variables were changed.
- Notes: Both API and uploads proxies now point to the same backend port.
- Compatibility: Matches current start_backend.bat uvicorn port configuration.
- TODO: Add guardrails to detect proxy/backend port mismatches automatically.

### 2025-11-29 20:13 - Card deck click placement overhaul
- Files: `frontend/src/components/CardSetBoard.tsx`, `frontend/src/components/CardSetBoard.css`
- Summary: Added two-column deck layout showing front/back sides side by side.
- Behavior: Click on either side now places the chosen card into the next empty slot and hides the row.
- Mobile: Deck rows keep two columns regardless of viewport width for consistent tapping.
- Interaction: Removed drag/drop dependency; slots remain clickable to flip between sides.
- Validation: Warns when no empty board slots are available before placing a card.
- Instructions: Updated helper copy to describe click-to-place flow and scoring bonuses.
- Styles: Introduced deck grid/row wrappers and focus states for keyboard activation.
- Styles: Switched card cursors to pointer and removed unused drag hover styling.
- Scoring: Default score text uses “未计分” phrasing to align with submit checks.
- Export: Preserved capture/export helpers and added console export button for inspection.
- Tests: Not run (frontend interaction changes; please verify in UI).
- TODO: Consider adding non-drag slot reordering for fine placement adjustments.

### 2025-11-29 20:17 - Widen deck and fit images
- Files: `frontend/src/components/CardSetBoard.css`
- Summary: Widened deck column to 320px for better card readability.
- Image: Ensured deck thumbnails keep a 2:3 aspect ratio with cover fit.
- Layout: Board/grid proportions stay unchanged for the right panel.
- UX: Reduces title clipping and avoids partially shown images.
- Risk: Slightly less space for the board on narrow screens.
- Mitigation: Column width still collapses to one column on small viewports.
- Tests: Not run (style-only change).
- TODO: Adjust image height dynamically if new assets require other ratios.

### 2025-11-29 20:23 - Deck width 400px with contained thumbnails
- Files: `frontend/src/components/CardSetBoard.css`
- Summary: Increased deck column to 400px while keeping board area intact.
- Image: Deck thumbnails now use 2:3 aspect ratio with `object-fit: contain` to avoid cropping.
- Layout: Card container uses grid to keep images centered within their ratio box.
- Mobile: Deck rows remain two columns even when wrapper collapses to single column.
- UX: Prevents clipped titles and shows full card art within fixed ratio.
- Risk: Slightly tighter space for the board on mid-size screens.
- Mitigation: Responsive collapse still active; widths adapt with available space.
- Tests: Not run (CSS-only tweak).
- TODO: Revisit slot area spacing if further width increases are requested.

### 2025-11-29 20:26 - Match deck container ratio to cards
- Files: `frontend/src/components/CardSetBoard.css`
- Summary: Deck card containers now enforce the same 2:3 aspect ratio as thumbnails.
- Image: Thumbnails stretch to full container height with `object-fit: contain` for full visibility.
- Layout: Grid items align to fill the ratio box, keeping front/back rows consistent.
- UX: Prevents any mismatch between container and image proportions.
- Risk: None expected; style-only.
- Mitigation: Falls back to existing responsive behavior if ratio unsupported.
- Tests: Not run (CSS-only change).
- TODO: Consider adding padding tweaks if future assets use different aspect ratios.

### 2025-11-29 20:31 - Correct deck ratio to match card art
- Files: `frontend/src/components/CardSetBoard.css`
- Summary: Updated deck containers and images to a 63:88 ratio to match standard card art.
- Image: Ensured thumbnails fill container height with `object-fit: contain` and proper ratio.
- Layout: Added justify stretch so images align fully within the ratio box.
- UX: Reduces letterboxing/whitespace while preserving full-card visibility.
- Risk: None expected; CSS-only refinement.
- Mitigation: Ratio can be adjusted if future assets differ.
- Tests: Not run (style-only).
- TODO: Verify visual fit against all card assets after deployment.

### 2025-11-29 20:35 - Align deck sizing with board slots
- Files: `frontend/src/components/CardSetBoard.css`
- Summary: Switched deck cards to flex with 140px min-height to mirror slot sizing feel.
- Image: Thumbnails fill available height with `object-fit: contain`, keeping full card visible.
- Layout: Removed enforced aspect-ratio to reduce excess whitespace when images differ.
- UX: Deck visuals now closer to board slot proportions, minimizing letterboxing.
- Risk: None expected; style-only adjustment.
- Mitigation: Width and contain behavior remain to avoid cropping.
- Tests: Not run (CSS-only).
- TODO: Fine-tune min-height if future assets need more headroom.

### 2025-11-29 20:38 - Restore slot drag swapping
- Files: `frontend/src/components/CardSetBoard.tsx`, `frontend/src/components/CardSetBoard.css`
- Summary: Re-enabled dragging between placed slots to swap cards after placement.
- Interaction: Slots highlight on drag-over and support drag start/end/drop for swapping.
- Behavior: Deck remains click-to-place; only placed slots are draggable.
- UX: Hover state shows drop target; swap keeps slotIndex updated for exports.
- Risk: Minimal; relies on standard HTML5 drag events.
- Mitigation: Hover reset on drag end/leave to avoid stuck highlights.
- Tests: Not run (interaction change).
- TODO: Consider keyboard-based swapping for accessibility later.

### 2025-11-29 20:40 - Touch drag swap support
- Files: `frontend/src/components/CardSetBoard.tsx`
- Summary: Added touch start/move/end handlers to swap placed cards on mobile.
- Interaction: Touch drag highlights target slot and swaps on release similar to desktop drag.
- Behavior: Uses data-slot-index detection via elementFromPoint to map touch position to slots.
- UX: Consistent drag-over highlight state for both mouse and touch.
- Risk: Potential slight scroll interference during touch drag.
- Mitigation: Stops propagation on touch start and clears hover state on end.
- Tests: Not run (touch interaction change).
- TODO: Evaluate touch gesture conflicts with page scroll on small screens.

### 2025-11-29 20:42 - Ensure parse result renders as Markdown
- Files: `frontend/src/pages/ParsePage.tsx`
- Summary: Markdown preview now keyed and defaults to a placeholder to guarantee rendered output.
- Behavior: Response text always shown via MarkdownPreview, even when empty.
- UX: Avoids raw text fallback and keeps parse results formatted.
- Risk: None expected; small render change.
- Mitigation: Light theme enforced via data-color-mode as before.
- Tests: Not run (UI rendering change).
- TODO: Add styles if further Markdown theming is needed.

### 2025-11-29 20:49 - Strip fenced Markdown wrappers from AI output
- Files: `frontend/src/pages/ParsePage.tsx`
- Summary: Added cleaner to remove outer ```/```markdown fences before displaying results.
- Behavior: Cleans response text on submit, mock fill, and when result updates.
- UX: Prevents code fences from leaking into the rendered Markdown preview.
- Risk: Low; only trims leading/trailing fences.
- Mitigation: Falls back to empty string when no content provided.
- Tests: Not run (string handling change).
- TODO: Extend cleaner if backend returns other fence formats.

### 2025-11-29 20:51 - Robust fence stripping for Markdown output
- Files: `frontend/src/pages/ParsePage.tsx`
- Summary: Enhanced cleaner to strip ```lang ... ``` wrappers and trailing fences more reliably.
- Behavior: Regex handles language-tagged fences; trims trailing blank lines and closing ticks.
- UX: Prevents leading/closing backticks from breaking Markdown render.
- Risk: Low; affects only outer fences.
- Mitigation: Falls back to original text if no fence pattern matches.
- Tests: Not run (string parsing change).
- TODO: Consider handling other fenced patterns if backend format shifts.

### 2025-11-29 20:59 - Keep 3x4 layout on mobile
- Files: `frontend/src/components/CardSetBoard.css`
- Summary: Removed mobile override that collapsed slots to 2 columns; board stays 3行4列.
- Behavior: Slot grid remains 4 columns across viewports to satisfy mobile layout requirement.
- UX: Ensures consistent visual structure between desktop and mobile.
- Risk: Possible horizontal squeeze on very narrow screens.
- Mitigation: Deck still collapses; adjust zoom if needed.
- Tests: Not run (CSS-only).
- TODO: Consider horizontal scroll or zoom aids if small devices struggle.

### 2025-11-29 21:03 - Prevent touch long-press conflicts when swapping
- Files: `frontend/src/components/CardSetBoard.tsx`, `frontend/src/components/CardSetBoard.css`
- Summary: Added preventDefault/stopPropagation on touch drag handlers to reduce long-press context triggers.
- Interaction: Touch drag still swaps slots; context menu suppressed on card elements.
- Styles: Disabled touch-action/user-select/user-drag on cards to stabilize gestures.
- UX: Lowers chance of long-press save image popping during drag on mobile.
- Risk: Minor impact on scrolling within the board area.
- Mitigation: Only applied to card elements; deck/sidebar scrolling unaffected.
- Tests: Not run (interaction/style change).
- TODO: If scroll conflicts appear, add gesture threshold or temporary drag mode toggle.

### 2025-11-29 21:08 - Swap via double-tap/double-click instead of drag
- Files: `frontend/src/components/CardSetBoard.tsx`, `frontend/src/components/CardSetBoard.css`
- Summary: Removed slot drag swapping; now double-click/tap first card then second card to swap.
- Interaction: Maintains single-click flip; double-tap detection added for mobile.
- UX: Selected slot highlighted; updated instructions to describe the new flow.
- Risk: Users accustomed to drag may need to learn the new gesture.
- Mitigation: Instructions clarify both single-click flip and double-tap swap.
- Tests: Not run (interaction change).
- TODO: Consider debounce to avoid accidental double taps when scrolling.

### 2025-11-29 21:15 - Drag handle based swapping to avoid image long-press conflicts
- Files: `frontend/src/components/CardSetBoard.tsx`, `frontend/src/components/CardSetBoard.css`
- Summary: Replaced double-tap swapping with drag handles that start pointer-based swaps; images remain free for system long-press actions.
- Interaction: Drag only from the handle (⇅); hover target highlighted via pointer tracking; click still flips sides.
- UX: Handle has enlarged touch area; instructions updated to mention handle drag.
- Risk: Users must use handle for swapping; might need guidance initially.
- Mitigation: Context menus stay available on images since drag is not bound to <img>.
- Tests: Not run (interaction/style change).
- TODO: If needed, add tooltip to drag handle for discoverability.
