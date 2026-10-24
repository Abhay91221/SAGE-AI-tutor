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

- Keep the tutor's model call in a client-importable server function, never the browser, so the AI key and teaching instructions remain private.
- Keep the abstract atom visualization procedural in a client-only R3F route, so it remains interactive without a model download dependency.
