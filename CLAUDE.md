# Keeping the docs current

The docs describe goback at its latest release. When a release changes what users can see or do, the pages say so.

- **Check each release.** Compare the goback version the docs describe with goback's newest tag, read the commits in between, and document what users can see or do.
- **Regenerate the CLI reference** from a goback build of that release, as the README shows. Never edit `src/content/docs/reference/cli/` by hand.
- **Build before committing.** `npm run build` must pass, and new links and anchors must resolve.
- **Write each commit message as one present-tense paragraph** saying what the pages now say.
- **Push only when the maintainer says so.** Every push to `main` publishes docs.goback.io.

# Writing the docs

Write the way a person would say it.

- **Write for experienced engineers.** Include what they need to act, and leave out what they already know.
- **Start with the plain fact.**
- **Say what goback does**, in its own terms.
- **Use plain word order**: subject, verb, object, one fact per sentence.
- **Tell readers what they can do.** How goback works inside goes in the Internals section.
- **Let the heading introduce the section**, and start the section with its content.
- **Use tables and code** where readers scan lists of fields, options or commands, and sentences everywhere else.
- **Describe.** Facts and commands carry the page.
- **Make claims a reader can check**, and name the mechanism behind them.
- **Commit only to what is decided.** Name no region, licence term or price that isn't settled.
- **Never suggest excluding files as a fix.** goback backs up everything.

Read each sentence aloud and keep it only if it sounds natural.
