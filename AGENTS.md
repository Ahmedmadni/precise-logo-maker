<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Share AI construction conversion through `src/ai/construction-model.ts` so preview and insertion use identical geometry.
- Keep path node operations pure and render their controls in a focused panel, preserving undo through the existing geometry update action.
- Package Android in hosted HTTPS Capacitor mode so TanStack server functions remain available; `mobile-shell` is only the required shell directory, not a standalone app bundle.
- Flush local autosave on page hide and backgrounding so mobile lifecycle transitions do not lose pending edits.
